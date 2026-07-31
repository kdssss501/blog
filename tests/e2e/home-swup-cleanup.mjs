import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4321";
const browserPath =
	process.env.PLAYWRIGHT_BROWSER ||
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const browser = await chromium.launch({
	headless: true,
	...(existsSync(browserPath) ? { executablePath: browserPath } : {}),
});

try {
	const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
	await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
	await page.waitForFunction(
		() =>
			document.querySelector("#home-display-layer")?.dataset.displayReady ===
			"ready" &&
			typeof window.swup?.navigate === "function",
		undefined,
		{ timeout: 30_000 },
	);

	const homePinState = await page.evaluate(() => {
		const root = document.querySelector("#home-display-layer");
		return {
			insideSwupContainer: Boolean(root?.closest("#swup-container")),
			pinSpacerCount: [...document.querySelectorAll(".pin-spacer")].filter(
				(spacer) => spacer.querySelector("#home-display-layer"),
			).length,
		};
	});
	assert.equal(homePinState.insideSwupContainer, true);
	assert.equal(homePinState.pinSpacerCount, 1);

	await page.evaluate(() => {
		const root = document.querySelector("#home-display-layer");
		if (!root) throw new Error("Home display layer is missing before navigation");
		window.scrollTo({ top: root.getBoundingClientRect().top + window.scrollY + 320 });
		window.swup.navigate("/archive/");
	});
	await page.waitForURL((url) => url.pathname === "/archive/", { timeout: 30_000 });
	await page.waitForFunction(
		() => !document.querySelector("#home-display-layer"),
		undefined,
		{ timeout: 30_000 },
	);

	const residualState = await page.evaluate(() => ({
		displayLayerCount: document.querySelectorAll("#home-display-layer").length,
		displayPinSpacerCount: [...document.querySelectorAll(".pin-spacer")].filter(
			(spacer) => spacer.querySelector("#home-display-layer"),
		).length,
		archiveVisible: Boolean(document.querySelector("#archive-heatmap")),
	}));
	assert.equal(residualState.displayLayerCount, 0);
	assert.equal(residualState.displayPinSpacerCount, 0);
	assert.equal(residualState.archiveVisible, true);

	console.log("Home Swup cleanup check passed.");
} finally {
	await browser.close();
}
