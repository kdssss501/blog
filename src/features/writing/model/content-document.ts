import matter from "gray-matter";
import { normalizePostSlug } from "./post-document";

export const CONTENT_KINDS = ["post", "moment", "notebook"] as const;

export type ContentKind = (typeof CONTENT_KINDS)[number];

export interface ContentDocumentInput {
	id?: string;
	kind: ContentKind;
	title: string;
	slug: string;
	description: string;
	category: string;
	notebook: string;
	tags: string[];
	published: string;
	draft: boolean;
	cover: string;
	images: string[];
	location: string;
	device: string;
	author: string;
	body: string;
}

export interface ContentDraft extends ContentDocumentInput {
	id: string;
	updatedAt: number;
}

export interface PublishedContentSummary {
	kind: ContentKind;
	title: string;
	slug: string;
	description: string;
	category: string;
	notebook: string;
	tags: string[];
	published: string;
	cover: string;
	images: string[];
	location: string;
	device: string;
	author: string;
	updatedAt: number;
	url: string;
}

export interface PublishedContentDetail extends PublishedContentSummary {
	html: string;
}

export interface ContentValidationIssue {
	field: keyof ContentDocumentInput;
	message: string;
}

export interface ContentCollectionDefinition {
	id: ContentKind;
	label: string;
	description: string;
	vaultFolder: string;
	publishMode: "git" | "storage";
}

export const CONTENT_COLLECTIONS: readonly ContentCollectionDefinition[] = [
	{
		id: "post",
		label: "文章",
		description: "长文、教程与专题内容",
		vaultFolder: "posts",
		publishMode: "git",
	},
	{
		id: "moment",
		label: "动态",
		description: "短内容、图片和生活记录",
		vaultFolder: "moments",
		publishMode: "storage",
	},
	{
		id: "notebook",
		label: "笔记",
		description: "按笔记本归档的 Markdown 笔记",
		vaultFolder: "life/notebooks",
		publishMode: "storage",
	},
] as const;

const SAFE_ASSET_URL = /^(?:https:\/\/|\/)(?!\/)/i;

function stringValue(value: unknown, maxLength: number): string {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString().slice(0, 10);
	}
	return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function stringArray(value: unknown, maxItems = 12): string[] {
	const values = Array.isArray(value)
		? value
		: typeof value === "string"
			? value.split(/[,，\n]/)
			: [];
	return values
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim().slice(0, 2000))
		.filter(Boolean)
		.slice(0, maxItems);
}

function normalizeKind(value: unknown, fallback: ContentKind): ContentKind {
	return CONTENT_KINDS.includes(value as ContentKind)
		? (value as ContentKind)
		: fallback;
}

function extractTitle(body: string): string {
	const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
	if (heading) return heading.slice(0, 120);
	const firstLine = body
		.split("\n")
		.map((line) => line.replace(/^[-*>#\s]+/, "").trim())
		.find(Boolean);
	return (firstLine || "未命名内容").slice(0, 120);
}

export function normalizeContentDocument(
	value: Record<string, unknown>,
	fallbackKind: ContentKind = "post",
): ContentDocumentInput {
	const kind = normalizeKind(value.kind, fallbackKind);
	const body =
		typeof value.body === "string" ? value.body.slice(0, 500_000) : "";
	const title =
		stringValue(value.title ?? value.name, 120) || extractTitle(body);
	const published = stringValue(value.published ?? value.date, 32);
	const category =
		normalizePostSlug(stringValue(value.category, 48)) ||
		(kind === "post" ? "notes" : "");
	const notebook =
		stringValue(value.notebook ?? value.name, 80) ||
		(kind === "notebook" ? "随手笔记" : "");
	const cover = stringValue(value.cover ?? value.image, 2000);
	const images = stringArray(value.images, 12).filter((url) =>
		SAFE_ASSET_URL.test(url),
	);

	return {
		...(typeof value.id === "string" && value.id
			? { id: value.id.trim().slice(0, 100) }
			: {}),
		kind,
		title,
		slug: normalizePostSlug(stringValue(value.slug, 120) || title),
		description: stringValue(value.description ?? value.summary, 300),
		category,
		notebook,
		tags: stringArray(value.tags).map((tag) => tag.slice(0, 32)),
		published,
		draft: value.draft !== false,
		cover: SAFE_ASSET_URL.test(cover) ? cover : "",
		images,
		location: stringValue(value.location, 80),
		device: stringValue(value.device, 80),
		author: stringValue(value.author, 80),
		body,
	};
}

export function validateContentDocument(
	document: ContentDocumentInput,
): ContentValidationIssue[] {
	const issues: ContentValidationIssue[] = [];
	if (!document.title) issues.push({ field: "title", message: "标题不能为空" });
	if (!document.slug) issues.push({ field: "slug", message: "Slug 不能为空" });
	if (!document.published || Number.isNaN(Date.parse(document.published))) {
		issues.push({ field: "published", message: "发布日期无效" });
	}
	if (!document.body.trim()) {
		issues.push({ field: "body", message: "正文不能为空" });
	}
	if (document.kind === "post") {
		if (!document.description) {
			issues.push({ field: "description", message: "文章摘要不能为空" });
		}
		if (!document.category) {
			issues.push({ field: "category", message: "文章分类不能为空" });
		}
	}
	if (document.kind === "notebook" && !document.notebook) {
		issues.push({ field: "notebook", message: "笔记本名称不能为空" });
	}
	return issues;
}

function frontmatterFor(
	document: ContentDocumentInput,
): Record<string, unknown> {
	if (document.kind === "post") {
		return {
			title: document.title,
			published: document.published,
			description: document.description,
			category: document.category,
			tags: document.tags,
			draft: document.draft,
			...(document.cover ? { image: document.cover } : {}),
		};
	}
	if (document.kind === "moment") {
		return {
			title: document.title,
			slug: document.slug,
			published: document.published,
			tags: document.tags,
			draft: document.draft,
			...(document.author ? { author: document.author } : {}),
			...(document.images.length ? { images: document.images } : {}),
			...(document.location ? { location: document.location } : {}),
			...(document.device ? { device: document.device } : {}),
		};
	}
	return {
		title: document.title,
		slug: document.slug,
		notebook: document.notebook,
		date: document.published,
		tags: document.tags,
		draft: document.draft,
		...(document.description ? { summary: document.description } : {}),
		...(document.cover ? { cover: document.cover } : {}),
	};
}

export function serializeContentDocument(
	document: ContentDocumentInput,
): string {
	return matter.stringify(document.body.trimEnd(), frontmatterFor(document));
}

export function parseContentMarkdown(
	source: string,
	kind: ContentKind,
): ContentDocumentInput {
	const parsed = matter(source.replace(/^\uFEFF/, ""));
	return normalizeContentDocument(
		{
			...parsed.data,
			kind,
			body: parsed.content,
		},
		kind,
	);
}

export function getContentCollection(kind: ContentKind) {
	return CONTENT_COLLECTIONS.find((collection) => collection.id === kind);
}

export function getPublishedContentUrl(
	kind: ContentKind,
	slug: string,
): string {
	const query = new URLSearchParams({ kind, slug });
	return `/content/view/?${query.toString()}`;
}
