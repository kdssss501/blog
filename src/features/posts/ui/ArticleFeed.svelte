<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import type { PostLayoutMode } from "@/features/settings";
import {
	getPostLayout,
	POST_LAYOUT_CHANGE_EVENT,
	setPostLayout,
} from "@/features/settings/client";
import type { ArticleListPost } from "../model/types";

interface Props {
	posts: ArticleListPost[];
	postsPerPage?: number;
	defaultLayout?: PostLayoutMode;
	allowLayoutSwitch?: boolean;
}

const DESKTOP_BREAKPOINT = 1200;

let {
	posts,
	postsPerPage = 10,
	defaultLayout = "grid",
	allowLayoutSwitch = true,
}: Props = $props();
let currentPage = $state(1);
let layout = $state<PostLayoutMode>("grid");
let pageSize = $state(postsPerPage);
let layoutSwitchAllowed = $state(allowLayoutSwitch);
let mounted = $state(false);
let isDesktop = $state(false);
let feedElement = $state<HTMLElement | null>(null);

const totalPages = $derived(Math.max(1, Math.ceil(posts.length / pageSize)));
const visiblePosts = $derived(
	posts.slice((currentPage - 1) * pageSize, currentPage * pageSize),
);
const pageNumbers = $derived(createPageNumbers(currentPage, totalPages));
const effectiveLayout = $derived(isDesktop ? layout : "list");

onMount(() => {
	mounted = true;
	const storedPreferences = localStorage.getItem("blog:display-preferences:v2");
	layout =
		storedPreferences || localStorage.getItem("postListLayout")
			? getPostLayout()
			: defaultLayout;

	const media = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
	const syncViewport = () => {
		isDesktop = media.matches;
	};
	syncViewport();
	const syncLayout = () => {
		layout = getPostLayout();
	};
	const syncPublicConfig = (event: Event) => {
		const detail = (
			event as CustomEvent<{
				config?: {
					postsPerPage?: number;
					allowPostLayoutSwitch?: boolean;
				};
			}>
		).detail;
		const configuredPageSize = Number(detail?.config?.postsPerPage);
		if (Number.isFinite(configuredPageSize)) {
			pageSize = Math.max(1, Math.min(50, Math.round(configuredPageSize)));
			currentPage = Math.min(currentPage, totalPages);
		}
		if (typeof detail?.config?.allowPostLayoutSwitch === "boolean") {
			layoutSwitchAllowed = detail.config.allowPostLayoutSwitch;
		}
	};
	media.addEventListener("change", syncViewport);
	window.addEventListener(POST_LAYOUT_CHANGE_EVENT, syncLayout);
	window.addEventListener("site-config:loaded", syncPublicConfig);
	return () => {
		media.removeEventListener("change", syncViewport);
		window.removeEventListener(POST_LAYOUT_CHANGE_EVENT, syncLayout);
		window.removeEventListener("site-config:loaded", syncPublicConfig);
	};
});

function createPageNumbers(
	current: number,
	total: number,
): (number | "ellipsis")[] {
	if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
	const result: (number | "ellipsis")[] = [1];
	const start = Math.max(2, current - 2);
	const end = Math.min(total - 1, current + 2);
	if (start > 2) result.push("ellipsis");
	for (let page = start; page <= end; page += 1) result.push(page);
	if (end < total - 1) result.push("ellipsis");
	result.push(total);
	return result;
}

function switchLayout() {
	if (!isDesktop || !layoutSwitchAllowed) return;
	layout = layout === "grid" ? "list" : "grid";
	setPostLayout(layout);
}

