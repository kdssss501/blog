import { escapeHtml, renderRichContent } from "@/features/activity";
import { fetchNotebookEntries } from "../data/notebook-api";
import {
	getNotebookEntryMeta,
	getNotebookGroupMeta,
} from "../model/notebook-content";
import { getCoverImage } from "../model/notebook-covers";
import {
	mergeNotebookEntries,
	sortNotebookEntries,
} from "../model/notebook-groups";
import type { NotebookEntry } from "../model/types";
import { readNotebookCache, writeNotebookCache } from "./notebook-cache";

class NotebookDetailElement extends HTMLElement {
	private requestController: AbortController | undefined;
	private initialEntries: NotebookEntry[] = [];
	private readonly handleClick = (event: Event) => {
		const target = (event.target as Element | null)?.closest<HTMLElement>(
			"[data-entry-id]",
		);
		if (!target || !this.contains(target)) return;
		const entryId = target.dataset.entryId;
		if (!entryId) return;
		this.querySelector<HTMLElement>(
			`#entry-${CSS.escape(entryId)}`,
		)?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
	};
	private readonly handleVisibility = () => {
		if (
			document.visibilityState === "visible" &&
			!this.querySelector(".notebook-entry-card")
		) {
			void this.load(false);
		}
	};

	connectedCallback() {
		this.initialEntries = readInitialEntries(this);
		this.addEventListener("click", this.handleClick);
		document.addEventListener("visibilitychange", this.handleVisibility);
		this.querySelector<HTMLButtonElement>(
			"[data-notebook-detail-retry]",
		)?.addEventListener("click", this.handleRetry);
		if (this.initialEntries.length > 0) this.renderInitial();
		void this.load(false);
	}

	disconnectedCallback() {
		this.removeEventListener("click", this.handleClick);
		document.removeEventListener("visibilitychange", this.handleVisibility);
		this.querySelector<HTMLButtonElement>(
			"[data-notebook-detail-retry]",
		)?.removeEventListener("click", this.handleRetry);
		this.requestController?.abort();
	}

	private readonly handleRetry = () => void this.load(true);

	private setState(
		state: "loading" | "error" | "empty" | "ready",
		message?: string,
	) {
		const loading = this.querySelector<HTMLElement>(
			"[data-notebook-detail-loading]",
		);
		const error = this.querySelector<HTMLElement>(
			"[data-notebook-detail-error]",
		);
		const content = this.querySelector<HTMLElement>(
			"[data-notebook-detail-content]",
		);
		const retry = this.querySelector<HTMLButtonElement>(
			"[data-notebook-detail-retry]",
		);
		if (loading) loading.hidden = state !== "loading";
		if (error) error.hidden = state !== "error" && state !== "empty";
		if (content) content.hidden = state !== "ready";
		if (retry) retry.hidden = state !== "error";
		const errorText = error?.querySelector("p");
		if (errorText && message) errorText.textContent = message;
	}

	private async load(forceRefresh: boolean) {
		const name =
			this.dataset.notebookName?.trim() ||
			new URLSearchParams(window.location.search).get("name")?.trim() ||
			"";
		if (!name) {
			this.setState("error", "未指定笔记本名称。");
			return;
		}

		this.requestController?.abort();
		const controller = new AbortController();
		this.requestController = controller;
		if (this.initialEntries.length === 0) this.setState("loading");
		const cacheKey = `notebook_detail_${name}`;

		try {
			const cached = forceRefresh
				? null
				: readNotebookCache<{ entries: NotebookEntry[] }>(cacheKey);
			const data =
				cached ??
				(await fetchNotebookEntries({
					notebook: name,
					signal: controller.signal,
				}));
			if (!cached) writeNotebookCache(cacheKey, data);
			const entries = mergeNotebookEntries(data.entries, this.initialEntries);
			if (entries.length === 0) {
				this.setState("empty", "这个笔记本还没有内容。");
				return;
			}
			const content = this.querySelector<HTMLElement>(
				"[data-notebook-detail-content]",
			);
			if (!content) return;
			content.innerHTML = renderNotebookDetail(name, entries);
			this.setState("ready");
		} catch (error) {
			if (controller.signal.aborted) return;
			if (this.initialEntries.length > 0) {
				this.renderInitial();
				return;
			}
			this.setState("error", "加载失败，请稍后重试。");
			console.error("[notebook-detail] load failed:", error);
		}
	}

	private renderInitial() {
		const name = this.dataset.notebookName?.trim() || "";
		const content = this.querySelector<HTMLElement>(
			"[data-notebook-detail-content]",
		);
		if (!name || !content || this.initialEntries.length === 0) return;
		content.innerHTML = renderNotebookDetail(name, this.initialEntries);
		this.setState("ready");
	}
}

function readInitialEntries(root: ParentNode): NotebookEntry[] {
	const source = root.querySelector<HTMLScriptElement>(
		"[data-notebook-initial]",
	);
	try {
		const value: unknown = JSON.parse(source?.textContent || "[]");
		return Array.isArray(value) ? (value as NotebookEntry[]) : [];
	} catch {
		return [];
	}
}

