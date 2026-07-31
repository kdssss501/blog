import {
	DARK_MODE,
	DEFAULT_THEME,
	LIGHT_MODE,
	SYSTEM_MODE,
} from "@constants/constants";
import { expressiveCodeConfig, siteConfig } from "@/config";
import type { LIGHT_DARK_MODE } from "@/types/config";
import {
	type DisplayPreferencesV2,
	type PostLayoutMode,
	patchDisplayPreferences,
	readDisplayPreferences,
	type WallpaperMode,
} from "./model/preferences";

export const THEME_CHANGE_EVENT = "theme-change";
export const BACKGROUND_CHANGE_EVENT = "firefly:background-change";
export const SAKURA_CHANGE_EVENT = "firefly:sakura-change";
export const POST_LAYOUT_CHANGE_EVENT = "firefly:post-layout-change";
export const DISPLAY_EFFECT_CHANGE_EVENT = "firefly:display-effect-change";
export const WALLPAPER_TUNING_CHANGE_EVENT = "firefly:wallpaper-tuning-change";

export type BackgroundMode = WallpaperMode;
export type DisplayEffectPreference =
	| "wallpaperTitle"
	| "wallpaperCarousel"
	| "waterRipple"
	| "gradientTransition";
export type DisplayEffectsState = Pick<
	DisplayPreferencesV2,
	DisplayEffectPreference
>;
export type WallpaperTuningPreference =
	| "overlayOpacity"
	| "overlayBlur"
	| "overlayCardOpacity";
export type WallpaperTuningState = Pick<
	DisplayPreferencesV2,
	WallpaperTuningPreference
>;

type ViewTransitionHandle = {
	finished?: Promise<unknown>;
};

const THEME_TRANSITION_TIMEOUT_MS = 500;
let activeThemeTransitionId = 0;

function startThemeTransition(useViewTransition: boolean): () => void {
	const root = document.documentElement;
	const transitionId = ++activeThemeTransitionId;
	let cleaned = false;

	root.classList.add("is-theme-transitioning");
	root.classList.toggle("use-view-transition", useViewTransition);

	const cleanupTimer =
		typeof window !== "undefined"
			? window.setTimeout(cleanup, THEME_TRANSITION_TIMEOUT_MS)
			: undefined;

	function cleanup() {
		if (cleaned || transitionId !== activeThemeTransitionId) {
			return;
		}
		cleaned = true;
		if (cleanupTimer !== undefined && typeof window !== "undefined") {
			window.clearTimeout(cleanupTimer);
		}
		root.classList.remove("is-theme-transitioning", "use-view-transition");
	}

	return cleanup;
}

function queueThemeTransitionCleanup(cleanup: () => void): void {
	if (
		typeof window !== "undefined" &&
		typeof window.requestAnimationFrame === "function"
	) {
		window.requestAnimationFrame(cleanup);
		return;
	}
	cleanup();
}

function runThemeMutation(
	update: () => void,
	preferViewTransition: boolean,
): void {
	if (document.documentElement.dataset.gradientTransition === "off") {
		update();
		return;
	}
	const startViewTransition = preferViewTransition
		? document.startViewTransition
		: undefined;
	const canUseViewTransition = typeof startViewTransition === "function";
	const cleanupThemeTransition = startThemeTransition(canUseViewTransition);

	if (canUseViewTransition) {
		try {
			const transition = startViewTransition.call(
				document,
				update,
			) as unknown as ViewTransitionHandle;
			if (transition?.finished) {
				void transition.finished.finally(cleanupThemeTransition);
			} else {
				queueThemeTransitionCleanup(cleanupThemeTransition);
			}
		} catch {
			cleanupThemeTransition();
			const fallbackCleanup = startThemeTransition(false);
			update();
			queueThemeTransitionCleanup(fallbackCleanup);
		}
		return;
	}

	update();
	queueThemeTransitionCleanup(cleanupThemeTransition);
}

export function getDefaultHue(): number {
	const fallback = "310";
	// 检查是否在浏览器环境中
	if (typeof document === "undefined") {
		return Number.parseInt(fallback, 10);
	}
	const configCarrier = document.getElementById("config-carrier");
	return Number.parseInt(configCarrier?.dataset.hue || fallback, 10);
}

export function getDefaultTheme(): LIGHT_DARK_MODE {
	// 如果配置文件中设置了 defaultMode，使用配置的值
	// 否则使用 DEFAULT_THEME（向后兼容）
	return siteConfig.themeColor.defaultMode ?? DEFAULT_THEME;
}

