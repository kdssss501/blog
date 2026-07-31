<script lang="ts">
import { onMount, tick } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import { aiSearchConfig } from "@/config";
import { createApiUrl } from "@/shared/http";
import {
	AI_SEARCH_TOGGLE_EVENT,
	LEGACY_AI_SEARCH_TOGGLE_EVENT,
} from "../client";

interface Message {
	role: "user" | "assistant";
	content: string;
	refs?: { title: string; path: string; published?: string; excerpt: string }[];
	streaming?: boolean;
}

interface SessionMeta {
	id: string;
	title: string;
	updatedAt: number;
}

const STORAGE_SESSIONS_KEY = "ai-chat:sessions";
const STORAGE_SESSION_PREFIX = "ai-chat:session:";
const MAX_SESSIONS = 20;
const VIEWPORT_HEIGHT_VARIABLE = "--ai-viewport-height";

const SUGGESTIONS = ["带我认识这个博客", "今天有什么值得读？"];
const FOLLOW_UP_SUGGESTIONS = ["继续展开这个话题", "给我几篇相关的文章"];

let isOpen = $state(false);
let inputVal = $state("");
let messages = $state<Message[]>([]);
let isLoading = $state(false);
let messagesEl = $state<HTMLDivElement>();
let inputEl = $state<HTMLTextAreaElement>();
let panelEl = $state<HTMLDivElement>();
let abortCtrl: AbortController | null = null;
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let sessionId = $state("");
let sessionList = $state<SessionMeta[]>([]);
let showSessionList = $state(false);
let previousFocus: HTMLElement | null = null;

const TEXTAREA_MIN_HEIGHT = 128;
const TEXTAREA_MAX_HEIGHT = 256;

function syncViewportHeight() {
	const height = window.visualViewport?.height ?? window.innerHeight;
	document.documentElement.style.setProperty(
		VIEWPORT_HEIGHT_VARIABLE,
		`${Math.round(height)}px`,
	);
}

function startResize(e: MouseEvent | TouchEvent) {
	e.preventDefault();
	const startY = "touches" in e ? e.touches[0].clientY : e.clientY;
	const startHeight = inputEl.offsetHeight;

	function onMove(ev: MouseEvent | TouchEvent) {
		const currentY = "touches" in ev ? ev.touches[0].clientY : ev.clientY;
		// 往上拖 = 增高，往下拖 = 缩短
		const newHeight = Math.max(
			TEXTAREA_MIN_HEIGHT,
			Math.min(TEXTAREA_MAX_HEIGHT, startHeight - (currentY - startY)),
		);
		inputEl.style.height = `${newHeight}px`;
	}

	function onEnd() {
		document.removeEventListener("mousemove", onMove);
		document.removeEventListener("mouseup", onEnd);
		document.removeEventListener("touchmove", onMove);
		document.removeEventListener("touchend", onEnd);
	}

	document.addEventListener("mousemove", onMove);
	document.addEventListener("mouseup", onEnd);
	document.addEventListener("touchmove", onMove);
	document.addEventListener("touchend", onEnd);
}

