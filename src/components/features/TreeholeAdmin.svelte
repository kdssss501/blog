<script lang="ts">
import { onMount } from "svelte";
import {
	fetchPending,
	reviewTreehole,
	reviewTreeholeReply,
} from "@/utils/treehole-api";
import type { TreeholeMessage } from "@/types/treehole";

let token = $state("");
let loggedIn = $state(false);
let messages = $state<TreeholeMessage[]>([]);
let loading = $state(false);
let error = $state<string | null>(null);
let reviewing = $state<Set<string>>(new Set());

onMount(() => {
	// 从 localStorage 恢复 token
	const saved = localStorage.getItem("treehole_admin_token");
	if (saved) {
		token = saved;
		checkLogin();
	}
});

async function checkLogin() {
	if (!token.trim()) return;
	localStorage.setItem("treehole_admin_token", token.trim());
	loggedIn = true;
	await loadPending();
}

async function login() {
	error = null;
	await checkLogin();
	if (!loggedIn) {
		error = "Token 无效或未设置";
	}
}

function logout() {
	localStorage.removeItem("treehole_admin_token");
	token = "";
	loggedIn = false;
	messages = [];
}

async function loadPending() {
	loading = true;
	error = null;
	try {
		const res = await fetchPending();
		messages = res.messages;
	} catch (e) {
		const err = e as Error & { status?: number };
		if (err.status === 401) {
			loggedIn = false;
			error = "Token 无效或已过期，请重新登录";
		} else {
			error = err.message;
		}
	} finally {
		loading = false;
	}
}

async function review(id: string, status: "approved" | "rejected") {
	const key = `${id}:${status}`;
	const next = new Set(reviewing);
	next.add(key);
	reviewing = next;
	try {
		await reviewTreehole(id, status);
		messages = messages.filter((m) => m.id !== id);
	} catch (e) {
		error = (e as Error).message;
	} finally {
		const after = new Set(reviewing);
		after.delete(key);
		reviewing = after;
	}
}

async function reviewReply(
	msgId: string,
	replyId: string,
	status: "approved" | "rejected",
) {
	const key = `${msgId}:${replyId}:${status}`;
	const next = new Set(reviewing);
	next.add(key);
	reviewing = next;
	try {
		await reviewTreeholeReply(msgId, replyId, status);
		messages = messages.map((m) =>
			m.id === msgId
				? {
						...m,
						replies: m.replies.map((r) =>
							r.id === replyId ? { ...r, status } : r,
						),
					}
				: m,
		);
	} catch (e) {
		error = (e as Error).message;
	} finally {
		const after = new Set(reviewing);
		after.delete(key);
		reviewing = after;
	}
}

function formatTime(ts: number): string {
	return new Date(ts).toLocaleString("zh-CN", {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}
</script>

{#if !loggedIn}
	<div class="treehole-admin-login">
		<h2 class="treehole-admin-login__title">树洞管理</h2>
		<p class="treehole-admin-login__hint">输入管理 Token 以审核树洞内容</p>
		<input
			class="treehole-admin-token-input"
			type="password"
			placeholder="管理 Token"
			bind:value={token}
			onkeydown={(e) => e.key === "Enter" && login()}
		/>
		<button class="treehole-admin-login-btn" onclick={login}>登录</button>
		{#if error}<div class="treehole-error">{error}</div>{/if}
	</div>
{:else if loading}
	<div class="treehole-loading">
		<div class="treehole-loading-dot"></div>
		<span>加载中...</span>
	</div>
{:else if messages.length === 0}
	<div class="treehole-empty">
		<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
		<p>没有待审核的内容</p>
	</div>
	<div class="treehole-admin-refresh-wrap">
		<button class="treehole-admin-refresh" onclick={loadPending}>刷新</button>
		<button class="treehole-admin-logout" onclick={logout}>退出登录</button>
	</div>
{:else}
	<div class="treehole-admin-toolbar">
		<span class="treehole-admin-count">待审核 {messages.length} 条</span>
		<button class="treehole-admin-refresh" onclick={loadPending}>刷新</button>
		<button class="treehole-admin-logout" onclick={logout}>退出</button>
	</div>

	{#if error}<div class="treehole-error treehole-error--block">{error}</div>{/if}

	<div class="treehole-list">
		{#each messages as msg (msg.id)}
			<article class="treehole-card treehole-card--pending">
				<div class="treehole-card__body">
					<p class="treehole-card__content">{msg.content}</p>
					<div class="treehole-card__meta">
						<span class="treehole-card__time">{formatTime(msg.createdAt)}</span>
					</div>
				</div>
				<div class="treehole-card__actions treehole-card__actions--review">
					<button
						class="treehole-review-btn treehole-review-btn--approve"
						onclick={() => review(msg.id, "approved")}
						disabled={reviewing.has(`${msg.id}:approved`)}
					>通过</button>
					<button
						class="treehole-review-btn treehole-review-btn--reject"
						onclick={() => review(msg.id, "rejected")}
						disabled={reviewing.has(`${msg.id}:rejected`)}
					>拒绝</button>
				</div>

				{#if msg.replies && msg.replies.filter((r) => r.status === "pending").length > 0}
					<div class="treehole-replies treehole-replies--pending">
						{#each msg.replies.filter((r) => r.status === "pending") as reply (reply.id)}
							<div class="treehole-reply">
								<span class="treehole-reply__bar treehole-reply__bar--pending"></span>
								<div class="treehole-reply__body">
									<p class="treehole-reply__content">{reply.content}</p>
									<span class="treehole-reply__time">{formatTime(reply.createdAt)}</span>
								</div>
								<div class="treehole-reply__review">
									<button
										class="treehole-review-btn treehole-review-btn--approve treehole-review-btn--sm"
										onclick={() => reviewReply(msg.id, reply.id, "approved")}
										disabled={reviewing.has(`${msg.id}:${reply.id}:approved`)}
									>通过</button>
									<button
										class="treehole-review-btn treehole-review-btn--reject treehole-review-btn--sm"
										onclick={() => reviewReply(msg.id, reply.id, "rejected")}
										disabled={reviewing.has(`${msg.id}:${reply.id}:rejected`)}
									>拒绝</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</article>
		{/each}
	</div>
{/if}
