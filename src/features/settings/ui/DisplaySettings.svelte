<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import type { WallpaperTuningPreference } from "../client";
import {
	applyDisplayEffects,
	BACKGROUND_CHANGE_EVENT,
	type BackgroundMode,
	DISPLAY_EFFECT_CHANGE_EVENT,
	type DisplayEffectPreference,
	getBackgroundMode,
	getDefaultHue,
	getDisplayEffects,
	getHue,
	getPostLayout,
	getSakuraEnabled,
	getWallpaperTuning,
	POST_LAYOUT_CHANGE_EVENT,
	SAKURA_CHANGE_EVENT,
	setBackgroundMode,
	setDisplayEffect,
	setHue,
	setPostLayout,
	setSakuraEnabled,
	setWallpaperTuning,
	WALLPAPER_TUNING_CHANGE_EVENT,
} from "../client";
import type { PostLayoutMode } from "../model/preferences";

let background = $state<BackgroundMode>("none");
let hue = $state(310);
let sakura = $state(false);
let postLayout = $state<PostLayoutMode>("list");
let wallpaperTitle = $state(true);
let wallpaperCarousel = $state(false);
let waterRipple = $state(true);
let gradientTransition = $state(true);
let overlayOpacity = $state(88);
let overlayBlur = $state(2);
let overlayCardOpacity = $state(68);

let carouselTimer: number | undefined;
let wallpaperSwapTimer: number | undefined;
let carouselIndex = 0;
const CAROUSEL_INTERVAL_MS = 12_000;

function chooseBackground(value: BackgroundMode) {
	background = value;
	setBackgroundMode(value);
}

function updateHue(event: Event) {
	hue = Number((event.currentTarget as HTMLInputElement).value);
	setHue(hue);
}

function resetHue() {
	hue = getDefaultHue();
	setHue(hue);
}

function resetBackground() {
	chooseBackground("none");
}

function toggleSakura() {
	sakura = !sakura;
	setSakuraEnabled(sakura);
}

function resetSakura() {
	sakura = false;
	setSakuraEnabled(false);
}

function choosePostLayout(value: PostLayoutMode) {
	postLayout = value;
	setPostLayout(value);
}

function syncEffectState() {
	const effects = getDisplayEffects();
	wallpaperTitle = effects.wallpaperTitle;
	wallpaperCarousel = effects.wallpaperCarousel;
	waterRipple = effects.waterRipple;
	gradientTransition = effects.gradientTransition;
	applyDisplayEffects(effects);
}

function toggleDisplayEffect(key: DisplayEffectPreference) {
	const current = {
		wallpaperTitle,
		wallpaperCarousel,
		waterRipple,
		gradientTransition,
	}[key];
	setDisplayEffect(key, !current);
	syncEffectState();
	if (key === "wallpaperCarousel" || key === "gradientTransition") {
		syncWallpaperCarousel(true);
	}
}

function resetWallpaperSettings() {
	setDisplayEffect("wallpaperCarousel", false);
	for (const key of [
		"wallpaperTitle",
		"waterRipple",
		"gradientTransition",
	] as const) {
		setDisplayEffect(key, true);
	}
	syncEffectState();
	for (const [key, value] of [
		["overlayOpacity", 88],
		["overlayBlur", 2],
		["overlayCardOpacity", 68],
	] as const) {
		setWallpaperTuning(key, value);
	}
	syncWallpaperTuning();
	syncWallpaperCarousel(true);
}

function syncWallpaperTuning() {
	const tuning = getWallpaperTuning();
	overlayOpacity = tuning.overlayOpacity;
	overlayBlur = tuning.overlayBlur;
	overlayCardOpacity = tuning.overlayCardOpacity;
}

function updateWallpaperTuning(key: WallpaperTuningPreference, event: Event) {
	setWallpaperTuning(
		key,
		Number((event.currentTarget as HTMLInputElement).value),
	);
	syncWallpaperTuning();
}

