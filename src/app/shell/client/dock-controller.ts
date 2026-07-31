import { requestSearchModalToggle } from "@/features/search/client";
import { toggleTheme } from "@/features/settings/client";
import {
	emitTypedEvent,
	NAV_MENU_TOGGLE_EVENT,
	type ShellEventMap,
} from "@/shared/events";
import { TOCManager } from "@/utils/toc-utils";
import {
	type DockCommandId,
	dockCommands,
	isDockCommandVisible,
	isGuestbookPathname,
} from "../model/dock-command";

let controller: AbortController | null = null;
let navObserver: MutationObserver | null = null;
let previousFocus: HTMLElement | null = null;

function getRuntimeContext() {
	return {
		pathname: window.location.pathname,
		scrollY: window.scrollY,
		hasComments: Boolean(document.getElementById("post-comments")),
		hasToc: Boolean(
			document.querySelector(
				"#post-content h2, #post-content h3, .custom-md h2, .custom-md h3",
			),
		),
	};
}

function getOpenDrawer(): HTMLElement | null {
	return document.querySelector<HTMLElement>(
		"[data-dock-drawer]:not(.dock-drawer-closed)",
	);
}

function getFocusable(container: HTMLElement): HTMLElement[] {
	return Array.from(
		container.querySelectorAll<HTMLElement>(
			'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
		),
	).filter((element) => !element.hidden && element.offsetParent !== null);
}

function setOverlay(open: boolean): void {
	const overlay = document.getElementById("mobile-dock-overlay");
	overlay?.classList.toggle("is-open", open);
	overlay?.setAttribute("aria-hidden", String(!open));
}

function syncBodyLock(): void {
	if (!window.matchMedia("(max-width: 768px)").matches) {
		document.body.style.removeProperty("overflow");
		return;
	}
	const sheetOpen = document
		.getElementById("mobile-dock-sheet")
		?.classList.contains("is-open");
	document.body.style.overflow = sheetOpen || getOpenDrawer() ? "hidden" : "";
}

function closeToolsSheet(returnFocus = false): void {
	const sheet = document.getElementById("mobile-dock-sheet");
	const button = document.querySelector<HTMLElement>(
		'[data-dock-command="tools"]',
	);
	sheet?.classList.remove("is-open");
	sheet?.setAttribute("aria-hidden", "true");
	button?.setAttribute("aria-expanded", "false");
	button
		?.querySelector<HTMLElement>('[data-surface-icon="closed"]')
		?.classList.remove("hidden");
	button
		?.querySelector<HTMLElement>('[data-surface-icon="open"]')
		?.classList.add("hidden");
	if (!getOpenDrawer()) setOverlay(false);
	syncBodyLock();
	if (returnFocus) button?.focus();
}

function openToolsSheet(button: HTMLElement): void {
	closeAllDrawers(false);
	const sheet = document.getElementById("mobile-dock-sheet");
	if (!sheet) return;
	previousFocus = button;
	sheet.classList.add("is-open");
	sheet.setAttribute("aria-hidden", "false");
	button.setAttribute("aria-expanded", "true");
	button
		.querySelector<HTMLElement>('[data-surface-icon="closed"]')
		?.classList.add("hidden");
	button
		.querySelector<HTMLElement>('[data-surface-icon="open"]')
		?.classList.remove("hidden");
	setOverlay(true);
	syncBodyLock();
	window.requestAnimationFrame(() => getFocusable(sheet)[0]?.focus());
}

function closeAllDrawers(returnFocus = false): void {
	for (const drawer of document.querySelectorAll<HTMLElement>(
		"[data-dock-drawer]",
	)) {
		drawer.classList.add("dock-drawer-closed");
		drawer.setAttribute("aria-hidden", "true");
		drawer.inert = true;
	}
	const sheetOpen = document
		.getElementById("mobile-dock-sheet")
		?.classList.contains("is-open");
	if (!sheetOpen) setOverlay(false);
	syncBodyLock();
	if (returnFocus) previousFocus?.focus();
	previousFocus = null;
}

function resetGuestbookDrawerPosition(drawer: HTMLElement): void {
	drawer.classList.remove("is-positioned", "is-dragging");
	drawer.style.removeProperty("left");
	drawer.style.removeProperty("top");
}

