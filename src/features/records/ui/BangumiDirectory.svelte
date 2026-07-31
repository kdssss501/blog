<script lang="ts">
import Icon from "@/components/common/Icon.svelte";
import {
	type BangumiCategory,
	type BangumiEntry,
	filterBangumiEntries,
	getBangumiStatusLabel,
} from "../model/types";

interface Props {
	title: string;
	description: string;
	entries: BangumiEntry[];
	categories: BangumiCategory[];
	emptyLabel: string;
}

const categoryLabels: Record<BangumiCategory, string> = {
	book: "书籍",
	anime: "动画",
	movie: "电影",
	tv: "剧集",
	documentary: "纪录片",
	game: "游戏",
	music: "音乐",
	real: "三次元",
};
const PAGE_SIZE = 12;

let { title, description, entries, categories, emptyLabel }: Props = $props();
let category = $state<BangumiCategory | "all">("all");
let status = $state<number | "all">("all");
let page = $state(1);
const isBooks = $derived(categories.length === 1 && categories[0] === "book");

const filtered = $derived(filterBangumiEntries(entries, category, status));
const totalPages = $derived(
	Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
);
const visibleEntries = $derived(
	filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
);

function chooseCategory(next: BangumiCategory | "all") {
	category = next;
	page = 1;
}

function chooseStatus(next: number | "all") {
	status = next;
	page = 1;
}

function changePage(next: number) {
	page = Math.max(1, Math.min(totalPages, next));
	document.querySelector(".record-directory")?.scrollIntoView({
		behavior: "smooth",
		block: "start",
	});
}
</script>

