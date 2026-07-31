import { existsSync } from "node:fs";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4325";
const browserPath =
	process.env.PLAYWRIGHT_BROWSER ||
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const browser = await chromium.launch({
	headless: true,
	...(existsSync(browserPath) ? { executablePath: browserPath } : {}),
});

const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.addInitScript(() => {
	window.__performanceLongTasks = [];
	try {
		const observer = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				window.__performanceLongTasks.push(entry.duration);
			}
		});
		observer.observe({ type: "longtask", buffered: true });
	} catch {}
});

await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.locator("#home-hero").waitFor({ state: "visible", timeout: 15_000 });
await page.waitForTimeout(4_500);
await page.evaluate(() => {
	document.documentElement.style.scrollBehavior = "auto";
});

const sampleFrames = (duration, scroll = false) =>
	page.evaluate(
		({ duration, scroll }) =>
			new Promise((resolve) => {
				const intervals = [];
				const startedAt = performance.now();
				const initialY = window.scrollY;
				const maxY = Math.min(
					document.documentElement.scrollHeight - window.innerHeight,
					window.innerHeight * 5,
				);
				let previous = startedAt;

				function frame(now) {
					intervals.push(now - previous);
					previous = now;
					const progress = Math.min(1, (now - startedAt) / duration);
					if (scroll) {
						const eased = progress * progress * (3 - 2 * progress);
						window.scrollTo(0, initialY + (maxY - initialY) * eased);
					}
					if (progress < 1) requestAnimationFrame(frame);
					else resolve(intervals.slice(2));
				}

				requestAnimationFrame(frame);
			}),
		{ duration, scroll },
	);

function percentile(values, ratio) {
	if (!values.length) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

const idleFrames = await sampleFrames(1_500, false);
const initialRainState = await page
	.locator(".home-hero__rain-canvas")
	.getAttribute("data-running");

await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.4));
await page.waitForFunction(
	() =>
		document.querySelector(".home-hero__rain-canvas")?.dataset.running ===
		"false",
	undefined,
	{ timeout: 2_000 },
);
const pausedRainState = await page
	.locator(".home-hero__rain-canvas")
	.getAttribute("data-running");

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForFunction(
	() =>
		document.querySelector(".home-hero__rain-canvas")?.dataset.running ===
		"true",
	undefined,
	{ timeout: 2_000 },
);
const resumedRainState = await page
	.locator(".home-hero__rain-canvas")
	.getAttribute("data-running");
const scrollFrames = await sampleFrames(2_500, true);

const metrics = await page.evaluate(() => {
	const resources = performance.getEntriesByType("resource");
	const live2d = window.__live2dGlobalState;
	const canvas = document.getElementById("live2d-canvas");
	return {
		innerWidth: window.innerWidth,
		scrollWidth: document.documentElement.scrollWidth,
		resources: resources.length,
		transferBytes: resources.reduce(
			(total, entry) => total + (entry.transferSize || 0),
			0,
		),
		longTasks: window.__performanceLongTasks || [],
		live2d: live2d?.app
			? {
					maxFps: live2d.app.ticker?.maxFPS,
					pixelRatio: canvas
						? canvas.width / Math.max(1, canvas.getBoundingClientRect().width)
						: null,
				}
			: null,
	};
});

const report = {
	idleP95: percentile(idleFrames, 0.95),
	idleMax: Math.max(0, ...idleFrames),
	scrollP95: percentile(scrollFrames, 0.95),
	scrollMax: Math.max(0, ...scrollFrames),
	longTaskCount: metrics.longTasks.length,
	longTaskMax: Math.max(0, ...metrics.longTasks),
	resources: metrics.resources,
	transferMiB: metrics.transferBytes / 1024 / 1024,
	live2d: metrics.live2d,
};

const failures = [];
if (metrics.scrollWidth > metrics.innerWidth + 1) {
	failures.push(`首页横向溢出：${metrics.scrollWidth} > ${metrics.innerWidth}`);
}
if (
	initialRainState !== "true" ||
	pausedRainState !== "false" ||
	resumedRainState !== "true"
) {
	failures.push(
		`雨滴可见性状态异常：${initialRainState}/${pausedRainState}/${resumedRainState}`,
	);
}
if (report.idleP95 > 50)
	failures.push(`空闲帧 P95 过高：${report.idleP95.toFixed(1)}ms`);
if (report.scrollP95 > 80)
	failures.push(`滚动帧 P95 过高：${report.scrollP95.toFixed(1)}ms`);
if (report.scrollMax > 600)
	failures.push(`滚动最大帧间隔过高：${report.scrollMax.toFixed(1)}ms`);
if (report.longTaskMax > 1_000)
	failures.push(`最长任务过高：${report.longTaskMax.toFixed(1)}ms`);
if (metrics.live2d?.maxFps > 30)
	failures.push(`Live2D 帧率未限制：${metrics.live2d.maxFps}`);
if (metrics.live2d?.pixelRatio > 1.6) {
	failures.push(`Live2D 像素倍率过高：${metrics.live2d.pixelRatio.toFixed(2)}`);
}

console.log(JSON.stringify(report, null, 2));
await browser.close();

if (failures.length) {
	throw new Error(failures.join("\n"));
}
