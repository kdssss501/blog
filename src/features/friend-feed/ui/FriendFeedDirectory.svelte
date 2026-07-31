<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import { createApiUrl } from "@/shared/http";
import type {
	FriendFeedEntry,
	FriendFeedResponse,
	FriendFeedSource,
} from "../model/types";

let entries = $state<FriendFeedEntry[]>([]);
let sources = $state<FriendFeedSource[]>([]);
let source = $state("all");
let loading = $state(true);
let error = $state("");
let updatedAt = $state("");
let canAdminRefresh = $state(false);
const endpoint = createApiUrl("/api/friend-feed");

const visibleEntries = $derived(
	source === "all"
		? entries
		: entries.filter((entry) => entry.sourceId === source),
);

async function load(force = false) {
	loading = true;
	error = "";
	try {
		const response = await fetch(endpoint, {
			method: force && canAdminRefresh ? "POST" : "GET",
			headers: { Accept: "application/json" },
			credentials: "same-origin",
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const payload = (await response.json()) as FriendFeedResponse;
		entries = payload.entries;
		sources = payload.sources;
		updatedAt = payload.updatedAt;
	} catch {
		error = "朋友动态暂时无法加载";
	} finally {
		loading = false;
	}
}

async function checkAdminSession() {
	try {
		const response = await fetch(createApiUrl("/api/admin/session"), {
			credentials: "same-origin",
		});
		if (!response.ok) return;
		const payload = (await response.json()) as { authenticated?: boolean };
		canAdminRefresh = payload.authenticated === true;
	} catch {
		canAdminRefresh = false;
	}
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
}

onMount(async () => {
	await checkAdminSession();
	await load();
});
</script>

<div class="friend-feed" data-pagefind-body>
	<header class="friend-feed__header">
		<div>
			<p>FRIEND CIRCLE</p>
			<h1 data-pagefind-meta="title">朋友动态</h1>
			<span>来自已授权友链订阅源的最新文章。</span>
		</div>
		<button type="button" onclick={() => load(canAdminRefresh)} disabled={loading} aria-label={canAdminRefresh ? "强制刷新朋友动态" : "刷新朋友动态"} title={canAdminRefresh ? "强制刷新朋友动态" : "刷新朋友动态"}>
			<Icon icon="material-symbols:refresh-rounded" />
		</button>
	</header>

	{#if sources.length > 1}
		<div class="friend-feed__filters" role="tablist" aria-label="友链筛选">
			<button type="button" class:is-active={source === "all"} aria-selected={source === "all"} onclick={() => (source = "all")}>全部</button>
			{#each sources as item (item.id)}
				<button type="button" class:is-active={source === item.id} aria-selected={source === item.id} onclick={() => (source = item.id)}>{item.name}</button>
			{/each}
		</div>
	{/if}

	{#if loading}
		<div class="friend-feed__status" aria-live="polite"><span class="friend-feed__loader"></span>正在整理朋友动态</div>
	{:else if error}
		<div class="friend-feed__status"><Icon icon="material-symbols:cloud-off-outline-rounded" size="2xl" /><strong>{error}</strong></div>
	{:else if visibleEntries.length === 0}
		<div class="friend-feed__status"><Icon icon="material-symbols:dynamic-feed-rounded" size="3xl" /><strong>暂无朋友动态</strong><span>已声明订阅源的友链更新会显示在这里。</span></div>
	{:else}
		<div class="friend-feed__list">
			{#each visibleEntries as entry (entry.id)}
				<article class="friend-feed-entry">
					<a class="friend-feed-entry__source" href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">
						<img src={entry.sourceAvatar} alt="" loading="lazy" decoding="async" />
						<span>{entry.sourceName}</span>
					</a>
					<a class="friend-feed-entry__title" href={entry.url} target="_blank" rel="noopener noreferrer">{entry.title}<Icon icon="material-symbols:arrow-outward-rounded" size="sm" /></a>
					{#if entry.excerpt}<p>{entry.excerpt}</p>{/if}
					<time datetime={entry.publishedAt}>{formatDate(entry.publishedAt)}</time>
				</article>
			{/each}
		</div>
	{/if}

	{#if updatedAt}<footer>更新于 {formatDate(updatedAt)}</footer>{/if}
</div>

<style>
	.friend-feed { display: grid; gap: 1.5rem; max-width: 52rem; margin: 0 auto; }
	.friend-feed__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--line-divider); }
	.friend-feed__header > div { display: grid; gap: 0.35rem; }
	.friend-feed__header p { margin: 0; color: var(--content-meta); font: 700 0.6875rem/1.2 ui-monospace, monospace; }
	.friend-feed__header h1 { margin: 0; color: var(--deep-text); font-size: 2rem; }
	.friend-feed__header span { color: var(--content-meta); }
	.friend-feed__header button { display: grid; place-items: center; width: 2.5rem; height: 2.5rem; border: 1px solid var(--line-divider); border-radius: 0.375rem; background: transparent; color: var(--content-meta); cursor: pointer; }
	.friend-feed__header button:hover { border-color: var(--primary); color: var(--primary); }
	.friend-feed__filters { display: flex; gap: 0.375rem; overflow-x: auto; }
	.friend-feed__filters button { flex: 0 0 auto; min-height: 2.25rem; padding: 0.375rem 0.75rem; border: 1px solid var(--line-divider); border-radius: 0.375rem; background: transparent; color: var(--content-meta); }
	.friend-feed__filters button.is-active { border-color: var(--primary); background: color-mix(in oklch, var(--primary) 12%, var(--card-bg)); color: var(--primary); }
	.friend-feed__list { display: grid; }
	.friend-feed-entry { display: grid; gap: 0.55rem; padding: 1rem 0; border-bottom: 1px solid var(--line-divider); }
	.friend-feed-entry:first-child { padding-top: 0; }
	.friend-feed-entry__source { display: inline-flex; align-items: center; gap: 0.5rem; width: fit-content; color: var(--content-meta); font-size: 0.75rem; text-decoration: none; }
	.friend-feed-entry__source img { width: 1.5rem; height: 1.5rem; border-radius: 50%; object-fit: cover; }
	.friend-feed-entry__title { display: inline-flex; align-items: center; gap: 0.35rem; width: fit-content; color: var(--deep-text); font-size: 1.05rem; font-weight: 700; text-decoration: none; }
	.friend-feed-entry__title:hover { color: var(--primary); }
	.friend-feed-entry p { margin: 0; color: var(--content-meta); line-height: 1.6; }
	.friend-feed-entry time, footer { color: var(--content-meta); font-size: 0.75rem; }
	.friend-feed__status { display: grid; place-items: center; gap: 0.5rem; min-height: 18rem; border: 1px dashed var(--line-divider); border-radius: 0.5rem; color: var(--content-meta); text-align: center; }
	.friend-feed__status strong { color: var(--deep-text); }
	.friend-feed__loader { width: 1.5rem; height: 1.5rem; border: 2px solid var(--line-divider); border-top-color: var(--primary); border-radius: 50%; animation: spin 700ms linear infinite; }
	footer { text-align: right; }
	@keyframes spin { to { transform: rotate(360deg); } }
	@media (max-width: 640px) { .friend-feed__header h1 { font-size: 1.6rem; } }
	@media (prefers-reduced-motion: reduce) { .friend-feed__loader { animation: none; } }
</style>