<div class="record-directory" data-pagefind-body>
	<header class="record-directory__header">
		<div class="record-directory__heading">
			<span class="record-directory__mark"><Icon icon={isBooks ? "material-symbols:local-library-outline-rounded" : "material-symbols:movie-outline-rounded"} size="xl" /></span>
			<div>
				<p>PERSONAL COLLECTION</p>
				<h1 data-pagefind-meta="title">{title}</h1>
			</div>
		</div>
		<p class="record-directory__description">{description}</p>
		<div class="record-directory__stats" aria-label="记录统计">
			<span><strong>{entries.length}</strong> 条记录</span>
			<span><strong>{entries.filter((entry) => entry.status === 3).length}</strong> 进行中</span>
			<span><strong>{entries.filter((entry) => entry.score !== undefined).length}</strong> 已评分</span>
		</div>
	</header>

	{#if entries.length > 0}
		<div class="record-directory__filters" class:is-books={isBooks}>
			<div class="record-directory__tabs" role="tablist" aria-label="内容类型">
				<button type="button" class:is-active={category === "all"} aria-selected={category === "all"} onclick={() => chooseCategory("all")}>全部</button>
				{#each categories as item (item)}
					<button type="button" class:is-active={category === item} aria-selected={category === item} onclick={() => chooseCategory(item)}>{categoryLabels[item]}</button>
				{/each}
			</div>
			<div class="record-directory__status" aria-label="进度筛选">
				<button type="button" class:is-active={status === "all"} aria-pressed={status === "all"} onclick={() => chooseStatus("all")}>全部状态</button>
				{#each [1, 2, 3, 4, 5] as item (item)}
					<button type="button" class:is-active={status === item} aria-pressed={status === item} onclick={() => chooseStatus(item)}>{getBangumiStatusLabel(category === "all" ? categories[0] ?? "anime" : category, item)}</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if visibleEntries.length > 0}
		<div class="record-directory__grid" class:is-books={isBooks}>
			{#each visibleEntries as entry (entry.id)}
				<a class="record-card" href={entry.link}>
					<div class="record-card__cover" class:has-image={Boolean(entry.image)}>
						{#if entry.image}
							<img src={entry.image} alt={`${entry.nameCn || entry.title}封面`} loading="lazy" decoding="async" />
						{:else}
							<Icon icon={entry.category === "book" ? "material-symbols:menu-book-outline-rounded" : entry.category === "game" ? "material-symbols:sports-esports-outline-rounded" : "material-symbols:movie-outline-rounded"} size="3xl" />
						{/if}
						<span>{getBangumiStatusLabel(entry.category, entry.status)}</span>
					</div>
					<div class="record-card__body">
						<h2>{entry.nameCn || entry.title}</h2>
						{#if entry.nameCn && entry.nameCn !== entry.title}<p class="record-card__original">{entry.title}</p>{/if}
						{#if entry.comment}<p class="record-card__comment">{entry.comment}</p>{/if}
						<div class="record-card__meta">
							<span>{categoryLabels[entry.category]}</span>
							{#if entry.score !== undefined}<strong>{entry.score.toFixed(1)}</strong>{/if}
						</div>
					</div>
				</a>
			{/each}
		</div>
	{:else}
		<div class="record-directory__empty">
			<Icon icon="material-symbols:inventory-2-outline-rounded" size="3xl" />
			<strong>{entries.length === 0 ? emptyLabel : "当前筛选没有记录"}</strong>
			<span>在对应内容目录添加 Markdown 或 YAML 文件后会自动显示。</span>
		</div>
	{/if}

	{#if totalPages > 1}
		<nav class="record-directory__pagination" aria-label="记录分页">
			<button type="button" disabled={page === 1} onclick={() => changePage(page - 1)} aria-label="上一页"><Icon icon="material-symbols:chevron-left-rounded" /></button>
			<span>{page} / {totalPages}</span>
			<button type="button" disabled={page === totalPages} onclick={() => changePage(page + 1)} aria-label="下一页"><Icon icon="material-symbols:chevron-right-rounded" /></button>
		</nav>
	{/if}
</div>

<style>
	.record-directory { display: grid; gap: 1.15rem; scroll-margin-top: 6rem; }
	.record-directory__header { display: grid; gap: 0.75rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--line-divider); }
	.record-directory__heading { display: flex; align-items: center; gap: 0.875rem; }
	.record-directory__heading p { margin: 0 0 0.125rem; color: var(--content-meta); font: 700 0.6875rem/1.2 ui-monospace, monospace; }
	.record-directory__heading h1 { margin: 0; color: var(--deep-text); font-size: 2rem; line-height: 1.1; }
	.record-directory__mark { display: grid; place-items: center; width: 2.5rem; height: 2.5rem; border: 1px solid color-mix(in oklch, var(--primary) 42%, var(--line-divider)); border-radius: 0.35rem; color: var(--deep-text); }
	.record-directory__description { max-width: 44rem; margin: 0; color: var(--content-meta); }
	.record-directory__stats { display: flex; flex-wrap: wrap; gap: 1rem; color: var(--content-meta); font-size: 0.8125rem; }
	.record-directory__stats strong { color: var(--deep-text); font-size: 1rem; }
	.record-directory__filters { display: grid; gap: 0.55rem; }
	.record-directory__tabs, .record-directory__status { display: flex; gap: 0.375rem; overflow-x: auto; scrollbar-width: none; }
	.record-directory__tabs button, .record-directory__status button { flex: 0 0 auto; min-height: 1.9rem; padding: 0.25rem 0.65rem; border: 1px solid var(--deep-text); border-radius: 999px; background: var(--card-bg); color: var(--deep-text); font-size:.72rem; font-weight:800; cursor: pointer; }
	.record-directory__tabs button.is-active, .record-directory__status button.is-active { border-color: var(--deep-text); background: var(--deep-text); color: var(--page-bg); }
	.record-directory__grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: .65rem; }
	.record-directory__grid.is-books { padding:.9rem .9rem 1.35rem; border:2px solid var(--deep-text); border-radius:.65rem; box-shadow:inset 0 -5px 0 color-mix(in srgb,var(--deep-text) 16%,transparent); }
	.record-card { min-width: 0; overflow: hidden; border: 1px solid var(--line-divider); border-radius: 0.3rem; color: inherit; text-decoration: none; background: var(--card-bg); transition: transform 160ms ease, border-color 160ms ease; }
	.record-card:hover { transform: translateY(-3px); border-color: var(--primary); }
	.record-card__cover { position: relative; display: grid; place-items: center; aspect-ratio: 3 / 4; overflow: hidden; background: var(--btn-regular-bg); color: var(--content-meta); }
	.record-card__cover img { width: 100%; height: 100%; object-fit: cover; transition: transform 220ms ease; }
	.record-card:hover .record-card__cover img { transform: scale(1.035); }
	.record-card__cover > span:last-child { position: absolute; top: 0.5rem; right: 0.5rem; padding: 0.1875rem 0.4375rem; border-radius: 0.25rem; background: color-mix(in oklch, var(--page-bg) 82%, transparent); backdrop-filter: blur(8px); color: var(--deep-text); font-size: 0.6875rem; font-weight: 700; }
	.record-card__body { display: grid; gap: 0.25rem; padding: 0.45rem; }
	.record-card__body h2 { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--deep-text); font-size: 0.75rem; }
	.record-card__original, .record-card__comment { margin: 0; color: var(--content-meta); font-size: 0.62rem; }
	.record-card__original { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.record-card__comment { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-height: 1.5; }
	.record-card__meta { display: flex; align-items: center; justify-content: space-between; color: var(--content-meta); font-size: 0.62rem; }
	.record-card__meta strong { color: var(--primary); }
	.record-directory__empty { display: grid; place-items: center; gap: 0.5rem; min-height: 17rem; border: 1px dashed var(--line-divider); border-radius: 0.5rem; color: var(--content-meta); text-align: center; }
	.record-directory__empty strong { color: var(--deep-text); }
	.record-directory__pagination { display: flex; align-items: center; justify-content: center; gap: 0.75rem; }
	.record-directory__pagination button { display: grid; place-items: center; width: 2.5rem; height: 2.5rem; border: 1px solid var(--line-divider); border-radius: 0.375rem; background: transparent; color: var(--deep-text); }
	@media (max-width: 1100px) { .record-directory__grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
	@media (max-width: 640px) { .record-directory__heading h1 { font-size: 1.6rem; } .record-directory__grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; } .record-directory__stats { gap: 0.625rem; } .record-card__comment { display:none; } }
	@media (prefers-reduced-motion: reduce) { .record-card, .record-card__cover img { transition: none; } }
</style>
