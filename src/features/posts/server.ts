import { type CollectionEntry, getCollection, render } from "astro:content";
import * as path from "node:path";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import {
	getCategoryUrl,
	getPostUrlBySlug,
	getTagUrl,
	url,
} from "@utils/url-utils";
import type { ImageMetadata } from "astro";
import { homeConfig, siteConfig } from "@/config";
import { getArticleAlbumCover } from "@/shared/content/article-cover-pool";
import { formatDateToYYYYMMDD } from "@/utils/date-utils";
import { sortPostEntries } from "./model/sort";
import { buildTagGraphData, type TagGraphData } from "./model/tag-graph";
import type {
	ArticleListPost,
	CatalogGroup,
	Category,
	PostForList,
	Tag,
} from "./model/types";

export type { CatalogGroup, Category, PostForList, Tag } from "./model/types";

let cachedPosts: CollectionEntry<"posts">[] | null = null;

async function getAllPosts(): Promise<CollectionEntry<"posts">[]> {
	if (cachedPosts) return cachedPosts;
	cachedPosts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});
	return cachedPosts;
}

async function getRawSortedPosts(): Promise<CollectionEntry<"posts">[]> {
	const allBlogPosts = await getAllPosts();

	return sortPostEntries(allBlogPosts);
}

export async function getSortedPosts(): Promise<CollectionEntry<"posts">[]> {
	const sorted = await getRawSortedPosts();

	return sorted.map((post, index) => ({
		...post,
		data: {
			...post.data,
			nextSlug: sorted[index - 1]?.id,
			nextTitle: sorted[index - 1]?.data.title,
			prevSlug: sorted[index + 1]?.id,
			prevTitle: sorted[index + 1]?.data.title,
		},
	}));
}

export async function getSortedPostsList(): Promise<PostForList[]> {
	const sortedFullPosts = await getRawSortedPosts();

	// delete post.body
	const sortedPostsList = sortedFullPosts.map((post) => ({
		id: post.id,
		data: post.data,
	}));

	return sortedPostsList;
}

export async function getTagList(): Promise<Tag[]> {
	const allBlogPosts = await getAllPosts();

	const countMap: { [key: string]: number } = {};
	allBlogPosts.forEach((post) => {
		new Set(post.data.tags.map((tag) => tag.trim()).filter(Boolean)).forEach(
			(tag) => {
				countMap[tag] = (countMap[tag] || 0) + 1;
			},
		);
	});

	// sort tags by count descending
	const keys: string[] = Object.keys(countMap).sort((a, b) => {
		return countMap[b] - countMap[a];
	});

	return keys.map((key) => ({ name: key, count: countMap[key] }));
}

export async function getTagGraphData(): Promise<TagGraphData> {
	const allBlogPosts = await getAllPosts();
	const graph = buildTagGraphData(
		allBlogPosts.map((post) => ({
			title: post.data.title,
			url: getPostUrlBySlug(post.id),
			published: post.data.published,
			tags: post.data.tags,
		})),
	);

	return {
		...graph,
		nodes: graph.nodes.map((node) => ({
			...node,
			url: getTagUrl(node.name),
		})),
	};
}

export async function getCategoryList(): Promise<Category[]> {
	const allBlogPosts = await getAllPosts();
	const count: { [key: string]: number } = {};
	allBlogPosts.forEach((post) => {
		if (!post.data.category) {
			const ucKey = i18n(I18nKey.uncategorized);
			count[ucKey] = count[ucKey] ? count[ucKey] + 1 : 1;
			return;
		}

		const categoryName =
			typeof post.data.category === "string"
				? post.data.category.trim()
				: String(post.data.category).trim();

		count[categoryName] = count[categoryName] ? count[categoryName] + 1 : 1;
	});

	const lst = Object.keys(count).sort((a, b) => {
		return (
			count[b] - count[a] || a.toLowerCase().localeCompare(b.toLowerCase())
		);
	});

	const ret: Category[] = [];
	for (const c of lst) {
		ret.push({
			name: c,
			count: count[c],
			url: getCategoryUrl(c),
		});
	}
	return ret;
}

/**
 * 获取按分类分组的全部文章，用于文章详情页左侧目录组件。
 * - 组内排序保持 getSortedPosts 原序（pinned 优先 + published 降序）
 * - 组间按该组最新文章的 published 日期降序
 * - 当前文章所在分类标记 isCurrent=true（用于 SSR 默认展开）
 */
export async function getCatalogGroups(
	currentPostId: string,
): Promise<CatalogGroup[]> {
	const sorted = await getSortedPosts();

	// 找到当前文章，确定其分类键
	const currentPost = sorted.find((p) => p.id === currentPostId);
	const currentCategoryKey =
		currentPost?.data.category?.trim() || i18n(I18nKey.uncategorized);

	// 按分类分组（保持 sorted 原序）
	const groupMap = new Map<string, PostForList[]>();
	for (const post of sorted) {
		const categoryName = post.data.category?.trim();
		const key = categoryName || i18n(I18nKey.uncategorized);
		if (!groupMap.has(key)) groupMap.set(key, []);
		groupMap.get(key)?.push({ id: post.id, data: post.data });
	}

	// 转换为数组
	const groups: CatalogGroup[] = [];
	for (const [name, posts] of groupMap) {
		groups.push({
			name,
			count: posts.length,
			posts,
			isCurrent: name === currentCategoryKey,
		});
	}

	// 组间按最新文章 published 降序（posts[0] 即最新，因 sorted 已按 published 降序）
	groups.sort((a, b) => {
		const aTime = a.posts[0]?.data.published
			? new Date(a.posts[0].data.published).getTime()
			: 0;
		const bTime = b.posts[0]?.data.published
			? new Date(b.posts[0].data.published).getTime()
			: 0;
		return bTime - aTime;
	});

	return groups;
}

