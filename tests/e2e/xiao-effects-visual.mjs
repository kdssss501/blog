import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4321";
const localOrigin = new URL(baseUrl).origin;
const outputDirectory = path.resolve(
	process.env.E2E_OUTPUT_DIR || "test-results/xiao-effects",
);
const browserPath =
	process.env.PLAYWRIGHT_BROWSER ||
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({
	headless: true,
	executablePath: browserPath,
});
const context = await browser.newContext({
	viewport: { width: 1920, height: 1080 },
});
const page = await context.newPage();
await page.addInitScript(() => {
	sessionStorage.setItem("blog:vampire:intro:v1", "complete");
});
const runtimeErrors = [];
page.on("pageerror", (error) => runtimeErrors.push(error.message));
page.on("console", (message) => {
	if (message.type() !== "error") return;
	const sourceUrl = message.location().url;
	if (sourceUrl && new URL(sourceUrl, baseUrl).origin !== localOrigin) return;
	runtimeErrors.push(message.text());
});
await page.route("**/*", async (route) => {
	const requestUrl = route.request().url();
	try {
		const url = new URL(requestUrl);
		if (
			url.origin !== localOrigin &&
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
await page.addInitScript(() => {
	const nativeFetch = window.fetch.bind(window);
	window.fetch = (input, init = {}) => {
		const requestUrl =
			typeof input === "string"
				? input
				: input instanceof Request
					? input.url
					: String(input);
		const url = new URL(requestUrl, window.location.href);
		if (!/\/api\/ai-chat\/?$/.test(url.pathname))
			return nativeFetch(input, init);
		const encoder = new TextEncoder();
		const text = "危险，立即停止并保护自己。";
		return Promise.resolve(
			new Response(
				new ReadableStream({
					start(controller) {
						controller.enqueue(
							encoder.encode(
								`data: {"type":"chunk","text":"${text}"}\n\ndata: {"type":"done"}\n\n`,
							),
						);
						controller.close();
					},
				}),
				{ headers: { "Content-Type": "text/event-stream; charset=utf-8" } },
			),
		);
	};
});

const canvasSignature = () =>
	page.locator(".xiao-scene__effects").evaluate((canvas) => {
		const context2d = canvas.getContext("2d");
		const pixels = context2d.getImageData(
			0,
			0,
			canvas.width,
			canvas.height,
		).data;
		let alpha = 0;
		let checksum = 0;
		for (let offset = 3; offset < pixels.length; offset += 64) {
			alpha += pixels[offset];
			checksum = (checksum * 33 + pixels[offset - 3] + pixels[offset]) >>> 0;
		}
		return { alpha, checksum };
	});

try {
	await page.goto(`${baseUrl}/live2D/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	await page.locator(".xiao-hub").waitFor({ state: "visible" });
	await page.waitForFunction(
		() =>
			document.querySelector(".xiao-scene__effects")?.dataset.assetState ===
			"ready",
		undefined,
		{ timeout: 60_000 },
	);
	await page.waitForFunction(
		() =>
			["live2d", "fallback"].includes(
				document.querySelector("[data-live2d-host]")?.dataset.modelMode ?? "",
			),
		undefined,
		{ timeout: 60_000 },
	);
	assert.equal(
		await page
			.locator(
				'[data-xiao-portal], .xiao-stage__frame, .xiao-portal-dissolve, img[src*="task-4237"]',
			)
			.count(),
		0,
		"the removed fullscreen frame returned",
	);

	await page.getByRole("button", { name: "装扮", exact: true }).click();
	await page.getByRole("button", { name: "白色形态", exact: true }).click();
	await page.getByRole("button", { name: "装扮", exact: true }).click();

	const chat = page.locator(".xiao-chat");
	await chat.getByRole("textbox", { name: "写给吸血鬼" }).fill("请保护我");
	await chat.getByRole("button", { name: "封缄并发送" }).click();
	await chat.getByText("危险，立即停止并保护自己。", { exact: true }).waitFor();
	await page.waitForFunction(
		() =>
			document.querySelector(".xiao-scene__effects")?.dataset.lastEffect ===
			"envelope-flight",
	);
	const chibi = page.locator(".vampire-chibi-reaction");
	await chibi.waitFor({ state: "visible", timeout: 2_500 });
	assert.equal(await chibi.getAttribute("data-expression"), "startled");
	const envelopeBefore = await canvasSignature();
	await page.waitForTimeout(100);
	const envelopeAfter = await canvasSignature();
	assert.ok(
		envelopeAfter.alpha > 0,
		"envelope sequence rendered no visible pixels",
	);
	assert.notEqual(
		envelopeAfter.checksum,
		envelopeBefore.checksum,
		"envelope sequence did not animate",
	);
	await page.screenshot({
		path: path.join(outputDirectory, "xiao-envelope-sequence-1920x1080.png"),
	});

	await page.getByRole("button", { name: "隐藏对话框" }).click();
	await chat.waitFor({ state: "hidden" });
	await page.screenshot({
		path: path.join(outputDirectory, "xiao-chat-hidden-1920x1080.png"),
	});
	assert.deepEqual(runtimeErrors, []);
	await writeFile(
		path.join(outputDirectory, "report.json"),
		JSON.stringify(
			{ envelopeBefore, envelopeAfter },
			null,
			2,
		),
	);
	console.log(`Xiao effect visual capture passed: ${outputDirectory}`);
} finally {
	await context.close();
	await browser.close();
}