function goToPage(page: number) {
	currentPage = Math.max(1, Math.min(totalPages, page));
	feedElement?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleImageError(event: Event, fallbacks: string[]) {
	const image = event.currentTarget as HTMLImageElement;
	const nextIndex = Number(image.dataset.apiIndex ?? "-1") + 1;
	if (nextIndex < fallbacks.length) {
		image.dataset.apiIndex = String(nextIndex);
		image.src = fallbacks[nextIndex];
		return;
	}
	image.closest(".article-feed-card")?.classList.add("has-no-image");
	image.remove();
}
</script>

{#if posts.length === 0}
	<div class="article-list-empty">
		<Icon icon="material-symbols:article-outline-rounded" size="3xl" />
		<strong>暂无文章</strong>
		<span>新的内容会显示在这里。</span>
	</div>
{:else}
	<div class="article-list-toolbar">
		<button
			type="button"
			class="article-layout-switch"
			class:is-switching={!mounted}
			disabled={!mounted || !isDesktop || !layoutSwitchAllowed}
			aria-label={effectiveLayout === "grid" ? "切换为文章列表" : "切换为卡片网格"}
			aria-pressed={effectiveLayout === "grid"}
			title={!layoutSwitchAllowed ? "站点已固定文章布局" : isDesktop ? "切换文章布局" : "移动端固定使用列表布局"}
			onclick={switchLayout}
		>
			<Icon icon="mdi:skull-outline" size="2xl" />
			<span class="article-layout-switch__state" aria-hidden="true">
				{effectiveLayout === "grid" ? "GRID" : "LIST"}
			</span>
		</button>

		<div class="article-list-toolbar__actions">
			<a href="/categories/">
				<Icon icon="material-symbols:folder-outline-rounded" />
				<span>分类</span>
			</a>
			<a href="/archive/">
				<Icon icon="material-symbols:archive-outline-rounded" />
				<span>归档</span>
			</a>
		</div>
	</div>

	<div
		class="article-feed"
		class:is-grid={effectiveLayout === "grid"}
		class:is-list={effectiveLayout === "list"}
		bind:this={feedElement}
		aria-label="文章列表"
		data-layout={effectiveLayout}
	>
		{#each visiblePosts as post (post.id)}
			<article class="article-feed-card" class:has-no-image={!post.imageUrl}>
				{#if post.imageUrl}
					<a class="article-feed-card__media" href={post.url} tabindex="-1" aria-hidden="true">
						<img
							src={post.imageUrl}
							alt=""
							loading="lazy"
							decoding="async"
							data-api-index="-1"
							referrerpolicy={post.imageReferrerPolicy || undefined}
							onerror={(event) => handleImageError(event, post.imageApiUrls)}
						/>
					</a>
				{:else}
					<a
						class="article-feed-card__media article-feed-card__media--placeholder"
						href={post.url}
						tabindex="-1"
						aria-hidden="true"
					></a>
				{/if}

				<div class="article-feed-card__content">
					<a class="article-feed-card__title" href={post.url}>
						{#if post.pinned}<span class="article-feed-card__pinned">置顶</span>{/if}
						<span>{post.title}</span>
						{#if post.password}<Icon icon="material-symbols:lock-outline" />{/if}
					</a>

					<div class="article-feed-card__date">
						<Icon icon="material-symbols:calendar-month-outline-rounded" />
						<time datetime={post.publishedIso}>{post.publishedText}</time>
					</div>

					<p>{post.description}</p>

					<div class="article-feed-card__meta">
						<a class="article-feed-card__category" href={post.categoryUrl}>#{post.category}</a>
						{#each post.tags.slice(0, 3) as tag (tag.name)}
							<a class="article-feed-card__tag" href={tag.url}>{tag.name}</a>
						{/each}
						{#if post.tags.length > 3}
							<span class="article-feed-card__more">+{post.tags.length - 3}</span>
						{/if}
					</div>
				</div>
			</article>
		{/each}
	</div>

	{#if totalPages > 1}
		<nav class="article-list-pagination" aria-label="文章分页">
			<button
				type="button"
				class="article-list-pagination__btn"
				disabled={currentPage === 1}
				aria-label="上一页"
				onclick={() => goToPage(currentPage - 1)}
			>
				<Icon icon="material-symbols:chevron-left-rounded" />
			</button>
			<div class="article-list-pagination__pages">
				{#each pageNumbers as item, index (`${item}-${index}`)}
					{#if item === "ellipsis"}
						<span class="article-list-pagination__dots">...</span>
					{:else}
						<button
							type="button"
							class="article-list-pagination__page"
							class:is-active={item === currentPage}
							aria-current={item === currentPage ? "page" : undefined}
							onclick={() => goToPage(item)}
						>
							{item}
						</button>
					{/if}
				{/each}
			</div>
			<button
				type="button"
				class="article-list-pagination__btn"
				disabled={currentPage === totalPages}
				aria-label="下一页"
				onclick={() => goToPage(currentPage + 1)}
			>
				<Icon icon="material-symbols:chevron-right-rounded" />
			</button>
		</nav>
	{/if}
{/if}
