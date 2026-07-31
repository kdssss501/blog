import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4341";
const screenshotDir =
	process.env.E2E_SCREENSHOT_DIR || "test-results/numbered-albums";
const edgeExecutable =
	process.env.EDGE_EXECUTABLE ||
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const albums = [
	{ slug: "05-original", title: "原创", sensitive: 10 },
	{ slug: "06-blue-archive", title: "蔚蓝档案", sensitive: 17 },
	{ slug: "07-azur-lane", title: "碧蓝航线", sensitive: 17 },
	{ slug: "08-genshin-impact", title: "原神", sensitive: 17 },
	{ slug: "09-arknights-endfield", title: "明日方舟：终末地", sensitive: 2 },
	{ slug: "10-zenless-zone-zero", title: "绝区零", sensitive: 8 },
];

await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({
	headless: true,
	executablePath: edgeExecutable,
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const pageErrors = [];
const localRequestFailures = [];
const consoleErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("console", (message) => {
	if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("requestfailed", (request) => {
	if (request.url().startsWith(baseUrl)) {
		localRequestFailures.push(
			`${request.url()}: ${request.failure()?.errorText}`,
		);
	}
});

async function open(pathname) {
	const response = await page.goto(`${baseUrl}${pathname}`, {
		waitUntil: "domcontentloaded",
		timeout: 30_000,
	});
	assert.equal(response?.status(), 200, `${pathname} should return 200`);
	await page.waitForTimeout(1_100);
}

async function loadAllAlbumImages() {
	await page.evaluate(async () => {
		const step = Math.max(500, Math.floor(window.innerHeight * 0.8));
		for (
			let top = 0;
			top < document.documentElement.scrollHeight;
			top += step
		) {
			window.scrollTo(0, top);
			await new Promise((resolve) => setTimeout(resolve, 55));
		}
		window.scrollTo(0, document.documentElement.scrollHeight);
	});
	await page.waitForFunction(
		() =>
			[...document.querySelectorAll(".album-detail__grid img")].every(
				(image) => image.complete && image.naturalWidth > 0,
			),
		undefined,
		{ timeout: 30_000 },
	);
}

await open("/album/");
const indexState = await page.evaluate((expectedAlbums) => {
	const cards = [...document.querySelectorAll(".collection-album-card")];
	const newCards = expectedAlbums.map(({ slug }) => {
		const card = cards.find((candidate) =>
			candidate.getAttribute("href")?.includes(`/album/${slug}/`),
		);
		return {
			slug,
			title: card?.querySelector("h2")?.textContent?.trim(),
			imageCount: card?.querySelectorAll("img").length || 0,
			imagesLoaded: [...(card?.querySelectorAll("img") || [])].every(
				(image) => image.complete && image.naturalWidth > 0,
			),
		};
	});
	return {
		cardCount: cards.length,
		newCards,
		overflow: document.documentElement.scrollWidth - window.innerWidth,
	};
}, albums);
assert.equal(indexState.cardCount, 11);
assert.ok(
	indexState.overflow <= 1,
	`album index overflow: ${indexState.overflow}`,
);
for (const [index, card] of indexState.newCards.entries()) {
	assert.equal(card.title, albums[index].title);
	assert.equal(card.imageCount, 3);
	assert.equal(card.imagesLoaded, true);
}
await page.screenshot({
	path: path.join(screenshotDir, "album-index-1920.png"),
	fullPage: false,
});

const results = [];
for (const album of albums) {
	await open(`/album/${album.slug}/`);
	await loadAllAlbumImages();
	const state = await page.evaluate(() => ({
		title: document.querySelector(".album-detail h1")?.textContent?.trim(),
		photos: document.querySelectorAll(".album-detail__grid figure").length,
		sensitive: document.querySelectorAll(
			".album-detail__grid figure.is-sensitive",
		).length,
		revealButtons: document.querySelectorAll("[data-sensitive-reveal]").length,
		sourceLinks: document.querySelectorAll(
			'.album-detail__grid a[href^="https://www.pixiv.net/artworks/"]',
		).length,
		warningVisible:
			getComputedStyle(document.querySelector(".album-detail__content-warning"))
				.display !== "none",
		overflow: document.documentElement.scrollWidth - window.innerWidth,
	}));
	assert.equal(state.title, album.title);
	assert.equal(state.photos, 20);
	assert.equal(state.sensitive, album.sensitive);
	assert.equal(state.revealButtons, album.sensitive);
	assert.equal(state.sourceLinks, 20);
	assert.equal(state.warningVisible, true);
	assert.ok(state.overflow <= 1, `${album.slug} overflow: ${state.overflow}`);
	results.push({ slug: album.slug, ...state });

	if (album.slug === "06-blue-archive") {
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.waitForTimeout(150);
		await page.screenshot({
			path: path.join(screenshotDir, "blue-archive-protected-1920.png"),
			fullPage: false,
		});
		const button = page.locator("[data-sensitive-reveal]").first();
		await button.scrollIntoViewIfNeeded();
		const figure = button.locator("xpath=ancestor::figure");
		const beforeFilter = await figure
			.locator("img")
			.evaluate((image) => getComputedStyle(image).filter);
		assert.notEqual(beforeFilter, "none");
		await button.click();
		await page.waitForTimeout(100);
		const revealedFigure = page.locator(
			".album-detail__grid figure.is-sensitive.is-revealed",
		);
		assert.equal(await revealedFigure.count(), 1);
		assert.equal(
			await page.locator("[data-sensitive-reveal]").count(),
			album.sensitive - 1,
		);
		assert.equal(
			await revealedFigure
				.locator("img")
				.evaluate((image) => getComputedStyle(image).filter),
			"none",
		);
	}
}

await browser.close();
const knownPageErrors = pageErrors.filter((message) =>
	message.includes("Could not find Cubism 4 runtime"),
);
const unexpectedPageErrors = pageErrors.filter(
	(message) => !message.includes("Could not find Cubism 4 runtime"),
);
const knownRequestFailures = localRequestFailures.filter(
	(message) =>
		message.includes("/pagefind/pagefind.js") &&
		message.includes("ERR_ABORTED"),
);
const unexpectedRequestFailures = localRequestFailures.filter(
	(message) =>
		!message.includes("/pagefind/pagefind.js") ||
		!message.includes("ERR_ABORTED"),
);
assert.deepEqual(unexpectedPageErrors, []);
assert.deepEqual(unexpectedRequestFailures, []);
console.log(
	JSON.stringify(
		{
			browser: "Microsoft Edge",
			viewport: "1920x1080",
			indexState,
			albums: results,
			knownPageErrors: [...new Set(knownPageErrors)],
			knownRequestFailures: [...new Set(knownRequestFailures)],
			consoleErrors: [...new Set(consoleErrors)],
		},
		null,
		2,
	),
);
