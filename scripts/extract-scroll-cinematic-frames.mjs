import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const [inputArg, outputArg, modeArg] = process.argv.slice(2);
const inputPath = path.resolve(inputArg ?? "public/assets/videos/artoria-original.mp4");
const outputPath = path.resolve(
	outputArg ?? "public/assets/images/home/artoria-scroll",
);
const browserPath =
	process.env.PLAYWRIGHT_BROWSER ??
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

if (!inputArg && !modeArg) {
	console.error(
		"Usage: node scripts/extract-scroll-cinematic-frames.mjs <video> <output> --scan|--times=0.4,1.2,...",
	);
	process.exit(1);
}

await mkdir(outputPath, { recursive: true });

const browser = await chromium.launch({
	headless: true,
	executablePath: browserPath,
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

try {
	await page.goto(pathToFileURL(inputPath).href, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	await page.waitForSelector("video");
	const metadata = await page.locator("video").evaluate(
		(video) =>
			new Promise((resolve, reject) => {
				const read = () => {
					if (!Number.isFinite(video.duration) || video.videoWidth === 0) {
						reject(new Error("Video metadata is incomplete"));
						return;
					}
					resolve({
						duration: video.duration,
						width: video.videoWidth,
						height: video.videoHeight,
					});
				};
				if (video.readyState >= 1) read();
				else video.addEventListener("loadedmetadata", read, { once: true });
			}),
	);

	const isScan = modeArg === "--scan";
	const times = isScan
		? Array.from(
				{ length: Math.ceil(metadata.duration / 0.5) },
				(_, index) => Math.min(metadata.duration - 0.04, index * 0.5),
			)
		: (modeArg?.replace(/^--times=/, "") ?? "")
			.split(",")
			.map(Number)
			.filter((time) => Number.isFinite(time) && time >= 0)
			.map((time) => Math.min(metadata.duration - 0.04, time));

	if (times.length < 2) throw new Error("At least two frame times are required");

	const capture = async (time, width) => {
		const video = page.locator("video");
		await video.evaluate(
			async (element, payload) => {
				const video = element;
				video.pause();
				video.controls = false;
				Object.assign(video.style, {
					position: "fixed",
					inset: "0",
					width: `${video.videoWidth}px`,
					height: `${video.videoHeight}px`,
					objectFit: "cover",
					background: "#000",
				});
				document.documentElement.style.background = "#000";
				document.body.style.margin = "0";
				const target = Math.max(0.001, payload.time);
				await new Promise((resolve) => {
					if (
						Math.abs(video.currentTime - target) < 0.0005 &&
						video.readyState >= 2
					) {
						resolve();
						return;
					}
					video.addEventListener("seeked", resolve, { once: true });
					video.currentTime = target;
				});
				await new Promise((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(resolve)),
				);
			},
			{ time },
		);
		const screenshot = await video.screenshot({
			animations: "allow",
			type: "png",
		});
		return sharp(screenshot)
			.resize({ width, withoutEnlargement: true })
			.webp({ quality: isScan ? 78 : 88, effort: 6 })
			.toBuffer();
	};

	const frames = [];
	for (const [index, time] of times.entries()) {
		const width = isScan ? 480 : metadata.width;
		const buffer = await capture(time, width);
		const name = `${isScan ? "scan" : "frame"}-${String(index + 1).padStart(2, "0")}-${time.toFixed(2).replace(".", "_")}.webp`;
		const target = path.join(outputPath, name);
		await writeFile(target, buffer);
		frames.push({
			index,
			time: Number(time.toFixed(3)),
			file: path.relative(projectRoot, target).replaceAll(path.sep, "/"),
		});
		console.log(`${frames.at(-1).file} @ ${time.toFixed(3)}s`);
	}

	if (isScan) {
		const columns = 4;
		const cellWidth = 480;
		const cellHeight = 300;
		const rows = Math.ceil(frames.length / columns);
		const composites = [];
		for (const frame of frames) {
			const source = await sharp(path.join(projectRoot, frame.file))
				.resize({ width: cellWidth, height: 270, fit: "fill" })
				.toBuffer();
			const label = Buffer.from(
				`<svg width="${cellWidth}" height="30"><rect width="100%" height="30" fill="#09090b"/><text x="12" y="21" fill="#fff" font-family="monospace" font-size="16">${frame.index + 1} / ${frame.time.toFixed(2)}s</text></svg>`,
			);
			const cell = await sharp({
				create: {
					width: cellWidth,
					height: cellHeight,
					channels: 3,
					background: "#09090b",
				},
			})
				.composite([
					{ input: source, top: 0, left: 0 },
					{ input: label, top: 270, left: 0 },
				])
				.png()
				.toBuffer();
			composites.push({
				input: cell,
				top: Math.floor(frame.index / columns) * cellHeight,
				left: (frame.index % columns) * cellWidth,
			});
		}
		await sharp({
			create: {
				width: columns * cellWidth,
				height: rows * cellHeight,
				channels: 3,
				background: "#09090b",
			},
		})
			.composite(composites)
			.webp({ quality: 88, effort: 6 })
			.toFile(path.join(outputPath, "contact-sheet.webp"));
	} else {
		await writeFile(
			path.join(outputPath, "manifest.json"),
			`${JSON.stringify({ source: path.basename(inputPath), ...metadata, frames }, null, 2)}\n`,
			"utf8",
		);
	}
} finally {
	await browser.close();
}
