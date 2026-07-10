<script lang="ts">
/**
 * 骷髅开关组件 - 用于切换列表/网格布局
 * 基于 Uiverse.io by ashif_6672 的原型改造
 * 注意：Swup 兼容，通过 astro:page-load 事件重新初始化 checkbox 状态
 */
interface Props {
	activeTab: "list" | "grid";
	class?: string;
}

let { activeTab = $bindable("list"), class: className = "" }: Props = $props();

let checkboxRef = $state<HTMLInputElement | null>(null);

function syncCheckbox() {
	if (checkboxRef) {
		checkboxRef.checked = activeTab === "grid";
	}
}

function handleChange() {
	const newLayout = checkboxRef?.checked ? "grid" : "list";
	activeTab = newLayout;
	localStorage.setItem("postListLayout", newLayout);
	window.dispatchEvent(
		new CustomEvent("layoutChange", { detail: { layout: newLayout } }),
	);
}

function initFromStorage() {
	const saved = localStorage.getItem("postListLayout");
	if (saved === "list" || saved === "grid") {
		activeTab = saved;
	}
	syncCheckbox();
}

// 初始化 + Swup 页面切换后重新初始化
$effect(() => {
	initFromStorage();
	if (typeof document === "undefined") return;
	document.addEventListener("astro:page-load", initFromStorage);
	return () => {
		document.removeEventListener("astro:page-load", initFromStorage);
	};
});
</script>

<label class="skull-switch {className}" aria-label="切换文章卡片/列表视图" title="切换文章卡片/列表视图">
	<input
		bind:this={checkboxRef}
		type="checkbox"
		checked={activeTab === "grid"}
		onchange={handleChange}
	/>
	<span class="thumb">
		<span class="cranium"></span>
		<span class="mouth"></span>
	</span>
	<span class="arm-wrapper">
		<span class="arm">
			<span class="bone"></span>
			<span class="bone"></span>
			<span class="hand">
				<span class="bone"></span>
				<span class="bone"></span>
				<span class="bone"></span>
				<span class="bone"></span>
			</span>
			<span class="big"></span>
		</span>
	</span>
</label>