// 获取系统主题
export function getSystemTheme(): LIGHT_DARK_MODE {
	if (typeof window === "undefined") {
		return LIGHT_MODE;
	}
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? DARK_MODE
		: LIGHT_MODE;
}

// 解析主题（如果是system模式，则获取系统主题）
export function resolveTheme(theme: LIGHT_DARK_MODE): LIGHT_DARK_MODE {
	if (theme === SYSTEM_MODE) {
		return getSystemTheme();
	}
	return theme;
}

export function getHue(): number {
	if (typeof window === "undefined" || !window.localStorage) {
		return getDefaultHue();
	}
	return readDisplayPreferences(localStorage, {
		hue: getDefaultHue(),
		theme: getDefaultTheme(),
	}).hue;
}

export function setHue(hue: number): void {
	// 先检查是否在浏览器环境
	if (
		typeof window === "undefined" ||
		!window.localStorage ||
		typeof document === "undefined"
	) {
		return;
	}
	const preferences = patchDisplayPreferences(
		localStorage,
		{ hue },
		{
			hue: getDefaultHue(),
			theme: getDefaultTheme(),
		},
	);
	const r = document.querySelector(":root") as HTMLElement;
	if (!r) {
		return;
	}
	r.style.setProperty("--hue", String(preferences.hue));
}

export function applyThemeToDocument(theme: LIGHT_DARK_MODE): void {
	// 检查是否在浏览器环境中
	if (typeof document === "undefined") {
		return;
	}

	// 解析主题
	const resolvedTheme = resolveTheme(theme);

	// 获取当前主题状态的完整信息
	const currentIsDark = document.documentElement.classList.contains("dark");
	const currentTheme = document.documentElement.getAttribute("data-theme");

	// 计算目标主题状态
	let targetIsDark = false; // 初始化默认值
	switch (resolvedTheme) {
		case LIGHT_MODE:
			targetIsDark = false;
			break;
		case DARK_MODE:
			targetIsDark = true;
			break;
		default:
			// 处理默认情况，使用当前主题状态
			targetIsDark = currentIsDark;
			break;
	}

	// 检测是否真的需要主题切换：
	// 1. dark类状态是否改变
	// 2. expressiveCode主题是否需要更新
	const needsThemeChange = currentIsDark !== targetIsDark;
	const expectedTheme = targetIsDark
		? expressiveCodeConfig.darkTheme
		: expressiveCodeConfig.lightTheme;
	const needsCodeThemeUpdate = currentTheme !== expectedTheme;

	// 如果既不需要主题切换也不需要代码主题更新，直接返回
	if (!needsThemeChange && !needsCodeThemeUpdate) {
		return;
	}

	// 实际执行主题切换的函数
	const doApply = () => {
		if (needsThemeChange) {
			if (targetIsDark) {
				document.documentElement.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
			}
		}
		if (needsCodeThemeUpdate) {
			document.documentElement.setAttribute("data-theme", expectedTheme);
		}
	};

	runThemeMutation(doApply, needsThemeChange);
}

// 系统主题监听器引用
let systemThemeListener:
	| ((e: MediaQueryListEvent | MediaQueryList) => void)
	| null = null;

export function setTheme(theme: LIGHT_DARK_MODE): void {
	// 检查是否在浏览器环境中
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.setItem !== "function"
	) {
		return;
	}

	// 先应用主题
	applyThemeToDocument(theme);

	patchDisplayPreferences(
		localStorage,
		{ theme },
		{
			hue: getDefaultHue(),
			theme: getDefaultTheme(),
		},
	);

	// 如果切换到 system 模式，需要监听系统主题变化
	if (theme === SYSTEM_MODE) {
		setupSystemThemeListener();
	} else {
		// 如果切换其他模式，移除系统主题监听
		cleanupSystemThemeListener();
	}

	window.dispatchEvent(
		new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } }),
	);
}

export function getBackgroundMode(): BackgroundMode {
	if (typeof localStorage === "undefined") return "none";
	return readDisplayPreferences(localStorage, {
		hue: getDefaultHue(),
		theme: getDefaultTheme(),
	}).wallpaperMode;
}

