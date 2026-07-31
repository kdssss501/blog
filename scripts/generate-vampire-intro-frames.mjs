import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const baseUrl = process.env.XIAO_INTRO_BASE_URL || "http://localhost:4321";
const outputDir = path.resolve(
	process.env.XIAO_INTRO_OUTPUT_DIR ||
		"public/assets/images/xiao/vampire-intro",
);
const browserPath =
	process.env.PLAYWRIGHT_BROWSER ||
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const frames = [
	{ file: "frame-wide-default.webp", camera: "广角", expression: null, variant: "normal" },
	{ file: "frame-portrait-shy.webp", camera: "半身", expression: "脸红", variant: "white" },
	{
		file: "frame-closeup-stareyes.webp",
		camera: "近景",
		expression: "星星眼",
		variant: "normal",
	},
	{ file: "frame-portrait-mad.webp", camera: "半身", expression: "黑脸生气", variant: "normal" },
	{
		file: "frame-closeup-hearteyes.webp",
		camera: "近景",
		expression: "爱心眼",
		variant: "normal",
	},
];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
	headless: true,
	executablePath: browserPath,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => {
	sessionStorage.setItem("blog:vampire:intro:v1", "complete");
	const nativeGetContext = HTMLCanvasElement.prototype.getContext;
	HTMLCanvasElement.prototype.getContext = function getPreservedContext(
		type,
		attributes,
	) {
		if (type === "webgl" || type === "webgl2") {
			return nativeGetContext.call(this, type, {
				...attributes,
				preserveDrawingBuffer: true,
			});
		}
		return nativeGetContext.call(this, type, attributes);
	};
});
const page = await context.newPage();

try {
	await page.goto(`${baseUrl}/live2D/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	await page.waitForFunction(
		() =>
			document.querySelector("[data-live2d-host]")?.dataset.modelMode ===
			"live2d",
		undefined,
		{ timeout: 120_000 },
	);
	await page.waitForTimeout(900);

	const expressionTrigger = page.getByRole("button", {
		name: "表情与动作",
	});
	await expressionTrigger.click();

	for (const frame of frames) {
		const switchToWhite = page.getByRole("button", { name: "切换白色形态" });
		const switchToNormal = page.getByRole("button", { name: "恢复黑色形态" });
		if (frame.variant === "white" && (await switchToWhite.count()) > 0) {
			await switchToWhite.click();
		} else if (frame.variant === "normal" && (await switchToNormal.count()) > 0) {
			await switchToNormal.click();
		}
		await page.locator(`.xiao-stage__camera button[title="${frame.camera}"]`).click();
		await page.getByRole("button", { name: "全部复位", exact: true }).click();
		if (frame.expression) {
			await page
				.getByRole("button", { name: frame.expression, exact: true })
				.click();
		}
		await page.waitForTimeout(820);

		const dataUrl = await page.evaluate(() => {
			const canvas = document.querySelector("[data-live2d-host] canvas");
			if (!(canvas instanceof HTMLCanvasElement)) {
				throw new Error("Live2D canvas is unavailable");
			}
			return canvas.toDataURL("image/png");
		});
		const png = Buffer.from(dataUrl.split(",")[1], "base64");
		const output = path.join(outputDir, frame.file);
		const webp = await sharp(png).webp({ quality: 88, alphaQuality: 92 }).toBuffer();
		const stats = await sharp(webp).stats();
		const alpha = stats.channels.length === 4 ? stats.channels[3] : null;
		if (!alpha || alpha.max === 0 || alpha.mean < 1) {
			throw new Error(`${frame.file} contains no visible Live2D pixels`);
		}
		await writeFile(output, webp);
		const metadata = await sharp(webp).metadata();
		console.log(
			`${frame.file}: ${metadata.width}x${metadata.height}, ${webp.length} bytes`,
		);
	}
} finally {
	await context.close();
	await browser.close();
}
