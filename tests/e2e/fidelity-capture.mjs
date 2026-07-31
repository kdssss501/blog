import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4321";
const outputDirectory =
	process.env.E2E_FIDELITY_DIR || path.resolve("test-results/fidelity");
const browserPath =
	process.env.PLAYWRIGHT_BROWSER ||
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const routes = [
	["home", "/", "#home-hero"],
	["posts", "/posts/", ".article-feed-card"],
	["article", "/posts/ai/ai-blog-ai-zero-editing/", "#post-container"],
	["friends", "/friends/", ".friend-card"],
	["guestbook", "/guestbook/", ".guestbook-page--page .guestbook-chat"],
	["notebook", "/notebook/", "[data-notebook-grid]:not([hidden])"],
];
const viewports = [
	["desktop", { width: 1440, height: 1000 }],
	["mobile", { width: 390, height: 844 }],
];

async function seekHomeFrame(
	page,
	display,
	range,
	predicate,
	label,
	startStep = 50,
) {
	for (let step = startStep; step <= 82; step += 1) {
		await page.evaluate(
			({ top, distance, progress }) =>
				window.scrollTo(0, top + distance * progress),
			{ ...range, progress: step / 100 },
		);
		await page.waitForTimeout(45);
		const frame = await display.evaluate(() => {
			const opacity = (selector) =>
				Number(getComputedStyle(document.querySelector(selector)).opacity);
			const bounds = (selector) => {
				const rect = document.querySelector(selector).getBoundingClientRect();
				return { x: rect.x, width: rect.width };
			};
			return {
				panels: [...document.querySelectorAll("[data-shutter-panel]")].map(
					(element) => Number(getComputedStyle(element).opacity),
				),
				background: opacity("[data-shutter-interlude-bg]"),
				foreground: opacity("[data-shutter-interlude-fg]"),
				stripTop: bounds("[data-shutter-interlude-strip-left]"),
				stripBottom: bounds("[data-shutter-interlude-strip-right]"),
				copy: [
					opacity(".home-portfolio-shutter__interlude-copy-text--left"),
					opacity(".home-portfolio-shutter__interlude-copy-text--right"),
				],
			};
		});
		if (predicate(frame)) return frame;
	}
	throw new Error(`Unable to capture home ${label} frame`);
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({
	headless: true,
	executablePath: browserPath,
});

try {
	for (const [viewportName, viewport] of viewports) {
		for (const [name, route, readySelector] of routes) {
			const page = await browser.newPage({ viewport });
			await page.goto(`${baseUrl}${route}`, {
				waitUntil: "domcontentloaded",
				timeout: 60_000,
			});
			const loader = page.locator("#page-loader");
			if ((await loader.count()) > 0) {
				await loader.waitFor({ state: "hidden", timeout: 12_000 });
			}
			await page.locator(readySelector).first().waitFor({
				state: "visible",
				timeout: 12_000,
			});
			await page.waitForTimeout(name === "home" ? 1_600 : 500);

			const metrics = await page.evaluate(() => ({
				innerWidth: window.innerWidth,
				scrollWidth: document.documentElement.scrollWidth,
			}));
			if (metrics.scrollWidth > metrics.innerWidth + 1) {
				throw new Error(
					`${route} horizontal overflow: ${metrics.scrollWidth} > ${metrics.innerWidth}`,
				);
			}

			const output = path.join(outputDirectory, `${name}-${viewportName}.png`);
			await page.screenshot({ path: output });
			console.log(`saved ${output}`);
			await page.close();
		}
	}

	{
		const page = await browser.newPage({
			viewport: { width: 1920, height: 1000 },
		});
		await page.goto(`${baseUrl}/guestbook/`, {
			waitUntil: "domcontentloaded",
			timeout: 60_000,
		});
		await page.locator(".guestbook-page--page .guestbook-chat").waitFor({
			state: "visible",
			timeout: 12_000,
		});
		await page.waitForTimeout(500);
		const output = path.join(outputDirectory, "guestbook-wide.png");
		await page.screenshot({ path: output });
		console.log(`saved ${output}`);
		await page.close();
	}

	{
		const page = await browser.newPage({
			viewport: { width: 1920, height: 1000 },
		});
		await page.goto(`${baseUrl}/`, {
			waitUntil: "domcontentloaded",
			timeout: 60_000,
		});
		const deck = page.locator("[data-photo-deck]");
		await deck.waitFor({ state: "visible", timeout: 12_000 });
		await deck.scrollIntoViewIfNeeded();
		await page.waitForTimeout(350);
		let output = path.join(outputDirectory, "home-photo-deck-wide.png");
		await page.screenshot({ path: output });
		console.log(`saved ${output}`);

		const display = page.locator("#home-display-layer");
		await page.waitForFunction(
			() =>
				document.querySelector("#home-display-layer")?.dataset.displayReady ===
				"ready",
			undefined,
			{ timeout: 12_000 },
		);
		const range = await display.evaluate((element) => ({
			top: element.getBoundingClientRect().top + window.scrollY,
			distance:
				Number(element.dataset.scrollDistance || 0) +
				Number(element.dataset.shutterScrollDistance || 0),
		}));
		await seekHomeFrame(
			page,
			display,
			range,
			(frame) =>
				frame.panels.every((opacity) => opacity > 0.98) &&
				frame.background < 0.05 &&
				frame.foreground < 0.1,
			"five-column",
		);
		output = path.join(outputDirectory, "home-five-columns-wide.png");
		await page.screenshot({ path: output });
		console.log(`saved ${output}`);

		await seekHomeFrame(
			page,
			display,
			range,
			(frame) =>
				frame.background > 0.98 &&
				frame.foreground > 0.95 &&
				frame.stripTop.x < -frame.stripTop.width * 0.35 &&
				frame.stripTop.x > -frame.stripTop.width * 0.68,
			"second-act entry",
			56,
		);
		output = path.join(outputDirectory, "home-second-act-entry-wide.png");
		await page.screenshot({ path: output });
		console.log(`saved ${output}`);

		await seekHomeFrame(
			page,
			display,
			range,
			(frame) =>
				frame.background > 0.98 &&
				frame.foreground > 0.98 &&
				Math.abs(frame.stripTop.x) < 2 &&
				Math.abs(frame.stripBottom.x) < 2 &&
				frame.copy.every((opacity) => opacity > 0.95),
			"second-act final",
			68,
		);
		output = path.join(outputDirectory, "home-second-act-wide.png");
		await page.screenshot({ path: output });
		console.log(`saved ${output}`);
		await page.close();
	}
} finally {
	await browser.close();
}
