<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import {
	ACTIVITY_CACHE_TTL,
	ACTIVITY_LIST_CACHE_VERSION,
	getActivityCacheKey,
} from "../data/activity-client";
import {
	type ActivityListResponse,
	fetchActivities,
} from "../data/activity-public-api";
import type { NormalizedActivity } from "../model/activity-content";
import { mergeMomentActivities } from "../model/moments";

interface Props {
	author: string;
	avatarUrl: string;
	initialItems?: NormalizedActivity[];
}

const PAGE_SIZE = 10;

let { author, avatarUrl, initialItems = [] }: Props = $props();
let userItems = $state<NormalizedActivity[]>(initialItems);
let loading = $state(true);
let failed = $state(false);
let currentPage = $state(1);
let feedElement = $state<HTMLElement | null>(null);

const items = $derived(userItems);
const totalPages = $derived(Math.max(1, Math.ceil(items.length / PAGE_SIZE)));
const visibleItems = $derived(
	items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
);

onMount(() => {
	void loadMoments(false);
});

async function loadMoments(forceRefresh: boolean) {
	loading = true;
	failed = false;
	const cached = forceRefresh ? null : readCache();
	if (cached) {
		userItems = mergeMomentActivities(cached.items, initialItems);
		loading = false;
	}

	try {
		const response = await fetchActivities();
		userItems = mergeMomentActivities(response.items, initialItems);
		writeCache(response);
	} catch {
		if (!cached && initialItems.length === 0) failed = true;
	} finally {
		loading = false;
	}
}

function goToPage(page: number) {
	currentPage = Math.max(1, Math.min(totalPages, page));
	feedElement?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatRelativeTime(timestamp: number) {
	const difference = Date.now() - timestamp;
	const minutes = Math.floor(difference / 60_000);
	const hours = Math.floor(difference / 3_600_000);
	const days = Math.floor(difference / 86_400_000);
	if (minutes < 1) return "刚刚";
	if (minutes < 60) return `${minutes}分钟前`;
	if (hours < 24) return `${hours}小时前`;
	if (days < 30) return `${days}天前`;
	return new Intl.DateTimeFormat("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date(timestamp));
}

function imageGridClass(imageCount: number) {
	if (imageCount === 1) return "is-single";
	if (imageCount === 2 || imageCount === 4) return "has-two-columns";
	return "has-three-columns";
}

function hideBrokenImage(event: Event) {
	const image = event.currentTarget as HTMLImageElement;
	image.closest<HTMLElement>(".moment-image")?.setAttribute("hidden", "");
}

function readCache(): ActivityListResponse | null {
	try {
		const key = getActivityCacheKey(ACTIVITY_LIST_CACHE_VERSION, "list");
		const raw = sessionStorage.getItem(key);
		if (!raw) return null;
		const cached = JSON.parse(raw) as {
			data: ActivityListResponse;
			timestamp: number;
		};
		if (
			Date.now() - cached.timestamp < ACTIVITY_CACHE_TTL &&
			Array.isArray(cached.data?.items)
		) {
			return cached.data;
		}
		sessionStorage.removeItem(key);
	} catch {
		// 缓存不可用时直接请求 API。
	}
	return null;
}

function writeCache(data: ActivityListResponse) {
	try {
		const key = getActivityCacheKey(ACTIVITY_LIST_CACHE_VERSION, "list");
		sessionStorage.setItem(
			key,
			JSON.stringify({ data, timestamp: Date.now() }),
		);
	} catch {
		// 缓存只用于减少重复请求。
	}
}
</script>

{#if loading && items.length === 0}
	<div class="moments-state" role="status">
		<span class="moments-state__dot"></span>
		<span>正在加载动态...</span>
	</div>
{:else if items.length === 0}
	<div class="moments-state">
		<Icon icon="material-symbols:sentiment-neutral-outline-rounded" size="2xl" />
		<strong>还没有发布任何动态</strong>
		<span>新的生活记录会显示在这里。</span>
	</div>
{:else}
	{#if failed}
		<div class="moments-notice" role="status">
			<Icon icon="material-symbols:cloud-off-outline-rounded" />
			<span>动态暂时无法加载，请稍后重试。</span>
			<button type="button" onclick={() => loadMoments(true)}>重试</button>
		</div>
	{/if}
	<div class="moments-feed" bind:this={feedElement}>
		{#each visibleItems as item, itemIndex (item.id)}
			<article class="moment-card" class:is-pinned={currentPage === 1 && itemIndex === 0} id={item.slug}>
				<header class="moment-card__header">
					<img class="moment-card__avatar" src={item.avatar || avatarUrl} alt="" width="40" height="40" />
					<div class="moment-card__author">
						<strong>{item.author || author}</strong>
						<div>
							<time datetime={new Date(item.createdAt).toISOString()} title={item.overview.updatedLabel}>
								{formatRelativeTime(item.createdAt)}
							</time>
							{#if item.location}<span>·</span><span class="moment-card__location"><Icon icon="material-symbols:location-on-outline-rounded" />{item.location}</span>{/if}
							{#if item.device}<span>·</span><span>{item.device}</span>{/if}
						</div>
					</div>
				</header>

				<div class="moment-card__copy">
					<div class="moment-markdown">{@html item.html}</div>
				</div>

				{#if item.images.length > 0}
					<div class={`moment-card__images ${imageGridClass(item.images.length)}`}>
						{#each item.images.slice(0, 9) as image, index (`${image.url}-${index}`)}
							<a class="moment-image" href={image.url} target="_blank" rel="noopener noreferrer">
								<img
									src={image.url}
									alt={image.alt || `${item.title} 配图 ${index + 1}`}
									loading="lazy"
									decoding="async"
									onerror={hideBrokenImage}
								/>
								{#if index === 8 && item.images.length > 9}
									<span class="moment-image__more">+{item.images.length - 9}</span>
								{/if}
							</a>
						{/each}
					</div>
				{/if}

				<footer class="moment-card__footer">
					{#each item.tags as tag (tag)}<a href={`/categories/?tag=${encodeURIComponent(tag)}`}>#{tag}</a>{/each}
					<a class="moment-card__comment" href="/life/guestbook/"><Icon icon="material-symbols:chat-bubble-outline-rounded" />评论</a>
				</footer>
			</article>
		{/each}
	</div>

	{#if totalPages > 1}
		<nav class="moments-pagination" aria-label="动态分页">
			<button type="button" disabled={currentPage === 1} onclick={() => goToPage(currentPage - 1)}>
				<Icon icon="material-symbols:chevron-left-rounded" />
				<span>上一页</span>
			</button>
			<p>第 <strong>{currentPage}</strong> / {totalPages} 页</p>
			<button type="button" disabled={currentPage === totalPages} onclick={() => goToPage(currentPage + 1)}>
				<span>下一页</span>
				<Icon icon="material-symbols:chevron-right-rounded" />
			</button>
		</nav>
	{/if}
{/if}
