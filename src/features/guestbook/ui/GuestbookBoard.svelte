<script lang="ts">
import { onMount, tick } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import {
	fetchGuestbookMessages,
	postGuestbookMessage,
} from "../data/guestbook-api";
import type { GuestbookMessage } from "../model/types";

interface Props {
	mode?: "page" | "dialog";
}

const PAGE_SIZE = 20;
const AUTHOR_STORAGE_KEY = "guestbook:author";
const SYNC_INTERVAL = 30_000;

let { mode = "page" }: Props = $props();
let messages = $state<GuestbookMessage[]>([]);
let total = $state(0);
let hasMore = $state(true);
let loading = $state(true);
let loadingMore = $state(false);
let refreshing = $state(false);
let submitting = $state(false);
let errorMessage = $state("");
let author = $state("");
let draftAuthor = $state("");
let content = $state("");
let sidebarOpen = $state(false);
let profileOpen = $state(false);
let emojiOpen = $state(false);
let lastSynced = $state<Date | null>(null);
let editor: HTMLTextAreaElement | undefined = $state();
let messageScroller: HTMLDivElement | undefined = $state();

const chronologicalMessages = $derived.by(() =>
	[...messages].sort((left, right) => left.createdAt - right.createdAt),
);
const groupedMessages = $derived.by(() => {
	const groups: Array<{
		key: string;
		label: string;
		messages: GuestbookMessage[];
	}> = [];
	for (const message of chronologicalMessages) {
		const key = new Intl.DateTimeFormat("zh-CN", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(new Date(message.createdAt));
		const previous = groups.at(-1);
		if (previous?.key === key) previous.messages.push(message);
		else
			groups.push({
				key,
				label: formatDateDivider(message.createdAt),
				messages: [message],
			});
	}
	return groups;
});
const members = $derived.by(() => {
	const seen = new Map<string, GuestbookMessage>();
	for (const message of [...chronologicalMessages].reverse()) {
		if (!seen.has(message.author)) seen.set(message.author, message);
	}
	return [...seen.values()];
});
const canSubmit = $derived(
	author.trim().length >= 2 &&
		author.trim().length <= 30 &&
		content.trim().length >= 5 &&
		content.trim().length <= 300 &&
		!submitting,
);

onMount(() => {
	author = localStorage.getItem(AUTHOR_STORAGE_KEY) ?? "";
	draftAuthor = author;
	void loadInitial(true);
	const timer = window.setInterval(
		() => void refreshMessages(false),
		SYNC_INTERVAL,
	);
	return () => window.clearInterval(timer);
});

async function loadInitial(scrollToLatest = false) {
	loading = true;
	errorMessage = "";
	try {
		const result = await fetchGuestbookMessages(0, PAGE_SIZE);
		messages = result.messages;
		total = result.total;
		hasMore = result.messages.length < result.total;
		lastSynced = new Date();
		if (scrollToLatest) await scrollToBottom();
	} catch {
		errorMessage = "留言暂时加载失败，请稍后重试。";
	} finally {
		loading = false;
	}
}

async function refreshMessages(showProgress = true) {
	if (refreshing) return;
	refreshing = showProgress;
	try {
		const result = await fetchGuestbookMessages(0, PAGE_SIZE);
		const known = new Map(messages.map((message) => [message.id, message]));
		for (const message of result.messages) known.set(message.id, message);
		messages = [...known.values()];
		total = result.total;
		hasMore = messages.length < result.total;
		lastSynced = new Date();
		errorMessage = "";
	} catch {
		errorMessage = "同步留言失败，请检查网络后重试。";
	} finally {
		refreshing = false;
	}
}

async function loadMore() {
	if (loadingMore || !hasMore) return;
	loadingMore = true;
	const previousHeight = messageScroller?.scrollHeight ?? 0;
	try {
		const result = await fetchGuestbookMessages(messages.length, PAGE_SIZE);
		const known = new Set(messages.map((message) => message.id));
		messages = [
			...messages,
			...result.messages.filter((message) => !known.has(message.id)),
		];
		total = result.total;
		hasMore = messages.length < result.total;
		await tick();
		if (messageScroller) {
			messageScroller.scrollTop +=
				messageScroller.scrollHeight - previousHeight;
		}
	} catch {
		errorMessage = "更多留言加载失败，请稍后重试。";
	} finally {
		loadingMore = false;
	}
}

async function submitMessage(event: SubmitEvent) {
	event.preventDefault();
	if (!canSubmit) return;
	submitting = true;
	errorMessage = "";
	try {
		const message = await postGuestbookMessage(author.trim(), content.trim());
		messages = [message, ...messages.filter((item) => item.id !== message.id)];
		total += 1;
		content = "";
		localStorage.setItem(AUTHOR_STORAGE_KEY, author.trim());
		lastSynced = new Date();
		await scrollToBottom();
	} catch (error) {
		const status = (error as Error & { status?: number }).status;
		errorMessage =
			status === 429
				? "发送太频繁，请稍后再试。"
				: status === 400
					? "昵称或留言内容不符合要求。"
					: "留言发送失败，请检查网络后重试。";
	} finally {
		submitting = false;
	}
}

async function scrollToBottom() {
	await tick();
	messageScroller?.scrollTo({
		top: messageScroller.scrollHeight,
		behavior: "smooth",
	});
}

function formatDateDivider(timestamp: number) {
	const date = new Date(timestamp);
	const now = new Date();
	if (date.toDateString() === now.toDateString()) return "今天";
	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	if (date.toDateString() === yesterday.toDateString()) return "昨天";
	return new Intl.DateTimeFormat("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

function formatMessageTime(timestamp: number) {
	return new Intl.DateTimeFormat("zh-CN", {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(new Date(timestamp));
}

function formatSyncTime(date: Date | null) {
	if (!date) return "等待同步";
	return new Intl.DateTimeFormat("zh-CN", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	}).format(date);
}

function initials(name: string) {
	return [...name.trim()].slice(0, 2).join("").toUpperCase() || "访";
}

function messageDevice(message: GuestbookMessage) {
	return message.device || "Web 访客";
}

function replyTo(message: GuestbookMessage) {
	content = `${`@${message.author} ${content}`.trimEnd()} `;
	editor?.focus();
}

async function copyMessage(message: GuestbookMessage) {
	try {
		await navigator.clipboard.writeText(message.content);
	} catch {
		errorMessage = "复制失败，请手动选择留言内容。";
	}
}

function insertEmoji(emoji: string) {
	content += emoji;
	emojiOpen = false;
	editor?.focus();
}

function openProfile() {
	draftAuthor = author;
	profileOpen = true;
}

function saveProfile(event: SubmitEvent) {
	event.preventDefault();
	const nextAuthor = draftAuthor.trim();
	if (nextAuthor.length < 2 || nextAuthor.length > 30) return;
	author = nextAuthor;
	localStorage.setItem(AUTHOR_STORAGE_KEY, author);
	profileOpen = false;
	editor?.focus();
}
</script>

<div class:guestbook-page--dialog={mode === "dialog"} class:guestbook-page--page={mode === "page"} class="guestbook-page">
<section class:guestbook-chat--dialog={mode === "dialog"} class="guestbook-chat" aria-label="留言板">
	<header class="guestbook-chat__header">
		<div class="guestbook-chat__channel">
			<button class="guestbook-chat__mobile-channel-refresh" type="button" aria-label="刷新留言板" onclick={() => refreshMessages()}>
				<span>留言板</span>
				<span class:visible={refreshing} class="guestbook-chat__mobile-refresh-icon"><Icon icon="material-symbols:refresh-rounded" /></span>
			</button>
			<div class="guestbook-chat__desktop-channel-details">
				<div class="guestbook-chat__title-row">
					<h2>留言板</h2>
					<span>· {total} 条留言</span>
					<div class="guestbook-chat__sync">
						<span>同步于 {formatSyncTime(lastSynced)} · 30 s</span>
						<button class:rotating={refreshing} type="button" aria-label="立即刷新消息" title="立即刷新" onclick={() => refreshMessages()}>
							<Icon icon="material-symbols:refresh-rounded" />
						</button>
					</div>
				</div>
			</div>
		</div>
		<div class="guestbook-chat__actions">
			<button class="guestbook-chat__sidebar-toggle" type="button" aria-controls="guestbook-chat-sidebar" aria-expanded={sidebarOpen} title="群公告与聊天成员" onclick={() => (sidebarOpen = !sidebarOpen)}>
				<Icon icon="material-symbols:group-outline-rounded" />
				<span>{members.length}</span>
			</button>
		</div>
	</header>

	<div class="guestbook-chat__workspace">
		<div class="guestbook-chat__conversation">
			<div class="guestbook-chat__messages custom-scrollbar" bind:this={messageScroller} aria-live="polite" aria-relevant="additions">
				<div class="guestbook-chat__history">
					{#if hasMore}
						<button type="button" disabled={loadingMore} onclick={loadMore}>{loadingMore ? "正在读取..." : "读取更早的留言"}</button>
					{:else if !loading}<span>已经到最早一条消息</span>{/if}
				</div>

				{#if loading}
					<div class="guestbook-chat__state"><span></span><span></span><span></span><p>正在同步留言...</p></div>
				{:else if chronologicalMessages.length === 0}
					<div class="guestbook-chat__empty"><Icon icon="material-symbols:forum-outline-rounded" size="2xl" /><strong>这里还很安静</strong><span>写下第一条留言，和后来的人打个招呼。</span></div>
				{:else}
					{#each groupedMessages as group (group.key)}
						<div class="guestbook-chat__date"><span>{group.label}</span></div>
						{#each group.messages as message (message.id)}
							<article id={`guestbook-message-${message.id}`} class:is-admin={message.role === "owner"} class="guestbook-message">
								<div class="guestbook-message__avatar" aria-hidden="true">
									<span>{initials(message.author)}</span>
									{#if message.avatarUrl}<img src={message.avatarUrl} alt="" loading="lazy" referrerpolicy="no-referrer" />{/if}
								</div>
								<div class="guestbook-message__column">
									<div class="guestbook-message__heading">
										<strong class="guestbook-message__author">{message.author}</strong>
										{#if message.role === "owner"}<span class="guestbook-message__badge">站长</span>{/if}
										<time datetime={new Date(message.createdAt).toISOString()}>{formatMessageTime(message.createdAt)}</time>
									</div>
									<div class="guestbook-message__bubble-row">
										<div class="guestbook-message__bubble"><p>{message.content}</p></div>
										<div class="guestbook-message__tools" role="group" aria-label="消息操作">
											<button type="button" title="引用回复" aria-label={`回复 ${message.author}`} onclick={() => replyTo(message)}><Icon icon="material-symbols:reply-rounded" /></button>
											<button type="button" title="复制消息" aria-label="复制消息" onclick={() => copyMessage(message)}><Icon icon="material-symbols:content-copy-outline-rounded" /></button>
										</div>
									</div>
									<div class="guestbook-message__meta"><Icon icon="material-symbols:computer-outline-rounded" /><span>{messageDevice(message)}</span></div>
								</div>
							</article>
						{/each}
					{/each}
				{/if}
			</div>

			<div class="guestbook-chat__composer-area">
				<form class="guestbook-composer" onsubmit={submitMessage}>
					<div class="guestbook-composer__editor">
						<textarea bind:this={editor} bind:value={content} minlength="5" maxlength="300" placeholder="说点什么..." aria-label="留言内容"></textarea>
						<div class="guestbook-composer__footer">
							<div class="guestbook-composer__tools">
								<button class:is-active={emojiOpen} type="button" title="表情" aria-label="选择表情" onclick={() => (emojiOpen = !emojiOpen)}><Icon icon="material-symbols:add-reaction-outline-rounded" /></button>
								<button type="button" disabled title="当前留言存储暂不支持图片" aria-label="添加图片"><Icon icon="material-symbols:add-photo-alternate-outline-rounded" /></button>
							</div>
							<div class="guestbook-composer__actions">
								<span class="guestbook-composer__count">{content.length}/300</span>
								<button class="guestbook-composer__guest-profile" type="button" onclick={openProfile}>{author ? author : "游客访问"}</button>
								<button class="guestbook-composer__login" type="button" onclick={openProfile}>登录</button>
								<button class="guestbook-composer__send" type="submit" disabled={!canSubmit}>{submitting ? "发送中" : "发送"}</button>
							</div>
						</div>
						{#if emojiOpen}
							<div class="guestbook-composer__emojis" aria-label="常用表情">
								{#each ["😀", "😄", "🥳", "👏", "✨", "💡", "❤️", "👍", "🌸", "🎉", "🤝", "☕"] as emoji}
									<button type="button" aria-label={`插入 ${emoji}`} onclick={() => insertEmoji(emoji)}>{emoji}</button>
								{/each}
							</div>
						{/if}
					</div>
					{#if errorMessage}<p class="guestbook-composer__error" role="alert"><Icon icon="material-symbols:warning-outline-rounded" /><span>{errorMessage}</span><button type="button" aria-label="关闭提示" onclick={() => (errorMessage = "")}><Icon icon="material-symbols:close-rounded" /></button></p>{/if}
				</form>
			</div>
		</div>

		{#if sidebarOpen}<button class="guestbook-chat__sidebar-overlay" type="button" aria-label="关闭群信息" onclick={() => (sidebarOpen = false)}></button>{/if}
		<aside id="guestbook-chat-sidebar" class:is-open={sidebarOpen} class="guestbook-chat__sidebar" aria-label="群信息">
			<div class="guestbook-chat__sidebar-heading"><strong>群信息</strong><button type="button" aria-label="关闭群信息" onclick={() => (sidebarOpen = false)}><Icon icon="material-symbols:close-rounded" /></button></div>
			<section class="guestbook-chat__announcement-panel">
				<div class="guestbook-chat__panel-title"><Icon icon="material-symbols:notifications-outline-rounded" /><strong>群公告</strong></div>
				<div class="guestbook-chat__announcement"><strong>评论及留言规则</strong><span>请在交流中保持友善、理性和尊重。</span></div>
			</section>
			<section class="guestbook-chat__members">
				<div class="guestbook-chat__panel-title"><Icon icon="material-symbols:group-outline-rounded" /><strong>聊天成员</strong><span>{members.length}</span></div>
				<div class="guestbook-chat__member-list custom-scrollbar">
					{#each members as member (member.author)}
						<div class="guestbook-chat__member">
							<span class="guestbook-chat__member-avatar">{initials(member.author)}{#if member.avatarUrl}<img src={member.avatarUrl} alt="" loading="lazy" />{/if}</span>
							<strong>{member.author}</strong>
							{#if member.role === "owner"}<small>站长</small>{/if}
						</div>
					{/each}
				</div>
			</section>
		</aside>
	</div>
</section>
</div>

{#if profileOpen}
	<div class="guestbook-profile-modal" role="presentation" onclick={(event) => event.currentTarget === event.target && (profileOpen = false)}>
		<form class="guestbook-profile-modal__panel" onsubmit={saveProfile}>
			<header><div><span>访客资料</span><small>昵称会保存在当前浏览器</small></div><button type="button" aria-label="关闭" onclick={() => (profileOpen = false)}><Icon icon="material-symbols:close-rounded" /></button></header>
			<label for={`guestbook-author-${mode}`}>昵称<input id={`guestbook-author-${mode}`} bind:value={draftAuthor} minlength="2" maxlength="30" placeholder="请输入昵称" autofocus /></label>
			<footer><button type="button" onclick={() => (profileOpen = false)}>取消</button><button type="submit" disabled={draftAuthor.trim().length < 2}>保存资料</button></footer>
		</form>
	</div>
{/if}
