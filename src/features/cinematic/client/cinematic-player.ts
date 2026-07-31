import { navigateToPage } from "@/utils/navigation-utils";
import {
	CINEMATIC_CLIPS,
	isCinematicClipId,
	type CinematicClip,
} from "../model/clips";

type CinematicMode = "navigate" | "preview";

const ACTIVE_CLASS = "is-active";
const CLOSING_CLASS = "is-closing";
const OPEN_FOCUS_DELAY_MS = 240;
const NAVIGATION_TIMEOUT_MS = 5000;

function prefersReducedMotion() {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function prefersLessData() {
	const connection = (
		navigator as Navigator & {
			connection?: { saveData?: boolean; effectiveType?: string };
		}
	).connection;
	return Boolean(
		connection?.saveData ||
		connection?.effectiveType === "slow-2g" ||
		connection?.effectiveType === "2g",
	);
}

function normalizePathname(value: string) {
	try {
		return new URL(value, window.location.href).pathname.replace(/\/+$/, "") || "/";
	} catch {
		return value.replace(/\/+$/, "") || "/";
	}
}

export function initCinematicPlayer() {
	const root = document.querySelector<HTMLElement>("[data-cinematic-player]");
	if (!root || root.dataset.initialized === "true") return;
	root.dataset.initialized = "true";

	const video = root.querySelector<HTMLVideoElement>("[data-cinematic-video]");
	const mp4Source = root.querySelector<HTMLSourceElement>("[data-cinematic-source='mp4']");
	const webmSource = root.querySelector<HTMLSourceElement>("[data-cinematic-source='webm']");
	const title = root.querySelector<HTMLElement>("[data-cinematic-title]");
	const duration = root.querySelector<HTMLElement>("[data-cinematic-duration]");
	const progress = root.querySelector<HTMLElement>("[data-cinematic-progress]");
	const toggleButton = root.querySelector<HTMLButtonElement>("[data-cinematic-toggle]");
	const audioButton = root.querySelector<HTMLButtonElement>("[data-cinematic-audio]");
	const dismissButton = root.querySelector<HTMLButtonElement>("[data-cinematic-dismiss]");
	if (
		!video ||
		!mp4Source ||
		!webmSource ||
		!title ||
		!duration ||
		!progress ||
		!toggleButton ||
		!audioButton ||
		!dismissButton
	) return;

	let activeClip: CinematicClip | null = null;
	let activeMode: CinematicMode = "preview";
	let targetHref = "";
	let navigationStarted = false;
	let navigationTimeout: number | undefined;
	let closeTimer: number | undefined;
	let focusTimer: number | undefined;
	let previousFocus: HTMLElement | null = null;
	let isolatedSiblings: Array<{
		element: HTMLElement;
		inert: boolean;
		ariaHidden: string | null;
	}> = [];

	const clearTimers = () => {
		window.clearTimeout(navigationTimeout);
		window.clearTimeout(closeTimer);
		window.clearTimeout(focusTimer);
		navigationTimeout = undefined;
		closeTimer = undefined;
		focusTimer = undefined;
	};

	const isolateBackground = () => {
		if (isolatedSiblings.length > 0) return;
		isolatedSiblings = [...(root.parentElement?.children ?? [])]
			.filter((element): element is HTMLElement =>
				element instanceof HTMLElement && element !== root,
			)
			.map((element) => ({
				element,
				inert: element.inert,
				ariaHidden: element.getAttribute("aria-hidden"),
			}));
		for (const { element } of isolatedSiblings) {
			element.inert = true;
			element.setAttribute("aria-hidden", "true");
		}
	};

	const restoreBackground = () => {
		for (const { element, inert, ariaHidden } of isolatedSiblings) {
			element.inert = inert;
			if (ariaHidden === null) element.removeAttribute("aria-hidden");
			else element.setAttribute("aria-hidden", ariaHidden);
		}
		isolatedSiblings = [];
	};

	const setPlaying = (playing: boolean) => {
		root.dataset.playing = playing ? "true" : "false";
		toggleButton.setAttribute("aria-label", playing ? "暂停短片" : "播放短片");
		toggleButton.title = playing ? "暂停" : "播放";
	};

	const setMuted = (muted: boolean) => {
		video.muted = muted;
		root.dataset.muted = muted ? "true" : "false";
		audioButton.setAttribute("aria-pressed", muted ? "false" : "true");
		audioButton.setAttribute("aria-label", muted ? "开启声音" : "关闭声音");
		audioButton.title = muted ? "开启声音" : "关闭声音";
	};

	const unloadVideo = () => {
		video.pause();
		video.removeAttribute("src");
		mp4Source.removeAttribute("src");
		webmSource.removeAttribute("src");
		video.removeAttribute("poster");
		video.load();
		progress.style.transform = "scaleX(0)";
	};

	const close = (restoreFocus = true) => {
		if (root.hidden) return;
		clearTimers();
		root.classList.remove(ACTIVE_CLASS);
		root.classList.add(CLOSING_CLASS);
		document.documentElement.removeAttribute("data-cinematic-open");
		restoreBackground();
		if (restoreFocus && previousFocus?.isConnected) previousFocus.focus();
		root.setAttribute("aria-hidden", "true");
		closeTimer = window.setTimeout(() => {
			root.hidden = true;
			root.classList.remove(CLOSING_CLASS);
			unloadVideo();
			activeClip = null;
			targetHref = "";
			navigationStarted = false;
			previousFocus = null;
		}, prefersReducedMotion() ? 0 : 220);
	};

	const finishNavigation = () => {
		if (!targetHref) return;
		if (normalizePathname(window.location.pathname) === normalizePathname(targetHref)) {
			close(false);
		}
	};

	const beginNavigation = () => {
		if (navigationStarted || !targetHref) return;
		navigationStarted = true;
		root.dataset.navigating = "true";
		navigateToPage(targetHref);
		navigationTimeout = window.setTimeout(() => {
			if (normalizePathname(window.location.pathname) !== normalizePathname(targetHref)) {
				window.location.assign(targetHref);
				return;
			}
			close(false);
		}, NAVIGATION_TIMEOUT_MS);
	};

	const open = async (
		clip: CinematicClip,
		mode: CinematicMode,
		href: string,
		trigger: HTMLElement,
	) => {
		clearTimers();
		activeClip = clip;
		activeMode = mode;
		targetHref = href;
		navigationStarted = false;
		previousFocus = trigger;

		root.dataset.mode = mode;
		root.dataset.navigating = "false";
		root.dataset.clip = clip.id;
		title.textContent = clip.title;
		duration.textContent = `${clip.duration.toFixed(1)} SEC`;
		dismissButton.setAttribute("aria-label", mode === "navigate" ? "跳过序章" : "关闭短片");
		dismissButton.title = mode === "navigate" ? "跳过" : "关闭";
		setMuted(true);
		setPlaying(false);

		root.classList.remove(ACTIVE_CLASS, CLOSING_CLASS);
		root.hidden = false;
		root.setAttribute("aria-hidden", "false");
		document.documentElement.dataset.cinematicOpen = "true";
		video.poster = clip.poster;
		mp4Source.src = clip.mp4;
		webmSource.src = clip.webm;
		video.currentTime = 0;
		video.load();
		requestAnimationFrame(() => {
			root.classList.add(ACTIVE_CLASS);
			isolateBackground();
			focusTimer = window.setTimeout(() => {
				if (root.hidden || root.classList.contains(CLOSING_CLASS)) return;
				dismissButton.focus({ preventScroll: true });
			}, prefersReducedMotion() ? 0 : OPEN_FOCUS_DELAY_MS);
		});

		try {
			await video.play();
			setPlaying(true);
		} catch {
			if (mode === "navigate" && video.error) beginNavigation();
		}
	};

	const togglePlayback = () => {
		if (!activeClip || activeMode === "navigate") return;
		if (video.ended) video.currentTime = 0;
		if (video.paused) {
			void video.play().catch(() => undefined);
		} else {
			video.pause();
		}
	};

	document.addEventListener("click", (event) => {
		const target = event.target instanceof Element ? event.target : null;
		const trigger = target?.closest<HTMLElement>("[data-cinematic-trigger]");
		if (!trigger) return;
		const clipId = trigger.dataset.cinematicClip;
		if (!isCinematicClipId(clipId)) return;

		event.preventDefault();
		const mode = trigger.dataset.cinematicMode === "navigate" ? "navigate" : "preview";
		const href = trigger.dataset.cinematicHref || "";
		if (mode === "navigate" && (prefersReducedMotion() || prefersLessData())) {
			navigateToPage(href);
			return;
		}
		void open(CINEMATIC_CLIPS[clipId], mode, href, trigger);
	});

	toggleButton.addEventListener("click", togglePlayback);
	video.addEventListener("click", togglePlayback);
	audioButton.addEventListener("click", () => setMuted(!video.muted));
	dismissButton.addEventListener("click", () => {
		if (activeMode === "navigate") beginNavigation();
		else close();
	});
	root.addEventListener("click", (event) => {
		if (event.target !== root || activeMode === "navigate") return;
		close();
	});
	video.addEventListener("play", () => setPlaying(true));
	video.addEventListener("pause", () => setPlaying(false));
	video.addEventListener("timeupdate", () => {
		const total = Number.isFinite(video.duration) && video.duration > 0
			? video.duration
			: activeClip?.duration || 1;
		progress.style.transform = `scaleX(${Math.min(1, video.currentTime / total)})`;
	});
	video.addEventListener("ended", () => {
		setPlaying(false);
		if (activeMode === "navigate") beginNavigation();
	});
	video.addEventListener("error", () => {
		if (activeMode === "navigate") beginNavigation();
		else close();
	});

	document.addEventListener("keydown", (event) => {
		if (root.hidden) return;
		if (event.key === "Escape") {
			event.preventDefault();
			if (activeMode === "navigate") beginNavigation();
			else close();
			return;
		}
		if (event.key !== "Tab") return;
		const focusable = [toggleButton, audioButton, dismissButton].filter(
			(button) => getComputedStyle(button).display !== "none",
		);
		if (focusable.length === 0) return;
		const currentIndex = focusable.indexOf(document.activeElement as HTMLButtonElement);
		const nextIndex = event.shiftKey
			? (currentIndex <= 0 ? focusable.length : currentIndex) - 1
			: (currentIndex + 1) % focusable.length;
		event.preventDefault();
		focusable[nextIndex].focus();
	});
	document.addEventListener("visibilitychange", () => {
		if (!document.hidden || root.hidden) return;
		video.pause();
		if (activeMode === "navigate") beginNavigation();
	});
	document.addEventListener("astro:page-load", finishNavigation);
}
