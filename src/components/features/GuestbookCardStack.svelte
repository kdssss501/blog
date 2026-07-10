<script lang="ts">
import { onDestroy, onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import type { GuestbookMessage } from "@/types/guestbook";
import { voteGuestbookMessage } from "@/utils/guestbook-api";
import { shouldDealGuestbookBatch } from "@/utils/guestbook-card-stack";

/**
 * 留言板卡片堆叠拖拽组件
 * 参考 neuro.lubeiluchen.cc 的卡片交互设计
 * 左右滑动 = 赞同/反对，上下滑动 = 中立
 * 数据通过 guestbook:data-update 事件从 GuestbookDataProvider 获取
 */

// 初始时为空，由 onMount 监听数据提供者逐张发牌入场
let allMessages = $state<GuestbookMessage[]>([]);
let isInitialDealing = $state(true);
let totalMessages = $state(0);
let isLoading = $state(false);

// 来自数据提供者的完整消息列表（不限于当前显示的5张）
let providerMessages = $state<GuestbookMessage[]>([]);
// 已经从 providerMessages 中发牌的偏移量
let dealtOffset = $state(0);
// 数据提供者是否还有更多数据
let hasMoreFromProvider = $state(true);

// 当前显示的卡片索引
let currentIndex = $state(0);
// 拖拽状态
let isDragging = $state(false);
let startX = $state(0);
let startY = $state(0);
let currentX = $state(0);
let currentY = $state(0);
// 飞出动画 — 独立于拖拽，避免被重置回 0
let flyOutTransform = $state<string | null>(null);
// 投票统计
let votes = $state<Record<string, "agree" | "disagree" | "neutral">>({});
// 新卡片入场动画偏移
let enteringCardId = $state<string | null>(null);
let enterTransform = $state<string | null>(null);
let isDealingBatch = $state(false);

// 动画与定时器管理，防止组件卸载时内存泄漏
let rafId: number | null = null;
let activeRafs: number[] = [];
let activeTimeouts: ReturnType<typeof setTimeout>[] = [];
let handleNew: ((e: Event) => void) | null = null;
let handleDataUpdate: ((e: Event) => void) | null = null;

function safeSetTimeout(fn: () => void, ms: number) {
	const id = setTimeout(() => {
		fn();
		activeTimeouts = activeTimeouts.filter((t) => t !== id);
	}, ms);
	activeTimeouts.push(id);
	return id;
}

function safeRequestAnimationFrame(fn: FrameRequestCallback): number {
	const id = requestAnimationFrame((time) => {
		activeRafs = activeRafs.filter((r) => r !== id);
		fn(time);
	});
	activeRafs.push(id);
	return id;
}

onDestroy(() => {
	if (rafId) cancelAnimationFrame(rafId);
	for (const id of activeRafs) {
		cancelAnimationFrame(id);
	}
	activeRafs = [];
	for (const id of activeTimeouts) {
		clearTimeout(id);
	}
	activeTimeouts = [];
	if (handleNew) {
		window.removeEventListener("guestbooknew", handleNew);
	}
	if (handleDataUpdate) {
		window.removeEventListener("guestbook:data-update", handleDataUpdate);
	}
});

// 获取当前可见的卡片（最多5张）
let visibleCards = $derived(
	allMessages.slice(currentIndex, currentIndex + 5).map((msg, i) => ({
		...msg,
		stackIndex: i,
	})),
);

// 判断投票类型
let voteType = $derived<"agree" | "disagree" | "neutral" | null>(
	Math.abs(currentX) > Math.abs(currentY)
		? currentX > 80
			? "agree"
			: currentX < -80
				? "disagree"
				: null
		: currentY < -80
			? "neutral"
			: null,
);

// 获取卡片样式
function getCardStyle(
	stackIndex: number,
	isActive: boolean,
	cx: number,
	cy: number,
	cardId?: string,
) {
	if (stackIndex === 0 && flyOutTransform) {
		return `${flyOutTransform}; z-index: 100;`;
	}

	if (stackIndex === 0 && isActive) {
		const rotate = cx * 0.05;
		return `transform: translate3d(${cx}px, ${cy}px, 0) rotate(${rotate}deg) scale(1.02); z-index: 100; opacity: 1; filter: none;`;
	}

	if (stackIndex === 0) {
		return "transform: translate3d(0px, 0px, 0px) scale(1) rotate(0deg); z-index: 100; opacity: 1; filter: none;";
	}

	if (cardId && enteringCardId === cardId && enterTransform) {
		return `${enterTransform} z-index: ${100 - stackIndex}; pointer-events: none;`;
	}

	const offset = stackIndex * 3;
	const scale = 1 - stackIndex * 0.03;
	const rotate = stackIndex * -1.8;
	const opacity = Math.max(0.5, 1 - stackIndex * 0.12);

	// 移除了 filter: brightness grayscale 提高渲染性能，由卡片内叠加 .card-overlay 替代
	return `transform: translate3d(${offset}px, ${offset * 5}px, -${stackIndex * 25}px) scale(${scale}) rotate(${rotate}deg); z-index: ${100 - stackIndex}; opacity: ${opacity}; pointer-events: none;`;
}

// 获取卡片边框颜色类名
function getCardBorderColor(stackIndex: number, activeVote: typeof voteType) {
	if (stackIndex !== 0 || !activeVote) {
		if (stackIndex === 0) return "card-border-default";
		return "card-border-dim";
	}

	switch (activeVote) {
		case "agree":
			return "vote-border-agree";
		case "disagree":
			return "vote-border-disagree";
		case "neutral":
			return "vote-border-neutral";
		default:
			return "card-border-default";
	}
}

// 获取卡片背景发光样式
function getCardGlow(stackIndex: number, activeVote: typeof voteType) {
	if (stackIndex !== 0 || !activeVote) return "";

	switch (activeVote) {
		case "agree":
			return "box-shadow: 0 0 40px rgba(16, 185, 129, 0.4);";
		case "disagree":
			return "box-shadow: 0 0 40px rgba(244, 63, 94, 0.4);";
		case "neutral":
			return "box-shadow: 0 0 30px rgba(234, 179, 8, 0.3);";
		default:
			return "";
	}
}

// 获取投票标签
function getVoteLabel(activeVote: typeof voteType) {
	if (!activeVote) return null;
	const labels = {
		agree: {
			text: "赞同 // AGREE",
			color: "text-emerald-400",
			position: "vote-label-top",
		},
		disagree: {
			text: "反对 // DISAGREE",
			color: "text-rose-400",
			position: "vote-label-top-right",
		},
		neutral: {
			text: "中立 // OBSERVE",
			color: "text-yellow-400",
			position: "vote-label-center",
		},
	};
	return labels[activeVote];
}

// 处理触摸/鼠标按下
function handlePointerDown(e: PointerEvent) {
	const target = e.target as HTMLElement;
	if (target.closest("a, button, [data-no-drag]")) return;

	isDragging = true;
	startX = e.clientX;
	startY = e.clientY;
	currentX = 0;
	currentY = 0;

	(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

// 处理触摸/鼠标移动 - 使用 requestAnimationFrame 节流
function handlePointerMove(e: PointerEvent) {
	if (!isDragging) return;

	if (rafId) cancelAnimationFrame(rafId);
	rafId = requestAnimationFrame(() => {
		currentX = e.clientX - startX;
		currentY = e.clientY - startY;
		rafId = null;
	});
}

// 提取公共的投票处理逻辑
async function submitVote(
	cardId: string,
	type: "agree" | "disagree" | "neutral",
) {
	votes[cardId] = type;
	try {
		const updated = await voteGuestbookMessage(cardId, type);
		const idx = allMessages.findIndex((m) => m.id === updated.id);
		if (idx !== -1) allMessages[idx] = updated;
		window.dispatchEvent(
			new CustomEvent("guestbook:message-updated", { detail: updated }),
		);
	} catch (err) {
		console.error("Failed to submit vote:", err);
	}
}

// 计算飞出目标位置（按拖拽方向直线飞出视窗）
function calculateFlyOutTarget(
	cx: number,
	cy: number,
): { x: number; y: number } {
	// 视窗对角线长度，确保能飞出视窗
	const viewportDiagonal = Math.sqrt(
		window.innerWidth ** 2 + window.innerHeight ** 2,
	);
	// 额外缓冲，确保完全飞出
	const flyDistance = viewportDiagonal * 0.8;

	// 如果几乎没有拖拽，默认往右飞出
	if (Math.abs(cx) < 1 && Math.abs(cy) < 1) {
		return { x: flyDistance, y: 0 };
	}

	// 按拖拽方向计算角度
	const angle = Math.atan2(cy, cx);
	return {
		x: Math.cos(angle) * flyDistance,
		y: Math.sin(angle) * flyDistance,
	};
}

// 处理触摸/鼠标释放 — 任何拖拽释放都执行飞出动画
function handlePointerUp() {
	if (!isDragging) return;
	isDragging = false;

	if (rafId) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}

	if (!visibleCards[0]) return;

	// 记录投票
	const currentCard = visibleCards[0];
	if (voteType) {
		submitVote(currentCard.id, voteType);
	}

	// 计算飞出目标位置（按拖拽方向直线飞出）
	const target = calculateFlyOutTarget(currentX, currentY);
	const rotate = currentX * 0.06;

	// 根据飞出距离动态计算动画时长（确保视觉上速度一致）
	const distance = Math.sqrt(target.x ** 2 + target.y ** 2);
	const baseDuration = 400;
	const duration = Math.min(700, baseDuration + distance * 0.15);

	// 设置飞出变换：直线飞出 + 渐隐
	flyOutTransform = `transform: translate3d(${target.x}px, ${target.y}px, 0) rotate(${rotate}deg) scale(0.85); transition: transform ${duration}ms cubic-bezier(0.22, 0.68, 0.25, 1), opacity ${duration}ms cubic-bezier(0.4, 0, 1, 1); opacity: 0;`;

	// 动画中途（opacity 接近 0 时）就移除卡片，避免用户看到卡片在页面其他元素上方突然消失
	const removeDelay = Math.max(200, duration - 100);
	safeSetTimeout(() => {
		currentIndex++;
		currentX = 0;
		currentY = 0;
		flyOutTransform = null;

		if (visibleCards.length === 0) {
			dealNextBatch();
		}
	}, removeDelay);
}

// 发牌动效：从共享数据中获取下一批卡片并逐张飞入
function dealCards(messages: GuestbookMessage[]) {
	if (messages.length === 0) return;
	isDealingBatch = true;

	// 清空，准备发牌
	allMessages = [];
	currentIndex = 0;
	enteringCardId = null;
	enterTransform = null;

	const entryTrajectories = [
		{ x: -600, y: 50, rot: -25 },
		{ x: 600, y: -30, rot: 20 },
		{ x: 0, y: -500, rot: -10 },
		{ x: -450, y: -350, rot: 30 },
		{ x: 500, y: 300, rot: -18 },
	];

	// 逐张发牌
	for (let i = 0; i < messages.length; i++) {
		safeSetTimeout(() => {
			const traj = entryTrajectories[i % entryTrajectories.length];

			enteringCardId = messages[i].id;
			enterTransform = `transform: translate3d(${traj.x}px, ${traj.y}px, 0) rotate(${traj.rot}deg) scale(0.6); opacity: 0;`;

			allMessages.push(messages[i]);

			safeRequestAnimationFrame(() => {
				enteringCardId = null;
				enterTransform = null;
			});
		}, i * 220);
	}

	safeSetTimeout(
		() => {
			isDealingBatch = false;
		},
		messages.length * 220 + 50,
	);
}

// 从 providerMessages 中取下一批卡片发牌，若本地已耗尽则请求更多数据
function dealNextBatch() {
	if (dealtOffset < providerMessages.length) {
		const messages = providerMessages.slice(dealtOffset, dealtOffset + 5);
		if (messages.length > 0) {
			dealtOffset += messages.length;
			dealCards(messages);
			return;
		}
	}
	if (hasMoreFromProvider) {
		isLoading = true;
		window.dispatchEvent(new CustomEvent("guestbook:load-more"));
	}
}

// 初始发牌动效：监听数据提供者的事件
onMount(() => {
	handleNew = (e: Event) => {
		handleNewMessage(e as CustomEvent<GuestbookMessage>);
	};
	window.addEventListener("guestbooknew", handleNew);

	handleDataUpdate = (e: Event) => {
		const detail = (e as CustomEvent).detail;
		if (!detail?.messages) return;

		totalMessages = detail.total || 0;
		hasMoreFromProvider = detail.hasMore ?? true;
		providerMessages = detail.messages;
		isLoading = false;

		if (allMessages.length > 0) {
			const updatedById = new Map(
				providerMessages.map((message: GuestbookMessage) => [
					message.id,
					message,
				]),
			);
			allMessages = allMessages.map(
				(message) => updatedById.get(message.id) ?? message,
			);
		}

		if (
			shouldDealGuestbookBatch({
				visibleCount: visibleCards.length,
				dealtOffset,
				providerCount: providerMessages.length,
				isDealing: isDealingBatch,
			})
		) {
			const messages = providerMessages.slice(dealtOffset, dealtOffset + 5);
			if (messages.length > 0) {
				dealtOffset += messages.length;
				dealCards(messages);

				safeSetTimeout(
					() => {
						isInitialDealing = false;
					},
					messages.length * 220 + 500,
				);
			}
		}
	};
	window.addEventListener("guestbook:data-update", handleDataUpdate);

	// 延迟触发数据请求，确保 GuestbookDataProvider 已挂载
	safeSetTimeout(() => {
		window.dispatchEvent(new CustomEvent("guestbook:request-data"));
	}, 50);
});

// 打开详情弹窗 — 通过事件通知页面级弹窗
function openDetail(card: GuestbookMessage, e: Event) {
	e.stopPropagation();
	window.dispatchEvent(
		new CustomEvent("guestbook:open-detail", { detail: card }),
	);
}

// 处理新留言事件（由发表留言弹窗触发）
function handleNewMessage(e: CustomEvent<GuestbookMessage>) {
	const msg = e.detail;
	if (!msg) return;
	// Provider 会把新留言插到共享缓存头部；本地已发牌偏移同步后移，避免下一组重复发旧卡片。
	dealtOffset += 1;
	// 将新留言插入到当前可见卡片的下一张位置，避免直接unshift导致currentIndex错位引发跳变
	if (visibleCards.length > 0) {
		allMessages.splice(currentIndex + 1, 0, msg);
	} else {
		allMessages.push(msg);
	}
}

// 键盘支持
function handleKeyDown(e: KeyboardEvent) {
	const target = e.target as HTMLElement;
	if (
		!target ||
		target.tagName === "INPUT" ||
		target.tagName === "TEXTAREA" ||
		target.isContentEditable
	) {
		return;
	}

	if (visibleCards.length === 0) return;

	const currentCard = visibleCards[0];
	switch (e.key) {
		case "ArrowRight":
			submitVote(currentCard.id, "agree");
			swipeCard(300, 0);
			break;
		case "ArrowLeft":
			submitVote(currentCard.id, "disagree");
			swipeCard(-300, 0);
			break;
		case "ArrowUp":
			submitVote(currentCard.id, "neutral");
			swipeCard(0, -300);
			break;
	}
}

// 程序化滑动卡片（键盘触发）
function swipeCard(x: number, y: number) {
	if (visibleCards.length === 0) return;

	const target = calculateFlyOutTarget(x, y);
	const rotate = x * 0.06;
	const distance = Math.sqrt(target.x ** 2 + target.y ** 2);
	const baseDuration = 400;
	const duration = Math.min(700, baseDuration + distance * 0.15);

	flyOutTransform = `transform: translate3d(${target.x}px, ${target.y}px, 0) rotate(${rotate}deg) scale(0.85); transition: transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${duration}ms cubic-bezier(0.4, 0, 1, 1); opacity: 0;`;

	const removeDelay = Math.max(200, duration - 100);
	safeSetTimeout(() => {
		currentIndex++;
		flyOutTransform = null;
		if (visibleCards.length === 0) {
			dealNextBatch();
		}
	}, removeDelay);
}
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="guestbook-card-stack">
	<!-- 背景装饰 -->
	<div class="stack-bg-decoration"></div>

	<!-- 卡片容器 -->
	<div class="cards-container">
		{#each visibleCards as card (card.id)}
			<div
				class="message-card {card.stackIndex === 0 ? 'top-card' : ''}"
				class:is-dragging={card.stackIndex === 0 && isDragging}
				class:no-transition={card.stackIndex === 0 && isDragging}
				style="{getCardStyle(card.stackIndex, card.stackIndex === 0 && isDragging, currentX, currentY, card.id)} {getCardGlow(card.stackIndex, voteType)}"
				onpointerdown={card.stackIndex === 0 ? handlePointerDown : null}
				onpointermove={card.stackIndex === 0 ? handlePointerMove : null}
				onpointerup={card.stackIndex === 0 ? handlePointerUp : null}
				onpointercancel={card.stackIndex === 0 ? handlePointerUp : null}
				role="button"
				tabindex={card.stackIndex === 0 ? 0 : -1}
				aria-label={card.stackIndex === 0 ? "留言卡片，拖拽投票" : "留言卡片（不可交互）"}
			>
				<!-- 卡片内容 -->
				<div class="card-frame {getCardBorderColor(card.stackIndex, voteType)}">
					<!-- 外层四角装饰 -->
					<div class="frame-corner top-left"></div>
					<div class="frame-corner top-right"></div>
					<div class="frame-corner bottom-left"></div>
					<div class="frame-corner bottom-right"></div>

					<!-- 内层卡片 -->
					<div class="card-inner">
						<!-- 内层四角装饰 -->
						<div class="inner-corner top-left"></div>
						<div class="inner-corner top-right"></div>
						<div class="inner-corner bottom-left"></div>
						<div class="inner-corner bottom-right"></div>

						<!-- 左上角序号 -->
						<div class="card-index">
							#{card.id && card.id.includes('_') ? card.id.split("_")[1] : card.id}
						</div>

						<!-- 顶部斜线路障条纹 -->
						<div class="stripe-bar top-stripe"></div>

						<!-- 主体内容 -->
						<div class="card-body">
							<p class="message-text">{card.content}</p>
						</div>

						<!-- 底部信息区域 - 员工证风格 -->
						<div class="card-info-section">
							<!-- 左侧头像 -->
							<div class="info-avatar">
								<Icon icon="material-symbols:person" size="lg" />
							</div>
							<!-- 右侧信息 -->
							<div class="info-right">
								<!-- 第一层：名字 -->
								<div class="info-name">{card.author}</div>
								<!-- 第二层：投票统计 -->
								<div class="info-votes">
									<span class="info-vote agree">赞同 {card.votes.agree}</span>
									<span class="vote-divider">|</span>
									<span class="info-vote neutral">中立 {card.votes.neutral}</span>
									<span class="vote-divider">|</span>
									<span class="info-vote disagree">反对 {card.votes.disagree}</span>
								</div>
								<!-- 第三层：查看详情按钮 -->
								<button class="meta-btn" data-no-drag onclick={(e) => openDetail(card, e)} onkeydown={(e) => e.key === "Enter" && openDetail(card, e)}>
									查看详情
								</button>
							</div>
						</div>
					</div>

					<!-- 投票标签 -->
					{#if card.stackIndex === 0 && isDragging && voteType}
						{@const label = getVoteLabel(voteType)}
						{#if label}
							<div class="vote-label {label.color} {label.position}">
								{label.text}
							</div>
						{/if}
					{/if}

					<!-- 底层卡片遮罩层 -->
					{#if card.stackIndex > 0}
						<div class="card-overlay" style="opacity: {Math.min(0.6, card.stackIndex * 0.15)}"></div>
					{/if}
				</div>
		</div>
		{/each}

		<!-- 空状态 -->
		{#if visibleCards.length === 0}
			<div class="empty-state">
				<div class="empty-icon"><Icon icon="material-symbols:mail-outline" size="xl" /></div>
				<div class="empty-text">暂无更多留言</div>
			</div>
		{/if}
	</div>

	<!-- 操作提示 -->
	<div class="swipe-hint">
		<div class="hint-item">
			<Icon icon="material-symbols:pan-tool" size="sm" />
			<span class="hint-text">拖拽翻看</span>
		</div>
	</div>

</div>