function renderNotebookDetail(name: string, entries: NotebookEntry[]) {
	const sorted = sortNotebookEntries(entries);
	const groupMeta = getNotebookGroupMeta(name);
	const latestEntry = sorted[0];
	const latestCover = latestEntry
		? getCoverImage(latestEntry.cover, name)
		: groupMeta.coverImage;
	const latestDate = latestEntry ? escapeHtml(latestEntry.date) : "暂无";
	const outline = sorted
		.map(
			(entry, index) => `
				<button class="notebook-outline__item" type="button" data-entry-id="${escapeHtml(entry.id)}">
					<span class="notebook-outline__index">${String(index + 1).padStart(2, "0")}</span>
					<span class="notebook-outline__text">
						<strong>${escapeHtml(entry.title)}</strong>
						<small>${escapeHtml(entry.date)}</small>
					</span>
				</button>`,
		)
		.join("");
	const tags = groupMeta.tags
		.map((tag) => `<span class="notebook-hero__tag">${escapeHtml(tag)}</span>`)
		.join("");
	const articles = sorted
		.map((entry, index) => {
			const meta = getNotebookEntryMeta(entry);
			const labels = meta.labels
				.map(
					(label) =>
						`<span class="notebook-entry-card__label">${escapeHtml(label)}</span>`,
				)
				.join("");
			return `
				<article class="notebook-entry-card" id="entry-${escapeHtml(entry.id)}">
					<div class="notebook-entry-card__media">
						<img src="${escapeHtml(meta.image)}" alt="${escapeHtml(meta.imageAlt || entry.title)}" loading="lazy" decoding="async" class="notebook-entry-card__image" />
					</div>
					<div class="notebook-entry-card__body">
						<div class="notebook-entry-card__meta">
							<span class="notebook-entry-card__count">#${String(index + 1).padStart(2, "0")}</span>
							<span class="notebook-entry-card__date">${escapeHtml(entry.date)}</span>
						</div>
						<h2 class="notebook-entry-card__title">${escapeHtml(entry.title)}</h2>
						<p class="notebook-entry-card__summary">${escapeHtml(meta.summary)}</p>
						<blockquote class="notebook-entry-card__insight">${escapeHtml(meta.insight)}</blockquote>
						${labels ? `<div class="notebook-entry-card__labels">${labels}</div>` : ""}
						<div class="notebook-entry-card__content custom-md">${renderRichContent(entry.content || "")}</div>
					</div>
				</article>`;
		})
		.join("");

	return `
		<a href="/notebook/" class="notebook-back">返回笔记本列表</a>
		<section class="notebook-hero notebook-hero--detail">
			<img src="${escapeHtml(groupMeta.coverImage || latestCover)}" alt="${escapeHtml(groupMeta.coverAlt || name)}" class="notebook-hero__image" loading="eager" decoding="async" />
			<div class="notebook-hero__overlay"></div>
			<div class="notebook-hero__content">
				<span class="notebook-hero__eyebrow">${escapeHtml(groupMeta.eyebrow || "Notebook")}</span>
				<h1 class="notebook-hero__title">${escapeHtml(groupMeta.heroTitle || name)}</h1>
				<p class="notebook-hero__description">${escapeHtml(groupMeta.heroDescription || groupMeta.intro)}</p>
				<div class="notebook-hero__meta">
					<span>${sorted.length} 篇笔记</span>
					<span>最近更新 ${latestDate}</span>
				</div>
				${tags ? `<div class="notebook-hero__tags">${tags}</div>` : ""}
			</div>
		</section>
		<section class="notebook-detail-grid">
			<article class="notebook-panel notebook-panel--entries">
				<div class="notebook-panel__header">
					<span class="notebook-panel__eyebrow">Notebook Essays</span>
					<h2 class="notebook-panel__title">这一组笔记的图文记录</h2>
					<p class="notebook-panel__text">${escapeHtml(groupMeta.intro)}</p>
				</div>
				<div class="notebook-entry-list">${articles}</div>
			</article>
			<aside class="notebook-panel notebook-panel--aside">
				<section class="notebook-side-card">
					<span class="notebook-side-card__eyebrow">Overview</span>
					<h2 class="notebook-side-card__title">${escapeHtml(groupMeta.name)}</h2>
					<p class="notebook-side-card__text">${escapeHtml(groupMeta.listDescription || groupMeta.intro)}</p>
					<dl class="notebook-side-card__stats">
						<div><dt>笔记数量</dt><dd>${sorted.length} 篇</dd></div>
						<div><dt>最近更新</dt><dd>${latestDate}</dd></div>
						<div><dt>主题气质</dt><dd>${escapeHtml(groupMeta.tags.join(" / ") || "记录中")}</dd></div>
					</dl>
				</section>
				<section class="notebook-side-card">
					<span class="notebook-side-card__eyebrow">Outline</span>
					<h2 class="notebook-side-card__title">快速跳转</h2>
					<div class="notebook-outline">${outline}</div>
				</section>
			</aside>
		</section>`;
}

if (!customElements.get("notebook-detail")) {
	customElements.define("notebook-detail", NotebookDetailElement);
}
