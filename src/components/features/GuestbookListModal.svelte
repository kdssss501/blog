<script lang="ts">
/**
 * 留言板列表弹窗
 * - 复用 GuestbookDataProvider 的共享缓存
 * - 虚拟列表 + 内部滚动 + 懒加载
 * - 支持展开/折叠、投票
 * - 居中弹窗，移动端全屏
 */
import { onDestroy, onMount, tick } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import type { GuestbookMessage } from "@/types/guestbook";
import { voteGuestbookMessage } from "@/utils/guestbook-api";

// ===== Props =====
interface Props {
	open?: boolean;
	onclose?: () => void;
}

let { open = false, onclose }: Props = $props();

// ===== 状态 =====
let allMessages = $state<GuestbookMessage[]>([]);
let containerRef = $state<HTMLDivElement | null>(null);
let scrollTop = $state(0);
let viewportHeight = $state(0);
let expandedId = $state<string | null>(null);
let expandedHeights = $state<Record<string, number>>({});
let itemRefs = $state<Record<string, HTMLDivElement>>({});
let isVoting = $state<Record<string, boolean>>({});
let hasMore = $state(true);
let isLoading = $state(false);
let totalMessages = $state(0);
let dialogRef = $state<HTMLDialogElement | null>(null);

// 已投票记录
let votedMessages = $state<Record<string, "agree" | "disagree" | "neutral">>(
	{},
);

// 动画中高度
let animatingHeights = $state<Record<string, number>>({});

// 虚拟列表配置
const ITEM_HEIGHT = 72;
const BUFFER_COUNT = 5;
const EXPANDED_EXTRA_HEIGHT = 160;

// 展开/折叠动效状态
let transitioningId = $state<string | null>(null);

// ===== 获取列表项当前高度 =====
function getItemHeight(msg: GuestbookMessage): number {
	const animHeight = animatingHeights[msg.id];
	if (animHeight !== undefined) {
		return ITEM_HEIGHT + animHeight;
	}
	if (expandedId === msg.id) {
		return ITEM_HEIGHT + (expandedHeights[msg.id] || EXPANDED_EXTRA_HEIGHT);
	}
	return ITEM_HEIGHT;
}

// ===== 计算虚拟列表范围 =====
let totalHeight = $derived(
	allMessages.reduce((sum, msg) => sum + getItemHeight(msg), 0),
);

let visibleRange = $derived.by(() => {
	if (!containerRef) return { start: 0, end: allMessages.length };

	let accumulated = 0;
	let startIdx = 0;
	let endIdx = allMessages.length;

	for (let i = 0; i < allMessages.length; i++) {
		const h = getItemHeight(allMessages[i]);
		if (accumulated + h > scrollTop) {
			startIdx = i;
			break;
		}
		accumulated += h;
	}

	let visibleAccumulated = 0;
	for (let i = startIdx; i < allMessages.length; i++) {
		const h = getItemHeight(allMessages[i]);
		visibleAccumulated += h;
		if (visibleAccumulated >= viewportHeight) {
			endIdx = i + 1;
			break;
		}
	}

	return {
		start: Math.max(0, startIdx - BUFFER_COUNT),
		end: Math.min(allMessages.length, endIdx + BUFFER_COUNT),
	};
});

// ===== 计算每个项目的偏移量 =====
function getItemOffset(index: number): number {
	let offset = 0;
	for (let i = 0; i < index; i++) {
		offset += getItemHeight(allMessages[i]);
	}
	return offset;
}

// ===== 内部滚动处理 =====
function handleScroll() {
	if (!containerRef) return;
	scrollTop = containerRef.scrollTop;
	checkLoadMore();
}

function handleResize() {
	if (!containerRef) return;
	viewportHeight = containerRef.clientHeight;
}

// ===== 平滑动画高度 =====
function animateHeight(
	msgId: string,
	fromHeight: number,
	toHeight: number,
	duration: number,
	onComplete?: () => void,
) {
	const startTime = performance.now();

	function step(currentTime: number) {
		const elapsed = currentTime - startTime;
		const progress = Math.min(elapsed / duration, 1);
		const eased = 1 - (1 - progress) ** 3;
		const currentHeight = fromHeight + (toHeight - fromHeight) * eased;

		animatingHeights[msgId] = currentHeight;

		if (progress < 1) {
			requestAnimationFrame(step);
		} else {
			delete animatingHeights[msgId];
			onComplete?.();
		}
	}

	requestAnimationFrame(step);
}

