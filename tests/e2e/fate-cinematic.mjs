import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4323";
const localOrigin = new URL(baseUrl).origin;
const browserPath =
	process.env.PLAYWRIGHT_BROWSER ||
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const outputDirectory = process.env.E2E_VISUAL_DIR || "";
const navigationTimeout = 60_000;

async function openPage(
	browser,
	reducedMotion = "no-preference",
	viewport = { width: 1440, height: 900 },
) {
	const context = await browser.newContext({
		viewport,
		reducedMotion,
	});
	const mediaRequests = [];
	const page = await context.newPage();
	await page.route("**/*", async (route) => {
		const requestUrl = route.request().url();
		try {
			const url = new URL(requestUrl);
			if (
				url.origin !== localOrigin &&
				url.protocol !== "data:" &&
				url.protocol !== "blob:"
			) {
				await route.abort("blockedbyclient");
				return;
			}
		} catch {}
		await route.continue();
	});
	page.on("request", (request) => {
		if (request.url().includes("/assets/videos/fate/")) mediaRequests.push(request.url());
	});
	return { context, page, mediaRequests };
}

async function goto(page, path, selector) {
	await page.goto(`${baseUrl}${path}`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	await page.locator(selector).waitFor({ state: "visible", timeout: 20_000 });
	await page.waitForFunction(
		() => document.querySelector("[data-cinematic-player]")?.dataset.initialized === "true",
		undefined,
		{ timeout: 20_000 },
	);
}

const browser = await chromium.launch({
	headless: true,
	executablePath: browserPath,
});

try {
	if (outputDirectory) await mkdir(outputDirectory, { recursive: true });
	const desktop = await openPage(browser);
	await goto(desktop.page, "/album/", ".album-collection__grid");
	const player = desktop.page.locator("[data-cinematic-player]");
	const prologue = desktop.page.locator('[data-cinematic-clip="saber-prologue"]');
	if ((await prologue.count()) !== 1 || !(await player.isHidden())) {
		throw new Error("Fate prologue trigger or idle player state is missing");
	}
	if (desktop.mediaRequests.length !== 0) {
		throw new Error(`idle page preloaded cinematic media: ${desktop.mediaRequests.join(", ")}`);
	}
	if (outputDirectory) {
		await desktop.page.screenshot({
			path: path.join(outputDirectory, "fate-album-cinematic-entry.png"),
		});
	}

	await prologue.click();
	await player.waitFor({ state: "visible" });
	await desktop.page.waitForFunction(() => {
		const video = document.querySelector("[data-cinematic-video]");
		return video?.currentSrc.includes("saber-prologue.mp4") && video.muted;
	});
	if ((await player.getAttribute("data-mode")) !== "navigate") {
		throw new Error("prologue did not open in navigation mode");
	}
	await desktop.page.locator("[data-cinematic-dismiss]").click();
	await desktop.page.waitForURL(/\/album\/04-fate\/?$/, { timeout: navigationTimeout });
	await player.waitFor({ state: "hidden", timeout: 10_000 });

	const preview = desktop.page.locator('[data-cinematic-clip="fgo-art-cut"]');
	await preview.waitFor({ state: "visible" });
	await preview.click();
	await player.waitFor({ state: "visible" });
	await desktop.page.waitForFunction(
		() => {
			const root = document.querySelector("[data-cinematic-player]");
			return Boolean(root?.contains(document.activeElement));
		},
		undefined,
		{ timeout: 2_000 },
	);
	const modalState = await desktop.page.evaluate(() => {
		const root = document.querySelector("[data-cinematic-player]");
		const siblings = root?.parentElement
			? [...root.parentElement.children].filter((element) => element !== root)
			: [];
		return {
			focusIsInside: Boolean(root?.contains(document.activeElement)),
			backgroundIsolated: siblings.every(
				(element) => element instanceof HTMLElement && element.inert,
			),
		};
	});
	if (!modalState.focusIsInside || !modalState.backgroundIsolated) {
		throw new Error(`cinematic modal isolation failed: ${JSON.stringify(modalState)}`);
	}
	await desktop.page.waitForFunction(() =>
		document.querySelector("[data-cinematic-video]")?.currentSrc.includes("fgo-art-cut.mp4"),
	);
	const beforePath = new URL(desktop.page.url()).pathname;
	await desktop.page.waitForTimeout(900);
	if (new URL(desktop.page.url()).pathname !== beforePath) {
		throw new Error("manual FGO preview unexpectedly navigated");
	}
	const audio = desktop.page.locator("[data-cinematic-audio]");
	await audio.click();
	if ((await player.getAttribute("data-muted")) !== "false") {
		throw new Error("cinematic audio toggle did not unmute");
	}
	if (outputDirectory) {
		await desktop.page.screenshot({
			path: path.join(outputDirectory, "fate-cinematic-desktop.png"),
		});
	}
	await desktop.page.keyboard.press("Escape");
	await player.waitFor({ state: "hidden", timeout: 5_000 });
	if (
		!(await preview.evaluate((trigger) => {
			let pageBranch = trigger;
			while (pageBranch.parentElement && pageBranch.parentElement !== document.body) {
				pageBranch = pageBranch.parentElement;
			}
			return document.activeElement === trigger && !pageBranch.inert;
		}))
	) {
		throw new Error("cinematic modal did not restore focus and page interactivity");
	}
	await desktop.context.close();

	const natural = await openPage(browser);
	await goto(natural.page, "/album/", ".album-collection__grid");
	let naturalEnded = false;
	await natural.page.exposeFunction("recordNaturalCinematicEnd", () => {
		naturalEnded = true;
	});
	await natural.page.evaluate(() => {
		document
			.querySelector("[data-cinematic-video]")
			?.addEventListener(
				"ended",
				() => {
					window.recordNaturalCinematicEnd();
				},
				{ once: true },
			);
	});
	const naturalStart = Date.now();
	await natural.page.locator('[data-cinematic-clip="saber-prologue"]').click();
	await natural.page.waitForURL(/\/album\/04-fate\/?$/, { timeout: navigationTimeout });
	if (!naturalEnded || Date.now() - naturalStart < 2_000) {
		throw new Error("Saber prologue navigated before natural playback ended");
	}
	await natural.context.close();

	const reduced = await openPage(browser, "reduce");
	await goto(reduced.page, "/album/", ".album-collection__grid");
	await reduced.page.locator('[data-cinematic-clip="saber-prologue"]').click();
	await reduced.page.waitForURL(/\/album\/04-fate\/?$/, { timeout: navigationTimeout });
	if (!(await reduced.page.locator("[data-cinematic-player]").isHidden())) {
		throw new Error("reduced-motion transition opened the cinematic player");
	}
	if (reduced.mediaRequests.length !== 0) {
		throw new Error("reduced-motion transition downloaded video media");
	}
	await reduced.context.close();

	const saveData = await openPage(browser);
	await saveData.page.addInitScript(() => {
		Object.defineProperty(navigator, "connection", {
			configurable: true,
			value: { effectiveType: "4g", saveData: true },
		});
	});
	await goto(saveData.page, "/album/", ".album-collection__grid");
	await saveData.page.locator('[data-cinematic-clip="saber-prologue"]').click();
	await saveData.page.waitForURL(/\/album\/04-fate\/?$/, { timeout: navigationTimeout });
	if (!(await saveData.page.locator("[data-cinematic-player]").isHidden())) {
		throw new Error("save-data transition opened the cinematic player");
	}
	if (saveData.mediaRequests.length !== 0) {
		throw new Error("save-data transition downloaded video media");
	}
	await saveData.context.close();

	const failedMedia = await openPage(browser);
	await goto(failedMedia.page, "/album/04-fate/", ".album-detail__cinematic");
	await failedMedia.page.locator('[data-cinematic-clip="fgo-art-cut"]').click();
	const failedPlayer = failedMedia.page.locator("[data-cinematic-player]");
	await failedPlayer.waitFor({ state: "visible" });
	await failedMedia.page
		.locator("[data-cinematic-video]")
		.evaluate((video) => video.dispatchEvent(new Event("error")));
	await failedPlayer.waitFor({ state: "hidden", timeout: 10_000 });
	if (new URL(failedMedia.page.url()).pathname !== "/album/04-fate/") {
		throw new Error("failed preview media unexpectedly navigated");
	}
	await failedMedia.context.close();

	const mobile = await openPage(
		browser,
		"no-preference",
		{ width: 390, height: 844 },
	);
	await goto(mobile.page, "/album/04-fate/", ".album-detail__cinematic");
	await mobile.page.locator('[data-cinematic-clip="fgo-art-cut"]').click();
	const mobilePlayer = mobile.page.locator("[data-cinematic-player]");
	await mobilePlayer.waitFor({ state: "visible" });
	await mobile.page.waitForTimeout(700);
	const mobileGeometry = await mobile.page.evaluate(() => {
		const root = document.querySelector("[data-cinematic-player]");
		const controls = document.querySelector(".cinematic-player__controls");
		const video = document.querySelector("[data-cinematic-video]");
		if (!root || !controls || !video) return null;
		const rootRect = root.getBoundingClientRect();
		const controlsRect = controls.getBoundingClientRect();
		return {
			root: rootRect.toJSON(),
			controls: controlsRect.toJSON(),
			videoWidth: video.videoWidth,
			videoHeight: video.videoHeight,
			overflow: document.documentElement.scrollWidth - window.innerWidth,
			topmost: [
				[12, 120],
				[12, 700],
				[195, 422],
				[378, 700],
			].map(([x, y]) => root.contains(document.elementFromPoint(x, y))),
		};
	});
	if (
		!mobileGeometry ||
		mobileGeometry.root.width !== 390 ||
		mobileGeometry.root.height !== 844 ||
		mobileGeometry.controls.bottom > 844.5 ||
		mobileGeometry.controls.left < -0.5 ||
		mobileGeometry.controls.right > 390.5 ||
		mobileGeometry.videoWidth !== 1280 ||
		mobileGeometry.videoHeight !== 720 ||
		mobileGeometry.overflow > 0 ||
		mobileGeometry.topmost.some((value) => !value)
	) {
		throw new Error(`mobile cinematic geometry is invalid: ${JSON.stringify(mobileGeometry)}`);
	}
	if (outputDirectory) {
		await mobile.page.screenshot({
			path: path.join(outputDirectory, "fate-cinematic-mobile.png"),
		});
	}
	await mobile.page.keyboard.press("Escape");
	await mobilePlayer.waitFor({ state: "hidden", timeout: 5_000 });
	await mobile.context.close();
} finally {
	await browser.close();
}

console.log("Optional Fate cinematic flow passed.");
