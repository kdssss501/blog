import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4321";
const browserPath =
	process.env.PLAYWRIGHT_BROWSER ||
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const outputDirectory =
	process.env.XIAO_LIPSYNC_OUTPUT ||
	"C:/Users/41462/.codex/visualizations/2026/07/25/019f98f1-39c9-7aa2-82bc-bef568588ab4/xiao-lipsync";

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({
	headless: true,
	args: ["--autoplay-policy=no-user-gesture-required"],
	...(existsSync(browserPath) ? { executablePath: browserPath } : {}),
});

try {
	const page = await browser.newPage({
		viewport: { width: 1920, height: 1080 },
	});
	await page.addInitScript(() => {
		sessionStorage.setItem("blog:vampire:intro:v1", "complete");
	});
	const runtimeErrors = [];
	const apiResponses = [];
	page.on("pageerror", (error) => runtimeErrors.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") runtimeErrors.push(message.text());
	});
	page.on("response", (response) => {
		if (response.url().includes("/api/")) {
			apiResponses.push({ url: response.url(), status: response.status() });
		}
	});

	await page.goto(`${baseUrl}/live2D/`, { waitUntil: "networkidle" });
	const live2d = page.locator("[data-live2d-host]");
	await live2d.waitFor({ state: "visible" });
	await page.waitForFunction(
		() =>
			document.querySelector("[data-live2d-host]")?.dataset.modelMode ===
			"live2d",
		null,
		{ timeout: 45_000 },
	);

	await page.locator(".xiao-stage__camera button").nth(2).click();
	await page
		.locator(".xiao-chat__composer textarea")
		.fill("请用一句简短的日语向我问好");
	await page.locator(".xiao-chat__composer button.is-send").click();

	const chibiFrames = new Set();
	const chibiPhases = new Set();
	const lipSyncSources = new Set();
	const mouthSamples = [];
	const jawSamples = [];
	let voicePhase = "";
	let playingScreenshotTaken = false;
	const deadline = Date.now() + 90_000;
	while (Date.now() < deadline) {
		const sample = await page.evaluate(() => {
			const host = document.querySelector("[data-live2d-host]");
			const chibi = document.querySelector(".vampire-chibi-reaction");
			const voice = [...document.querySelectorAll(".xiao-message__voice")].at(
				-1,
			);
			return {
				stagePhase: host?.getAttribute("data-phase") ?? "",
				lipSyncSource: host?.getAttribute("data-lipsync-source") ?? "",
				mouthOpen: Number(host?.getAttribute("data-native-mouth-open") ?? 0),
				jawOpen: Number(host?.getAttribute("data-native-jaw-open") ?? 0),
				mouthMaximum: Number(host?.getAttribute("data-mouth-maximum") ?? 0),
				jawMaximum: Number(host?.getAttribute("data-jaw-maximum") ?? 0),
				chibiFrame: chibi?.getAttribute("data-frame") ?? "",
				chibiPhase: chibi?.getAttribute("data-phase") ?? "",
				voicePhase: voice?.querySelector("small")?.textContent?.trim() ?? "",
				error:
					document
						.querySelector(".xiao-chat__error span")
						?.textContent?.trim() ?? "",
			};
		});
		voicePhase = sample.voicePhase;
		if (sample.error) throw new Error(`chat error: ${sample.error}`);
		if (sample.chibiFrame) chibiFrames.add(sample.chibiFrame);
		if (sample.chibiPhase) chibiPhases.add(sample.chibiPhase);
		if (sample.lipSyncSource) lipSyncSources.add(sample.lipSyncSource);
		if (sample.stagePhase === "speaking") {
			mouthSamples.push(sample.mouthOpen);
			jawSamples.push(sample.jawOpen);
			if (!playingScreenshotTaken) {
				await page.screenshot({
					path: path.join(outputDirectory, "playing-1920x1080.png"),
				});
				playingScreenshotTaken = true;
			}
		}
		if (
			mouthSamples.length >= 5 &&
			sample.mouthMaximum > 0.3 &&
			sample.jawMaximum > 0.16
		) {
			break;
		}
		await page.waitForTimeout(90);
	}

	await page.screenshot({
		path: path.join(outputDirectory, "final-1920x1080.png"),
	});
	const report = {
		viewport: "1920x1080",
		apiResponses,
		voicePhase,
		chibiFrames: [...chibiFrames],
		chibiPhases: [...chibiPhases],
		lipSyncSources: [...lipSyncSources],
		mouthMinimum: mouthSamples.length ? Math.min(...mouthSamples) : 0,
		mouthMaximum: mouthSamples.length ? Math.max(...mouthSamples) : 0,
		jawMinimum: jawSamples.length ? Math.min(...jawSamples) : 0,
		jawMaximum: jawSamples.length ? Math.max(...jawSamples) : 0,
		runtimeErrors,
	};
	await writeFile(
		path.join(outputDirectory, "report.json"),
		JSON.stringify(report, null, 2),
	);

	assert.ok(
		apiResponses.some(
			(response) =>
				response.url.includes("/api/ai-chat/") && response.status === 200,
		),
		`AI response missing: ${JSON.stringify(apiResponses)}`,
	);
	assert.ok(
		apiResponses.some(
			(response) =>
				response.url.includes("/api/xiao/tts/") && response.status === 200,
		),
		`TTS response missing: ${JSON.stringify(apiResponses)}`,
	);
	assert.ok(
		chibiFrames.size >= 3,
		`chibi timeline did not advance: ${[...chibiFrames]}`,
	);
	assert.ok(
		chibiPhases.has("thinking"),
		`thinking phase missing: ${[...chibiPhases]}`,
	);
	assert.ok(
		chibiPhases.has("playing"),
		`playing phase missing: ${[...chibiPhases]}`,
	);
	assert.ok(mouthSamples.length >= 3, "no speaking mouth samples");
	assert.ok(
		Math.max(...mouthSamples) > 0.3,
		`mouth opening too small: ${Math.max(...mouthSamples)}`,
	);
	assert.ok(
		Math.max(...jawSamples) > 0.16,
		`jaw opening too small: ${Math.max(...jawSamples)}`,
	);
	assert.ok(
		lipSyncSources.has("audio"),
		`audio lip sync was not used: ${[...lipSyncSources]}`,
	);
	assert.deepEqual(runtimeErrors, []);
	console.log(JSON.stringify(report, null, 2));
} finally {
	await browser.close();
}