export function applyBackgroundMode(mode: BackgroundMode): void {
	if (typeof document === "undefined") return;
	document.documentElement.dataset.wallpaperMode = mode;
	document.documentElement.dataset.backgroundMode =
		mode === "none" ? "plain" : "wallpaper";

	const carrier = document.getElementById("config-carrier");
	const image = carrier?.dataset.backgroundImage;
	const mobileImage = carrier?.dataset.backgroundImageMobile || image;
	if (image) {
		document.documentElement.style.setProperty(
			"--site-wallpaper",
			`url("${image}")`,
		);
	}
	if (mobileImage) {
		document.documentElement.style.setProperty(
			"--site-wallpaper-mobile",
			`url("${mobileImage}")`,
		);
	}
}

export function setBackgroundMode(mode: BackgroundMode): void {
	if (typeof localStorage === "undefined") return;
	patchDisplayPreferences(
		localStorage,
		{ wallpaperMode: mode },
		{
			hue: getDefaultHue(),
			theme: getDefaultTheme(),
		},
	);
	applyBackgroundMode(mode);
	window.dispatchEvent(
		new CustomEvent(BACKGROUND_CHANGE_EVENT, { detail: { mode } }),
	);
}

export function getWallpaperTuning(): WallpaperTuningState {
	const defaults: WallpaperTuningState = {
		overlayOpacity: 88,
		overlayBlur: 2,
		overlayCardOpacity: 68,
	};
	if (typeof localStorage === "undefined") return defaults;
	const preferences = readDisplayPreferences(localStorage, {
		hue: getDefaultHue(),
		theme: getDefaultTheme(),
		...defaults,
	});
	return {
		overlayOpacity: preferences.overlayOpacity,
		overlayBlur: preferences.overlayBlur,
		overlayCardOpacity: preferences.overlayCardOpacity,
	};
}

export function applyWallpaperTuning(tuning: WallpaperTuningState): void {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	root.style.setProperty(
		"--wallpaper-overlay-opacity",
		String(tuning.overlayOpacity / 100),
	);
	root.style.setProperty("--wallpaper-overlay-blur", `${tuning.overlayBlur}px`);
	root.style.setProperty(
		"--wallpaper-card-opacity",
		String(tuning.overlayCardOpacity / 100),
	);
}

export function setWallpaperTuning(
	key: WallpaperTuningPreference,
	value: number,
): WallpaperTuningState {
	const fallback = getWallpaperTuning();
	if (typeof localStorage === "undefined") {
		const next = { ...fallback, [key]: value };
		applyWallpaperTuning(next);
		return next;
	}
	const preferences = patchDisplayPreferences(
		localStorage,
		{ [key]: value },
		{
			hue: getDefaultHue(),
			theme: getDefaultTheme(),
			...fallback,
		},
	);
	const next: WallpaperTuningState = {
		overlayOpacity: preferences.overlayOpacity,
		overlayBlur: preferences.overlayBlur,
		overlayCardOpacity: preferences.overlayCardOpacity,
	};
	applyWallpaperTuning(next);
	window.dispatchEvent(
		new CustomEvent(WALLPAPER_TUNING_CHANGE_EVENT, {
			detail: { key, value: next[key], tuning: next },
		}),
	);
	return next;
}

export function getDisplayEffects(): DisplayEffectsState {
	const defaults: DisplayEffectsState = {
		wallpaperTitle: true,
		wallpaperCarousel: false,
		waterRipple: true,
		gradientTransition: true,
	};
	if (typeof localStorage === "undefined") return defaults;
	const preferences = readDisplayPreferences(localStorage, {
		hue: getDefaultHue(),
		theme: getDefaultTheme(),
		...defaults,
	});
	return {
		wallpaperTitle: preferences.wallpaperTitle,
		wallpaperCarousel: preferences.wallpaperCarousel,
		waterRipple: preferences.waterRipple,
		gradientTransition: preferences.gradientTransition,
	};
}

export function applyDisplayEffects(effects: DisplayEffectsState): void {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	root.dataset.wallpaperTitle = effects.wallpaperTitle ? "on" : "off";
	root.dataset.wallpaperCarousel = effects.wallpaperCarousel ? "on" : "off";
	root.dataset.waterRipple = effects.waterRipple ? "on" : "off";
	root.dataset.gradientTransition = effects.gradientTransition ? "on" : "off";
}