function readWallpaperSources(): string[] {
	const carrier = document.getElementById("config-carrier");
	const sources: string[] = [];
	const base = carrier?.dataset.backgroundImage;
	if (base) sources.push(base);
	try {
		const configured = JSON.parse(
			carrier?.dataset.wallpaperCarousel || "[]",
		) as unknown;
		if (Array.isArray(configured)) {
			for (const source of configured) {
				if (typeof source === "string" && source.trim()) sources.push(source);
			}
		}
	} catch {
		// 配置损坏时仍使用首页主壁纸。
	}
	return [...new Set(sources)];
}

function applyWallpaperSource(source: string, immediate = false) {
	const root = document.documentElement;
	const commit = () => {
		root.style.setProperty("--site-wallpaper", `url("${source}")`);
		root.style.setProperty("--site-wallpaper-mobile", `url("${source}")`);
	};

	if (immediate || !gradientTransition) {
		commit();
		return;
	}

	root.classList.add("is-wallpaper-switching");
	if (wallpaperSwapTimer !== undefined) window.clearTimeout(wallpaperSwapTimer);
	wallpaperSwapTimer = window.setTimeout(() => {
		commit();
		requestAnimationFrame(() =>
			root.classList.remove("is-wallpaper-switching"),
		);
		wallpaperSwapTimer = undefined;
	}, 280);
}

function stopWallpaperCarousel() {
	if (carouselTimer !== undefined) {
		window.clearInterval(carouselTimer);
		carouselTimer = undefined;
	}
}

function syncWallpaperCarousel(resetImage = false) {
	stopWallpaperCarousel();
	const sources = readWallpaperSources();
	if (sources.length === 0) return;

	if (resetImage || !wallpaperCarousel) {
		carouselIndex = 0;
		applyWallpaperSource(sources[0], !gradientTransition);
	}
	if (!wallpaperCarousel || sources.length < 2) return;

	carouselTimer = window.setInterval(() => {
		carouselIndex = (carouselIndex + 1) % sources.length;
		applyWallpaperSource(sources[carouselIndex]);
	}, CAROUSEL_INTERVAL_MS);
}

function createWaterRipple(event: PointerEvent) {
	if (
		!waterRipple ||
		event.button > 0 ||
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	) {
		return;
	}
	const target = event.target as Element | null;
	if (
		target?.closest(
			"a, button, input, textarea, select, [contenteditable='true'], [data-water-ripple-ignore]",
		)
	) {
		return;
	}

	const oldRipples = document.querySelectorAll<HTMLElement>(
		".wallpaper-water-ripple",
	);
	if (oldRipples.length >= 8) oldRipples[0]?.remove();

	const ripple = document.createElement("span");
	ripple.className = "wallpaper-water-ripple";
	ripple.setAttribute("aria-hidden", "true");
	ripple.style.setProperty("--ripple-x", `${event.clientX}px`);
	ripple.style.setProperty("--ripple-y", `${event.clientY}px`);
	document.body.append(ripple);
	ripple.addEventListener("animationend", () => ripple.remove(), {
		once: true,
	});
	window.setTimeout(() => ripple.remove(), 1400);
}

onMount(() => {
	background = getBackgroundMode();
	hue = getHue();
	sakura = getSakuraEnabled();
	postLayout = getPostLayout();
	syncEffectState();
	syncWallpaperTuning();
	syncWallpaperCarousel();

	const syncBackground = () => {
		background = getBackgroundMode();
	};
	const syncSakura = () => (sakura = getSakuraEnabled());
	const syncPostLayout = () => (postLayout = getPostLayout());
	const syncEffects = () => {
		syncEffectState();
		syncWallpaperCarousel();
	};
	const syncAfterNavigation = () => {
		const sources = readWallpaperSources();
		if (sources.length > 0) {
			applyWallpaperSource(sources[carouselIndex % sources.length], true);
		}
	};

	window.addEventListener(BACKGROUND_CHANGE_EVENT, syncBackground);
	window.addEventListener(SAKURA_CHANGE_EVENT, syncSakura);
	window.addEventListener(POST_LAYOUT_CHANGE_EVENT, syncPostLayout);
	window.addEventListener(DISPLAY_EFFECT_CHANGE_EVENT, syncEffects);
	window.addEventListener(WALLPAPER_TUNING_CHANGE_EVENT, syncWallpaperTuning);
	document.addEventListener("pointerdown", createWaterRipple, {
		capture: true,
		passive: true,
	});
	document.addEventListener("astro:page-load", syncAfterNavigation);

	return () => {
		window.removeEventListener(BACKGROUND_CHANGE_EVENT, syncBackground);
		window.removeEventListener(SAKURA_CHANGE_EVENT, syncSakura);
		window.removeEventListener(POST_LAYOUT_CHANGE_EVENT, syncPostLayout);
		window.removeEventListener(DISPLAY_EFFECT_CHANGE_EVENT, syncEffects);
		window.removeEventListener(
			WALLPAPER_TUNING_CHANGE_EVENT,
			syncWallpaperTuning,
		);
		document.removeEventListener("pointerdown", createWaterRipple, true);
		document.removeEventListener("astro:page-load", syncAfterNavigation);
		stopWallpaperCarousel();
		if (wallpaperSwapTimer !== undefined)
			window.clearTimeout(wallpaperSwapTimer);
	};
});
</script>