// ===== 展开/折叠 =====
async function toggleExpand(msg: GuestbookMessage) {
	if (transitioningId) return;

	const isExpanding = expandedId !== msg.id;

	if (isExpanding) {
		transitioningId = msg.id;
		expandedId = msg.id;
		await tick();

		const el = itemRefs[msg.id];
		if (el) {
			const contentEl = el.querySelector(".expand-content") as HTMLElement;
			if (contentEl) {
				contentEl.style.maxHeight = "none";
				const actualHeight = contentEl.scrollHeight;
				expandedHeights[msg.id] = actualHeight;
				animateHeight(msg.id, 0, actualHeight, 350, () => {
					transitioningId = null;
				});
			}
		} else {
			transitioningId = null;
		}
	} else {
		transitioningId = msg.id;
		const currentHeight = expandedHeights[msg.id] || EXPANDED_EXTRA_HEIGHT;
		animateHeight(msg.id, currentHeight, 0, 350, () => {
			expandedId = null;
			delete expandedHeights[msg.id];
			transitioningId = null;
		});
	}
}

// ===== 投票 =====
async function handleVote(
	msgId: string,
	type: "agree" | "disagree" | "neutral",
	e: Event,
) {
	e.stopPropagation();
	if (isVoting[msgId]) return;
	if (votedMessages[msgId]) {
		alert("您已经投过票了！");
		return;
	}

	isVoting[msgId] = true;
	try {
		const updated = await voteGuestbookMessage(msgId, type);
		window.dispatchEvent(
			new CustomEvent("guestbook:message-updated", { detail: updated }),
		);
		votedMessages[msgId] = type;
		const votedData = JSON.parse(
			localStorage.getItem("guestbookVoted") || "{}",
		);
		votedData[msgId] = type;
		localStorage.setItem("guestbookVoted", JSON.stringify(votedData));
	} catch (err) {
		console.error("Failed to vote:", err);
	} finally {
		isVoting[msgId] = false;
	}
}

function hasVoted(msgId: string): boolean {
	return !!votedMessages[msgId];
}

function getVotedType(msgId: string): "agree" | "disagree" | "neutral" | null {
	return votedMessages[msgId] || null;
}

function checkLoadMore() {
	if (!hasMore || isLoading || !containerRef) return;
	const scrollBottom = containerRef.scrollTop + containerRef.clientHeight;
	const scrollHeight = containerRef.scrollHeight;
	if (scrollBottom >= scrollHeight - 200) {
		isLoading = true;
		window.dispatchEvent(new CustomEvent("guestbook:load-more"));
	}
}

// ===== 打开/关闭弹窗 =====
function handleOpen() {
	if (!dialogRef) return;

	expandedId = null;
	expandedHeights = {};
	animatingHeights = {};
	transitioningId = null;
	scrollTop = 0;
	if (containerRef) containerRef.scrollTop = 0;

	dialogRef.showModal();
	// 恢复已投票记录
	try {
		const votedData = JSON.parse(
			localStorage.getItem("guestbookVoted") || "{}",
		);
		votedMessages = votedData;
	} catch {
		votedMessages = {};
	}
	// 初始化尺寸并加载数据
	requestAnimationFrame(() => {
		if (containerRef) {
			viewportHeight = containerRef.clientHeight;
		}
		window.dispatchEvent(new CustomEvent("guestbook:request-data"));
	});
}

function handleDataUpdate(e: CustomEvent) {
	const detail = e.detail;
	if (!detail?.messages) return;
	allMessages = detail.messages;
	totalMessages = detail.total || 0;
	hasMore = detail.hasMore ?? true;
	isLoading = detail.isLoading ?? false;
}

function handleClose() {
	if (!dialogRef) return;
	dialogRef.close();
	onclose?.();
}

function handleBackdropClick(e: MouseEvent) {
	const target = e.target as HTMLElement | null;
	if (target === dialogRef || target?.classList.contains("gb-list-overlay")) {
		handleClose();
	}
}

function handleKeyDown(e: KeyboardEvent) {
	if (e.key === "Escape") {
		handleClose();
	}
}

// ===== 监听打开事件 =====
function handleOpenEvent() {
	handleOpen();
}

onMount(() => {
	window.addEventListener("guestbook:open-list", handleOpenEvent);
	window.addEventListener(
		"guestbook:data-update",
		handleDataUpdate as EventListener,
	);
	window.dispatchEvent(new CustomEvent("guestbook:request-data"));
});

onDestroy(() => {
	window.removeEventListener("guestbook:open-list", handleOpenEvent);
	window.removeEventListener(
		"guestbook:data-update",
		handleDataUpdate as EventListener,
	);
});

// ===== 计算当前可见消息 =====
let visibleMessages = $derived.by(() => {
	const range = visibleRange;
	return allMessages.slice(range.start, range.end).map((msg, idx) => ({
		...msg,
		_virtualIndex: range.start + idx,
	}));
});
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialogRef}
	class="gb-list-modal"
	onclick={handleBackdropClick}
	onkeydown={handleKeyDown}