type ArticleImageImportMap = Record<string, () => Promise<ImageMetadata>>;

export type PostImageImportMap = ArticleImageImportMap;

function resolveArticleListImage(
	entry: CollectionEntry<"posts">,
	ordinal: number,
) {
	const cover = getArticleAlbumCover(entry.id, ordinal);
	return {
		imageUrl: url(cover.imageUrl),
		imageApiUrls: [],
		imageReferrerPolicy: "",
		imageAttribution: cover.attribution,
	};
}

export async function getArticleListPosts(
	_imageFiles: ArticleImageImportMap,
): Promise<ArticleListPost[]> {
	const posts = await getSortedPosts();
	const dateFormatter = new Intl.DateTimeFormat(
		siteConfig.lang.replace("_", "-"),
		{ year: "numeric", month: "2-digit", day: "2-digit" },
	);

	return Promise.all(
		posts.map(async (entry, ordinal) => {
			const { remarkPluginFrontmatter } = await render(entry);
			const articleImage = resolveArticleListImage(entry, ordinal);
			const rawCategory = entry.data.category?.trim();
			const category = rawCategory || i18n(I18nKey.uncategorized);
			const tags = (entry.data.tags || [])
				.map((tag) => tag.trim())
				.filter(Boolean)
				.map((tag) => ({ name: tag, url: getTagUrl(tag) }));

			return {
				id: entry.id,
				title: entry.data.title,
				url: getPostUrlBySlug(entry.id),
				publishedIso: entry.data.published.toISOString(),
				publishedText: dateFormatter.format(entry.data.published),
				category,
				categoryUrl: getCategoryUrl(rawCategory || null),
				tags,
				description:
					entry.data.description ||
					remarkPluginFrontmatter.excerpt ||
					"暂无文章简介，点击卡片查看完整内容。",
				imageUrl: articleImage.imageUrl,
				imageApiUrls: articleImage.imageApiUrls,
				imageReferrerPolicy: articleImage.imageReferrerPolicy,
				imageAttribution: articleImage.imageAttribution,
				pinned: Boolean(entry.data.pinned),
				password: Boolean(entry.data.password),
			};
		}),
	);
}

async function resolvePostLocalImage(
	imagePath: string,
	imageFiles: PostImageImportMap,
	basePath?: string,
): Promise<string | null> {
	if (!imagePath) return null;
	const isLocal = !(
		imagePath.startsWith("/") ||
		imagePath.startsWith("http") ||
		imagePath.startsWith("https") ||
		imagePath.startsWith("data:")
	);
	if (!isLocal) return imagePath;

	const normalizedPath = basePath
		? path
				.normalize(path.join("../../", basePath, imagePath))
				.replace(/\\/g, "/")
		: path.normalize(path.join("../../", imagePath)).replace(/\\/g, "/");
	const imageFile = imageFiles[normalizedPath];
	if (!imageFile) return null;
	return (await imageFile()).src;
}

export async function getPostPagePresentation(
	entry: CollectionEntry<"posts">,
	imageFiles: PostImageImportMap,
	pageUrl: string,
	siteUrl?: URL,
) {
	const sortedPosts = await getRawSortedPosts();
	const articleOrdinal = Math.max(
		0,
		sortedPosts.findIndex((post) => post.id === entry.id),
	);
	const articleCover = getArticleAlbumCover(entry.id, articleOrdinal);
	const processedImage = url(articleCover.imageUrl);
	const apiUrls: string[] = [];
	const posterCoverUrl = processedImage;

	let posterAvatarUrl: string | null = homeConfig.avatar || null;
	if (posterAvatarUrl) {
		const resolved = await resolvePostLocalImage(posterAvatarUrl, imageFiles);
		if (resolved) posterAvatarUrl = resolved;
	}

	const canonicalBase = siteUrl ?? new URL(pageUrl).origin;
	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		headline: entry.data.title,
		description: entry.data.description || entry.data.title,
		keywords: entry.data.tags,
		image: posterCoverUrl || undefined,
		author: {
			"@type": "Person",
			name: homeConfig.name,
			url: canonicalBase,
		},
		publisher: {
			"@type": "Organization",
			name: siteConfig.title,
			logo: {
				"@type": "ImageObject",
				url: new URL("/favicon/favicon.ico", canonicalBase).href,
			},
		},
		datePublished: formatDateToYYYYMMDD(entry.data.published),
		...(entry.data.updated && {
			dateModified: formatDateToYYYYMMDD(entry.data.updated),
		}),
		mainEntityOfPage: {
			"@type": "WebPage",
			"@id": pageUrl,
		},
		inLanguage: entry.data.lang
			? entry.data.lang.replace("_", "-")
			: siteConfig.lang.replace("_", "-"),
	};

	return {
		processedImage,
		apiUrls,
		imageAttribution: articleCover.attribution,
		posterCoverUrl,
		posterAvatarUrl,
		jsonLd,
		catalogGroups: await getCatalogGroups(entry.id),
	};
}
