<script lang="ts">
import { onMount } from "svelte";
import {
	setBackgroundMode,
	setHue,
	setPostLayout,
	setSakuraEnabled,
	setTheme,
} from "@/features/settings/client";
import { createApiUrl } from "@/shared/http";
import type { PublicSiteConfig } from "../model/public-site-config";

function applyConfig(config: PublicSiteConfig) {
	for (const element of document.querySelectorAll<HTMLElement>(
		"[data-runtime-site-title]",
	)) {
		element.textContent = config.title;
	}
	const carrier = document.querySelector<HTMLElement>("#config-carrier");
	if (carrier) {
		carrier.dataset.hue = String(config.accentHue);
		carrier.dataset.postLayout = config.defaultPostLayout;
		carrier.dataset.postLayoutSwitch = String(config.allowPostLayoutSwitch);
		carrier.dataset.postsPerPage = String(config.postsPerPage);
		carrier.dataset.sidebarPosition = config.sidebarPosition;
		carrier.dataset.postGridColumns = String(config.postGridColumns);
		carrier.dataset.postMasonry = String(config.postMasonry);
	}
	document.documentElement.style.setProperty(
		"--page-width",
		`${config.pageWidth}rem`,
	);
	if (config.wallpaperDesktop) {
		document.documentElement.style.setProperty(
			"--site-wallpaper",
			`url("${config.wallpaperDesktop}")`,
		);
	}
	if (config.wallpaperMobile || config.wallpaperDesktop) {
		document.documentElement.style.setProperty(
			"--site-wallpaper-mobile",
			`url("${config.wallpaperMobile || config.wallpaperDesktop}")`,
		);
	}
	const hasPreferences =
		localStorage.getItem("blog:display-preferences:v2") !== null ||
		["theme", "hue", "wallpaperMode", "sakuraEnabled", "postListLayout"].some(
			(key) => localStorage.getItem(key) !== null,
		);
	if (!hasPreferences) {
		setHue(config.accentHue);
		setTheme(config.themeMode);
		setBackgroundMode(config.wallpaperMode);
		setSakuraEnabled(config.sakuraEnabled);
		setPostLayout(config.defaultPostLayout);
	}
	document.documentElement.style.setProperty(
		"--article-grid-columns",
		String(config.postGridColumns),
	);
	document.documentElement.dataset.cardBorder = config.cardBorder
		? "on"
		: "off";
	document.documentElement.dataset.waves = config.wavesEnabled ? "on" : "off";
	document.documentElement.dataset.music = config.musicEnabled ? "on" : "off";
	document.documentElement.dataset.live2d = config.live2dEnabled ? "on" : "off";
	document.documentElement.dataset.spine = config.spineEnabled ? "on" : "off";
	document.documentElement.dataset.sidebarPosition = config.sidebarPosition;
	for (const grid of document.querySelectorAll<HTMLElement>(
		'#main-grid[data-sidebar-position]:not([data-sidebar-position="none"])',
	)) {
		grid.dataset.sidebarPosition = config.sidebarPosition;
	}
	for (const content of document.querySelectorAll<HTMLElement>(
		'#swup-container[data-sidebar-position]:not([data-sidebar-position="none"])',
	)) {
		content.dataset.sidebarPosition = config.sidebarPosition;
	}
	document.documentElement.dataset.publicSiteConfig = "loaded";
	window.dispatchEvent(
		new CustomEvent("site-config:loaded", { detail: { config } }),
	);
}

onMount(() => {
	const controller = new AbortController();
	void fetch(createApiUrl("api", "site-config"), {
		signal: controller.signal,
	})
		.then((response) => (response.ok ? response.json() : null))
		.then((value: { config?: PublicSiteConfig } | null) => {
			if (value?.config) applyConfig(value.config);
		})
		.catch(() => {});
	return () => controller.abort();
});
</script>