function setupGuestbookDrawerDrag(signal: AbortSignal): void {
	const drawer = document.querySelector<HTMLElement>(
		'[data-dock-drawer="guestbook"]',
	);
	const handle = drawer?.querySelector<HTMLElement>("[data-dock-drag-handle]");
	if (!drawer || !handle) return;

	let pointerId: number | null = null;
	let offsetX = 0;
	let offsetY = 0;

	const move = (event: PointerEvent) => {
		if (event.pointerId !== pointerId) return;
		const maxLeft = Math.max(8, window.innerWidth - drawer.offsetWidth - 8);
		const maxTop = Math.max(8, window.innerHeight - drawer.offsetHeight - 8);
		const left = Math.min(maxLeft, Math.max(8, event.clientX - offsetX));
		const top = Math.min(maxTop, Math.max(8, event.clientY - offsetY));
		drawer.style.left = `${left}px`;
		drawer.style.top = `${top}px`;
	};

	const stop = (event: PointerEvent) => {
		if (event.pointerId !== pointerId) return;
		pointerId = null;
		drawer.classList.remove("is-dragging");
		if (handle.hasPointerCapture(event.pointerId)) {
			handle.releasePointerCapture(event.pointerId);
		}
	};

	handle.addEventListener(
		"pointerdown",
		(event) => {
			if (
				window.matchMedia("(max-width: 768px)").matches ||
				event.button !== 0 ||
				(event.target as Element).closest("a, button, input, textarea, select")
			) {
				return;
			}
			const rect = drawer.getBoundingClientRect();
			pointerId = event.pointerId;
			offsetX = event.clientX - rect.left;
			offsetY = event.clientY - rect.top;
			drawer.style.left = `${rect.left}px`;
			drawer.style.top = `${rect.top}px`;
			drawer.classList.add("is-positioned", "is-dragging");
			handle.setPointerCapture(event.pointerId);
			event.preventDefault();
		},
		{ signal },
	);
	handle.addEventListener("pointermove", move, { signal });
	handle.addEventListener("pointerup", stop, { signal });
	handle.addEventListener("pointercancel", stop, { signal });
	window.addEventListener(
		"resize",
		() => {
			if (!drawer.classList.contains("is-positioned")) return;
			const rect = drawer.getBoundingClientRect();
			drawer.style.left = `${Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - rect.width - 8))}px`;
			drawer.style.top = `${Math.min(Math.max(8, rect.top), Math.max(8, window.innerHeight - rect.height - 8))}px`;
		},
		{ passive: true, signal },
	);
}

async function prepareDrawer(drawer: HTMLElement): Promise<void> {
	const drawerId = drawer.dataset.dockDrawer;
	if (drawerId === "music") {
		const manager = window.__fireflyMusic;
		if (manager && !manager.getState().initialized) manager.init();
	}
	if (drawerId === "toc") {
		const content = document.getElementById("dock-toc-content");
		if (!content) return;
		content.replaceChildren();
		const manager = new TOCManager({
			contentId: "dock-toc-content",
			indicatorId: "dock-toc-active-indicator",
			maxLevel: 3,
			scrollOffset: 80,
		});
		manager.init();
	}
}

function toggleDrawer(drawerId: string, button: HTMLElement): void {
	if (
		drawerId === "guestbook" &&
		isGuestbookPathname(window.location.pathname)
	) {
		closeAllDrawers(false);
		return;
	}
	const drawer = document.querySelector<HTMLElement>(
		`[data-dock-drawer="${drawerId}"]`,
	);
	if (!drawer) return;
	const wasOpen = !drawer.classList.contains("dock-drawer-closed");
	closeToolsSheet(false);
	closeAllDrawers(false);
	if (wasOpen) return;

	previousFocus = button;
	if (drawerId === "guestbook") resetGuestbookDrawerPosition(drawer);
	drawer.classList.remove("dock-drawer-closed");
	drawer.setAttribute("aria-hidden", "false");
	drawer.inert = false;
	if (window.matchMedia("(max-width: 768px)").matches) setOverlay(true);
	syncBodyLock();
	void prepareDrawer(drawer);
	window.requestAnimationFrame(() => {
		(getFocusable(drawer)[0] ?? drawer).focus();
	});
}