function generateSessionId(): string {
	return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getSessionTitle(msgs: Message[]): string {
	const firstUser = msgs.find((m) => m.role === "user");
	if (!firstUser) return "新对话";
	return firstUser.content.length > 20
		? `${firstUser.content.slice(0, 20)}...`
		: firstUser.content;
}

function loadSessionListFromStorage(): SessionMeta[] {
	try {
		const raw = localStorage.getItem(STORAGE_SESSIONS_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

function saveSessionListToStorage(list: SessionMeta[]) {
	try {
		localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(list));
	} catch {}
}

function saveCurrentSession() {
	if (!sessionId || messages.length === 0) return;
	if (messages.some((m) => m.streaming)) return;
	try {
		localStorage.setItem(
			STORAGE_SESSION_PREFIX + sessionId,
			JSON.stringify(messages),
		);
		const existing = sessionList.find((s) => s.id === sessionId);
		if (existing) {
			existing.title = getSessionTitle(messages);
			existing.updatedAt = Date.now();
		} else {
			sessionList.unshift({
				id: sessionId,
				title: getSessionTitle(messages),
				updatedAt: Date.now(),
			});
		}
		if (sessionList.length > MAX_SESSIONS) {
			const removed = sessionList.splice(MAX_SESSIONS);
			for (const s of removed) {
				try {
					localStorage.removeItem(STORAGE_SESSION_PREFIX + s.id);
				} catch {}
			}
		}
		sessionList = [...sessionList];
		saveSessionListToStorage(sessionList);
	} catch {}
}

function loadSessionMessages(id: string): Message[] {
	try {
		const raw = localStorage.getItem(STORAGE_SESSION_PREFIX + id);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

function deleteSession(id: string) {
	try {
		localStorage.removeItem(STORAGE_SESSION_PREFIX + id);
	} catch {}
	sessionList = sessionList.filter((s) => s.id !== id);
	saveSessionListToStorage(sessionList);
	if (id === sessionId) {
		sessionId = generateSessionId();
		messages = [];
		showSessionList = false;
		scrollToBottom();
	}
}

function startNewSession() {
	saveCurrentSession();
	sessionId = generateSessionId();
	messages = [];
	showSessionList = false;
}

function switchSession(id: string) {
	if (id === sessionId) {
		showSessionList = false;
		return;
	}
	saveCurrentSession();
	sessionId = id;
	messages = loadSessionMessages(id);
	showSessionList = false;
	scrollToBottom();
}

function formatTime(ts: number): string {
	const diff = Date.now() - ts;
	if (diff < 60000) return "刚刚";
	if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
	if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
	return `${Math.floor(diff / 86400000)} 天前`;
}

export function toggle() {
	if (isOpen) {
		close();
		return;
	}
	previousFocus =
		document.activeElement instanceof HTMLElement
			? document.activeElement
			: null;
	isOpen = true;
	window.__aiSearchOpen = true;
	tick().then(() => {
		syncViewportHeight();
		inputEl?.focus();
	});
}

function close() {
	isOpen = false;
	window.__aiSearchOpen = false;
	const focusTarget = previousFocus;
	previousFocus = null;
	tick().then(() => focusTarget?.focus());
}

function handleDialogKeydown(event: KeyboardEvent) {
	if (event.key === "Escape") {
		event.preventDefault();
		close();
		return;
	}
	if (event.key !== "Tab" || !panelEl) return;
	const focusable = Array.from(
		panelEl.querySelectorAll<HTMLElement>(
			'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
		),
	).filter((element) => !element.hasAttribute("hidden"));
	if (focusable.length === 0) {
		event.preventDefault();
		panelEl.focus();
		return;
	}
	const first = focusable[0];
	const last = focusable[focusable.length - 1];
	if (event.shiftKey && document.activeElement === first) {
		event.preventDefault();
		last.focus();
	} else if (!event.shiftKey && document.activeElement === last) {
		event.preventDefault();
		first.focus();
	}
}

function scrollToBottom() {
	tick().then(() => {
		if (messagesEl) {
			requestAnimationFrame(() => {
				messagesEl.scrollTo({
					top: messagesEl.scrollHeight,
					left: 0,
					behavior: "auto",
				});
			});
		}
	});
}

function isSafeUrl(value: string): boolean {
	return /^(https?:|mailto:|tel:|\/|#|\.\/|\.\.\/|\?)/i.test(value.trim());
}

function renderSimpleMd(text: string): string {
	let html = text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");

	html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
	html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
	html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
	html = html.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, "<em>$1</em>");
	html = html.replace(/~~([^~]+)~~/g, "<del>$1</del>");
	html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
		if (!isSafeUrl(url)) return `[${label}](${url})`;
		return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
	});
	html = html.replace(/\n/g, "<br>");

	return html;
}

async function send(text?: string) {
	const q = (text || inputVal).trim();
	if (!q || isLoading) return;

	const MAX_INPUT_LEN = 2000;
	if (q.length > MAX_INPUT_LEN) {
		messages = [
			...messages,
			{
				role: "assistant",
				content: `这段内容有些长，请控制在 ${MAX_INPUT_LEN} 个字符以内。`,
			},
		];
		scrollToBottom();
		return;
	}

	inputVal = "";
	messages = [...messages, { role: "user", content: q }];
	scrollToBottom();

	isLoading = true;
	abortCtrl = new AbortController();

	const aiIdx = messages.length;
	messages = [
		...messages,
		{ role: "assistant", content: "", streaming: true, refs: [] },
	];
	scrollToBottom();

	try {
		const history = messages
			.slice(0, -1)
			.slice(-6)
			.map((m) => ({ role: m.role, content: m.content }));

		const res = await fetch(createApiUrl("api", "ai-chat"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ question: q, history, sessionId }),
			signal: abortCtrl.signal,
		});

		if (!res.ok) {
			let errMsg = `请求失败 (${res.status})`;
			try {
				const errBody = await res.json();
				if (errBody.error) errMsg = errBody.error;
			} catch {}
			throw new Error(errMsg);
		}

		reader = res.body?.getReader() ?? null;
		if (!reader) throw new Error("无法读取响应流");

		const decoder = new TextDecoder();
		let buffer = "";

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";

			for (const line of lines) {
				if (!line.startsWith("data: ")) continue;
				const json = line.slice(6);
				try {
					const data = JSON.parse(json);

					if (data.type === "chunk") {
						messages[aiIdx].content += data.text;
						messages = [...messages];
						scrollToBottom();
					} else if (data.type === "refs") {
						messages[aiIdx].refs = data.articles;
						messages = [...messages];
						scrollToBottom();
					} else if (data.type === "error") {
						messages[aiIdx].content += `\n\n> 错误：${data.error}`;
						messages = [...messages];
					} else if (data.type === "done") {
						// 流结束
					}
				} catch {
					// 忽略解析错误
				}
			}
		}
	} catch (err: unknown) {
		const e = err instanceof Error ? err : new Error(String(err));
		if (e.name === "AbortError") {
			messages[aiIdx].content += "\n\n> *(已取消)*";
		} else {
			console.error("AI chat error:", e);
			if (/429|insufficient_quota|quota/i.test(e.message)) {
				messages[aiIdx].content =
					"今天的对话额度已经用完了。稍后再来，我会从这里继续等你。";
			} else if (
				/503|not configured|unavailable|未配置|不可用/i.test(e.message)
			) {
				messages[aiIdx].content = "小爱助手尚未配置或暂时不可用，请稍后再试。";
			} else {
				messages[aiIdx].content = "连接暂时中断了，请稍后再试。";
			}
		}
		messages = [...messages];
	} finally {
		messages[aiIdx].streaming = false;
		messages = [...messages];
		isLoading = false;
		abortCtrl = null;
		reader = null;
		scrollToBottom();
		saveCurrentSession();
	}
}

