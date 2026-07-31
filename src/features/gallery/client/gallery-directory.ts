import {
	createGalleryHash,
	type GalleryView,
	galleryAlbumMatchesTag,
	getGalleryNavigationIndex,
	normalizeGalleryTag,
	normalizeGalleryView,
	parseGalleryHash,
} from "../model/gallery-directory";

const VIEW_STORAGE_KEY = "gallery:selected-view";
const TAG_STORAGE_KEY = "gallery:selected-tag";
const NAVIGATION_KEYS = new Set([
	"ArrowLeft",
	"ArrowRight",
	"ArrowUp",
	"ArrowDown",
	"Home",
	"End",
]);

class GalleryDirectoryElement extends HTMLElement {
	private controller: AbortController | undefined;
	private resizeFrame = 0;

	connectedCallback() {
		this.controller?.abort();
		this.controller = new AbortController();
		const { signal } = this.controller;

		this.addEventListener("click", this.handleClick, { signal });
		this.addEventListener("keydown", this.handleKeydown, { signal });
		window.addEventListener("hashchange", this.handleHashChange, { signal });
		window.addEventListener("resize", this.handleResize, { signal });

		const storedView = readStorage(VIEW_STORAGE_KEY);
		const initialView =
			parseGalleryHash(window.location.hash) ??
			normalizeGalleryView(storedView);
		this.activateView(initialView, false);

		const tags = this.filterButtons
			.map((button) => button.dataset.galleryTag)
			.filter((tag): tag is string => Boolean(tag) && tag !== "all");
		this.activateTag(normalizeGalleryTag(readStorage(TAG_STORAGE_KEY), tags));
	}

	disconnectedCallback() {
		this.controller?.abort();
		window.cancelAnimationFrame(this.resizeFrame);
	}

	private get tabButtons() {
		return Array.from(
			this.querySelectorAll<HTMLButtonElement>("[data-gallery-tab]"),
		);
	}

	private get filterButtons() {
		return Array.from(
			this.querySelectorAll<HTMLButtonElement>("[data-gallery-tag]"),
		);
	}

	private readonly handleClick = (event: Event) => {
		if (!(event.target instanceof Element)) return;
		const tab = event.target.closest<HTMLButtonElement>("[data-gallery-tab]");
		if (tab) {
			this.activateView(normalizeGalleryView(tab.dataset.galleryTab));
			return;
		}

		const filter =
			event.target.closest<HTMLButtonElement>("[data-gallery-tag]");
		if (filter?.dataset.galleryTag) this.activateTag(filter.dataset.galleryTag);
	};

	private readonly handleKeydown = (event: KeyboardEvent) => {
		if (!NAVIGATION_KEYS.has(event.key) || !(event.target instanceof Element)) {
			return;
		}
		const tab = event.target.closest<HTMLButtonElement>("[data-gallery-tab]");
		const filter =
			event.target.closest<HTMLButtonElement>("[data-gallery-tag]");
		const buttons = tab ? this.tabButtons : filter ? this.filterButtons : [];
		if (buttons.length === 0) return;

		event.preventDefault();
		const nextIndex = getGalleryNavigationIndex(
			buttons.indexOf((tab ?? filter) as HTMLButtonElement),
			buttons.length,
			event.key,
		);
		const nextButton = buttons[nextIndex];
		nextButton?.focus();
		if (tab) {
			this.activateView(normalizeGalleryView(nextButton?.dataset.galleryTab));
		} else if (nextButton?.dataset.galleryTag) {
			this.activateTag(nextButton.dataset.galleryTag);
		}
	};

	private readonly handleHashChange = () => {
		const view = parseGalleryHash(window.location.hash);
		if (view) this.activateView(view, false);
	};

	private readonly handleResize = () => {
		window.cancelAnimationFrame(this.resizeFrame);
		this.resizeFrame = window.requestAnimationFrame(() => {
			this.updateViewIndicator();
			this.updateFilterIndicator();
		});
	};

	private activateView(view: GalleryView, updateUrl = true) {
		for (const button of this.tabButtons) {
			const active = button.dataset.galleryTab === view;
			button.classList.toggle("gallery-tab-btn-active", active);
			button.classList.toggle("gallery-tab-btn-inactive", !active);
			button.setAttribute("aria-selected", String(active));
			button.tabIndex = active ? 0 : -1;
		}

		for (const panel of this.querySelectorAll<HTMLElement>(
			"[data-gallery-panel]",
		)) {
			panel.hidden = panel.dataset.galleryPanel !== view;
		}

		writeStorage(VIEW_STORAGE_KEY, view);
		this.updateViewIndicator();
		if (!updateUrl) return;
		const hash = createGalleryHash(view);
		if (window.location.hash !== hash) {
			window.history.replaceState(window.history.state, "", hash);
		}
	}

	private activateTag(requestedTag: string) {
		const availableTags = this.filterButtons
			.map((button) => button.dataset.galleryTag)
			.filter((tag): tag is string => Boolean(tag) && tag !== "all");
		const tag = normalizeGalleryTag(requestedTag, availableTags);

		for (const button of this.filterButtons) {
			const active = button.dataset.galleryTag === tag;
			button.classList.toggle("gallery-filter__button--active", active);
			button.setAttribute("aria-pressed", String(active));
			button.tabIndex = active ? 0 : -1;
		}

		let visibleCount = 0;
		for (const card of this.querySelectorAll<HTMLElement>(
			"[data-gallery-album]",
		)) {
			const tags = parseTags(card.dataset.galleryTags);
			const visible = galleryAlbumMatchesTag(tags, tag);
			card.hidden = !visible;
			card.classList.toggle("gallery-card-fade-in", visible);
			if (visible) visibleCount += 1;
		}

		const empty = this.querySelector<HTMLElement>(
			"[data-gallery-filter-empty]",
		);
		if (empty) empty.hidden = visibleCount > 0;
		writeStorage(TAG_STORAGE_KEY, tag);
		this.updateFilterIndicator();
	}

	private updateViewIndicator() {
		const button = this.querySelector<HTMLElement>(
			'[data-gallery-tab][aria-selected="true"]',
		);
		const indicator = this.querySelector<HTMLElement>(
			"[data-gallery-tab-indicator]",
		);
		positionIndicator(indicator, button);
	}

	private updateFilterIndicator() {
		const button = this.querySelector<HTMLElement>(
			'[data-gallery-tag][aria-pressed="true"]',
		);
		const indicator = this.querySelector<HTMLElement>(
			"[data-gallery-filter-indicator]",
		);
		positionIndicator(indicator, button, true);
	}
}

function positionIndicator(
	indicator: HTMLElement | null,
	button: HTMLElement | null,
	includeHeight = false,
) {
	if (!indicator || !button) return;
	indicator.style.transform = `translate(${button.offsetLeft}px, ${button.offsetTop}px)`;
	indicator.style.width = `${button.offsetWidth}px`;
	if (includeHeight) indicator.style.height = `${button.offsetHeight}px`;
	indicator.style.opacity = "1";
}

function parseTags(value: string | undefined): string[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed)
			? parsed.filter((tag): tag is string => typeof tag === "string")
			: [];
	} catch {
		return [];
	}
}

function readStorage(key: string): string | null {
	try {
		return window.sessionStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeStorage(key: string, value: string) {
	try {
		window.sessionStorage.setItem(key, value);
	} catch {
		// 浏览器禁用存储时，页面状态仍可在当前视图内工作。
	}
}

if (!customElements.get("gallery-directory")) {
	customElements.define("gallery-directory", GalleryDirectoryElement);
}
