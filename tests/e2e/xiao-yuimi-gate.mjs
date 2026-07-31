import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:4321";
const browserPath = process.env.PLAYWRIGHT_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const outputDir = path.resolve("test-results/xiao-yuimi-gate");
const viewports = [
	{ name: "desktop", width: 1440, height: 900, isMobile: false },
	{ name: "mobile", width: 390, height: 844, isMobile: true },
];
const gateSelector = "[data-kisara-gate]";

async function readGate(page) {
	return page.locator(gateSelector).evaluate((gate) => ({
		state: gate.getAttribute("data-gate-state"),
		progress: Number(gate.getAttribute("data-kisara-scroll-progress") || 0),
	}));
}

async function assertGateGeometry(page) {
	const result = await page.evaluate(() => {
		const title = document.querySelector(".kisara-title");
		const chains = Array.from(document.querySelectorAll("[data-kisara-chain-back], [data-kisara-chain-front]"));
		const nonBlank = chains.some((canvas) => {
			if (!(canvas instanceof HTMLCanvasElement)) return false;
			const context = canvas.getContext("2d");
			if (!context) return false;
			const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
			for (let index = 3; index < pixels.length; index += 80) if (pixels[index] > 8) return true;
			return false;
		});
		const box = title?.getBoundingClientRect();
		return {
			canvasCount: document.querySelectorAll("[data-kisara-gate] canvas").length,
			nonBlank,
			title: title?.getAttribute("aria-label"),
			titleFits: Boolean(box && box.left >= 0 && box.right <= innerWidth),
			overflow: document.documentElement.scrollWidth > innerWidth,
		};
	});
	assert.equal(result.canvasCount, 8, "all Yuimi Gate canvases are required");
	assert.equal(result.title, "VAMPIRE");
	assert.equal(result.titleFits, true, "VAMPIRE title overflowed");
	assert.equal(result.overflow, false, "page has horizontal overflow");
	assert.equal(result.nonBlank, true, "chain canvases are visually blank");
}

async function chargeWithTouch(page) {
	await page.evaluate(() => {
		const createTouch = (clientY) => new Touch({ identifier: 1, target: document.body, clientX: innerWidth / 2, clientY });
		const start = createTouch(innerHeight * 0.82);
		const end = createTouch(innerHeight * 0.42);
		window.dispatchEvent(new TouchEvent("touchstart", { touches: [start] }));
		window.dispatchEvent(new TouchEvent("touchmove", { touches: [end] }));
		window.dispatchEvent(new TouchEvent("touchend", { changedTouches: [end] }));
	});
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: browserPath });

for (const viewport of viewports) {
	const context = await browser.newContext({ viewport, isMobile: viewport.isMobile, hasTouch: viewport.isMobile });
	const page = await context.newPage();
	const errors = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
	await page.goto(`${baseUrl}/live2D/`, { waitUntil: "networkidle", timeout: 60_000 });
	await page.locator(gateSelector).waitFor();
	assert.equal(await page.locator(".xiao-workspace").getAttribute("inert"), "");
	await page.screenshot({ path: path.join(outputDir, `${viewport.name}-idle.png`) });

	for (let index = 0; index < 4; index += 1) {
		await page.mouse.wheel(0, 160);
		await page.waitForTimeout(120);
	}
	const afterWheel = await readGate(page);
	assert.equal(afterWheel.state, "charging");
	assert.ok(afterWheel.progress > 0, "wheel input did not charge the gate");
	await page.keyboard.press("ArrowDown");
	await page.waitForTimeout(180);
	assert.ok((await readGate(page)).progress > afterWheel.progress, "keyboard input did not charge the gate");
	if (viewport.isMobile) {
		const beforeTouch = (await readGate(page)).progress;
		await chargeWithTouch(page);
		await page.waitForTimeout(180);
		assert.ok((await readGate(page)).progress > beforeTouch, "touch input did not charge the gate");
	}
	await assertGateGeometry(page);
	await page.screenshot({ path: path.join(outputDir, `${viewport.name}-charging.png`) });

	const states = new Set();
	for (let index = 0; index < 24; index += 1) {
		await page.mouse.wheel(0, 220);
		await page.waitForTimeout(110);
		states.add((await readGate(page)).state);
	}
	assert.ok(states.has("sealing"), "gate did not enter sealing");
	assert.ok(states.has("release"), "gate did not enter release");
	await page.screenshot({ path: path.join(outputDir, `${viewport.name}-release.png`) });

	if (await page.locator(gateSelector).count()) {
		await page.locator("[data-kisara-skip]").click();
		await page.locator(gateSelector).waitFor({ state: "detached" });
	}
	assert.equal(await page.locator(".xiao-workspace").getAttribute("inert"), null);
	await page.screenshot({ path: path.join(outputDir, `${viewport.name}-complete.png`) });
	await page.locator(".xiao-workspace__tools > button").first().click();
	await page.locator(gateSelector).waitFor();
	await page.locator("[data-kisara-skip]").click();
	await page.locator(gateSelector).waitFor({ state: "detached" });
	await page.reload({ waitUntil: "networkidle" });
	assert.equal(await page.locator(gateSelector).count(), 0, "intro replayed in the same session");
	assert.deepEqual(errors, [], errors.join("\n"));
	await context.close();
}

const reducedContext = await browser.newContext({ viewport: viewports[0], reducedMotion: "reduce" });
const reducedPage = await reducedContext.newPage();
await reducedPage.goto(`${baseUrl}/live2D/`, { waitUntil: "networkidle" });
assert.equal(await reducedPage.locator(gateSelector).count(), 0);
assert.equal(await reducedPage.locator(".xiao-workspace").getAttribute("inert"), null);
await reducedContext.close();

const failureContext = await browser.newContext({ viewport: viewports[0] });
const failurePage = await failureContext.newPage();
await failurePage.route("**/__local-vampire/**", (route) => route.abort());
await failurePage.goto(`${baseUrl}/live2D/`, { waitUntil: "networkidle" });
await failurePage.locator(gateSelector).waitFor();
await failurePage.locator("[data-kisara-skip]").click();
await failurePage.locator(gateSelector).waitFor({ state: "detached" });
assert.equal(await failurePage.locator(".xiao-workspace").getAttribute("inert"), null);
await failureContext.close();

await browser.close();
console.log("Vampire Yuimi Gate desktop/mobile checks passed.");
