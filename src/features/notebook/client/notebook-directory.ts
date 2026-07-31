import { fetchNotebookEntries } from "../data/notebook-api";
import { getNotebookGroupMeta } from "../model/notebook-content";
import { getCoverImage } from "../model/notebook-covers";
import {
	groupNotebookEntries,
	mergeNotebookEntries,
	type NotebookGroup,
} from "../model/notebook-groups";
import type { NotebookEntry } from "../model/types";
import { readNotebookCache, writeNotebookCache } from "./notebook-cache";

const CACHE_KEY = "notebook_v2_list";

class NotebookDirectoryElement extends HTMLElement {
	private requestController: AbortController | undefined;
	private initialEntries: NotebookEntry[] = [];
	private readonly handleVisibility = () => {
		if (document.visibilityState === "visible" && !this.hasRenderedCards()) {
			void this.load(false);
		}
	};

	connectedCallback() {
		this.initialEntries = readInitialEntries(this);
		document.addEventListener("visibilitychange", this.handleVisibility);
		this.querySelector<HTMLButtonElement>(
			"[data-notebook-retry]",
		)?.addEventListener("click", this.handleRetry);
		if (this.initialEntries.length > 0) this.render(this.initialEntries);
		void this.load(false);
	}

	disconnectedCallback() {
		document.removeEventListener("visibilitychange", this.handleVisibility);
		this.querySelector<HTMLButtonElement>(
			"[data-notebook-retry]",
		)?.removeEventListener("click", this.handleRetry);
		this.requestController?.abort();
	}

	private readonly handleRetry = () => void this.load(true);

	private hasRenderedCards() {
		return Boolean(this.querySelector(".notebook-card"));
	}

	private setState(state: "loading" | "empty" | "ready" | "error") {
		const loading = this.querySelector<HTMLElement>("[data-notebook-loading]");
		const empty = this.querySelector<HTMLElement>("[data-notebook-empty]");
		const grid = this.querySelector<HTMLElement>("[data-notebook-grid]");
		const retry = this.querySelector<HTMLButtonElement>(
			"[data-notebook-retry]",
		);
		if (loading) loading.hidden = state !== "loading";
		if (empty) empty.hidden = state !== "empty" && state !== "error";
		if (grid) grid.hidden = state !== "ready";
		if (retry) retry.hidden = state !== "error";
		const message = empty?.querySelector("p");
		if (message) {
			message.textContent =
				state === "error"
					? "笔记本加载失败，请稍后重试。"
					: "还没有任何笔记本，先创建一个吧。";
		}
	}

	private async load(forceRefresh: boolean) {
		this.requestController?.abort();
		this.requestController = new AbortController();
		if (this.initialEntries.length === 0) this.setState("loading");

		try {
			const cached = forceRefresh
				? null
				: readNotebookCache<{ entries: NotebookEntry[] }>(CACHE_KEY);
			const data =
				cached ??
				(await fetchNotebookEntries({ signal: this.requestController.signal }));
			if (!cached) writeNotebookCache(CACHE_KEY, data);
			this.render(mergeNotebookEntries(data.entries, this.initialEntries));
		} catch (error) {
			if (this.requestController.signal.aborted) return;
			if (this.initialEntries.length > 0) {
				this.render(this.initialEntries);
				return;
			}
			this.setState("error");
			console.error("[notebook] load failed:", error);
		}
	}

	private render(entries: NotebookEntry[]) {
		const groups = groupNotebookEntries(entries);
		this.renderOverview(groups, entries.length);
		this.renderCards(groups);
		this.setState(groups.length > 0 ? "ready" : "empty");
	}

	private renderOverview(groups: NotebookGroup[], entryCount: number) {
		const topGroup = groups[0];
		setText(this, "[data-notebook-total-groups]", String(groups.length));
		setText(this, "[data-notebook-total-entries]", String(entryCount));
		setText(
			this,
			"[data-notebook-last-updated]",
			topGroup?.lastUpdated
				? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(
						new Date(topGroup.lastUpdated),
					)
				: "整理中",
		);
		setText(
			this,
			"[data-notebook-featured-name]",
			topGroup?.name ?? "最近更新主题",
		);
	}

	private renderCards(groups: NotebookGroup[]) {
		const grid = this.querySelector<HTMLElement>("[data-notebook-grid]");
		if (!grid) return;
		grid.replaceChildren(
			...groups.map((group) => {
				const meta = getNotebookGroupMeta(group.name);
				const card = document.createElement("a");
				card.href = `/life/notebooks/${encodeURIComponent(group.name)}/`;
				card.className = "notebook-card";

				const media = createElement("div", "notebook-card__media");
				const image = document.createElement("img");
				image.className = "notebook-card__image";
				image.src = meta.coverImage || getCoverImage(group.cover, group.name);
				image.alt = meta.coverAlt || `${group.name}封面`;
				image.loading = "lazy";
				image.decoding = "async";
				media.append(image);

				const body = createElement("div", "notebook-card__body");
				const metaRow = createElement("div", "notebook-card__meta");
				metaRow.append(
					createElement(
						"span",
						"notebook-card__type",
						meta.tags[0] || meta.eyebrow || "笔记",
					),
					createElement("span", "notebook-card__count", `${group.count} 篇`),
				);
				body.append(
					metaRow,
					createElement("h2", "notebook-card__name", group.name),
					createElement(
						"p",
						"notebook-card__desc",
						meta.listDescription || group.description,
					),
					createElement(
						"time",
						"notebook-card__date",
						formatNotebookDate(group.lastUpdated),
					),
				);
				card.append(media, body);
				return card;
			}),
		);
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

function formatNotebookDate(timestamp: number) {
	if (!timestamp) return "尚未更新";
	return new Intl.DateTimeFormat("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date(timestamp));
}

function setText(root: ParentNode, selector: string, value: string) {
	const element = root.querySelector<HTMLElement>(selector);
	if (element) element.textContent = value;
}

function createElement<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className: string,
	text?: string,
) {
	const element = document.createElement(tag);
	element.className = className;
	if (text !== undefined) element.textContent = text;
	return element;
}

if (!customElements.get("notebook-directory")) {
	customElements.define("notebook-directory", NotebookDirectoryElement);
}
