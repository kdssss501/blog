<script lang="ts">
/**
 * 留言板视图切换 Tabs
 * 文字标签风格，左对齐，点击切换无悬停滑动
 */
import { onMount } from "svelte";

interface Props {
	activeView: "card" | "list";
	class?: string;
}

let { activeView = $bindable("card"), class: className = "" }: Props = $props();

let tabRef = $state<HTMLDivElement | null>(null);
let cardBtnRef = $state<HTMLButtonElement | null>(null);
let listBtnRef = $state<HTMLButtonElement | null>(null);
let indicatorStyle = $state({ left: 0, width: 0, opacity: 0 });

function updateIndicatorPosition(view: "card" | "list") {
	const btnRef = view === "card" ? cardBtnRef : listBtnRef;
	if (!btnRef || !tabRef) return;

	const parentRect = tabRef.getBoundingClientRect();
	const btnRect = btnRef.getBoundingClientRect();

	indicatorStyle = {
		left: btnRect.left - parentRect.left,
		width: btnRect.width,
		opacity: 1,
	};
}

function handleViewChange(view: "card" | "list") {
	activeView = view;
	localStorage.setItem("guestbookView", view);
	updateIndicatorPosition(view);
}

onMount(() => {
	requestAnimationFrame(() => updateIndicatorPosition(activeView));
});
</script>

<div
	class="view-tabs {className}"
	bind:this={tabRef}
>
	<!-- 滑动背景指示器 -->
	<div
		class="tab-indicator"
		style="left: {indicatorStyle.left}px; width: {indicatorStyle.width}px; opacity: {indicatorStyle.opacity};"
	></div>

	<!-- 卡片视图 -->
	<button
		bind:this={cardBtnRef}
		class="tab-item {activeView === 'card' ? 'active' : ''}"
		onclick={() => handleViewChange("card")}
		aria-label="卡片视图"
	>
		<span class="tab-label">卡片</span>
	</button>

	<!-- 列表视图 -->
	<button
		bind:this={listBtnRef}
		class="tab-item {activeView === 'list' ? 'active' : ''}"
		onclick={() => handleViewChange("list")}
		aria-label="列表视图"
	>
		<span class="tab-label">列表</span>
	</button>
</div>
