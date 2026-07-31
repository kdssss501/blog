<script lang="ts">
import Icon from "@/components/common/Icon.svelte";
import type { ChangelogEntry, ChangelogType } from "../model/types";

interface Props {
	entries: ChangelogEntry[];
}
const typeLabels: Record<ChangelogType, string> = {
	feature: "功能新增",
	improvement: "功能优化",
	fix: "问题修复",
	removal: "功能移除",
};
const typeIcons: Record<ChangelogType, string> = {
	feature: "material-symbols:rocket-launch-outline-rounded",
	improvement: "material-symbols:build-outline-rounded",
	fix: "material-symbols:bug-report-outline-rounded",
	removal: "material-symbols:delete-outline-rounded",
};
let { entries }: Props = $props();
let filter = $state<ChangelogType | "all">("all");
const visible = $derived(
	entries.filter((entry) => filter === "all" || entry.type === filter),
);
</script>

<div class="change-log" data-pagefind-body>
	<header><p>PROJECT HISTORY</p><h1 data-pagefind-meta="title">更新日志</h1><span>记录博客功能迭代、问题修复与重要变更。</span></header>
	<div class="change-log__filters" aria-label="更新类型">
		<button type="button" class:is-active={filter === "all"} onclick={() => (filter = "all")}>全部</button>
		{#each Object.entries(typeLabels) as [type, label] (type)}
			<button type="button" class:is-active={filter === type} onclick={() => (filter = type as ChangelogType)}>{label}</button>
		{/each}
	</div>
	<div class="change-log__timeline">
		{#each visible as entry (entry.id)}
			<article data-type={entry.type}>
				<div class="change-log__dot"><Icon icon={typeIcons[entry.type]} /></div>
				<div class="change-log__meta"><time datetime={entry.date}>{entry.date.slice(0, 10)} {entry.time}</time><strong>v{entry.version}</strong></div>
				<div class="change-log__entry"><span>{typeLabels[entry.type]}</span><p>{entry.description}</p></div>
			</article>
		{:else}
			<div class="change-log__empty">当前类型暂无更新记录。</div>
		{/each}
	</div>
</div>

<style>
	.change-log { display: grid; gap: 1.5rem; max-width: 50rem; margin: 0 auto; }
	header { display: grid; gap: 0.35rem; }
	header p { margin: 0; color: var(--content-meta); font: 700 0.6875rem/1.2 ui-monospace, monospace; }
	header h1 { margin: 0; color: var(--deep-text); font-size: 2rem; }
	header span { color: var(--content-meta); }
	.change-log__filters { display: flex; gap: 0.375rem; overflow-x: auto; }
	.change-log__filters button { flex: 0 0 auto; min-height: 2.25rem; padding: 0.375rem 0.75rem; border: 1px solid var(--line-divider); border-radius: 0.375rem; background: transparent; color: var(--content-meta); }
	.change-log__filters button.is-active { border-color: var(--primary); background: var(--primary); color: white; }
	.change-log__timeline { position: relative; display: grid; gap: 1rem; padding-left: 2.25rem; }
	.change-log__timeline::before { content: ""; position: absolute; top: 0.75rem; bottom: 0.75rem; left: 0.875rem; width: 1px; background: var(--line-divider); }
	article { position: relative; display: grid; gap: 0.5rem; }
	.change-log__dot { position: absolute; top: 0.2rem; left: -2.25rem; display: grid; place-items: center; width: 1.75rem; height: 1.75rem; border: 1px solid var(--line-divider); border-radius: 50%; background: var(--page-bg); color: var(--primary); }
	.change-log__meta { display: flex; align-items: center; gap: 0.75rem; }
	.change-log__meta time { color: var(--content-meta); font-size: 0.75rem; }
	.change-log__meta strong { color: var(--primary); font: 700 0.75rem/1 ui-monospace, monospace; }
	.change-log__entry { padding: 0.875rem 1rem; border: 1px solid var(--line-divider); border-left: 3px solid var(--primary); border-radius: 0.375rem; }
	.change-log__entry span { color: var(--content-meta); font-size: 0.6875rem; font-weight: 700; }
	.change-log__entry p { margin: 0.35rem 0 0; color: var(--deep-text); }
	.change-log__empty { padding: 2rem; color: var(--content-meta); text-align: center; }
	@media (max-width: 640px) { header h1 { font-size: 1.6rem; } }
</style>
