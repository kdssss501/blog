import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4321";
const browserPath =
	process.env.PLAYWRIGHT_BROWSER ||
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const outputDirectory =
	process.env.XIAO_CHIBI_OUTPUT ||
	"C:/Users/41462/.codex/visualizations/2026/07/25/019f98f1-39c9-7aa2-82bc-bef568588ab4/xiao-chibi";

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({
	headless: true,
	...(existsSync(browserPath) ? { executablePath: browserPath } : {}),
});

function canvasSignature(page) {
	return page.locator(".vampire-chibi-reaction canvas").evaluate((canvas) => {
		const context = canvas.getContext("2d", { willReadFrequently: true });
		const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
		let alphaPixels = 0;
		let checksum = 0;
		for (let index = 0; index < pixels.length; index += 16) {
			const alpha = pixels[index + 3];
			if (alpha > 0) alphaPixels += 1;
			checksum =
				(checksum +
					pixels[index] * 3 +
					pixels[index + 1] * 5 +
					pixels[index + 2] * 7 +
					alpha * 11) %
				2_147_483_647;
		}
		return { alphaPixels, checksum };
	});
}

function canvasAlphaBounds(page) {
	return page.locator(".vampire-chibi-reaction canvas").evaluate((canvas) => {
		const context = canvas.getContext("2d", { willReadFrequently: true });
		const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
		let minX = canvas.width;
		let maxX = -1;
		for (let y = 0; y < canvas.height; y += 1) {
			for (let x = 0; x < canvas.width; x += 1) {
				if (pixels[(y * canvas.width + x) * 4 + 3] < 80) continue;
				minX = Math.min(minX, x);
				maxX = Math.max(maxX, x);
			}
		}
		return { minX, maxX };
	});
}

function pivotSignature(page) {
	return page.locator(".vampire-chibi-reaction canvas").evaluate((canvas) => {
		const context = canvas.getContext("2d", { willReadFrequently: true });
		const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
		let crimsonPixels = 0;
		for (let y = 346; y < 382; y += 1) {
			for (let x = 177; x < 207; x += 1) {
				const offset = (y * canvas.width + x) * 4;
				const red = pixels[offset];
				const green = pixels[offset + 1];
				const blue = pixels[offset + 2];
				const alpha = pixels[offset + 3];
				if (alpha > 120 && red > green * 1.3 && red > blue * 1.25) {
					crimsonPixels += 1;
				}
			}
		}
		return { crimsonPixels };
	});
}

try {
	const page = await browser.newPage({
		viewport: { width: 1920, height: 1080 },
	});
	await page.addInitScript(() => {
		sessionStorage.setItem("blog:vampire:intro:v1", "complete");
	});
	await page.goto(`${baseUrl}/live2D/`, { waitUntil: "networkidle" });
	await page.locator(".xiao-stage").click({ position: { x: 720, y: 420 } });
	const chibi = page.locator(".vampire-chibi-reaction");
	await chibi.waitFor({ state: "visible" });
	await page.waitForFunction(
		() =>
			document
				.querySelector(".vampire-chibi-reaction")
				?.classList.contains("is-atlas-ready"),
		null,
		{ timeout: 10_000 },
	);
	await page.waitForTimeout(180);
	const first = await canvasSignature(page);
	const pivot = await pivotSignature(page);
	const firstFrame = Number(await chibi.getAttribute("data-frame"));
	await page.waitForFunction(
		() => document.querySelector(".vampire-chibi-reaction")?.getAttribute("data-frame") === "3",
		null,
		{ timeout: 3_000 },
	);
	const rightSwingBounds = await canvasAlphaBounds(page);
	await page.waitForFunction(
		() => document.querySelector(".vampire-chibi-reaction")?.getAttribute("data-frame") === "9",
		null,
		{ timeout: 3_000 },
	);
	const leftSwingBounds = await canvasAlphaBounds(page);
	const geometry = await chibi.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		const chatRect = document
			.querySelector(".xiao-chat")
			?.getBoundingClientRect();
		const style = getComputedStyle(element);
		return {
			rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
			chatLeft: chatRect?.left ?? 0,
			display: style.display,
			opacity: style.opacity,
			visibility: style.visibility,
			zIndex: style.zIndex,
		};
	});
	await chibi.screenshot({
		path: path.join(outputDirectory, "chibi-frame-a.png"),
	});
	await page.waitForTimeout(180);
	const second = await canvasSignature(page);
	const secondFrame = Number(await chibi.getAttribute("data-frame"));
	await chibi.screenshot({
		path: path.join(outputDirectory, "chibi-frame-b.png"),
	});
	await page.screenshot({
		path: path.join(outputDirectory, "chibi-stage-1920x1080.png"),
	});

	assert.ok(
		first.alphaPixels > 1_000,
		`first chibi frame is blank: ${JSON.stringify(first)}`,
	);
	assert.ok(
		second.alphaPixels > 1_000,
		`second chibi frame is blank: ${JSON.stringify(second)}`,
	);
	assert.notEqual(firstFrame, secondFrame, "chibi frame index did not advance");
	assert.notEqual(
		first.checksum,
		second.checksum,
		"chibi canvas pixels did not animate",
	);
	assert.ok(
		Math.abs(rightSwingBounds.minX - leftSwingBounds.minX) > 70,
		`pivot swing is not visibly broad: ${JSON.stringify({ rightSwingBounds, leftSwingBounds })}`,
	);
	assert.equal(await chibi.getAttribute("data-animation"), "staff-pivot-v2");
	assert.ok(
		pivot.crimsonPixels > 40,
		`staff pivot is missing from the chibi frame: ${JSON.stringify(pivot)}`,
	);
	assert.equal(geometry.visibility, "visible");
	assert.equal(geometry.opacity, "1");
	assert.ok(
		geometry.rect.x + geometry.rect.width < geometry.chatLeft,
		`chibi is covered by chat: ${JSON.stringify(geometry)}`,
	);
	console.log(
		JSON.stringify(
			{
				firstFrame,
				secondFrame,
				first,
				second,
				pivot,
				rightSwingBounds,
				leftSwingBounds,
				geometry,
			},
			null,
			2,
		),
	);
} finally {
	await browser.close();
}
