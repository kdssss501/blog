import {
	COLLECTIONS_FILTER_STORAGE_KEY,
	getBeijingClockSnapshot,
	resolveCollectionCategory,
} from "../model/directory";

class CollectionsDirectoryElement extends HTMLElement {
	private clockTimer: number | undefined;
	private readonly handleKeyDown = (event: KeyboardEvent) => {
		const tabs = [
			...this.querySelectorAll<HTMLButtonElement>("[data-tools-tab]"),
		];
		const currentIndex = tabs.indexOf(
			document.activeElement as HTMLButtonElement,
		);
		if (currentIndex < 0 || tabs.length < 2) return;
		let nextIndex = currentIndex;
		if (event.key === "ArrowRight" || event.key === "ArrowDown")
			nextIndex = (currentIndex + 1) % tabs.length;
		if (event.key === "ArrowLeft" || event.key === "ArrowUp")
			nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
		if (event.key === "Home") nextIndex = 0;
		if (event.key === "End") nextIndex = tabs.length - 1;
		if (nextIndex === currentIndex) return;
		event.preventDefault();
		tabs[nextIndex]?.focus();
		this.activate(tabs[nextIndex]?.dataset.toolsTab || "all");
	};
	private readonly handleClick = (event: Event) => {
		const target = event.target as Element | null;
		const button = target?.closest<HTMLButtonElement>("[data-tools-tab]");
		if (!button || !this.contains(button)) return;
		this.activate(button.dataset.toolsTab || "all");
	};

	private readonly handleHashChange = () => {
		const hash = decodeHash(window.location.hash);
		if (hash) this.activate(hash, false);
	};
	private readonly handleResize = () => this.syncIndicator();

	connectedCallback() {
		this.addEventListener("click", this.handleClick);
		this.addEventListener("keydown", this.handleKeyDown);
		window.addEventListener("hashchange", this.handleHashChange);
		window.addEventListener("resize", this.handleResize);
		this.updateClock();
		this.clockTimer = window.setInterval(() => this.updateClock(), 1000);
		requestAnimationFrame(() => {
			const stored = readStoredCategory();
			this.activate(
				resolveCollectionCategory(
					decodeHash(window.location.hash) || stored,
					this.categories,
				),
				false,
			);
		});
	}

	disconnectedCallback() {
		this.removeEventListener("click", this.handleClick);
		this.removeEventListener("keydown", this.handleKeyDown);
		window.removeEventListener("hashchange", this.handleHashChange);
		window.removeEventListener("resize", this.handleResize);
		if (this.clockTimer !== undefined) window.clearInterval(this.clockTimer);
		this.clockTimer = undefined;
	}

	private get categories() {
		return [
			...this.querySelectorAll<HTMLButtonElement>("[data-tools-tab]"),
		].map((button) => button.dataset.toolsTab || "all");
	}

	private updateClock() {
		const clock = this.querySelector<HTMLElement>("[data-tools-clock]");
		if (!clock) return;
		const snapshot = getBeijingClockSnapshot();
		clock.textContent = `${snapshot.dateLabel} ${snapshot.timeLabel}`;
		clock.setAttribute("datetime", snapshot.iso);
	}

	private activate(category: string, updateHash = true) {
		const buttons = [
			...this.querySelectorAll<HTMLButtonElement>("[data-tools-tab]"),
		];
		const target =
			buttons.find((button) => button.dataset.toolsTab === category) ||
			buttons[0];
		if (!target) return;
		const selected = target.dataset.toolsTab || "all";

		buttons.forEach((button) => {
			const active = button === target;
			button.classList.toggle("tools-tab-btn-active", active);
			button.classList.toggle("tools-tab-btn-inactive", !active);
			button.setAttribute("aria-selected", String(active));
			button.tabIndex = active ? 0 : -1;
		});

		this.querySelectorAll<HTMLElement>("[data-tools-category-group]").forEach(
			(group) => {
				group.hidden =
					group.dataset.toolsCategoryGroup !== selected && selected !== "all";
				if (group.dataset.toolsCategoryGroup === "all")
					group.hidden = selected !== "all";
			},
		);
		try {
			window.localStorage.setItem(COLLECTIONS_FILTER_STORAGE_KEY, selected);
		} catch {
			// 隐私模式或禁用存储时保持纯内存交互。
		}

		this.syncIndicator(target);

		if (updateHash)
			window.history.replaceState(
				null,
				"",
				`#tools-${encodeURIComponent(selected)}`,
			);
	}

	private syncIndicator(
		target = this.querySelector<HTMLButtonElement>(
			"[data-tools-tab].tools-tab-btn-active",
		),
	) {
		const indicator = this.querySelector<HTMLElement>(
			"[data-tools-tab-indicator]",
		);
		const navigation = this.querySelector<HTMLElement>("[data-tools-tab-nav]");
		if (indicator && navigation && target) {
			indicator.style.transform = `translate(${target.offsetLeft}px, ${target.offsetTop}px)`;
			indicator.style.width = `${target.offsetWidth}px`;
			indicator.style.height = `${target.offsetHeight}px`;
			indicator.style.opacity = "1";
		}
	}
}

function readStoredCategory() {
	try {
		return window.localStorage.getItem(COLLECTIONS_FILTER_STORAGE_KEY) || "";
	} catch {
		return "";
	}
}

function decodeHash(value: string) {
	if (!value.startsWith("#tools-")) return "";
	try {
		return decodeURIComponent(value.slice("#tools-".length));
	} catch {
		return "";
	}
}

if (!customElements.get("collection-directory")) {
	customElements.define("collection-directory", CollectionsDirectoryElement);
}