function stop() {
	abortCtrl?.abort();
	reader?.cancel().catch(() => {});
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		send();
	}
	if (e.key === "Escape") {
		if (showSessionList) {
			showSessionList = false;
		} else {
			close();
		}
	}
}

onMount(() => {
	const viewport = window.visualViewport;
	syncViewportHeight();
	sessionList = loadSessionListFromStorage();
	if (sessionList.length > 0) {
		const latest = sessionList[0];
		sessionId = latest.id;
		messages = loadSessionMessages(latest.id);
	} else {
		sessionId = generateSessionId();
	}

	const toggleHandler = () => toggle();
	window.addEventListener(AI_SEARCH_TOGGLE_EVENT, toggleHandler);
	window.addEventListener(LEGACY_AI_SEARCH_TOGGLE_EVENT, toggleHandler);
	window.addEventListener("resize", syncViewportHeight, { passive: true });
	viewport?.addEventListener("resize", syncViewportHeight, { passive: true });

	return () => {
		saveCurrentSession();
		window.removeEventListener(AI_SEARCH_TOGGLE_EVENT, toggleHandler);
		window.removeEventListener(LEGACY_AI_SEARCH_TOGGLE_EVENT, toggleHandler);
		window.removeEventListener("resize", syncViewportHeight);
		viewport?.removeEventListener("resize", syncViewportHeight);
		document.documentElement.style.removeProperty(VIEWPORT_HEIGHT_VARIABLE);
	};
});
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="ai-overlay">
		<div
			class="ai-panel"
			bind:this={panelEl}
			role="dialog"
			aria-modal="true"
			aria-labelledby="ai-dialog-title"
			tabindex="-1"
			onkeydown={handleDialogKeydown}
		>
			<!-- 标题栏 -->
			<div class="ai-header">
				<div class="ai-header__left">
					<span class="ai-signal-avatar ai-signal-avatar--header" role="img" aria-label="小爱">
						<Icon icon="material-symbols:auto-awesome-rounded" />
					</span>
					<span class="ai-header__name" id="ai-dialog-title">小爱助手</span>
					<span class="ai-header__model">{aiSearchConfig.modelName}</span>
				</div>
				<div class="ai-header__actions">
					{#if sessionList.length > 0}
						<button
							class="ai-icon-btn"
							class:ai-icon-btn--active={showSessionList}
							onclick={() => (showSessionList = !showSessionList)}
							title="历史会话"
							aria-label="历史会话"
						>
							<Icon icon="material-symbols:history" />
						</button>
					{/if}
					<button class="ai-icon-btn" onclick={startNewSession} title="新建会话" aria-label="新建会话">
						<Icon icon="material-symbols:add-circle-outline" />
					</button>
					<button class="ai-icon-btn" onclick={close} title="关闭" aria-label="关闭小爱助手">
						<Icon icon="material-symbols:close" />
					</button>
				</div>
			</div>

			<!-- 历史会话列表 -->
			{#if showSessionList}
				<div class="ai-session-list">
					{#each sessionList as sess}
						<div
							class="ai-session-item"
							class:ai-session-item--active={sess.id === sessionId}
						>
							<button
								type="button"
								class="ai-session-select"
								onclick={() => switchSession(sess.id)}
							>
								<span class="ai-session-info">
									<span class="ai-session-title">{sess.title}</span>
									<span class="ai-session-time">{formatTime(sess.updatedAt)}</span>
								</span>
							</button>
							<button
								type="button"
								class="ai-session-delete"
								onclick={() => deleteSession(sess.id)}
								title="删除会话"
								aria-label={`删除会话：${sess.title}`}
							>
								<Icon icon="material-symbols:close" size="sm" />
							</button>
						</div>
					{/each}
					{#if sessionList.length === 0}
						<div class="ai-session-empty">暂无历史会话</div>
					{/if}
				</div>
			{/if}

			<!-- 消息列表 -->
			<div class="ai-messages" bind:this={messagesEl}>
				{#if messages.length === 0}
					<div class="ai-empty">
						<div class="ai-empty__icon-wrapper">
							<span class="ai-signal-avatar ai-signal-avatar--hero" role="img" aria-label="小爱">
								<Icon icon="material-symbols:auto-awesome-rounded" size="2xl" />
							</span>
						</div>
						<h2 class="ai-empty__title">想从哪里开始？</h2>
						<div class="ai-empty__suggestions-box">
							{#each SUGGESTIONS as suggestion}
								<button class="ai-empty__suggestion" onclick={() => send(suggestion)}>
									{suggestion}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				{#each messages as msg, i}
					<div
						class="ai-msg ai-msg--{msg.role}"
						class:ai-msg--turn-start={msg.role === "user" && i > 0}
					>
						{#if msg.role === "assistant"}
							<div class="ai-msg__avatar" role="img" aria-label="小爱">
								<Icon icon="material-symbols:auto-awesome-rounded" />
							</div>
						{/if}
						<div class="ai-msg__body">
							<div class="ai-msg__content">
								{#if msg.role === "user"}
									<span class="ai-msg__text">{msg.content}</span>
									<span class="ai-msg__bubble"></span>
									<span class="ai-msg__bubble ai-msg__bubble--small"></span>
								{:else if msg.streaming && !msg.content.trim()}
									<svg class="ai-loader" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path class="ai-loader__line" d="m4.9 4.9 2.9 2.9" />
										<path class="ai-loader__line" d="M2 12h4" />
										<path class="ai-loader__line" d="m4.9 19.1 2.9-2.9" />
										<path class="ai-loader__line" d="M12 18v4" />
										<path class="ai-loader__line" d="m16.2 16.2 2.9 2.9" />
										<path class="ai-loader__line" d="M18 12h4" />
										<path class="ai-loader__line" d="m16.2 7.8 2.9-2.9" />
										<path class="ai-loader__line" d="M12 2v4" />
									</svg>
								{:else}
									<span class="ai-msg__text">{@html renderSimpleMd(msg.content)}</span>
									{#if msg.streaming}
										<span class="ai-cursor"></span>
									{/if}
								{/if}
								{#if msg.role === "assistant" && msg.refs && msg.refs.length > 0}
									<div class="ai-refs">
										<div class="ai-refs__title">参考文章</div>
										{#each msg.refs as ref}
											<a href={isSafeUrl(ref.path) ? ref.path : '#'} class="ai-refs__link" onclick={close}>
												<Icon icon="material-symbols:article-outline" size="sm" />
												<span>{ref.title}</span>
												{#if ref.published}
													<span class="ai-refs__date">{ref.published}</span>
												{/if}
											</a>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- 输入区域 -->
			<div class="ai-input-area">
				<div class="ai-input-area__box">
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="ai-input-area__resize-handle"
						onmousedown={startResize}
						ontouchstart={startResize}
						title="拖拽调整高度"
					>
						<span class="ai-input-area__resize-grip"></span>
					</div>
					{#if messages.length > 0 && !isLoading}
						<div class="ai-input-area__tags">
							{#each FOLLOW_UP_SUGGESTIONS as suggestion}
								<button
									class="ai-input-area__tag"
									type="button"
									disabled={isLoading}
									onclick={() => send(suggestion)}
								>
									{suggestion}
								</button>
							{/each}
						</div>
					{/if}
					<label class="ai-input-area__label" for="ai-chat-input">Ask</label>
					<div class="ai-input-area__textarea-wrapper">
						<textarea
							id="ai-chat-input"
							bind:this={inputEl}
							bind:value={inputVal}
							onkeydown={handleKeydown}
							placeholder="输入你的问题..."
							disabled={isLoading}
							class="ai-input-area__textarea"
							rows="5"
							aria-label="向小爱助手提问"
						></textarea>
						{#if isLoading}
							<button
								type="button"
								class="ai-input-area__submit ai-input-area__submit--stop"
								onclick={stop}
								title="停止生成"
								aria-label="停止生成"
							>
								<Icon icon="material-symbols:stop-circle-outline" size="lg" />
							</button>
						{:else}
							<button
								type="button"
								class="ai-input-area__submit"
								onclick={() => send()}
								disabled={!inputVal.trim()}
								title="发送"
								aria-label="发送"
							>
								<Icon icon="material-symbols:arrow-outward-rounded" size="lg" />
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