<div class="display-settings">
	<section class="display-settings__section" aria-labelledby="display-hue-title">
		<div class="display-settings__section-head">
			<label class="display-settings__label" id="display-hue-title" for="display-hue">主题色相</label>
			<div class="display-settings__range-actions">
				<button type="button" class="display-settings__reset" onclick={resetHue} aria-label="重置主题色" title="重置主题色">
					<Icon icon="fa7-solid:arrow-rotate-left" size="sm" />
				</button>
				<output for="display-hue">{hue}</output>
			</div>
		</div>
		<input id="display-hue" type="range" min="0" max="360" step="5" value={hue} oninput={updateHue} />
	</section>

	<section class="display-settings__section" aria-labelledby="display-background-title">
		<div class="display-settings__section-head">
			<div class="display-settings__label" id="display-background-title">壁纸模式</div>
			<button type="button" class="display-settings__reset" onclick={resetBackground} aria-label="重置壁纸模式" title="重置壁纸模式">
				<Icon icon="fa7-solid:arrow-rotate-left" size="sm" />
			</button>
		</div>
		<div class="display-settings__segments display-settings__segments--wallpaper" role="group" aria-label="壁纸模式">
			<button type="button" class:is-active={background === "banner"} aria-pressed={background === "banner"} onclick={() => chooseBackground("banner")}>
				<Icon icon="material-symbols:imagesmode-outline-rounded" size="sm" />
				<span>横幅壁纸</span>
			</button>
			<button type="button" class:is-active={background === "full"} aria-pressed={background === "full"} onclick={() => chooseBackground("full")}>
				<Icon icon="material-symbols:fullscreen-rounded" size="sm" />
				<span>全屏壁纸</span>
			</button>
			<button type="button" class:is-active={background === "overlay"} aria-pressed={background === "overlay"} onclick={() => chooseBackground("overlay")}>
				<Icon icon="material-symbols:layers-outline-rounded" size="sm" />
				<span>全屏透明</span>
			</button>
			<button type="button" class:is-active={background === "none"} aria-pressed={background === "none"} onclick={() => chooseBackground("none")}>
				<Icon icon="material-symbols:hide-image-outline-rounded" size="sm" />
				<span>纯色背景</span>
			</button>
		</div>
	</section>

	{#if background === "overlay"}
		<section class="display-settings__section display-settings__tuning" aria-labelledby="display-transparency-title">
			<div class="display-settings__section-head">
				<div class="display-settings__label" id="display-transparency-title">透明模式</div>
				<Icon icon="material-symbols:tune-rounded" size="sm" />
			</div>
			<label class="display-settings__range-row" for="display-overlay-opacity">
				<span>壁纸可见度</span><output>{overlayOpacity}%</output>
			</label>
			<input id="display-overlay-opacity" type="range" min="20" max="100" step="1" value={overlayOpacity} oninput={(event) => updateWallpaperTuning("overlayOpacity", event)} />
			<label class="display-settings__range-row" for="display-overlay-blur">
				<span>背景模糊</span><output>{overlayBlur}px</output>
			</label>
			<input id="display-overlay-blur" type="range" min="0" max="24" step="1" value={overlayBlur} oninput={(event) => updateWallpaperTuning("overlayBlur", event)} />
			<label class="display-settings__range-row" for="display-card-opacity">
				<span>卡片不透明度</span><output>{overlayCardOpacity}%</output>
			</label>
			<input id="display-card-opacity" type="range" min="20" max="96" step="1" value={overlayCardOpacity} oninput={(event) => updateWallpaperTuning("overlayCardOpacity", event)} />
		</section>
	{/if}

	<section class="display-settings__section" aria-labelledby="display-wallpaper-settings-title">
		<div class="display-settings__section-head">
			<div class="display-settings__label" id="display-wallpaper-settings-title">壁纸设置</div>
			<button type="button" class="display-settings__reset" onclick={resetWallpaperSettings} aria-label="重置壁纸设置" title="重置壁纸设置">
				<Icon icon="fa7-solid:arrow-rotate-left" size="sm" />
			</button>
		</div>
		<div class="display-settings__toggles">
			<button type="button" class="display-settings__toggle" class:is-active={wallpaperTitle} aria-pressed={wallpaperTitle} onclick={() => toggleDisplayEffect("wallpaperTitle")}>
				<span><Icon icon="material-symbols:title-rounded" size="sm" />首页壁纸标题</span>
				<span class="display-settings__switch" aria-hidden="true"></span>
			</button>
			<button type="button" class="display-settings__toggle" class:is-active={wallpaperCarousel} aria-pressed={wallpaperCarousel} onclick={() => toggleDisplayEffect("wallpaperCarousel")}>
				<span><Icon icon="material-symbols:view-carousel-outline-rounded" size="sm" />壁纸轮播</span>
				<span class="display-settings__switch" aria-hidden="true"></span>
			</button>
			<button type="button" class="display-settings__toggle" class:is-active={waterRipple} aria-pressed={waterRipple} onclick={() => toggleDisplayEffect("waterRipple")}>
				<span><Icon icon="material-symbols:water-rounded" size="sm" />水波纹动画</span>
				<span class="display-settings__switch" aria-hidden="true"></span>
			</button>
			<button type="button" class="display-settings__toggle" class:is-active={gradientTransition} aria-pressed={gradientTransition} onclick={() => toggleDisplayEffect("gradientTransition")}>
				<span><Icon icon="material-symbols:gradient" size="sm" />渐变过渡</span>
				<span class="display-settings__switch" aria-hidden="true"></span>
			</button>
		</div>
	</section>

	<section class="display-settings__section" aria-labelledby="display-effect-title">
		<div class="display-settings__section-head">
			<div class="display-settings__label" id="display-effect-title">特效设置</div>
			<button type="button" class="display-settings__reset" onclick={resetSakura} aria-label="重置特效" title="重置特效">
				<Icon icon="fa7-solid:arrow-rotate-left" size="sm" />
			</button>
		</div>
		<button type="button" class="display-settings__toggle" class:is-active={sakura} aria-pressed={sakura} onclick={toggleSakura}>
			<span><Icon icon="material-symbols:local-florist-outline-rounded" size="sm" />樱花特效</span>
			<span class="display-settings__switch" aria-hidden="true"></span>
		</button>
	</section>

	<section class="display-settings__section" aria-labelledby="display-layout-title">
		<div class="display-settings__label" id="display-layout-title">文章布局</div>
		<div class="display-settings__segments" role="group" aria-label="文章布局">
			<button type="button" class:is-active={postLayout === "list"} aria-pressed={postLayout === "list"} onclick={() => choosePostLayout("list")}>
				<Icon icon="material-symbols:format-list-bulleted-rounded" size="sm" />
				<span>列表</span>
			</button>
			<button type="button" class:is-active={postLayout === "grid"} aria-pressed={postLayout === "grid"} onclick={() => choosePostLayout("grid")}>
				<Icon icon="material-symbols:grid-view-rounded" size="sm" />
				<span>网格</span>
			</button>
		</div>
	</section>
</div>