function setDesktopExpanded(expanded: boolean): void {
	const stack = document.getElementById("dock-stack");
	const button = document.querySelector<HTMLElement>(
		'[data-dock-command="toggle"]',
	);
	stack?.setAttribute("data-expanded", String(expanded));
	button?.setAttribute("aria-expanded", String(expanded));
	button
		?.querySelector<HTMLElement>('[data-surface-icon="closed"]')
		?.classList.toggle("hidden", expanded);
	button
		?.querySelector<HTMLElement>('[data-surface-icon="open"]')
		?.classList.toggle("hidden", !expanded);
	const label = button?.querySelector<HTMLElement>(".dock-btn-label");
	if (label) label.textContent = expanded ? "收起" : "展开";
	button?.setAttribute("data-tooltip", expanded ? "收起" : "展开");
	if (!expanded) closeAllDrawers(false);
}

function updateThemeState(): void {
	const isDark = document.documentElement.classList.contains("dark");
	for (const button of document.querySelectorAll<HTMLElement>(
		'[data-dock-command="theme"]',
	)) {
		button
			.querySelector<HTMLElement>('[data-theme-icon="light"]')
			?.classList.toggle("hidden", isDark);
		button
			.querySelector<HTMLElement>('[data-theme-icon="dark"]')
			?.classList.toggle("hidden", !isDark);
		button.setAttribute("data-tooltip", isDark ? "切换亮色" : "切换暗色");
	}
}

function updateMusicState(): void {
	const playing = window.__fireflyMusic?.getState().isPlaying ?? false;
	for (const button of document.querySelectorAll<HTMLElement>(
		'[data-dock-command="music"]',
	)) {
		button.classList.toggle("is-playing", playing);
	}
}

function updateCommandVisibility(): void {
	const context = getRuntimeContext();
	for (const element of document.querySelectorAll<HTMLElement>(
		"[data-dock-command]",
	)) {
		const commandId = element.dataset.dockCommand as DockCommandId | undefined;
		if (!commandId || !(commandId in dockCommands)) continue;
		const command = dockCommands[commandId];
		const isPrimaryHome =
			commandId === "home" && element.closest("#mobile-dock") !== null;
		const available = element.dataset.commandAvailable !== "false";
		const visible =
			available && (isPrimaryHome || isDockCommandVisible(command, context));
		const blockedOnCurrentPage =
			commandId === "guestbook" && isGuestbookPathname(context.pathname);
		element.hidden = !visible;
		element.classList.toggle("hide", !visible);
		if (element instanceof HTMLButtonElement) {
			element.disabled = blockedOnCurrentPage;
		}
		element.setAttribute("aria-disabled", String(blockedOnCurrentPage));
		if (isPrimaryHome) {
			element.classList.toggle("is-active", context.pathname === "/");
		}
	}
}

function toggleSpine(button: HTMLElement): void {
	const target = document.getElementById("spine-model-container");
	if (!target) return;
	const isHidden = target.style.display === "none";
	target.style.display = isHidden ? "" : "none";
	button.setAttribute("aria-pressed", String(isHidden));
	localStorage.setItem("spine-hidden", String(!isHidden));
}

function closeSurfaces(): void {
	closeToolsSheet(false);
	closeAllDrawers(false);
}

function navigate(path: string): void {
	if (window.navigateToPage) window.navigateToPage(path);
	else window.location.assign(path);
}

function executeCommand(commandId: DockCommandId, button: HTMLElement): void {
	const command = dockCommands[commandId];
	const { action } = command;
	switch (action.type) {
		case "navigate":
			closeSurfaces();
			navigate(action.path);
			break;
		case "drawer":
			toggleDrawer(action.drawer, button);
			break;
		case "scroll": {
			closeSurfaces();
			if (action.target === "top") {
				window.scrollTo({ top: 0, behavior: "smooth" });
			} else {
				document
					.querySelector(action.target)
					?.scrollIntoView({ behavior: "smooth", block: "start" });
			}
			break;
		}
		case "theme":
			toggleTheme();
			break;
		case "search":
			closeSurfaces();
			requestSearchModalToggle();
			break;
		case "xiao":
			closeSurfaces();
			window.location.assign("/live2D/");
			break;
		case "spine":
			toggleSpine(button);
			break;
		case "surface":
			if (action.surface === "desktop") {
				const expanded =
					document.getElementById("dock-stack")?.dataset.expanded === "true";
				setDesktopExpanded(!expanded);
			} else if (action.surface === "tools") {
				const sheet = document.getElementById("mobile-dock-sheet");
				if (sheet?.classList.contains("is-open")) closeToolsSheet(true);
				else openToolsSheet(button);
			} else {
				closeSurfaces();
				emitTypedEvent<ShellEventMap, typeof NAV_MENU_TOGGLE_EVENT>(
					window,
					NAV_MENU_TOGGLE_EVENT,
					{ source: "mobile-dock" },
				);
			}
			break;
	}
}

