import assert from "node:assert/strict";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4370";
const outputDirectory =
	process.env.E2E_OUTPUT_DIR ||
	"C:/Users/41462/.codex/visualizations/2026/07/25/019f98f1-39c9-7aa2-82bc-bef568588ab4";
const edgePath =
	process.env.PLAYWRIGHT_BROWSER ||
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

async function blockExternalSubresources(page) {
	await page.route("**/*", async (route) => {
		const requestUrl = route.request().url();
		try {
			const url = new URL(requestUrl);
			if (
				url.origin !== baseUrl &&
				url.origin !== "https://cubism.live2d.com" &&
				url.protocol !== "data:" &&
				url.protocol !== "blob:"
			) {
				await route.abort("blockedbyclient");
				return;
			}
		} catch {}
		await route.continue();
	});
}

function collectLocalErrors(page) {
	const errors = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => {
		if (
			message.type() === "error" &&
			message.location().url.startsWith(baseUrl)
		) {
			errors.push(message.text());
		}
	});
	return errors;
}

const browser = await chromium.launch({
	headless: true,
	executablePath: edgePath,
});

try {
	const homePage = await browser.newPage({
		viewport: { width: 1920, height: 1080 },
	});
	await blockExternalSubresources(homePage);
	const homeErrors = collectLocalErrors(homePage);
	await homePage.goto(`${baseUrl}/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	await homePage.locator("#home-hero").waitFor();
	await homePage.waitForTimeout(4_000);
	const home = await homePage.evaluate(() => {
		const hero = document.querySelector("#home-hero");
		const letter = document.querySelector(".home-hero__name-letter");
		const media = document.querySelector(".home-hero__video");
		const status = document.querySelector("#work-status");
		const letterStyle = getComputedStyle(letter);
		return {
			viewport: [innerWidth, innerHeight],
			status: status?.textContent?.trim(),
			off: status?.classList.contains("is-off-work"),
			avatar: document.querySelector("#hero-avatar")?.getAttribute("src"),
			letterBackground: letterStyle.backgroundImage,
			letterColor: letterStyle.color,
			letterFill: letterStyle.webkitTextFillColor,
			overlay: getComputedStyle(hero, "::after").backgroundColor,
			mediaFilter: getComputedStyle(media).filter,
		};
	});
	assert.deepEqual(home.viewport, [1920, 1080]);
	assert.equal(home.status, "上班中");
	assert.equal(home.off, false);
	assert.equal(home.letterBackground, "none");
	assert.equal(home.overlay, "rgba(0, 0, 0, 0.25)");
	assert.equal(
		home.mediaFilter,
		"brightness(1.12) saturate(1.18) contrast(1.03)",
	);
	assert.deepEqual(homeErrors, []);
	await homePage.screenshot({
		path: path.join(outputDirectory, "home-brighter-solid-1920x1080.png"),
	});

	const xiaoContext = await browser.newContext({
		viewport: { width: 1920, height: 1080 },
		reducedMotion: "reduce",
	});
	const xiaoPage = await xiaoContext.newPage();
	await blockExternalSubresources(xiaoPage);
	const xiaoErrors = collectLocalErrors(xiaoPage);
	await xiaoPage.goto(`${baseUrl}/live2D/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	await xiaoPage.waitForFunction(
		() =>
			document.querySelector("[data-live2d-host]")?.dataset.modelMode ===
			"live2d",
		undefined,
		{ timeout: 120_000 },
	);
	await xiaoPage.waitForTimeout(2_500);
	const host = xiaoPage.locator("[data-live2d-host]");
	const before = await xiaoPage.locator(".xiao-stage").boundingBox();
	const hostBefore = await host.boundingBox();
	const canvasBefore = await host.locator("canvas").evaluate((canvas) => ({
		cssWidth: canvas.getBoundingClientRect().width,
		cssHeight: canvas.getBoundingClientRect().height,
		backingWidth: canvas.width,
		backingHeight: canvas.height,
	}));
	const chat = await xiaoPage.locator(".xiao-chat").boundingBox();
	assert.ok(before && hostBefore && chat);
	assert.equal(await xiaoPage.getByText("动态模型已暂停").count(), 0);
	await xiaoPage.screenshot({
		path: path.join(outputDirectory, "xiao-live2d-open-1920x1080.png"),
	});

	const canvasPath = path.join(
		outputDirectory,
		"xiao-live2d-canvas-1920x1080.png",
	);
	await host.locator("canvas").screenshot({ path: canvasPath });
	const canvasStats = await sharp(canvasPath).stats();
	const canvasStdev = canvasStats.channels.map((channel) =>
		Number(channel.stdev.toFixed(2)),
	);
	assert.ok(Math.max(...canvasStdev) >= 5, "Live2D canvas is visually blank");

	await xiaoPage.getByRole("button", { name: "隐藏对话框" }).click();
	await xiaoPage.locator(".xiao-chat").waitFor({ state: "hidden" });
	const after = await xiaoPage.locator(".xiao-stage").boundingBox();
	const hostAfter = await host.boundingBox();
	const canvasAfter = await host.locator("canvas").evaluate((canvas) => ({
		cssWidth: canvas.getBoundingClientRect().width,
		cssHeight: canvas.getBoundingClientRect().height,
		backingWidth: canvas.width,
		backingHeight: canvas.height,
	}));
	assert.ok(after && hostAfter);
	assert.ok(Math.abs(after.width - before.width) <= 1);
	assert.ok(Math.abs(after.height - before.height) <= 1);
	assert.ok(Math.abs(hostAfter.width - hostBefore.width) <= 1);
	assert.ok(Math.abs(hostAfter.height - hostBefore.height) <= 1);
	assert.deepEqual(canvasAfter, canvasBefore);
	assert.equal(
		await xiaoPage.getByRole("button", { name: "显示对话框" }).isVisible(),
		true,
	);
	await xiaoPage.screenshot({
		path: path.join(outputDirectory, "xiao-live2d-chat-hidden-1920x1080.png"),
	});
	assert.deepEqual(xiaoErrors, []);

	console.log(
		JSON.stringify(
			{
				home,
				xiao: {
					mode: await host.getAttribute("data-model-mode"),
					beforeWidth: before.width,
					chatWidth: chat.width,
					afterWidth: after.width,
					canvas: canvasAfter,
					canvasStdev,
				},
			},
			null,
			2,
		),
	);
	await xiaoContext.close();
	await homePage.close();
} finally {
	await browser.close();
}
