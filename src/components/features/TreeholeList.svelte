<script lang="ts">
import { onMount } from "svelte";
import {
	fetchTreeholes,
	resonateTreehole,
	replyTreehole,
} from "@/utils/treehole-api";
import type { TreeholeMessage } from "@/types/treehole";

let messages = $state<TreeholeMessage[]>([]);
let total = $state(0);
let offset = $state(0);
let loading = $state(false);
let loadingMore = $state(false);
let error = $state<string | null>(null);
const LIMIT = 10;

// 记录已共鸣的树洞 id（本地防重复点击）
let resonatedIds = $state<Set<string>>(new Set());
// 展开回复框的树洞 id
let replyOpenIds = $state<Set<string>>(new Set());
// 回复输入内容
let replyInputs = $state<Record<string, string>>({});
let replySubmitting = $state<Set<string>>(new Set());

onMount(async () => {
	await loadInitial();
	// Swup 页面切换后重新加载
	const handler = () => loadInitial();
	window.swup?.hooks.on("content:replace", handler);
	return () => window.swup?.hooks.off("content:replace", handler);
});

async function loadInitial() {
	loading = true;
	error = null;
	try {
		const res = await fetchTreeholes(0, LIMIT);
		messages = res.messages;
		total = res.total;
		offset = res.messages.length;
		// 从 localStorage 恢复已共鸣记录
		try {
			const saved = localStorage.getItem("treehole_resonated");
			if (saved) resonatedIds = new Set(JSON.parse(saved));
		} catch {}
	} catch (e) {
		error = (e as Error).message;
	} finally {
		loading = false;
	}
}

async function loadMore() {
	if (loadingMore || offset >= total) return;
	loadingMore = true;
	try {
		const res = await fetchTreeholes(offset, LIMIT);
		messages = [...messages, ...res.messages];
		offset += res.messages.length;
	} catch (e) {
		error = (e as Error).message;
	} finally {
		loadingMore = false;
	}
}

async function toggleResonance(id: string) {
	if (resonatedIds.has(id)) return;
	try {
		const res = await resonateTreehole(id);
		// 更新本地数据
		messages = messages.map((m) =>
			m.id === id ? { ...m, resonance: res.resonance } : m,
		);
		const next = new Set(resonatedIds);
		next.add(id);
		resonatedIds = next;
		localStorage.setItem(
			"treehole_resonated",
			JSON.stringify([...next]),
		);
	} catch (e) {
		if ((e as Error & { status?: number }).status === 409) {
			// 服务端已记录共鸣，同步本地
			const next = new Set(resonatedIds);
			next.add(id);
			resonatedIds = next;
		}
	}
}

function toggleReply(id: string) {
	const next = new Set(replyOpenIds);
	if (next.has(id)) {
		next.delete(id);
	} else {
		next.add(id);
	}
	replyOpenIds = next;
}

async function submitReply(id: string) {
	const text = (replyInputs[id] || "").trim();
	if (text.length < 5) return;
	const next = new Set(replySubmitting);
	next.add(id);
	replySubmitting = next;
	try {
		await replyTreehole(id, text);
		// 回复提交后清空输入，提示等待审核
		replyInputs = { ...replyInputs, [id]: "" };
		replyOpenIds = new Set([...replyOpenIds].filter((x) => x !== id));
		// 在卡片上显示"待审核"提示
		messages = messages.map((m) =>
			m.id === id
				? {
						...m,
						replies: [
							...m.replies,
							{
								id: `pending_${Date.now()}`,
								content: text,
								createdAt: Date.now(),
								status: "pending" as const,
								resonance: 0,
							},
						],
					}
				: m,
		);
	} catch (e) {
		error = (e as Error).message;
	} finally {
		const after = new Set(replySubmitting);
		after.delete(id);
		replySubmitting = after;
	}
}

function formatTime(ts: number): string {
	const diff = Date.now() - ts;
	const min = Math.floor(diff / 60000);
	const hour = Math.floor(diff / 3600000);
	const day = Math.floor(diff / 86400000);
	if (min < 1) return "刚刚";
	if (min < 60) return `${min} 分钟前`;
	if (hour < 24) return `${hour} 小时前`;
	if (day < 30) return `${day} 天前`;
	const date = new Date(ts);
	return `${date.getMonth() + 1}/${date.getDate()}`;
}
</script>

{#if loading}
	<div class="treehole-loading">
		<div class="treehole-loading-dot"></div>
		<span>正在聆听树洞...</span>
	</div>
{:else if error && messages.length === 0}
	<div class="treehole-error treehole-error--block">{error}</div>
{:else if messages.length === 0}
	<div class="treehole-empty">
		<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"><path d="M12 2L4 7v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V7l-8-5z"/></svg>
		<p>树洞还很安静，成为第一个倾诉的人吧</p>
	</div>
{:else}
	<div class="treehole-list">
		{#each messages as msg (msg.id)}
			<article class="treehole-card">
				<div class="treehole-card__body">
					<p class="treehole-card__content">{msg.content}</p>
					<div class="treehole-card__meta">
						<span class="treehole-card__time">{formatTime(msg.createdAt)}</span>
						{#if msg.replies.length > 0}
							<span class="treehole-card__sep">·</span>
							<span class="treehole-card__replies">{msg.replies.filter((r) => r.status === "approved").length} 条回应</span>
						{/if}
					</div>
				</div>

				<div class="treehole-card__actions">
					<button
						class="treehole-resonance-btn"
						class:is-resonated={resonatedIds.has(msg.id)}
						onclick={() => toggleResonance(msg.id)}
						disabled={resonatedIds.has(msg.id)}
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill={resonatedIds.has(msg.id) ? "currentColor" : "none"} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
						<span>{resonatedIds.has(msg.id) ? "已共鸣" : "共鸣"}</span>
						{#if msg.resonance > 0}<span class="treehole-resonance-count">{msg.resonance}</span>{/if}
					</button>
					<button
						class="treehole-reply-btn"
						onclick={() => toggleReply(msg.id)}
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
						<span>回应</span>
					</button>
				</div>

				{#if msg.replies.filter((r) => r.status === "approved").length > 0}
					<div class="treehole-replies">
						{#each msg.replies.filter((r) => r.status === "approved") as reply (reply.id)}
							<div class="treehole-reply">
								<span class="treehole-reply__bar"></span>
								<div class="treehole-reply__body">
									<p class="treehole-reply__content">{reply.content}</p>
									<span class="treehole-reply__time">{formatTime(reply.createdAt)}</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				{#if replyOpenIds.has(msg.id)}
					<div class="treehole-reply-form">
						<textarea
							class="treehole-reply-textarea"
							placeholder="写下一句温暖的回应..."
							rows="2"
							maxlength="1000"
							bind:value={replyInputs[msg.id]}
						></textarea>
						<div class="treehole-reply-form-footer">
							<button
								class="treehole-reply-cancel"
								onclick={() => toggleReply(msg.id)}
							>取消</button>
							<button
								class="treehole-reply-submit"
								onclick={() => submitReply(msg.id)}
								disabled={(replyInputs[msg.id] || "").trim().length < 5 || replySubmitting.has(msg.id)}
							>
								{replySubmitting.has(msg.id) ? "发送中..." : "发送回应"}
							</button>
						</div>
					</div>
				{/if}
			</article>
		{/each}
	</div>

	{#if offset < total}
		<div class="treehole-loadmore-wrap">
			<button
				class="treehole-loadmore"
				onclick={loadMore}
				disabled={loadingMore}
			>
				{loadingMore ? "加载中..." : "聆听更多"}
			</button>
		</div>
	{/if}
{/if}