function handleFocusTrap(event: KeyboardEvent): void {
	if (event.key === "Escape") {
		if (getOpenDrawer()) closeAllDrawers(true);
		else closeToolsSheet(true);
		return;
	}
	if (event.key !== "Tab") return;
	const surface =
		getOpenDrawer() ??
		document.querySelector<HTMLElement>("#mobile-dock-sheet.is-open");
	if (!surface) return;
	const focusable = getFocusable(surface);
	if (focusable.length === 0) return;
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

function observeNavigationMenu(): void {
	navObserver?.disconnect();
	const panel = document.getElementById("nav-menu-panel");
	const button = document.querySelector<HTMLElement>(
		'[data-dock-command="menu"]',
	);
	if (!panel || !button) return;
	const sync = () => {
		const open = panel.classList.contains("is-open");
		button.setAttribute("aria-expanded", String(open));
		button
			.querySelector<HTMLElement>('[data-surface-icon="closed"]')
			?.classList.toggle("hidden", open);
		button
			.querySelector<HTMLElement>('[data-surface-icon="open"]')
			?.classList.toggle("hidden", !open);
	};
	navObserver = new MutationObserver(sync);
	navObserver.observe(panel, { attributes: true, attributeFilter: ["class"] });
	sync();
}

export function initDockController(): void {
	controller?.abort();
	controller = new AbortController();
	const { signal } = controller;
	let lastScrollY = window.scrollY;

	for (const button of document.querySelectorAll<HTMLElement>(
		"[data-dock-command]",
	)) {
		button.addEventListener(
			"click",
			(event) => {
				event.stopPropagation();
				const commandId = button.dataset.dockCommand as DockCommandId;
				executeCommand(commandId, button);
			},
			{ signal },
		);
	}
	for (const button of document.querySelectorAll<HTMLElement>(
		"[data-dock-close]",
	)) {
		button.addEventListener("click", () => closeAllDrawers(true), { signal });
	}

	document.getElementById("mobile-dock-overlay")?.addEventListener(
		"click",
		() => {
			closeToolsSheet(false);
			closeAllDrawers(false);
		},
		{ signal },
	);

	document.addEventListener("keydown", handleFocusTrap, { signal });
	document.addEventListener(
		"click",
		(event) => {
			const target = event.target as Node | null;
			if (!target) return;
			if (
				document.getElementById("floating-dock")?.contains(target) ||
				getOpenDrawer()?.contains(target) ||
				document.getElementById("mobile-dock")?.contains(target) ||
				document.getElementById("mobile-dock-sheet")?.contains(target)
			) {
				return;
			}
			closeAllDrawers(false);
		},
		{ signal },
	);

	window.addEventListener(
		"scroll",
		() => {
			updateCommandVisibility();
			const dock = document.getElementById("mobile-dock");
			const surfaceOpen = Boolean(
				getOpenDrawer() ||
					document
						.getElementById("mobile-dock-sheet")
						?.classList.contains("is-open"),
			);
			if (!surfaceOpen && dock) {
				const nextY = window.scrollY;
				if (nextY > lastScrollY + 8 && nextY > 100) {
					dock.classList.add("is-hidden");
				} else if (nextY < lastScrollY - 8) {
					dock.classList.remove("is-hidden");
				}
				lastScrollY = nextY;
			}
		},
		{ passive: true, signal },
	);
	window.addEventListener("theme-change", updateThemeState, { signal });
	window.addEventListener("fm:play-state", updateMusicState, { signal });
	document.addEventListener(
		"astro:page-load",
		() => {
			closeSurfaces();
			setDesktopExpanded(false);
			lastScrollY = window.scrollY;
			document.getElementById("mobile-dock")?.classList.remove("is-hidden");
			updateCommandVisibility();
			observeNavigationMenu();
		},
		{ signal },
	);

	setDesktopExpanded(false);
	closeToolsSheet(false);
	closeAllDrawers(false);
	updateCommandVisibility();
	updateThemeState();
	updateMusicState();
	observeNavigationMenu();
	setupGuestbookDrawerDrag(signal);
}