export function setDisplayEffect(
	key: DisplayEffectPreference,
	enabled: boolean,
): DisplayEffectsState {
	const fallback = getDisplayEffects();
	if (typeof localStorage === "undefined") {
		const next = { ...fallback, [key]: enabled };
		applyDisplayEffects(next);
		return next;
	}
	const preferences = patchDisplayPreferences(
		localStorage,
		{ [key]: enabled },
		{
			hue: getDefaultHue(),
			theme: getDefaultTheme(),
			...fallback,
		},
	);
	const next: DisplayEffectsState = {
		wallpaperTitle: preferences.wallpaperTitle,
		wallpaperCarousel: preferences.wallpaperCarousel,
		waterRipple: preferences.waterRipple,
		gradientTransition: preferences.gradientTransition,
	};
	applyDisplayEffects(next);
	window.dispatchEvent(
		new CustomEvent(DISPLAY_EFFECT_CHANGE_EVENT, {
			detail: { key, enabled, effects: next },
		}),
	);
	return next;
}

export function getSakuraEnabled(): boolean {
	if (typeof localStorage === "undefined") return false;
	return readDisplayPreferences(localStorage, {
		hue: getDefaultHue(),
		theme: getDefaultTheme(),
	}).sakura;
}

export function setSakuraEnabled(enabled: boolean): void {
	if (typeof localStorage === "undefined") return;
	patchDisplayPreferences(
		localStorage,
		{ sakura: enabled },
		{
			hue: getDefaultHue(),
			theme: getDefaultTheme(),
		},
	);
	document.documentElement.dataset.sakura = enabled ? "on" : "off";
	window.dispatchEvent(
		new CustomEvent(SAKURA_CHANGE_EVENT, { detail: { enabled } }),
	);
}

export function getPostLayout(): PostLayoutMode {
	if (typeof localStorage === "undefined") return "grid";
	return readDisplayPreferences(localStorage, {
		hue: getDefaultHue(),
		theme: getDefaultTheme(),
	}).postLayout;
}

export function setPostLayout(layout: PostLayoutMode): void {
	if (typeof localStorage === "undefined") return;
	patchDisplayPreferences(
		localStorage,
		{ postLayout: layout },
		{
			hue: getDefaultHue(),
			theme: getDefaultTheme(),
		},
	);
	document.documentElement.dataset.postLayout = layout;
	window.dispatchEvent(
		new CustomEvent(POST_LAYOUT_CHANGE_EVENT, { detail: { layout } }),
	);
}

export function toggleTheme(): LIGHT_DARK_MODE {
	const current = getStoredTheme();
	const resolved = current === SYSTEM_MODE ? getSystemTheme() : current;
	const next = resolved === LIGHT_MODE ? DARK_MODE : LIGHT_MODE;
	setTheme(next);
	return next;
}

// 设置系统主题监听器
export function setupSystemThemeListener(): void {
	// 先清理之前的监听器
	cleanupSystemThemeListener();

	if (typeof window === "undefined") {
		return;
	}

	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

	// 处理系统主题变化的回调
	const handleSystemThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
		const isDark = e.matches;
		const currentIsDark = document.documentElement.classList.contains("dark");

		// 如果主题状态没有变化，直接返回
		if (currentIsDark === isDark) {
			return;
		}

		// 应用系统主题切换
		const applySystemTheme = () => {
			if (isDark) {
				document.documentElement.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
			}
			const expressiveTheme = isDark
				? expressiveCodeConfig.darkTheme
				: expressiveCodeConfig.lightTheme;
			document.documentElement.setAttribute("data-theme", expressiveTheme);
		};

		runThemeMutation(applySystemTheme, true);

		// 触发自定义事件通知其他组件（仅在真正切换时触发）
		window.dispatchEvent(
			new CustomEvent(THEME_CHANGE_EVENT, {
				detail: { theme: isDark ? DARK_MODE : LIGHT_MODE },
			}),
		);
	};

	// 监听系统主题变化（现代浏览器）
	if (mediaQuery.addEventListener) {
		mediaQuery.addEventListener("change", handleSystemThemeChange);
	} else {
		// 兼容旧浏览器
		mediaQuery.addListener(handleSystemThemeChange);
	}

	systemThemeListener = handleSystemThemeChange;
}

// 清理系统主题监听器
function cleanupSystemThemeListener() {
	if (typeof window === "undefined" || !systemThemeListener) {
		return;
	}

	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

	if (mediaQuery.removeEventListener) {
		mediaQuery.removeEventListener("change", systemThemeListener);
	} else {
		// 兼容旧浏览器
		mediaQuery.removeListener(systemThemeListener);
	}

	systemThemeListener = null;
}

export function getStoredTheme(): LIGHT_DARK_MODE {
	// 检查是否在浏览器环境中
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultTheme();
	}
	return readDisplayPreferences(localStorage, {
		hue: getDefaultHue(),
		theme: getDefaultTheme(),
	}).theme;
}
