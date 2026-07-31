import assert from "node:assert/strict";
import {
	DISPLAY_PREFERENCES_STORAGE_KEY,
	readDisplayPreferences,
	writeDisplayPreferences,
} from "../../src/features/settings/model/preferences.ts";

class MemoryStorage {
	constructor(entries = {}) {
		this.values = new Map(Object.entries(entries));
	}

	getItem(key) {
		return this.values.get(key) ?? null;
	}

	setItem(key, value) {
		this.values.set(key, String(value));
	}
}

const plainLegacy = new MemoryStorage({ "blog-background-mode": "plain" });
assert.equal(readDisplayPreferences(plainLegacy).wallpaperMode, "none");

const wallpaperLegacy = new MemoryStorage({
	"blog-background-mode": "wallpaper",
});
assert.equal(readDisplayPreferences(wallpaperLegacy).wallpaperMode, "full");
assert.equal(
	readDisplayPreferences(new MemoryStorage({ wallpaperMode: "fullscreen" }))
		.wallpaperMode,
	"full",
);
assert.equal(readDisplayPreferences(new MemoryStorage()).postLayout, "grid");
assert.equal(readDisplayPreferences(new MemoryStorage()).hue, 310);

const defaultsOnly = new MemoryStorage();
assert.deepEqual(
	readDisplayPreferences(defaultsOnly, {
		theme: "system",
		hue: 180,
		wallpaperMode: "banner",
		sakura: true,
		postLayout: "grid",
		wallpaperTitle: true,
		wallpaperCarousel: false,
		waterRipple: true,
		gradientTransition: true,
		overlayOpacity: 88,
		overlayBlur: 2,
		overlayCardOpacity: 68,
	}),
	{
		version: 2,
		theme: "system",
		hue: 180,
		wallpaperMode: "banner",
		sakura: true,
		postLayout: "grid",
		wallpaperTitle: true,
		wallpaperCarousel: false,
		waterRipple: true,
		gradientTransition: true,
		overlayOpacity: 88,
		overlayBlur: 2,
		overlayCardOpacity: 68,
	},
);

const v2Wins = new MemoryStorage({
	[DISPLAY_PREFERENCES_STORAGE_KEY]: JSON.stringify({
		version: 2,
		theme: "dark",
		hue: 220,
		wallpaperMode: "overlay",
		sakura: true,
		postLayout: "grid",
	}),
	theme: "light",
	hue: "15",
	wallpaperMode: "none",
	sakuraEnabled: "false",
	postListLayout: "list",
});
assert.deepEqual(readDisplayPreferences(v2Wins), {
	version: 2,
	theme: "dark",
	hue: 220,
	wallpaperMode: "overlay",
	sakura: true,
	postLayout: "grid",
	wallpaperTitle: true,
	wallpaperCarousel: false,
	waterRipple: true,
	gradientTransition: true,
	overlayOpacity: 88,
	overlayBlur: 2,
	overlayCardOpacity: 68,
});

const malformed = new MemoryStorage({
	[DISPLAY_PREFERENCES_STORAGE_KEY]: "{broken",
	hue: "999",
});
assert.equal(readDisplayPreferences(malformed).hue, 360);

const negativeHue = new MemoryStorage({ hue: "-50" });
assert.equal(readDisplayPreferences(negativeHue).hue, 0);

const written = new MemoryStorage();
writeDisplayPreferences(written, {
	version: 2,
	theme: "system",
	hue: 175,
	wallpaperMode: "full",
	sakura: true,
	postLayout: "grid",
	wallpaperTitle: true,
	wallpaperCarousel: false,
	waterRipple: true,
	gradientTransition: false,
	overlayOpacity: 84,
	overlayBlur: 5,
	overlayCardOpacity: 61,
});
assert.equal(written.getItem("theme"), "system");
assert.equal(written.getItem("hue"), "175");
assert.equal(written.getItem("wallpaperMode"), "fullscreen");
assert.equal(written.getItem("blog-background-mode"), "wallpaper");
assert.equal(written.getItem("sakuraEnabled"), "true");
assert.equal(written.getItem("postListLayout"), "grid");
assert.equal(written.getItem("wallpaperCarousel"), "false");
assert.equal(written.getItem("waterRipple"), "true");
assert.equal(written.getItem("gradientTransition"), "false");
assert.equal(written.getItem("overlayOpacity"), "84");
assert.equal(written.getItem("overlayBlur"), "5");
assert.equal(written.getItem("overlayCardOpacity"), "61");
assert.deepEqual(JSON.parse(written.getItem(DISPLAY_PREFERENCES_STORAGE_KEY)), {
	version: 2,
	theme: "system",
	hue: 175,
	wallpaperMode: "full",
	sakura: true,
	postLayout: "grid",
	wallpaperTitle: true,
	wallpaperCarousel: false,
	waterRipple: true,
	gradientTransition: false,
	overlayOpacity: 84,
	overlayBlur: 5,
	overlayCardOpacity: 61,
});

console.log("Settings preference checks passed.");
