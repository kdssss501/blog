import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4321";
const browserPath =
	process.env.PLAYWRIGHT_BROWSER ||
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const screenshotPath =
	process.env.XIAO_TTS_SCREENSHOT ||
	"C:/Users/41462/.codex/visualizations/2026/07/25/019f98f1-39c9-7aa2-82bc-bef568588ab4/xiao-tts-1920x1080.png";

const browser = await chromium.launch({
	headless: true,
	args: ["--autoplay-policy=no-user-gesture-required"],
	...(existsSync(browserPath) ? { executablePath: browserPath } : {}),
});

try {
	const page = await browser.newPage({
		viewport: { width: 1920, height: 1080 },
	});
	const pageErrors = [];
	page.on("pageerror", (error) => pageErrors.push(error.message));

	await page.goto(`${baseUrl}/xiao/`, { waitUntil: "networkidle" });
	const live2d = page.locator("[data-live2d-host]");
	await live2d.waitFor({ state: "visible" });
	await page.waitForFunction(
		() =>
			document.querySelector("[data-live2d-host]")?.dataset.modelMode ===
			"live2d",
		null,
		{ timeout: 45_000 },
	);

	await page
		.getByLabel("写给吸血鬼")
		.fill(
			"为什么 Rust 的所有权机制能在编译阶段减少数据竞争？请用通俗中文回答。",
		);
	await page.getByLabel("封缄并发送").click();

	const phases = new Set();
	const mouthSamples = [];
	let screenshotTaken = false;
	const startedAt = Date.now();
	while (Date.now() - startedAt < 45_000) {
		const sample = await page.evaluate(() => {
			const voice = [...document.querySelectorAll(".xiao-message__voice")].at(
				-1,
			);
			const host = document.querySelector("[data-live2d-host]");
			return {
				label: voice?.querySelector("small")?.textContent?.trim() ?? "",
				progress: Number(
					voice?.querySelector("progress")?.getAttribute("value") ?? 0,
				),
				stagePhase: host?.getAttribute("data-phase") ?? "",
				mouthOpen: Number(host?.getAttribute("data-native-mouth-open") ?? 0),
			};
		});
		if (sample.label) phases.add(sample.label);
		if (sample.stagePhase === "speaking") mouthSamples.push(sample.mouthOpen);
		if (!screenshotTaken && sample.label === "正在播放") {
			await page.screenshot({ path: screenshotPath, fullPage: false });
			screenshotTaken = true;
		}
		if (sample.label === "语音已就绪") break;
		if (sample.label.includes("失败")) {
			throw new Error(`voice pipeline failed: ${sample.label}`);
		}
		await page.waitForTimeout(100);
	}

	const voice = page.locator(".xiao-message__voice").last();
	await voice.waitFor({ state: "visible" });
	const reply = await page
		.locator(".xiao-message.assistant p")
		.last()
		.textContent();
	assert.doesNotMatch(reply ?? "", /解析失败|没有完整送达/);
	assert.match(reply ?? "", /Rust|所有权|数据竞争/i);
	assert.equal(await voice.locator("small").textContent(), "语音已就绪");
	assert.match(
		await voice.locator("[lang='ja']").textContent(),
		/[ぁ-んァ-ヶ]/u,
	);
	assert.ok(
		[...phases].some((phase) => phase.includes("生成日语语音")),
		`generation phase was not visible: ${JSON.stringify([...phases])}`,
	);
	assert.ok(
		phases.has("正在播放"),
		`playback phase missing: ${JSON.stringify([...phases])}`,
	);
	assert.ok(
		mouthSamples.length > 2,
		"speaking phase did not produce mouth samples",
	);
	const mouthRange = Math.max(...mouthSamples) - Math.min(...mouthSamples);
	assert.ok(
		mouthRange > 0.015,
		`mouth did not react to real audio: range=${mouthRange}`,
	);
	assert.deepEqual(pageErrors, []);
	if (!screenshotTaken)
		await page.screenshot({ path: screenshotPath, fullPage: false });

	console.log(
		JSON.stringify(
			{
				viewport: "1920x1080",
				modelMode: await live2d.getAttribute("data-model-mode"),
				phases: [...phases],
				mouthRange,
				screenshotPath,
			},
			null,
		),
	);
} finally {
	await browser.close();
}
