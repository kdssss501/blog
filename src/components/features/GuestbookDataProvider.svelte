<script lang="ts">
/**
 * 留言板数据共享组件
 * 负责统一获取留言数据，通过 CustomEvent 分发给卡片和列表视图
 * 避免两个视图各自独立请求 API
 */
import { onDestroy, onMount } from "svelte";
import type { GuestbookMessage } from "@/types/guestbook";
import { fetchGuestbookMessages } from "@/utils/guestbook-api";
import {
	applyGuestbookPage,
	createGuestbookCacheState,
	type GuestbookCacheState,
	getNextGuestbookOffset,
	prependGuestbookMessage,
	upsertGuestbookMessage,
} from "@/utils/guestbook-cache";

// 使用全局状态，避免 Swup 切换时重置
const GLOBAL_KEY = "__guestbook_data__";

function getGlobalState() {
	if (typeof window === "undefined") return null;
	return (window as Record<string, unknown>)[GLOBAL_KEY] as
		| GuestbookCacheState
		| undefined;
}

function setGlobalState(state: GuestbookCacheState) {
	if (typeof window === "undefined") return;
	(window as Record<string, unknown>)[GLOBAL_KEY] = state;
}

// 初始化状态：优先从全局状态恢复
let cacheState = $state<GuestbookCacheState>(
	getGlobalState() ?? createGuestbookCacheState(),
);
let isLoading = $state(false);

const BATCH_SIZE = 20;

// 同步到全局状态
function syncGlobalState() {
	setGlobalState(cacheState);
}

// 广播数据更新
function broadcast() {
	window.dispatchEvent(
		new CustomEvent("guestbook:data-update", {
			detail: {
				messages: cacheState.messages,
				total: cacheState.total,
				hasMore: cacheState.hasMore,
				isLoading,
			},
		}),
	);
	syncGlobalState();
}

// 加载更多数据
async function loadMore() {
	if (isLoading || !cacheState.hasMore) return;
	isLoading = true;
	broadcast();

	try {
		const { messages, total } = await fetchGuestbookMessages(
			getNextGuestbookOffset(cacheState),
			BATCH_SIZE,
		);
		applyGuestbookPage(cacheState, messages, total);
		broadcast();
	} catch (err) {
		console.error("Failed to load guestbook messages:", err);
	} finally {
		isLoading = false;
		broadcast();
	}
}

// 重新加载
async function reload() {
	cacheState = createGuestbookCacheState();
	syncGlobalState();
	await loadMore();
}

// 处理新留言
function handleNewMessage(e: CustomEvent<GuestbookMessage>) {
	const msg = e.detail;
	if (!msg) return;
	prependGuestbookMessage(cacheState, msg);
	broadcast();
}

function handleMessageUpdated(e: CustomEvent<GuestbookMessage>) {
	const msg = e.detail;
	if (!msg) return;
	upsertGuestbookMessage(cacheState, msg);
	broadcast();
}

// 处理数据请求
function handleRequestData() {
	if (!cacheState.isInitialized) {
		cacheState.isInitialized = true;
		syncGlobalState();
		loadMore();
	} else {
		// 数据已存在，直接广播
		broadcast();
		if (cacheState.messages.length < BATCH_SIZE && cacheState.hasMore) {
			loadMore();
		}
	}
}

// 处理加载更多请求
function handleLoadMore() {
	loadMore();
}

onMount(() => {
	window.addEventListener("guestbooknew", handleNewMessage as EventListener);
	window.addEventListener(
		"guestbook:message-updated",
		handleMessageUpdated as EventListener,
	);
	window.addEventListener("guestbook:request-data", handleRequestData);
	window.addEventListener("guestbook:load-more", handleLoadMore);

	// 如果全局状态已有数据，立即广播
	if (cacheState.messages.length > 0) {
		broadcast();
	}
});

onDestroy(() => {
	window.removeEventListener("guestbooknew", handleNewMessage as EventListener);
	window.removeEventListener(
		"guestbook:message-updated",
		handleMessageUpdated as EventListener,
	);
	window.removeEventListener("guestbook:request-data", handleRequestData);
	window.removeEventListener("guestbook:load-more", handleLoadMore);
});
</script>

<!-- 此组件无可见 UI，仅作为数据提供者 -->
