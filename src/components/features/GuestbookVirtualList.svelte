<script lang="ts">
/**
 * 留言板虚拟列表组件
 * - 全视窗页面滚动模式（非内部滚动）
 * - 展开动效：点击列表项丝滑展开/折叠，带动下方列表整体平滑移动
 * - 完整交互：投票（赞同/反对/中立），限制只能投一次
 * - 数据通过 guestbook:data-update 事件从 GuestbookDataProvider 获取
 */
import { onDestroy, onMount, tick } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import type { GuestbookMessage } from "@/types/guestbook";
import { voteGuestbookMessage } from "@/utils/guestbook-api";

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

// 已投票记录（本地存储，限制只能投一次）
let votedMessages = $state<Record<string, "agree" | "disagree" | "neutral">>(
	{},
);

// 动画中高度（用于平滑过渡）
let animatingHeights = $state<Record<string, number>>({});

// 虚拟列表配置
const ITEM_HEIGHT = 72; // 折叠状态列表项高度
const BUFFER_COUNT = 5; // 上下缓冲数量（页面滚动模式下增加缓冲）
const EXPANDED_EXTRA_HEIGHT = 160; // 展开额外高度估算（用于滚动计算）

// ===== 展开/折叠动效状态 =====
let transitioningId = $state<string | null>(null);

// ===== 获取列表项当前高度（考虑动画） =====
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

	// 找到 startIdx
	for (let i = 0; i < allMessages.length; i++) {
		const h = getItemHeight(allMessages[i]);
		if (accumulated + h > scrollTop) {
			startIdx = i;
			break;
		}
		accumulated += h;
	}

	// 找到 endIdx
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

// ===== 页面滚动处理 =====
function handleWindowScroll() {
	scrollTop = window.scrollY - (containerRef?.offsetTop || 0);
	if (scrollTop < 0) scrollTop = 0;
	checkLoadMore();
}

function handleResize() {
	viewportHeight = window.innerHeight;
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
		// ease-out cubic
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
	if (transitioningId) return; // 防止动效期间重复点击

	const isExpanding = expandedId !== msg.id;

	if (isExpanding) {
		// 展开
		transitioningId = msg.id;
		expandedId = msg.id;
		await tick();

		const el = itemRefs[msg.id];
		if (el) {
			const contentEl = el.querySelector(".expand-content") as HTMLElement;
			if (contentEl) {
				// 测量实际高度
				contentEl.style.maxHeight = "none";
				const actualHeight = contentEl.scrollHeight;
				expandedHeights[msg.id] = actualHeight;

				// 从 0 动画到实际高度
				animateHeight(msg.id, 0, actualHeight, 350, () => {
					transitioningId = null;
				});
			}
		} else {
			transitioningId = null;
		}
	} else {
		// 折叠
		transitioningId = msg.id;
		const currentHeight = expandedHeights[msg.id] || EXPANDED_EXTRA_HEIGHT;

		// 从当前高度动画到 0
		animateHeight(msg.id, currentHeight, 0, 350, () => {
			expandedId = null;
			delete expandedHeights[msg.id];
			transitioningId = null;
		});
	}
}

// ===== 投票（限制只能投一次） =====
async function handleVote(
	msgId: string,
	type: "agree" | "disagree" | "neutral",
	e: Event,
) {
	e.stopPropagation();
	if (isVoting[msgId]) return;

	// 检查是否已经投过票
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
		// 记录已投票
		votedMessages[msgId] = type;
		// 持久化到 localStorage
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

// ===== 检查是否已经投票 =====
function hasVoted(msgId: string): boolean {
	return !!votedMessages[msgId];
}

// ===== 获取投票类型 =====
function getVotedType(msgId: string): "agree" | "disagree" | "neutral" | null {
	return votedMessages[msgId] || null;
}

// ===== 处理新留言事件 =====
function handleNewMessage(e: CustomEvent<GuestbookMessage>) {
	const msg = e.detail;
	if (!msg) return;
	if (allMessages.some((message) => message.id === msg.id)) return;
	allMessages.unshift(msg);
}

// ===== 处理数据更新事件 =====
function handleDataUpdate(e: CustomEvent) {
	const detail = e.detail;
	if (!detail?.messages) return;
	allMessages = detail.messages;
	hasMore = detail.hasMore ?? true;
	isLoading = detail.isLoading ?? false;
}

// ===== 加载更多数据 =====
function loadMore() {
	if (isLoading || !hasMore) return;
	isLoading = true;
	window.dispatchEvent(new CustomEvent("guestbook:load-more"));
}

// ===== 检查是否需要加载更多（页面滚动模式） =====
function checkLoadMore() {
	if (!hasMore || isLoading) return;
	const scrollBottom = window.scrollY + window.innerHeight;
	const docHeight = document.documentElement.scrollHeight;
	if (scrollBottom >= docHeight - 200) {
		loadMore();
	}
}

function handleViewChanged(e: CustomEvent) {
	if (e.detail?.view === "list") {
		requestAnimationFrame(() => {
			viewportHeight = window.innerHeight;
			scrollTop = window.scrollY - (containerRef?.offsetTop || 0);
			if (scrollTop < 0) scrollTop = 0;
		});
	}
}

// ===== 生命周期 =====
onMount(() => {
	viewportHeight = window.innerHeight;
	window.addEventListener("scroll", handleWindowScroll, { passive: true });
	window.addEventListener("resize", handleResize);
	window.addEventListener("guestbooknew", handleNewMessage as EventListener);
	window.addEventListener(
		"guestbook:data-update",
		handleDataUpdate as EventListener,
	);
	window.addEventListener(
		"guestbook:view-changed",
		handleViewChanged as EventListener,
	);

	// 恢复已投票记录
	try {
		const votedData = JSON.parse(
			localStorage.getItem("guestbookVoted") || "{}",
		);
		votedMessages = votedData;
	} catch {
		votedMessages = {};
	}

	// 延迟触发数据请求，确保 GuestbookDataProvider 已挂载
	setTimeout(() => {
		window.dispatchEvent(new CustomEvent("guestbook:request-data"));
	}, 50);
});

onDestroy(() => {
	window.removeEventListener("scroll", handleWindowScroll);
	window.removeEventListener("resize", handleResize);
	window.removeEventListener("guestbooknew", handleNewMessage as EventListener);
	window.removeEventListener(
		"guestbook:data-update",
		handleDataUpdate as EventListener,
	);
	window.removeEventListener(
		"guestbook:view-changed",
		handleViewChanged as EventListener,
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

<div class="virtual-list-container" bind:this={containerRef}>
	<!-- 占位高度 -->
	<div class="list-spacer" style="height: {totalHeight}px;">
		<!-- 可见项目 -->
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
				<!-- 主行：点击展开 -->
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

				<!-- 展开内容：显示完整内容 + 投票按钮 -->
				{#if showContent}
					<div
						class="expand-content"
						style="height: {isAnimating ? animatingHeights[msg.id] : expandedHeights[msg.id]}px;"
					>
						<div class="expand-inner">
							<div class="expand-divider"></div>

							<!-- 完整内容 -->
							<p class="expand-text">{msg.content}</p>

							<!-- 投票按钮 -->
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

	<!-- 空状态 -->
	{#if allMessages.length === 0}
		<div class="empty-state">
			<div class="empty-icon"><Icon icon="material-symbols:mail-outline" size="xl" /></div>
			<div class="empty-text">暂无留言</div>
		</div>
	{/if}
</div>