>
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="gb-list-overlay" onclick={handleBackdropClick}></div>
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="gb-list-panel" onclick={(e) => e.stopPropagation()}>
		<!-- 四角装饰 -->
		<div class="corner-mark top-left"></div>
		<div class="corner-mark top-right"></div>
		<div class="corner-mark bottom-left"></div>
		<div class="corner-mark bottom-right"></div>

		<!-- 头部 -->
		<div class="list-modal-header">
			<div class="header-bg"></div>
			<div class="header-content">
				<div class="author-info">
					<div class="author-avatar"></div>
					<div class="author-name">留言列表</div>
				</div>
				<div class="header-meta">
					<span class="header-tag">TOTAL {totalMessages}</span>
					<button class="gb-btn-close" onclick={handleClose} aria-label="关闭">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
					</button>
				</div>
			</div>
		</div>

		<!-- 列表内容区 -->
		<div
			class="list-modal-body"
			bind:this={containerRef}
			onscroll={handleScroll}
		>
			<div class="list-spacer" style="height: {totalHeight}px;">
				{#each visibleMessages as msg (msg.id)}
					{@const offset = getItemOffset(msg._virtualIndex)}
					{@const isExpanded = expandedId === msg.id}
					{@const isAnimating = msg.id in animatingHeights}
					{@const showContent = isExpanded || isAnimating}
					<div
						class="list-item"
						class:expanded={showContent}
						style="transform: translateY({offset}px);"
						bind:this={itemRefs[msg.id]}
					>
						<button
							class="item-header"
							onclick={() => toggleExpand(msg)}
							aria-expanded={showContent}
						>
							<div class="item-main">
								<span class="item-author">{msg.author}</span>
								<span class="item-id">留言 #{msg.id.slice(-3)}</span>
							</div>
							<div class="item-content-preview">
								<span class="content-text">{msg.content}</span>
							</div>
							<div class="item-right">
								<div class="item-votes-summary">
									<span class="vote-sum agree" class:voted={getVotedType(msg.id) === "agree"}>
										赞同 {msg.votes.agree}
									</span>
									<span class="vote-sum neutral" class:voted={getVotedType(msg.id) === "neutral"}>
										中立 {msg.votes.neutral}
									</span>
									<span class="vote-sum disagree" class:voted={getVotedType(msg.id) === "disagree"}>
										反对 {msg.votes.disagree}
									</span>
								</div>
								<div class="expand-icon" class:rotated={showContent}>
									<Icon icon="material-symbols:keyboard-arrow-down" size="sm" />
								</div>
							</div>
						</button>

						{#if showContent}
							<div
								class="expand-content"
								style="height: {isAnimating ? animatingHeights[msg.id] : expandedHeights[msg.id]}px;"
							>
								<div class="expand-inner">
									<div class="expand-divider"></div>
									<p class="expand-text">{msg.content}</p>
									<div class="expand-votes">
										<button
											class="vote-btn agree"
											class:voted={getVotedType(msg.id) === "agree"}
											disabled={isVoting[msg.id] || hasVoted(msg.id)}
											onclick={(e) => handleVote(msg.id, "agree", e)}
										>
											<Icon icon="material-symbols:thumb-up" size="sm" />
											<span>赞同 {msg.votes.agree}</span>
										</button>
										<button
											class="vote-btn neutral"
											class:voted={getVotedType(msg.id) === "neutral"}
											disabled={isVoting[msg.id] || hasVoted(msg.id)}
											onclick={(e) => handleVote(msg.id, "neutral", e)}
										>
											<Icon icon="material-symbols:remove" size="sm" />
											<span>中立 {msg.votes.neutral}</span>
										</button>
										<button
											class="vote-btn disagree"
											class:voted={getVotedType(msg.id) === "disagree"}
											disabled={isVoting[msg.id] || hasVoted(msg.id)}
											onclick={(e) => handleVote(msg.id, "disagree", e)}
										>
											<Icon icon="material-symbols:thumb-down" size="sm" />
											<span>反对 {msg.votes.disagree}</span>
										</button>
									</div>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>

			{#if allMessages.length === 0 && !isLoading}
				<div class="empty-state">
					<div class="empty-icon"><Icon icon="material-symbols:mail-outline" size="xl" /></div>
					<div class="empty-text">暂无留言</div>
				</div>
			{/if}

			{#if isLoading}
				<div class="loading-more">
					<div class="loading-spinner"></div>
					<span>加载中...</span>
				</div>
			{/if}
		</div>

		<!-- 底部 -->
		<div class="list-modal-footer">
			<span class="footer-text">GUESTBOOK ARCHIVE</span>
			<span class="footer-count">{allMessages.length} / {totalMessages}</span>
		</div>
	</div>
</dialog>
