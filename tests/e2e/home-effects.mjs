import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4321";
const localOrigin = new URL(baseUrl).origin;
const outputDirectory =
	process.env.E2E_VISUAL_DIR || path.resolve("test-results/home-effects");
const browserPath =
	process.env.PLAYWRIGHT_BROWSER ||
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const homeOnly = process.env.E2E_HOME_ONLY === "1";
const captureCinematicContactSheet =
	process.env.E2E_CAPTURE_CINEMATIC_CONTACT_SHEET === "1";
const CINEMATIC_FRAME_COUNT = 24;
const CINEMATIC_SOURCE_TIMES = [
	0.05, 0.65, 1.25, 1.8, 2.35, 2.9, 3.45, 4, 4.55, 4.72, 5.05, 5.22, 5.55, 5.72,
	6.05, 6.22, 6.55, 6.72, 7.05, 7.55, 8.1, 8.65, 9.2, 9.82,
];
const CINEMATIC_FRAME_FILES = Array.from({ length: 24 }, (_, index) => {
	const frameNumber = String(index + 1).padStart(2, "0");
	return `frame-${frameNumber}.webp`;
});
const SHUTTER_TIMELINE_END = 16.8;
const SHUTTER_ENTRY_PROGRESS = 1.18 / SHUTTER_TIMELINE_END;
const SHUTTER_COLUMNS_PROGRESS = 2.62 / SHUTTER_TIMELINE_END;
const SHUTTER_STORY_FRAME_START = 2.76;
const SHUTTER_STORY_FRAME_STEP = 0.32;
const SHUTTER_STORY_BLEND_DURATION = 0.12;
const SHUTTER_STORY_HOLD_PROGRESS = 5.9 / SHUTTER_TIMELINE_END;
const SHUTTER_STRIPS_MID_PROGRESS = 11.7 / SHUTTER_TIMELINE_END;
const SHUTTER_STRIPS_COMPLETE_PROGRESS = 12.62 / SHUTTER_TIMELINE_END;
const SHUTTER_FINAL_VIDEO_PROGRESS = 14.6 / SHUTTER_TIMELINE_END;
const pageFailures = new WeakMap();

await mkdir(outputDirectory, { recursive: true });

async function blockExternalSubresources(page) {
	await page.route("**/*", async (route) => {
		try {
			const url = new URL(route.request().url());
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
}

async function createPage(browser, viewport, reducedMotion = "no-preference") {
	const context = await browser.newContext({
		viewport,
		colorScheme: "light",
		reducedMotion,
	});
	await context.addInitScript(() => localStorage.clear());
	const page = await context.newPage();
	const failures = [];
	pageFailures.set(page, failures);
	page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
	page.on("console", (message) => {
		if (
			message.type() === "error" &&
			!message.text().includes("ERR_BLOCKED_BY_CLIENT")
		) {
			const location = message.location();
			failures.push(
				`console: ${message.text()}${location.url ? ` @ ${location.url}:${location.lineNumber}` : ""}`,
			);
		}
	});
	page.on("response", (response) => {
		if (response.status() >= 400 && response.url().startsWith(localOrigin)) {
			failures.push(`response: ${response.status()} ${response.url()}`);
		}
	});
	await blockExternalSubresources(page);
	return page;
}

function assertNoPageErrors(page, label, ignoredFragments = []) {
	const allFailures = pageFailures.get(page) ?? [];
	const failures = allFailures.filter(
		(failure) =>
			!ignoredFragments.some((fragment) => failure.includes(fragment)),
	);
	if (failures.length > 0) {
		throw new Error(
			`${label} emitted browser errors: ${JSON.stringify(failures)}`,
		);
	}
	const ignored = allFailures.filter((failure) => !failures.includes(failure));
	if (ignored.length > 0) {
		console.warn(`${label} ignored known errors: ${JSON.stringify(ignored)}`);
	}
}

async function goto(page, route, readySelector) {
	await page.goto(`${baseUrl}${route}`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	await page.locator(readySelector).first().waitFor({
		state: "visible",
		timeout: 20_000,
	});
	if ((await page.locator("html[hidden]").count()) > 0) {
		throw new Error(`${route} unexpectedly hides the document root`);
	}
}

async function readHeroIdentityGeometry(page) {
	return page.evaluate(() => {
		const avatar = document.querySelector(".home-hero__avatar-group");
		const title = document.querySelector(".home-hero__name");
		if (!avatar || !title) return null;
		const avatarRect = avatar.getBoundingClientRect();
		const titleRect = title.getBoundingClientRect();
		const overlapWidth = Math.max(
			0,
			Math.min(avatarRect.right, titleRect.right) -
				Math.max(avatarRect.left, titleRect.left),
		);
		const verticalOverlap = Math.max(
			0,
			Math.min(avatarRect.bottom, titleRect.bottom) -
				Math.max(avatarRect.top, titleRect.top),
		);
		return {
			overlapArea: overlapWidth * verticalOverlap,
			horizontalGap: avatarRect.left - titleRect.right,
			verticalOverlap,
			avatar: avatarRect.toJSON(),
			title: titleRect.toJSON(),
		};
	});
}

async function waitForHeroOpening(page) {
	const loader = page.locator("#page-loader");
	if ((await loader.count()) > 0) {
		await loader.waitFor({ state: "hidden", timeout: 15_000 });
	}
	await page.evaluate(() => document.fonts.ready);
	await page.waitForFunction(
		() => {
			const avatar = document.querySelector(".home-hero__avatar-group");
			if (!avatar) return false;
			const style = getComputedStyle(avatar);
			const matrix =
				style.transform === "none"
					? new DOMMatrixReadOnly()
					: new DOMMatrixReadOnly(style.transform);
			return (
				Number(style.opacity) >= 0.99 &&
				Math.abs(matrix.a - 1) <= 0.002 &&
				Math.abs(matrix.d - 1) <= 0.002 &&
				Math.abs(matrix.m41) <= 0.5 &&
				Math.abs(matrix.m42) <= 0.5
			);
		},
		undefined,
		{ timeout: 8_000 },
	);
}

function assertHeroIdentityGeometry(geometry, label) {
	const minimumVerticalOverlap = geometry
		? Math.min(geometry.avatar.height, geometry.title.height) * 0.55
		: 0;
	if (
		!geometry ||
		geometry.overlapArea > 0 ||
		geometry.horizontalGap < 8 ||
		geometry.horizontalGap > 96 ||
		geometry.verticalOverlap < minimumVerticalOverlap
	) {
		throw new Error(
			`${label} work status must sit beside the hero title: ${JSON.stringify(geometry)}`,
		);
	}
}

async function readHeroCharacterFollow(page) {
	return page.locator(".home-hero__character-duo").evaluate((character) => {
		const style = getComputedStyle(character);
		const rect = character.getBoundingClientRect();
		return {
			x: Number.parseFloat(style.getPropertyValue("--home-character-follow-x")),
			y: Number.parseFloat(style.getPropertyValue("--home-character-follow-y")),
			ready: character.dataset.pointerFollow,
			translate: style.translate,
			transform: style.transform,
			rect: rect.toJSON(),
		};
	});
}

async function verifyHeroCharacterFollow(page) {
	await page.waitForFunction(
		() =>
			document.querySelector(".home-hero__character-duo")?.dataset
				.pointerFollow === "ready",
	);
	const viewport = page.viewportSize();
	if (!viewport) throw new Error("missing viewport for hero character test");
	const character = page.locator(".home-hero__character-duo");
	await character.evaluate((element) =>
		Promise.all(
			element
				.getAnimations()
				.filter(
					(animation) =>
						Number(animation.effect?.getTiming().iterations ?? 1) !==
						Number.POSITIVE_INFINITY,
				)
				.map((animation) => animation.finished.catch(() => undefined)),
		),
	);

	await page.mouse.move(viewport.width / 2, viewport.height / 2);
	await page.waitForFunction(() => {
		const element = document.querySelector(".home-hero__character-duo");
		if (!element) return false;
		const style = getComputedStyle(element);
		return (
			Math.abs(
				Number.parseFloat(style.getPropertyValue("--home-character-follow-x")),
			) < 0.25 &&
			Math.abs(
				Number.parseFloat(style.getPropertyValue("--home-character-follow-y")),
			) < 0.25
		);
	});
	const center = await readHeroCharacterFollow(page);

	await page.mouse.move(1, 1);
	await page.waitForFunction(() => {
		const element = document.querySelector(".home-hero__character-duo");
		if (!element) return false;
		const style = getComputedStyle(element);
		return (
			Number.parseFloat(style.getPropertyValue("--home-character-follow-x")) <
				-24.5 &&
			Number.parseFloat(style.getPropertyValue("--home-character-follow-y")) <
				-16.5
		);
	});
	const topLeft = await readHeroCharacterFollow(page);
	await page.screenshot({
		path: path.join(outputDirectory, "home-hero-character-top-left.png"),
	});

	await page.mouse.move(viewport.width - 1, viewport.height - 1);
	await page.waitForFunction(() => {
		const element = document.querySelector(".home-hero__character-duo");
		if (!element) return false;
		const style = getComputedStyle(element);
		return (
			Number.parseFloat(style.getPropertyValue("--home-character-follow-x")) >
				24.5 &&
			Number.parseFloat(style.getPropertyValue("--home-character-follow-y")) >
				16.5
		);
	});
	const bottomRight = await readHeroCharacterFollow(page);
	await page.screenshot({
		path: path.join(outputDirectory, "home-hero-character-bottom-right.png"),
	});
	if (
		bottomRight.ready !== "ready" ||
		topLeft.ready !== "ready" ||
		bottomRight.x > 26.1 ||
		bottomRight.y > 18.1 ||
		topLeft.x < -26.1 ||
		topLeft.y < -18.1 ||
		bottomRight.rect.left - topLeft.rect.left < 48 ||
		bottomRight.rect.top - topLeft.rect.top < 32
	) {
		throw new Error(
			`hero character bounding box did not visibly follow the pointer: ${JSON.stringify({ center, topLeft, bottomRight })}`,
		);
	}

	await page.evaluate(() => window.dispatchEvent(new Event("blur")));
	await page.waitForFunction(() => {
		const character = document.querySelector(".home-hero__character-duo");
		if (!character) return false;
		const style = getComputedStyle(character);
		return (
			Math.abs(
				Number.parseFloat(style.getPropertyValue("--home-character-follow-x")),
			) < 0.5 &&
			Math.abs(
				Number.parseFloat(style.getPropertyValue("--home-character-follow-y")),
			) < 0.5
		);
	});
	const reset = await readHeroCharacterFollow(page);
	if (
		Math.abs(reset.rect.left - center.rect.left) > 1 ||
		Math.abs(reset.rect.top - center.rect.top) > 1
	) {
		throw new Error(
			`hero character did not return to its centered bounding box: ${JSON.stringify({ center, reset })}`,
		);
	}

	await page.evaluate(() => {
		const hero = document.getElementById("home-hero");
		window.scrollTo({ top: (hero?.offsetHeight ?? window.innerHeight) + 80 });
	});
	await page.waitForFunction(
		() => document.documentElement.dataset.homeHeroVisible === "false",
	);
	await page.waitForFunction(() => {
		const character = document.querySelector(".home-hero__character-duo");
		if (!character) return false;
		const style = getComputedStyle(character);
		return (
			Math.abs(
				Number.parseFloat(style.getPropertyValue("--home-character-follow-x")),
			) < 0.5 &&
			Math.abs(
				Number.parseFloat(style.getPropertyValue("--home-character-follow-y")),
			) < 0.5
		);
	});
	await page.mouse.move(viewport.width - 1, viewport.height - 1);
	await page.waitForTimeout(220);
	const hiddenHeroPosition = await readHeroCharacterFollow(page);
	if (
		Math.abs(hiddenHeroPosition.x) >= 0.5 ||
		Math.abs(hiddenHeroPosition.y) >= 0.5
	) {
		throw new Error(
			`hidden hero still follows the pointer: ${JSON.stringify(hiddenHeroPosition)}`,
		);
	}
	await page.evaluate(() => window.scrollTo({ top: 0 }));
	await page.waitForFunction(
		() => document.documentElement.dataset.homeHeroVisible === "true",
	);
	console.log(
		"Hero character follow:",
		JSON.stringify({
			center: {
				x: center.x,
				y: center.y,
				left: center.rect.left,
				top: center.rect.top,
			},
			topLeft: {
				x: topLeft.x,
				y: topLeft.y,
				left: topLeft.rect.left,
				top: topLeft.rect.top,
			},
			bottomRight: {
				x: bottomRight.x,
				y: bottomRight.y,
				left: bottomRight.rect.left,
				top: bottomRight.rect.top,
			},
			boundingDelta: {
				x: bottomRight.rect.left - topLeft.rect.left,
				y: bottomRight.rect.top - topLeft.rect.top,
			},
		}),
	);
	return { center, topLeft, bottomRight, reset };
}

async function verifyWallpaperModes(page) {
	await goto(page, "/posts/", ".article-feed-card");
	await page.locator('#floating-dock [data-dock-command="toggle"]').click();
	await page.locator('#floating-dock [data-dock-command="settings"]').click();
	const drawer = page.locator('[data-dock-drawer="settings"]');
	await drawer.waitFor({ state: "visible" });

	const hue = drawer.locator("#display-hue");
	const hueBackground = await hue.evaluate(
		(element) => getComputedStyle(element).backgroundImage,
	);
	if (!hueBackground.includes("linear-gradient")) {
		throw new Error("theme hue control is not rendered as a rainbow strip");
	}
	await hue.evaluate((element) => {
		const input = element;
		input.value = "125";
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
	await page.waitForFunction(
		() => document.documentElement.style.getPropertyValue("--hue") === "125",
	);

	const buttons = drawer.locator(
		".display-settings__segments--wallpaper button",
	);
	if ((await buttons.count()) !== 4) {
		throw new Error("wallpaper mode control must expose four modes");
	}

	const modes = ["banner", "full", "overlay", "none"];
	for (let index = 0; index < modes.length; index += 1) {
		const mode = modes[index];
		await buttons.nth(index).click();
		await page.waitForFunction(
			(expected) => document.documentElement.dataset.wallpaperMode === expected,
			mode,
		);
		await page.waitForTimeout(650);
		const metrics = await page.evaluate(() => {
			const banner = document.getElementById("page-wallpaper-banner");
			const article = document.querySelector(".article-feed-card");
			const pseudo = getComputedStyle(document.body, "::before");
			return {
				mode: document.documentElement.dataset.wallpaperMode,
				bannerDisplay: banner ? getComputedStyle(banner).display : "missing",
				bodyBackground: getComputedStyle(document.body).backgroundImage,
				pseudoImage: pseudo.backgroundImage,
				pseudoOpacity: Number(pseudo.opacity),
				pseudoFilter: pseudo.filter,
				cardBackground: article
					? getComputedStyle(article).backgroundColor
					: "missing",
				cardOpacity: getComputedStyle(
					document.documentElement,
				).getPropertyValue("--wallpaper-card-opacity"),
			};
		});

		if (metrics.mode !== mode) {
			throw new Error(`wallpaper mode did not switch to ${mode}`);
		}
		if (mode === "banner" && metrics.bannerDisplay === "none") {
			throw new Error("banner mode does not show the page banner");
		}
		if (mode === "banner") {
			const waves = page.locator(".page-wallpaper-banner__parallax use");
			const waveSurface = page.locator(".page-wallpaper-banner__waves");
			if ((await waves.count()) !== 4) {
				throw new Error("banner water surface must contain four wave layers");
			}
			const readWaves = () =>
				waves.evaluateAll((elements) =>
					elements.map((element) => {
						const style = getComputedStyle(element);
						return {
							transform: style.transform,
							animationName: style.animationName,
							animationPlayState: style.animationPlayState,
							fill: style.fill,
							opacity: Number(style.opacity),
							stroke: style.stroke,
							filter: style.filter,
						};
					}),
				);
			const before = await readWaves();
			const expectedPageBackground = await page.evaluate(() =>
				getComputedStyle(document.documentElement)
					.getPropertyValue("--page-bg")
					.trim(),
			);
			const expectedWaveOpacity = [0.25, 0.5, 0.65, 0.75];
			if (
				before.some(
					(wave, index) =>
						wave.fill !== expectedPageBackground ||
						Math.abs(wave.opacity - expectedWaveOpacity[index]) > 0.01 ||
						wave.stroke !== "none" ||
						wave.filter !== "none",
				)
			) {
				throw new Error(
					`banner water surface is not using the reference white layers: ${JSON.stringify({ expectedPageBackground, before })}`,
				);
			}
			const visualBefore = await waveSurface.screenshot({
				animations: "allow",
			});
			await page.waitForTimeout(420);
			const after = await readWaves();
			const visualAfter = await waveSurface.screenshot({ animations: "allow" });
			if (
				before.some(
					(wave) =>
						wave.animationName === "none" ||
						wave.animationPlayState !== "running",
				) ||
				before.every(
					(wave, waveIndex) => wave.transform === after[waveIndex]?.transform,
				)
			) {
				throw new Error(
					`banner water surface is static: ${JSON.stringify({ before, after })}`,
				);
			}
			const visualDifference = await compareVisualFrames(
				visualBefore,
				visualAfter,
			);
			if (
				visualDifference.changedRatio < 0.08 ||
				visualDifference.meanChannelDelta < 1.5
			) {
				throw new Error(
					`banner wave transforms changed without visible pixels: ${JSON.stringify(visualDifference)}`,
				);
			}
			console.log(
				"Wallpaper wave motion:",
				JSON.stringify({ before, after, visualDifference }),
			);
		}
		if (mode !== "banner" && metrics.bannerDisplay !== "none") {
			throw new Error(`${mode} mode unexpectedly shows the page banner`);
		}
		if (["full", "overlay"].includes(mode) && metrics.pseudoImage === "none") {
			throw new Error(`${mode} mode does not render a fixed wallpaper`);
		}
		if (mode === "full" && metrics.pseudoOpacity < 0.99) {
			throw new Error("full wallpaper is not fully opaque");
		}
		if (
			mode === "overlay" &&
			(metrics.pseudoOpacity >= 0.99 ||
				metrics.pseudoFilter === "none" ||
				metrics.cardOpacity.trim() === "1")
		) {
			throw new Error("overlay mode is missing transparency or blur");
		}
		if (
			mode === "none" &&
			(metrics.bodyBackground !== "none" || metrics.pseudoImage !== "none")
		) {
			throw new Error("plain mode still renders a wallpaper");
		}

		await page.screenshot({
			path: path.join(outputDirectory, `wallpaper-${mode}.png`),
		});
	}

	await buttons.nth(1).click();
	await page.evaluate(() => {
		document.body.dispatchEvent(
			new PointerEvent("pointerdown", {
				bubbles: true,
				button: 0,
				clientX: 560,
				clientY: 420,
			}),
		);
	});
	const ripple = page.locator(".wallpaper-water-ripple").last();
	await ripple.waitFor({ state: "attached" });
	await page.waitForTimeout(80);
	const readRipple = () =>
		ripple.evaluate((element) => {
			const style = getComputedStyle(element);
			const rect = element.getBoundingClientRect();
			return {
				width: rect.width,
				height: rect.height,
				opacity: Number(style.opacity),
				animationName: style.animationName,
				animationPlayState: style.animationPlayState,
			};
		});
	const rippleEarly = await readRipple();
	await page.waitForTimeout(300);
	const rippleLate = await readRipple();
	if (
		rippleEarly.animationName !== "wallpaper-water-ripple" ||
		rippleEarly.animationPlayState !== "running" ||
		rippleLate.width <= rippleEarly.width + 30 ||
		rippleLate.height <= rippleEarly.height + 30 ||
		rippleLate.opacity >= rippleEarly.opacity
	) {
		throw new Error(
			`click water ripple did not expand and fade: ${JSON.stringify({ rippleEarly, rippleLate })}`,
		);
	}
	await page.screenshot({
		path: path.join(outputDirectory, "wallpaper-click-ripple.png"),
	});
	console.log(
		"Wallpaper click ripple:",
		JSON.stringify({ rippleEarly, rippleLate }),
	);
	await ripple.waitFor({ state: "detached", timeout: 2_000 });
}

async function getHomeScrollRange(page) {
	const root = page.locator("#home-display-layer");
	return root.evaluate((element) => ({
		top:
			(element.closest(".pin-spacer") ?? element).getBoundingClientRect().top +
			window.scrollY,
		distance: Number(element.dataset.cinematicScrollDistance),
	}));
}

async function readHomeLayoutGeometry(page) {
	return page.evaluate(() => {
		const home = document.querySelector(".home-page");
		const hero = document.getElementById("home-hero");
		const display = document.getElementById("home-display-layer");
		const displayAnchor = display?.closest(".pin-spacer") ?? display;
		const ticker = document.querySelector(".home-ticker");
		const deck = document.querySelector("[data-photo-deck]");
		const data = document.querySelector(".home-data-layer");
		const documentTop = (element) => {
			if (!element) return null;
			return element.getBoundingClientRect().top + window.scrollY;
		};
		const documentBottom = (element) => {
			if (!element) return null;
			return element.getBoundingClientRect().bottom + window.scrollY;
		};
		const semanticOrder = [...(home?.children ?? [])]
			.map((element) => {
				if (element === hero) return "hero";
				if (element === displayAnchor || element.contains(display))
					return "display";
				if (element === ticker || element.contains(ticker)) return "ticker";
				if (element === deck || element.contains(deck)) return "photo";
				if (element === data || element.contains(data)) return "data";
				return null;
			})
			.filter(Boolean);
		return {
			heroBottom: documentBottom(hero),
			displayTriggerTop: documentTop(displayAnchor),
			displayBottom: documentBottom(displayAnchor),
			tickerTop: documentTop(ticker),
			photoDeckTop: documentTop(deck),
			photoDeckBottom: documentBottom(deck),
			dataLayerTop: documentTop(data),
			semanticOrder,
			dataIsLast: semanticOrder.at(-1) === "data",
			displayFollowsHero:
				semanticOrder.indexOf("display") === semanticOrder.indexOf("hero") + 1,
		};
	});
}

async function wheelDistance(page, delta, maximumStep = 220) {
	const steps = Math.max(1, Math.ceil(Math.abs(delta) / maximumStep));
	const step = delta / steps;
	for (let index = 0; index < steps; index += 1) {
		await page.mouse.wheel(0, step);
		await page.waitForTimeout(24);
	}
	await page.waitForTimeout(100);
}

async function captureShutterViewport(page) {
	const viewport = page.viewportSize();
	if (!viewport || viewport.width < 400 || viewport.height < 300) {
		throw new Error("shutter visual capture requires a desktop viewport");
	}
	const insetX = 80;
	const insetTop = 100;
	const insetBottom = 120;
	return page.screenshot({
		animations: "allow",
		clip: {
			x: insetX,
			y: insetTop,
			width: viewport.width - insetX * 2,
			height: viewport.height - insetTop - insetBottom,
		},
	});
}

async function compareVisualFrames(referenceBuffer, actualBuffer) {
	const reference = await sharp(referenceBuffer)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const actual = await sharp(actualBuffer).ensureAlpha().raw().toBuffer();
	if (reference.data.length !== actual.length) {
		throw new Error("visual frame dimensions do not match");
	}

	let changedPixels = 0;
	let totalDelta = 0;
	const pixelCount = reference.info.width * reference.info.height;
	for (let offset = 0; offset < reference.data.length; offset += 4) {
		const red = Math.abs(reference.data[offset] - actual[offset]);
		const green = Math.abs(reference.data[offset + 1] - actual[offset + 1]);
		const blue = Math.abs(reference.data[offset + 2] - actual[offset + 2]);
		const maximum = Math.max(red, green, blue);
		if (maximum >= 20) changedPixels += 1;
		totalDelta += red + green + blue;
	}

	return {
		changedRatio: changedPixels / pixelCount,
		meanChannelDelta: totalDelta / (pixelCount * 3),
	};
}

async function captureRenderedCinematicContactSheet(page, range) {
	const columns = 4;
	const thumbnailWidth = 480;
	const thumbnailHeight = 270;
	const thumbnails = [];

	for (let index = 0; index < CINEMATIC_FRAME_COUNT; index += 1) {
		const timelineTime =
			index === 0
				? SHUTTER_STORY_FRAME_START + 0.18
				: SHUTTER_STORY_FRAME_START +
					index * SHUTTER_STORY_FRAME_STEP +
					SHUTTER_STORY_BLEND_DURATION +
					0.04;
		await setHomeProgress(page, range, timelineTime / SHUTTER_TIMELINE_END);
		assertCinematicStoryHold(
			await readHomeCinematicStoryState(page),
			index,
			`rendered contact sheet frame ${index + 1}`,
		);
		const label = String(index + 1).padStart(2, "0");
		const thumbnail = await sharp(await captureShutterViewport(page))
			.resize(thumbnailWidth, thumbnailHeight)
			.composite([
				{
					input: Buffer.from(`
						<svg xmlns="http://www.w3.org/2000/svg" width="150" height="34">
							<rect width="150" height="34" fill="#000000"/>
							<text x="12" y="23" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700">FRAME ${label} / 24</text>
						</svg>
					`),
					left: 0,
					top: 0,
				},
			])
			.png()
			.toBuffer();
		thumbnails.push({
			input: thumbnail,
			left: (index % columns) * thumbnailWidth,
			top: Math.floor(index / columns) * thumbnailHeight,
		});
	}

	await sharp({
		create: {
			width: columns * thumbnailWidth,
			height: Math.ceil(CINEMATIC_FRAME_COUNT / columns) * thumbnailHeight,
			channels: 3,
			background: "#000",
		},
	})
		.composite(thumbnails)
		.png({ compressionLevel: 9 })
		.toFile(
			path.join(outputDirectory, "home-artoria-24-edge-contact-sheet.png"),
		);
}

async function waitForUnpinnedShutterStart(page) {
	await page.waitForFunction(() => {
		const root = document.querySelector("#home-display-layer");
		return (
			root?.closest(".pin-spacer") &&
			getComputedStyle(root).position === "relative"
		);
	});
	await page.evaluate(
		() =>
			new Promise((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(resolve)),
			),
	);
}

async function verifyWheelScrub(page, range) {
	await page.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
	await wheelDistance(page, range.top);
	await page.waitForFunction(() => {
		const root = document.querySelector("#home-display-layer");
		return Number(root?.dataset.cinematicProgress || 0) <= 0.012;
	});
	await waitForUnpinnedShutterStart(page);

	const startY = await page.evaluate(() => window.scrollY);
	const startFrame = await captureShutterViewport(page);
	const travel = Math.min(2_500, range.distance * 0.22);
	let reference = null;
	let referenceY = null;
	for (let round = 0; round < 2; round += 1) {
		await wheelDistance(page, travel);
		await page.waitForFunction(() => {
			const progress = Number(
				document.querySelector("#home-display-layer")?.dataset
					.cinematicProgress || 0,
			);
			return progress > 0.15 && progress < 0.4;
		});
		const state = await readHomeShutterState(page);
		const currentY = await page.evaluate(() => window.scrollY);
		await page.waitForTimeout(350);
		if (round === 0) {
			const forwardDifference = await compareVisualFrames(
				startFrame,
				await captureShutterViewport(page),
			);
			if (
				forwardDifference.changedRatio < 0.18 ||
				forwardDifference.meanChannelDelta < 8
			) {
				throw new Error(
					`wheel progress changed without a visible shutter transition: ${JSON.stringify(forwardDifference)}`,
				);
			}
			console.log(
				"Home shutter visual delta:",
				JSON.stringify(forwardDifference),
			);
		}
		assertEquivalentShutterState(
			await readHomeShutterState(page),
			state,
			`wheel round ${round + 1} fixed position`,
		);

		if (reference) {
			assertNear(currentY, referenceY, 2, "wheel rounds scroll position");
			assertEquivalentShutterState(
				state,
				reference,
				"wheel state on the second pass",
			);
		} else {
			reference = state;
			referenceY = currentY;
		}

		await wheelDistance(page, -travel);
		await page.waitForFunction(() => {
			const progress = Number(
				document.querySelector("#home-display-layer")?.dataset
					.cinematicProgress || 0,
			);
			return progress <= 0.012;
		});
		await waitForUnpinnedShutterStart(page);
		assertNear(
			await page.evaluate(() => window.scrollY),
			startY,
			2,
			`wheel round ${round + 1} reverse position`,
		);
		if (round === 0) {
			await page.waitForTimeout(300);
			const reverseDifference = await compareVisualFrames(
				startFrame,
				await captureShutterViewport(page),
			);
			if (
				reverseDifference.changedRatio > 0.012 ||
				reverseDifference.meanChannelDelta > 1.2
			) {
				throw new Error(
					`reverse scroll did not restore the visible shutter frame: ${JSON.stringify(reverseDifference)}`,
				);
			}
			console.log(
				"Home shutter reverse visual delta:",
				JSON.stringify(reverseDifference),
			);
		}
	}

	console.log(
		"Home wheel scrub:",
		JSON.stringify({ startY, referenceY, progress: reference?.progress }),
	);
}

async function readHomeShutterState(page) {
	return page.locator("#home-display-layer").evaluate((root) => {
		const readStrip = (selector) => {
			const strip = root.querySelector(selector);
			if (!strip) return null;
			const style = getComputedStyle(strip);
			const matrix =
				style.transform === "none"
					? new DOMMatrixReadOnly()
					: new DOMMatrixReadOnly(style.transform);
			return {
				x: matrix.m41,
				width: strip.getBoundingClientRect().width,
				opacity: Number(style.opacity),
				visibility: style.visibility,
				src: strip.getAttribute("src") ?? "missing",
			};
		};

		return {
			progress: Number(root.dataset.cinematicProgress || 0),
			panels: [...root.querySelectorAll("[data-shutter-panel]")].map(
				(panel) => {
					const style = getComputedStyle(panel);
					const rect = panel.getBoundingClientRect();
					const image = panel.querySelector("[data-shutter-image]");
					const imageStyle = image ? getComputedStyle(image) : null;
					const matrix =
						style.transform === "none"
							? new DOMMatrixReadOnly()
							: new DOMMatrixReadOnly(style.transform);
					return {
						direction: panel.dataset.direction,
						progress: Number(
							style.getPropertyValue("--shutter-panel-progress") || 0,
						),
						y: matrix.m42,
						height: rect.height,
						opacity: Number(style.opacity),
						visibility: style.visibility,
						clipPath: style.clipPath,
						filter: style.filter,
						backdropFilter: style.backdropFilter,
						imageFilter: imageStyle?.filter ?? "missing",
						imageSrc: image?.getAttribute("src") ?? "missing",
					};
				},
			),
			strips: {
				left: readStrip("[data-shutter-interlude-strip-left]"),
				right: readStrip("[data-shutter-interlude-strip-right]"),
			},
		};
	});
}

async function readHomeCinematicStoryState(page) {
	return page.locator("#home-display-layer").evaluate((root) => {
		const story = root.querySelector("[data-scroll-cinematic]");
		if (!story) return null;
		const storyStyle = getComputedStyle(story);
		const storyRect = story.getBoundingClientRect();
		const letterbox = story.querySelector(".home-scroll-cinematic__letterbox");
		const captionBand = story.querySelector("[data-scroll-cinematic-captions]");
		const captionBandRect = captionBand?.getBoundingClientRect();
		const readStripExposure = (selector) => {
			const strip = root.querySelector(selector);
			if (!strip) return null;
			const rect = strip.getBoundingClientRect();
			const visibleWidth = Math.max(
				0,
				Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0),
			);
			const visibleHeight = Math.max(
				0,
				Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0),
			);
			return {
				intersectionRatio:
					rect.width > 0 && rect.height > 0
						? (visibleWidth * visibleHeight) / (rect.width * rect.height)
						: 0,
				left: rect.left,
				right: rect.right,
				width: rect.width,
			};
		};

		return {
			progress: Number(root.dataset.cinematicProgress || 0),
			active: root.dataset.cinematicStoryActive,
			activeFrame: Number(root.dataset.cinematicStoryFrame || 0),
			opacity: Number(storyStyle.opacity),
			visibility: storyStyle.visibility,
			frameCount: Number(story.dataset.frameCount),
			sourceVideo: story.dataset.sourceVideo,
			width: storyRect.width,
			height: storyRect.height,
			letterboxHeight: letterbox
				? Number.parseFloat(getComputedStyle(letterbox, "::before").height)
				: 0,
			captionBand: captionBandRect
				? {
						top: captionBandRect.top,
						bottom: captionBandRect.bottom,
						height: captionBandRect.height,
					}
				: null,
			frames: [...story.querySelectorAll("[data-scroll-cinematic-frame]")].map(
				(frame) => {
					const style = getComputedStyle(frame);
					const matrix =
						style.transform === "none"
							? new DOMMatrixReadOnly()
							: new DOMMatrixReadOnly(style.transform);
					return {
						index: Number(frame.dataset.frameIndex),
						sourceTime: Number(frame.dataset.sourceTime),
						src: frame.getAttribute("src"),
						naturalWidth: frame.naturalWidth,
						naturalHeight: frame.naturalHeight,
						opacity: Number(style.opacity),
						visibility: style.visibility,
						filter: style.filter,
						objectFit: style.objectFit,
						objectPosition: style.objectPosition,
						scaleX: matrix.m11,
						scaleY: matrix.m22,
						x: matrix.m41,
						y: matrix.m42,
					};
				},
			),
			captions: [
				...story.querySelectorAll("[data-scroll-cinematic-caption]"),
			].map((caption) => {
				const style = getComputedStyle(caption);
				const rect = caption.getBoundingClientRect();
				const matrix =
					style.transform === "none"
						? new DOMMatrixReadOnly()
						: new DOMMatrixReadOnly(style.transform);
				return {
					index: Number(caption.dataset.captionIndex),
					text: caption.textContent?.trim(),
					opacity: Number(style.opacity),
					visibility: style.visibility,
					top: rect.top,
					bottom: rect.bottom,
					y: matrix.m42,
				};
			}),
			strips: {
				left: readStripExposure("[data-shutter-interlude-strip-left]"),
				right: readStripExposure("[data-shutter-interlude-strip-right]"),
			},
		};
	});
}

async function setHomeProgress(page, range, progress) {
	await page.evaluate(
		({ top, distance, progress }) => {
			document.documentElement.style.scrollBehavior = "auto";
			window.scrollTo({
				top: top + distance * progress,
				behavior: "auto",
			});
		},
		{ ...range, progress },
	);
	await page.waitForFunction(
		(expected) => {
			const value = Number(
				document.querySelector("#home-display-layer")?.dataset
					.cinematicProgress || 0,
			);
			return Math.abs(value - expected) <= 0.00025;
		},
		progress,
		{ timeout: 8_000 },
	);
	await page.evaluate(
		() =>
			new Promise((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(resolve)),
			),
	);
	return readHomeShutterState(page);
}

function assertNear(actual, expected, tolerance, label) {
	if (Math.abs(actual - expected) > tolerance) {
		throw new Error(`${label}: expected ${expected}, received ${actual}`);
	}
}

function assertEquivalentShutterState(actual, expected, label) {
	assertNear(
		actual.progress,
		expected.progress,
		0.012,
		`${label} root progress`,
	);
	if (actual.panels.length !== 5 || expected.panels.length !== 5) {
		throw new Error(`${label}: shutter must contain exactly five panels`);
	}
	actual.panels.forEach((panel, index) => {
		const reference = expected.panels[index];
		assertNear(
			panel.progress,
			reference.progress,
			0.012,
			`${label} panel ${index} progress`,
		);
		assertNear(panel.y, reference.y, 2, `${label} panel ${index} y`);
		assertNear(
			panel.opacity,
			reference.opacity,
			0.02,
			`${label} panel ${index} opacity`,
		);
		if (
			panel.direction !== reference.direction ||
			panel.visibility !== reference.visibility ||
			panel.clipPath !== reference.clipPath ||
			panel.filter !== reference.filter ||
			panel.backdropFilter !== reference.backdropFilter ||
			panel.imageFilter !== reference.imageFilter ||
			panel.imageSrc !== reference.imageSrc
		) {
			throw new Error(
				`${label} panel ${index} visual state changed: ${JSON.stringify({ panel, reference })}`,
			);
		}
	});
	for (const side of ["left", "right"]) {
		const strip = actual.strips[side];
		const reference = expected.strips[side];
		if (!strip || !reference) {
			throw new Error(`${label}: missing ${side} interlude strip`);
		}
		assertNear(strip.x, reference.x, 2, `${label} ${side} strip x`);
		assertNear(strip.width, reference.width, 1, `${label} ${side} strip width`);
		assertNear(
			strip.opacity,
			reference.opacity,
			0.02,
			`${label} ${side} strip opacity`,
		);
		if (
			strip.visibility !== reference.visibility ||
			strip.src !== reference.src
		) {
			throw new Error(
				`${label} ${side} strip visual state changed: ${JSON.stringify({ strip, reference })}`,
			);
		}
	}
}

function assertCinematicStoryAssets(state, label) {
	if (
		!state ||
		state.frameCount !== CINEMATIC_FRAME_COUNT ||
		state.frames.length !== CINEMATIC_FRAME_COUNT ||
		state.captions.length !== CINEMATIC_FRAME_COUNT
	) {
		throw new Error(
			`${label}: expected ${CINEMATIC_FRAME_COUNT} cinematic frames and captions: ${JSON.stringify(state)}`,
		);
	}
	if (state.sourceVideo !== "/assets/videos/artoria-original.mp4") {
		throw new Error(
			`${label}: source video is not retained: ${state.sourceVideo}`,
		);
	}
	const sources = new Set();
	state.frames.forEach((frame, index) => {
		const expectedFile = CINEMATIC_FRAME_FILES[index];
		if (
			frame.index !== index ||
			Math.abs(frame.sourceTime - CINEMATIC_SOURCE_TIMES[index]) > 0.001 ||
			frame.naturalWidth !== 3840 ||
			frame.naturalHeight !== 1600 ||
			frame.objectFit !== "contain" ||
			frame.objectPosition !== "50% 50%" ||
			Math.abs(frame.scaleX - 1) > 0.001 ||
			Math.abs(frame.scaleY - 1) > 0.001 ||
			Math.abs(frame.x) > 0.5 ||
			Math.abs(frame.y) > 0.5 ||
			!frame.src?.endsWith(
				`/assets/images/home/artoria-scroll-4k/${expectedFile}`,
			) ||
			frame.src.startsWith("data:image/gif") ||
			frame.filter === "none"
		) {
			throw new Error(
				`${label}: frame ${index} is missing or malformed: ${JSON.stringify(frame)}`,
			);
		}
		sources.add(frame.src);
	});
	state.captions.forEach((caption, index) => {
		if (caption.index !== index || !caption.text) {
			throw new Error(
				`${label}: caption ${index} is missing or malformed: ${JSON.stringify(caption)}`,
			);
		}
	});
	if (sources.size !== CINEMATIC_FRAME_COUNT) {
		throw new Error(`${label}: cinematic frame sources are not unique`);
	}
	assertNear(state.width, 1920, 1, `${label} story width`);
	assertNear(state.height, 1080, 1, `${label} story height`);
	assertNear(state.letterboxHeight, 140, 2, `${label} letterbox height`);
	assertNear(
		state.captionBand?.height ?? 0,
		state.letterboxHeight,
		1,
		`${label} caption band height`,
	);
	assertNear(
		state.captionBand?.bottom ?? 0,
		1080,
		2,
		`${label} caption band bottom`,
	);
}

function assertStoryStripsOutsideViewport(state, label) {
	for (const side of ["left", "right"]) {
		const strip = state?.strips?.[side];
		if (!strip || strip.intersectionRatio > 0.001) {
			throw new Error(
				`${label}: ${side} interlude strip is exposed during the freeze-frame story: ${JSON.stringify(strip)}`,
			);
		}
	}
}

function assertCinematicStoryBlend(state, incomingIndex, label) {
	if (
		!state ||
		state.active !== "true" ||
		state.activeFrame !== incomingIndex ||
		state.opacity < 0.99 ||
		state.visibility !== "visible"
	) {
		throw new Error(
			`${label}: cinematic story is not active: ${JSON.stringify(state)}`,
		);
	}
	const visibleFrames = state.frames.filter(
		(frame) => frame.opacity > 0.02 && frame.visibility === "visible",
	);
	if (
		visibleFrames.length !== 2 ||
		visibleFrames[0].index !== incomingIndex - 1 ||
		visibleFrames[1].index !== incomingIndex
	) {
		throw new Error(
			`${label}: blend must contain exactly two adjacent frames: ${JSON.stringify(visibleFrames)}`,
		);
	}
	assertNear(visibleFrames[0].opacity, 0.5, 0.06, `${label} outgoing opacity`);
	assertNear(visibleFrames[1].opacity, 0.5, 0.06, `${label} incoming opacity`);
	assertNear(
		visibleFrames[0].opacity + visibleFrames[1].opacity,
		1,
		0.06,
		`${label} combined opacity`,
	);
	const visibleCaptions = state.captions.filter(
		(caption) => caption.opacity > 0.02 && caption.visibility === "visible",
	);
	if (
		visibleCaptions.length > 1 ||
		visibleCaptions.some(
			(caption) =>
				caption.index !== incomingIndex - 1 && caption.index !== incomingIndex,
		)
	) {
		throw new Error(
			`${label}: captions must not overlap during the image blend: ${JSON.stringify(visibleCaptions)}`,
		);
	}
	assertStoryStripsOutsideViewport(state, label);
}

function assertCinematicStoryHold(state, expectedIndex, label) {
	const visibleFrames = state?.frames.filter(
		(frame) => frame.opacity > 0.02 && frame.visibility === "visible",
	);
	const visibleCaptions = state?.captions.filter(
		(caption) => caption.opacity > 0.02 && caption.visibility === "visible",
	);
	if (
		!state ||
		state.active !== "true" ||
		state.opacity < 0.99 ||
		state.visibility !== "visible" ||
		state.activeFrame !== expectedIndex ||
		visibleFrames?.length !== 1 ||
		visibleFrames[0].index !== expectedIndex ||
		visibleCaptions?.length !== 1 ||
		visibleCaptions[0].index !== expectedIndex
	) {
		throw new Error(
			`${label}: hold must show one matching frame and caption: ${JSON.stringify({ state, visibleFrames, visibleCaptions })}`,
		);
	}
	assertNear(visibleFrames[0].opacity, 1, 0.02, `${label} frame opacity`);
	assertNear(visibleCaptions[0].opacity, 1, 0.02, `${label} caption opacity`);
	assertStoryStripsOutsideViewport(state, label);
}

function assertEquivalentCinematicStoryState(actual, expected, label) {
	if (
		!actual ||
		!expected ||
		actual.frames.length !== expected.frames.length ||
		actual.captions.length !== expected.captions.length
	) {
		throw new Error(`${label}: cinematic state is missing`);
	}
	assertNear(actual.progress, expected.progress, 0.012, `${label} progress`);
	assertNear(actual.opacity, expected.opacity, 0.02, `${label} story opacity`);
	if (
		actual.active !== expected.active ||
		actual.activeFrame !== expected.activeFrame ||
		actual.visibility !== expected.visibility ||
		actual.sourceVideo !== expected.sourceVideo
	) {
		throw new Error(`${label}: story wrapper changed after reverse`);
	}
	actual.frames.forEach((frame, index) => {
		const reference = expected.frames[index];
		assertNear(
			frame.opacity,
			reference.opacity,
			0.02,
			`${label} frame ${index} opacity`,
		);
		assertNear(
			frame.scaleX,
			reference.scaleX,
			0.002,
			`${label} frame ${index} scaleX`,
		);
		assertNear(
			frame.scaleY,
			reference.scaleY,
			0.002,
			`${label} frame ${index} scaleY`,
		);
		assertNear(frame.x, reference.x, 1, `${label} frame ${index} x`);
		assertNear(frame.y, reference.y, 1, `${label} frame ${index} y`);
		if (
			frame.visibility !== reference.visibility ||
			frame.src !== reference.src ||
			frame.filter !== reference.filter
		) {
			throw new Error(`${label}: frame ${index} changed after reverse`);
		}
	});
	actual.captions.forEach((caption, index) => {
		const reference = expected.captions[index];
		assertNear(
			caption.opacity,
			reference.opacity,
			0.02,
			`${label} caption ${index} opacity`,
		);
		assertNear(caption.y, reference.y, 1, `${label} caption ${index} y`);
		if (
			caption.index !== reference.index ||
			caption.text !== reference.text ||
			caption.visibility !== reference.visibility
		) {
			throw new Error(`${label}: caption ${index} changed after reverse`);
		}
	});
}

function assertSharpShutter(state, label) {
	state.panels.forEach((panel, index) => {
		if (
			panel.filter !== "none" ||
			panel.backdropFilter !== "none" ||
			panel.imageFilter !== "none" ||
			panel.imageSrc.includes("-blur")
		) {
			throw new Error(
				`${label} panel ${index} still applies blur: ${JSON.stringify(panel)}`,
			);
		}
	});
}

function assertClosedShutter(state, label) {
	assertNear(state.progress, 0, 0.012, `${label} root progress`);
	state.panels.forEach((panel, index) => {
		assertNear(panel.progress, 0, 0.012, `${label} panel ${index} progress`);
		if (Math.abs(panel.y) < panel.height - 0.5) {
			throw new Error(
				`${label} panel ${index} is still exposed: ${JSON.stringify({ y: panel.y, height: panel.height })}`,
			);
		}
		const expectedSign = index % 2 === 0 ? 1 : -1;
		if (Math.sign(panel.y) !== expectedSign) {
			throw new Error(
				`${label} panel ${index} does not alternate entry direction: ${panel.y}`,
			);
		}
		if (panel.clipPath !== "none") {
			throw new Error(
				`${label} panel ${index} still uses clip-path: ${panel.clipPath}`,
			);
		}
	});
}

function assertEntryShutter(state, label) {
	assertNear(
		state.progress,
		SHUTTER_ENTRY_PROGRESS,
		0.012,
		`${label} root progress`,
	);
	const values = state.panels.map((panel) => panel.progress);
	if (
		values[0] < 0.98 ||
		values[1] < 0.98 ||
		values[2] <= 0.05 ||
		values[2] >= 0.95 ||
		values[3] > 0.02 ||
		values[4] > 0.02 ||
		!values.every((value, index) => index === 0 || value <= values[index - 1])
	) {
		throw new Error(
			`${label} is not a staggered five-panel state: ${JSON.stringify(values)}`,
		);
	}
}

function assertColumnsOpen(state, label) {
	assertNear(
		state.progress,
		SHUTTER_COLUMNS_PROGRESS,
		0.012,
		`${label} root progress`,
	);
	state.panels.forEach((panel, index) => {
		assertNear(panel.progress, 1, 0.012, `${label} panel ${index} progress`);
		assertNear(panel.y, 0, 1, `${label} panel ${index} y`);
	});
}

function assertStripsMidway(state, label) {
	assertNear(
		state.progress,
		SHUTTER_STRIPS_MID_PROGRESS,
		0.012,
		`${label} root progress`,
	);
	const { left, right } = state.strips;
	if (!left || !right || left.width <= 0 || right.width <= 0) {
		throw new Error(`${label} is missing measurable interlude strips`);
	}
	if (
		[left, right].some(
			(strip) =>
				strip.opacity < 0.99 ||
				strip.visibility !== "visible" ||
				strip.src.startsWith("data:image/gif"),
		)
	) {
		throw new Error(
			`${label} interlude strips are hidden or still placeholders: ${JSON.stringify({ left, right })}`,
		);
	}
	const leftRatio = left.x / left.width;
	const rightRatio = right.x / right.width;
	if (
		leftRatio > -0.48 ||
		leftRatio < -0.6 ||
		rightRatio < 0.48 ||
		rightRatio > 0.6
	) {
		throw new Error(
			`${label} strips are not halfway through opposing entries: ${JSON.stringify({ leftRatio, rightRatio, left, right })}`,
		);
	}
}

function assertStripsComplete(state, label) {
	assertNear(
		state.progress,
		SHUTTER_STRIPS_COMPLETE_PROGRESS,
		0.012,
		`${label} root progress`,
	);
	for (const side of ["left", "right"]) {
		const strip = state.strips[side];
		if (!strip) throw new Error(`${label} is missing the ${side} strip`);
		assertNear(strip.x, 0, 2, `${label} ${side} strip x`);
	}
}

async function assertDisplayLayerTopmost(page, label) {
	const result = await page.locator("#home-display-layer").evaluate((root) => {
		const previousPointerEvents = root.style.pointerEvents;
		root.style.pointerEvents = "auto";
		try {
			const points = [0.1, 0.3, 0.5, 0.7, 0.9].map((xRatio) => {
				const target = document.elementFromPoint(
					window.innerWidth * xRatio,
					window.innerHeight * 0.5,
				);
				return {
					xRatio,
					insideDisplayLayer: Boolean(target && root.contains(target)),
					tag: target?.tagName ?? null,
					id: target?.id ?? null,
					className:
						target && "className" in target ? String(target.className) : null,
				};
			});
			const rect = root.getBoundingClientRect();
			return {
				points,
				display: getComputedStyle(root).display,
				opacity: Number(getComputedStyle(root).opacity),
				position: getComputedStyle(root).position,
				visibility: getComputedStyle(root).visibility,
				zIndex: getComputedStyle(root).zIndex,
				rect: rect.toJSON(),
				viewportHeight: window.innerHeight,
			};
		} finally {
			root.style.pointerEvents = previousPointerEvents;
		}
	});
	if (
		result.display === "none" ||
		result.opacity < 0.99 ||
		result.visibility !== "visible" ||
		result.rect.top > 1 ||
		result.rect.bottom < result.viewportHeight - 1 ||
		result.points.some((point) => !point.insideDisplayLayer)
	) {
		throw new Error(
			`${label} display layer is covered or not pinned to the viewport: ${JSON.stringify(result)}`,
		);
	}
}

async function verifyHomeEffects(page) {
	await page.addInitScript((timestamp) => {
		const NativeDate = Date;
		const FixedDate = new Proxy(NativeDate, {
			construct(target, args) {
				return Reflect.construct(target, args.length > 0 ? args : [timestamp]);
			},
			apply(target, thisArg, args) {
				return args.length > 0
					? Reflect.apply(target, thisArg, args)
					: new target(timestamp).toString();
			},
		});
		window.Date = FixedDate;
	}, new Date("2026-07-27T02:00:00.000Z").getTime());
	await goto(page, "/", "#home-hero");
	const cover = await page.locator(".home-hero__video").getAttribute("src");
	if (!cover?.includes("59561306-p0")) {
		throw new Error("home Fate cover changed unexpectedly");
	}
	const titleRendering = await page
		.locator(".home-hero__name-letter")
		.first()
		.evaluate((letter) => {
			const style = getComputedStyle(letter);
			return {
				backgroundImage: style.backgroundImage,
				color: style.color,
				textFillColor: style.webkitTextFillColor,
			};
		});
	if (
		titleRendering.backgroundImage !== "none" ||
		titleRendering.color !== "rgb(255, 82, 82)" ||
		titleRendering.textFillColor !== titleRendering.color
	) {
		throw new Error(
			`hero title is not rendered as a solid color: ${JSON.stringify(titleRendering)}`,
		);
	}

	const status = page.locator("#work-status");
	await status.waitFor({ state: "visible", timeout: 8_000 });
	const statusState = await page.evaluate(() => {
		const hero = document.getElementById("home-hero");
		const avatar = document.getElementById("hero-avatar");
		const wrapper = avatar?.closest(".home-hero__avatar-wrapper");
		const avatarRect = avatar?.getBoundingClientRect();
		const wrapperRect = wrapper?.getBoundingClientRect();
		const avatarStyle = avatar ? getComputedStyle(avatar) : null;
		const wrapperStyle = wrapper ? getComputedStyle(wrapper) : null;
		return {
			text: document.querySelector("#work-status .home-hero__status-text")
				?.textContent,
			src: avatar?.getAttribute("src"),
			currentSrc: avatar?.currentSrc,
			naturalSize: avatar ? [avatar.naturalWidth, avatar.naturalHeight] : null,
			work: hero?.dataset.avatar,
			off: hero?.dataset.avatarOff,
			objectFit: avatarStyle?.objectFit,
			display: avatarStyle?.display,
			wrapperBackground: wrapperStyle?.backgroundColor,
			wrapperBorders: wrapperStyle
				? [
						wrapperStyle.borderTopWidth,
						wrapperStyle.borderRightWidth,
						wrapperStyle.borderBottomWidth,
						wrapperStyle.borderLeftWidth,
					]
				: [],
			insetGap:
				avatarRect && wrapperRect
					? Math.max(
							Math.abs(avatarRect.left - wrapperRect.left),
							Math.abs(avatarRect.top - wrapperRect.top),
							Math.abs(avatarRect.right - wrapperRect.right),
							Math.abs(avatarRect.bottom - wrapperRect.bottom),
						)
					: null,
		};
	});
	if (
		statusState.text?.trim() !== "上班中" ||
		statusState.src !== "/assets/images/home/avatar-work-on.gif" ||
		statusState.work !== statusState.src ||
		!statusState.currentSrc?.endsWith(statusState.src) ||
		statusState.naturalSize?.join("x") !== "300x300" ||
		statusState.objectFit !== "cover" ||
		statusState.display !== "block" ||
		statusState.wrapperBackground !== "rgba(0, 0, 0, 0)" ||
		statusState.wrapperBorders.some((width) => width !== "0px") ||
		statusState.insetGap === null ||
		statusState.insetGap > 0.5
	) {
		throw new Error(
			`work status GIF or circular crop is incorrect: ${JSON.stringify(statusState)}`,
		);
	}
	const avatarResponse = await page.request.get(statusState.currentSrc);
	if (
		!avatarResponse.ok() ||
		!avatarResponse.headers()["content-type"]?.includes("image/gif")
	) {
		throw new Error(
			`work avatar response is not image/gif: ${avatarResponse.status()} ${avatarResponse.headers()["content-type"]}`,
		);
	}

	await waitForHeroOpening(page);
	assertHeroIdentityGeometry(await readHeroIdentityGeometry(page), "1920px");
	const avatar = page.locator("#hero-avatar");
	const firstFrame = await avatar.screenshot({
		path: path.join(outputDirectory, "home-avatar-work-on-frame-a.png"),
	});
	await page.waitForTimeout(500);
	const secondFrame = await avatar.screenshot({
		path: path.join(outputDirectory, "home-avatar-work-on-frame-b.png"),
	});
	const [firstPixels, secondPixels] = await Promise.all([
		sharp(firstFrame).ensureAlpha().raw().toBuffer(),
		sharp(secondFrame).ensureAlpha().raw().toBuffer(),
	]);
	let changedChannels = 0;
	for (let index = 0; index < firstPixels.length; index += 1) {
		if (Math.abs(firstPixels[index] - secondPixels[index]) > 8) {
			changedChannels += 1;
		}
	}
	if (changedChannels < 500) {
		throw new Error(
			`work avatar GIF appears static: only ${changedChannels} pixel channels changed`,
		);
	}

	const restoredHeroArt = await page.evaluate(() => {
		const duo = document.querySelector("#home-hero-character-duo");
		const accent = document.querySelector(".home-hero__speech-accent");
		if (!duo || !accent) return null;
		const duoStyle = getComputedStyle(duo);
		return {
			duoNatural: [duo.naturalWidth, duo.naturalHeight],
			duoWidth: duo.getBoundingClientRect().width,
			duoOpacity: Number(duoStyle.opacity),
			duoFilter: duoStyle.filter,
			accentNatural: [accent.naturalWidth, accent.naturalHeight],
		};
	});
	if (
		!restoredHeroArt ||
		restoredHeroArt.duoNatural.join("x") !== "2048x1152" ||
		restoredHeroArt.duoWidth < 450 ||
		restoredHeroArt.duoWidth > 475 ||
		Math.abs(restoredHeroArt.duoOpacity - 0.82) > 0.01 ||
		restoredHeroArt.duoFilter !== "none" ||
		restoredHeroArt.accentNatural.join("x") !== "192x151"
	) {
		throw new Error(
			`restored hero artwork is incorrect: ${JSON.stringify(restoredHeroArt)}`,
		);
	}
	await verifyHeroCharacterFollow(page);

	await page.screenshot({
		path: path.join(outputDirectory, "home-hero.png"),
	});

	await page.waitForFunction(
		() =>
			document.querySelector("#home-display-layer")?.dataset.displayReady ===
			"ready",
	);

	const range = await getHomeScrollRange(page);
	if (!Number.isFinite(range.distance) || range.distance <= 0) {
		throw new Error(
			`home shutter has an invalid scroll range: ${JSON.stringify(range)}`,
		);
	}
	assertNear(range.distance, 12000, 1, "home cinematic scroll distance");
	const layoutGeometry = await readHomeLayoutGeometry(page);
	if (
		!layoutGeometry.displayFollowsHero ||
		!layoutGeometry.dataIsLast ||
		Math.abs(layoutGeometry.displayTriggerTop - layoutGeometry.heroBottom) >
			2 ||
		layoutGeometry.tickerTop < layoutGeometry.displayBottom - 2 ||
		layoutGeometry.photoDeckTop < layoutGeometry.tickerTop ||
		layoutGeometry.dataLayerTop < layoutGeometry.photoDeckBottom - 2
	) {
		throw new Error(
			`home sections are not ordered Hero -> Display -> Ticker -> Photos -> Data: ${JSON.stringify(layoutGeometry)}`,
		);
	}
	console.log("Home layout geometry:", JSON.stringify(layoutGeometry));
	const initialState = await readHomeShutterState(page);
	assertClosedShutter(initialState, "initial load");
	assertSharpShutter(initialState, "initial load");
	await page.waitForTimeout(400);
	assertEquivalentShutterState(
		await readHomeShutterState(page),
		initialState,
		"initial fixed position",
	);
	await verifyWheelScrub(page, range);

	const startA = await setHomeProgress(page, range, 0);
	assertClosedShutter(startA, "first start");
	assertSharpShutter(startA, "first start");
	assertEquivalentShutterState(startA, initialState, "first start after load");

	const entryA = await setHomeProgress(page, range, SHUTTER_ENTRY_PROGRESS);
	assertEntryShutter(entryA, "first entry");
	assertSharpShutter(entryA, "first entry");
	const entryBackdrop = await page
		.locator("[data-display-backdrop]")
		.evaluate((element) => {
			const style = getComputedStyle(element);
			return {
				opacity: Number(style.opacity),
				visibility: style.visibility,
				backgroundColor: style.backgroundColor,
			};
		});
	if (
		entryBackdrop.opacity < 0.99 ||
		entryBackdrop.visibility !== "visible" ||
		entryBackdrop.backgroundColor === "rgba(0, 0, 0, 0)"
	) {
		throw new Error(
			`shutter entry backdrop is blank: ${JSON.stringify(entryBackdrop)}`,
		);
	}
	await assertDisplayLayerTopmost(page, "first entry");
	await page.screenshot({
		path: path.join(outputDirectory, "home-five-columns-entry.png"),
	});

	await page.waitForTimeout(400);
	assertEquivalentShutterState(
		await readHomeShutterState(page),
		entryA,
		"fixed scroll position",
	);

	const columnsA = await setHomeProgress(page, range, SHUTTER_COLUMNS_PROGRESS);
	assertColumnsOpen(columnsA, "first columns complete");
	assertSharpShutter(columnsA, "first columns complete");
	await page.screenshot({
		path: path.join(outputDirectory, "home-five-columns.png"),
	});

	const storyBlendStates = new Map();
	for (
		let incomingIndex = 1;
		incomingIndex < CINEMATIC_FRAME_COUNT;
		incomingIndex += 1
	) {
		const blendProgress =
			(SHUTTER_STORY_FRAME_START +
				incomingIndex * SHUTTER_STORY_FRAME_STEP +
				SHUTTER_STORY_BLEND_DURATION / 2) /
			SHUTTER_TIMELINE_END;
		await setHomeProgress(page, range, blendProgress);
		if (incomingIndex === 1) {
			await page.waitForFunction(
				() =>
					[...document.querySelectorAll("[data-scroll-cinematic-frame]")].every(
						(frame) =>
							frame.complete &&
							frame.naturalWidth === 3840 &&
							frame.naturalHeight === 1600,
					),
				undefined,
				{ timeout: 30_000 },
			);
		}
		const blendState = await readHomeCinematicStoryState(page);
		if (incomingIndex === 1) {
			assertCinematicStoryAssets(blendState, "cinematic story assets");
			const sourceVideoResponse = await page.request.get(
				new URL(blendState.sourceVideo, baseUrl).href,
			);
			if (
				!sourceVideoResponse.ok() ||
				!sourceVideoResponse.headers()["content-type"]?.includes("video/mp4")
			) {
				throw new Error(
					`cinematic source video is unavailable: ${sourceVideoResponse.status()} ${sourceVideoResponse.headers()["content-type"]}`,
				);
			}
		}
		assertCinematicStoryBlend(
			blendState,
			incomingIndex,
			`forward cinematic blend ${incomingIndex - 1}->${incomingIndex}`,
		);
		storyBlendStates.set(incomingIndex, blendState);
		if (incomingIndex === 9) {
			await page.screenshot({
				path: path.join(outputDirectory, "home-artoria-crossfade.png"),
			});
		}
	}

	for (
		let incomingIndex = CINEMATIC_FRAME_COUNT - 1;
		incomingIndex >= 1;
		incomingIndex -= 1
	) {
		const blendProgress =
			(SHUTTER_STORY_FRAME_START +
				incomingIndex * SHUTTER_STORY_FRAME_STEP +
				SHUTTER_STORY_BLEND_DURATION / 2) /
			SHUTTER_TIMELINE_END;
		await setHomeProgress(page, range, blendProgress);
		const reverseState = await readHomeCinematicStoryState(page);
		assertCinematicStoryBlend(
			reverseState,
			incomingIndex,
			`reverse cinematic blend ${incomingIndex}->${incomingIndex - 1}`,
		);
		assertEquivalentCinematicStoryState(
			reverseState,
			storyBlendStates.get(incomingIndex),
			`cinematic blend ${incomingIndex} after reverse`,
		);
	}

	if (captureCinematicContactSheet) {
		await captureRenderedCinematicContactSheet(page, range);
	}

	await setHomeProgress(page, range, SHUTTER_STORY_HOLD_PROGRESS);
	const storyHold = await readHomeCinematicStoryState(page);
	assertCinematicStoryHold(storyHold, 9, "cinematic frame hold");
	const holdFrameA = await captureShutterViewport(page);
	await page.waitForTimeout(420);
	const holdFrameB = await captureShutterViewport(page);
	const holdDifference = await compareVisualFrames(holdFrameA, holdFrameB);
	if (
		holdDifference.changedRatio > 0.002 ||
		holdDifference.meanChannelDelta > 0.5
	) {
		throw new Error(
			`cinematic hold advances without scroll: ${JSON.stringify(holdDifference)}`,
		);
	}
	await page.screenshot({
		path: path.join(outputDirectory, "home-artoria-hold.png"),
	});
	console.log(
		"Home cinematic story:",
		JSON.stringify({ frames: storyHold.frameCount, holdDifference }),
	);

	const wheelTransitionAt =
		SHUTTER_STORY_FRAME_START + 9 * SHUTTER_STORY_FRAME_STEP;
	const wheelBeforeProgress = (wheelTransitionAt - 0.03) / SHUTTER_TIMELINE_END;
	const wheelBlendProgress =
		(wheelTransitionAt + SHUTTER_STORY_BLEND_DURATION / 2) /
		SHUTTER_TIMELINE_END;
	const wheelAfterProgress =
		(wheelTransitionAt + SHUTTER_STORY_BLEND_DURATION + 0.03) /
		SHUTTER_TIMELINE_END;
	await setHomeProgress(page, range, wheelBeforeProgress);
	const wheelBefore = await readHomeCinematicStoryState(page);
	assertCinematicStoryHold(wheelBefore, 8, "wheel transition start");
	await wheelDistance(
		page,
		range.distance * (wheelBlendProgress - wheelBeforeProgress),
		40,
	);
	const wheelBlend = await readHomeCinematicStoryState(page);
	assertCinematicStoryBlend(wheelBlend, 9, "forward wheel cinematic blend");
	await wheelDistance(
		page,
		range.distance * (wheelAfterProgress - wheelBlendProgress),
		40,
	);
	const wheelAfter = await readHomeCinematicStoryState(page);
	assertCinematicStoryHold(wheelAfter, 9, "forward wheel cinematic hold");
	await wheelDistance(
		page,
		-range.distance * (wheelAfterProgress - wheelBeforeProgress),
		40,
	);
	const wheelReversed = await readHomeCinematicStoryState(page);
	assertCinematicStoryHold(wheelReversed, 8, "reverse wheel cinematic hold");
	assertEquivalentCinematicStoryState(
		wheelReversed,
		wheelBefore,
		"cinematic wheel transition after reverse",
	);
	console.log(
		"Home cinematic wheel scrub:",
		JSON.stringify({
			before: wheelBefore.progress,
			blend: wheelBlend.progress,
			after: wheelAfter.progress,
			reversed: wheelReversed.progress,
		}),
	);

	const stripsMidA = await setHomeProgress(
		page,
		range,
		SHUTTER_STRIPS_MID_PROGRESS,
	);
	assertStripsMidway(stripsMidA, "first strips midpoint");
	await assertDisplayLayerTopmost(page, "first strips midpoint");
	await page.screenshot({
		path: path.join(outputDirectory, "home-interlude-strips-entry.png"),
	});

	const stripsCompleteA = await setHomeProgress(
		page,
		range,
		SHUTTER_STRIPS_COMPLETE_PROGRESS,
	);
	assertStripsComplete(stripsCompleteA, "first strips complete");
	await page.screenshot({
		path: path.join(outputDirectory, "home-interlude-strips-complete.png"),
	});

	const stripsMidB = await setHomeProgress(
		page,
		range,
		SHUTTER_STRIPS_MID_PROGRESS,
	);
	assertStripsMidway(stripsMidB, "reverse strips midpoint");
	assertEquivalentShutterState(
		stripsMidB,
		stripsMidA,
		"strips midpoint after reverse",
	);

	const entryB = await setHomeProgress(page, range, SHUTTER_ENTRY_PROGRESS);
	assertEntryShutter(entryB, "reverse entry");
	assertEquivalentShutterState(entryB, entryA, "entry after reverse");

	const startB = await setHomeProgress(page, range, 0);
	assertClosedShutter(startB, "reverse start");
	assertEquivalentShutterState(startB, startA, "start after reverse");

	const entryC = await setHomeProgress(page, range, SHUTTER_ENTRY_PROGRESS);
	assertEntryShutter(entryC, "second entry");
	assertEquivalentShutterState(entryC, entryA, "entry on second pass");

	const columnsB = await setHomeProgress(page, range, SHUTTER_COLUMNS_PROGRESS);
	assertColumnsOpen(columnsB, "second columns complete");
	assertEquivalentShutterState(columnsB, columnsA, "columns on second pass");
	const secondPassBlendProgress =
		(SHUTTER_STORY_FRAME_START +
			9 * SHUTTER_STORY_FRAME_STEP +
			SHUTTER_STORY_BLEND_DURATION / 2) /
		SHUTTER_TIMELINE_END;
	await setHomeProgress(page, range, secondPassBlendProgress);
	const secondPassBlend = await readHomeCinematicStoryState(page);
	assertCinematicStoryBlend(secondPassBlend, 9, "second pass cinematic blend");
	assertEquivalentCinematicStoryState(
		secondPassBlend,
		storyBlendStates.get(9),
		"cinematic blend on second pass",
	);

	const stripsMidC = await setHomeProgress(
		page,
		range,
		SHUTTER_STRIPS_MID_PROGRESS,
	);
	assertStripsMidway(stripsMidC, "second strips midpoint");
	assertEquivalentShutterState(
		stripsMidC,
		stripsMidA,
		"strips midpoint on second pass",
	);

	const stripsCompleteB = await setHomeProgress(
		page,
		range,
		SHUTTER_STRIPS_COMPLETE_PROGRESS,
	);
	assertStripsComplete(stripsCompleteB, "second strips complete");
	assertEquivalentShutterState(
		stripsCompleteB,
		stripsCompleteA,
		"strips complete on second pass",
	);

	const finalFrame = await setHomeProgress(page, range, 1);
	assertNear(finalFrame.progress, 1, 0.012, "final frame root progress");
	await page.waitForFunction(
		() => {
			const video = document.querySelector("[data-shutter-final-video]");
			return Boolean(
				video?.currentSrc &&
					video.videoWidth > 0 &&
					video.videoHeight > 0 &&
					!video.paused &&
					video.dataset.cinematicVideoActive === "true",
			);
		},
		undefined,
		{ timeout: 8_000 },
	);
	const finalVideo = page.locator("[data-shutter-final-video]");
	const readFinalVideo = () =>
		finalVideo.evaluate((video) => {
			const style = getComputedStyle(video);
			return {
				src: video.getAttribute("src"),
				currentSrc: video.currentSrc,
				videoWidth: video.videoWidth,
				videoHeight: video.videoHeight,
				currentTime: video.currentTime,
				paused: video.paused,
				readyState: video.readyState,
				opacity: Number(style.opacity),
				visibility: style.visibility,
				active: video.dataset.cinematicVideoActive,
			};
		});
	const finalVideoStart = await readFinalVideo();
	await page.waitForTimeout(600);
	const finalVideoLater = await readFinalVideo();
	const finalVideoResponse = await page.request.get(finalVideoStart.currentSrc);
	if (
		!finalVideoStart.currentSrc.endsWith(
			"/assets/images/home-truncated/utl-back2.webm",
		) ||
		finalVideoStart.videoWidth <= 0 ||
		finalVideoStart.videoHeight <= 0 ||
		finalVideoStart.paused ||
		finalVideoStart.opacity < 0.99 ||
		finalVideoStart.visibility !== "visible" ||
		finalVideoLater.currentTime <= finalVideoStart.currentTime + 0.15 ||
		!finalVideoResponse.ok() ||
		!finalVideoResponse.headers()["content-type"]?.includes("video/webm")
	) {
		throw new Error(
			`home final video is unavailable or static: ${JSON.stringify({ finalVideoStart, finalVideoLater, status: finalVideoResponse.status(), contentType: finalVideoResponse.headers()["content-type"] })}`,
		);
	}
	console.log(
		"Home final video:",
		JSON.stringify({ finalVideoStart, finalVideoLater }),
	);
	await page.screenshot({
		path: path.join(outputDirectory, "home-cinematic-final.png"),
	});

	const stripsCompleteC = await setHomeProgress(
		page,
		range,
		SHUTTER_STRIPS_COMPLETE_PROGRESS,
	);
	assertStripsComplete(stripsCompleteC, "reverse strips from final frame");
	assertEquivalentShutterState(
		stripsCompleteC,
		stripsCompleteA,
		"strips complete after final frame reverse",
	);
	if (SHUTTER_STRIPS_COMPLETE_PROGRESS >= SHUTTER_FINAL_VIDEO_PROGRESS) {
		throw new Error(
			"test fixture must reverse below the final video threshold",
		);
	}
	await page.waitForFunction(() => {
		const video = document.querySelector("[data-shutter-final-video]");
		if (!video) return false;
		const style = getComputedStyle(video);
		return (
			video.paused &&
			video.dataset.cinematicVideoActive === "false" &&
			Number(style.opacity) < 0.01 &&
			style.visibility === "hidden"
		);
	});

	const stripsMidD = await setHomeProgress(
		page,
		range,
		SHUTTER_STRIPS_MID_PROGRESS,
	);
	assertStripsMidway(stripsMidD, "reverse strips midpoint from final frame");
	assertEquivalentShutterState(
		stripsMidD,
		stripsMidA,
		"strips midpoint after final frame reverse",
	);

	const columnsC = await setHomeProgress(page, range, SHUTTER_COLUMNS_PROGRESS);
	assertColumnsOpen(columnsC, "reverse from final frame");
	assertEquivalentShutterState(
		columnsC,
		columnsA,
		"columns after final frame reverse",
	);

	const startC = await setHomeProgress(page, range, 0);
	assertClosedShutter(startC, "second reverse start");
	assertEquivalentShutterState(startC, startA, "start on second pass");

	const pinCount = await page
		.locator(".pin-spacer")
		.evaluateAll(
			(spacers) =>
				spacers.filter((spacer) => spacer.querySelector("#home-display-layer"))
					.length,
		);
	if (pinCount !== 1) {
		throw new Error(
			`home shutter created ${pinCount} pin spacers instead of one`,
		);
	}

	const deck = page.locator("[data-photo-deck]");
	await deck.scrollIntoViewIfNeeded();
	await page.waitForTimeout(350);
	const photos = await deck
		.locator("[data-photo-deck-card] img")
		.evaluateAll((images) =>
			images.map((image) => ({
				width: image.naturalWidth,
				height: image.naturalHeight,
			})),
		);
	if (
		photos.length !== 4 ||
		photos.some(({ width, height }) => width / Math.max(1, height) < 1.45)
	) {
		throw new Error(
			`home deck is not four landscape images: ${JSON.stringify(photos)}`,
		);
	}
	await page.screenshot({
		path: path.join(outputDirectory, "home-photo-deck.png"),
	});

	const dataLayer = page.locator(".home-data-layer");
	await dataLayer.scrollIntoViewIfNeeded();
	await page.waitForTimeout(1_500);
	await page.screenshot({
		path: path.join(outputDirectory, "home-data-matrix-final.png"),
	});
}

async function verifyMobileShutterDisabled(page) {
	await goto(page, "/", "#home-hero");
	const display = page.locator("#home-display-layer");
	await page.waitForFunction(() => {
		const root = document.querySelector("#home-display-layer");
		return root?.dataset.displayReady === "disabled";
	});
	const state = await display.evaluate((root) => ({
		ready: root.dataset.displayReady,
		display: getComputedStyle(root).display,
		fallbackCount: root.querySelectorAll(".home-display-layer__fallback")
			.length,
		assetSources: [
			...root.querySelectorAll("img[data-src], video[data-src]"),
		].map((asset) => asset.getAttribute("src")),
	}));
	if (
		state.ready !== "disabled" ||
		state.display !== "none" ||
		state.fallbackCount !== 0 ||
		state.assetSources.some(
			(source) => source !== null && !source.startsWith("data:image/gif"),
		)
	) {
		throw new Error(
			`mobile shutter must stay disabled and unloaded: ${JSON.stringify(state)}`,
		);
	}
	await page.screenshot({
		path: path.join(outputDirectory, "home-mobile.png"),
	});
}

async function verifyHiddenCharacterFollowDisabled(page) {
	await goto(page, "/", "#home-hero");
	const state = await page
		.locator(".home-hero__character-duo")
		.evaluate((character) => ({
			display: getComputedStyle(character).display,
			pointerFollow: character.dataset.pointerFollow,
		}));
	if (state.display !== "none" || state.pointerFollow !== undefined) {
		throw new Error(
			`hidden compact character still initialized pointer follow: ${JSON.stringify(state)}`,
		);
	}
}

async function verifyReducedMotionInteractiveEffects(page) {
	await goto(page, "/", "#home-hero");
	await page.waitForFunction(() => {
		const root = document.querySelector("#home-display-layer");
		const character = document.querySelector(".home-hero__character-duo");
		return (
			root?.dataset.displayReady === "ready" &&
			character?.dataset.pointerFollow === "ready"
		);
	});
	const state = await page.evaluate(() => {
		const display = document.querySelector("#home-display-layer");
		const character = document.querySelector(".home-hero__character-duo");
		return {
			reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
				.matches,
			displayReady: display?.dataset.displayReady,
			display: display ? getComputedStyle(display).display : "missing",
			pointerFollow: character?.dataset.pointerFollow,
			panelSources: display
				? [...display.querySelectorAll("img[data-shutter-image]")].map(
						(asset) => asset.getAttribute("src"),
					)
				: [],
		};
	});
	if (
		!state.reducedMotion ||
		state.displayReady !== "ready" ||
		state.display === "none" ||
		state.pointerFollow !== "ready" ||
		state.panelSources.length !== 5 ||
		state.panelSources.some(
			(source) => source === null || source.startsWith("data:image/gif"),
		)
	) {
		throw new Error(
			`site-controlled interactive motion was disabled by the OS preference: ${JSON.stringify(state)}`,
		);
	}

	await page.mouse.move(1, 1);
	await page.waitForFunction(() => {
		const character = document.querySelector(".home-hero__character-duo");
		if (!character) return false;
		const style = getComputedStyle(character);
		return (
			Number.parseFloat(style.getPropertyValue("--home-character-follow-x")) <
				-24 &&
			Number.parseFloat(style.getPropertyValue("--home-character-follow-y")) <
				-16
		);
	});

	const range = await getHomeScrollRange(page);
	const start = await setHomeProgress(page, range, 0);
	const forward = await setHomeProgress(page, range, 0.2);
	if (forward.panels.every((panel) => panel.progress <= 0.02)) {
		throw new Error(
			`reduced-motion scroll did not advance the shutter: ${JSON.stringify(forward)}`,
		);
	}
	const reverse = await setHomeProgress(page, range, 0);
	assertEquivalentShutterState(
		reverse,
		start,
		"reduced-motion reverse shutter",
	);

	await goto(page, "/posts/", ".article-feed-card");
	await page.evaluate(() => {
		document.documentElement.dataset.wallpaperMode = "banner";
		document.documentElement.dataset.pageWallpaperBanner = "on";
		document.documentElement.dataset.waterRipple = "on";
		document.getElementById("page-wallpaper-banner")?.removeAttribute("hidden");
	});
	const banner = page.locator("#page-wallpaper-banner");
	await banner.waitFor({ state: "visible" });
	const waves = page.locator(".page-wallpaper-banner__parallax use");
	const readTransforms = () =>
		waves.evaluateAll((elements) =>
			elements.map((element) => {
				const style = getComputedStyle(element);
				return {
					name: style.animationName,
					playState: style.animationPlayState,
					transform: style.transform,
				};
			}),
		);
	const wavesBefore = await readTransforms();
	await page.waitForTimeout(320);
	const wavesAfter = await readTransforms();
	if (
		wavesBefore.length !== 4 ||
		wavesBefore.some(
			(wave) => wave.name === "none" || wave.playState !== "running",
		) ||
		wavesBefore.every(
			(wave, index) => wave.transform === wavesAfter[index]?.transform,
		)
	) {
		throw new Error(
			`site-enabled banner waves stopped under reduced motion: ${JSON.stringify({ wavesBefore, wavesAfter })}`,
		);
	}
}

const browser = await chromium.launch({
	headless: true,
	executablePath: browserPath,
});

try {
	if (!homeOnly) {
		const settingsPage = await createPage(browser, {
			width: 1920,
			height: 1080,
		});
		await verifyWallpaperModes(settingsPage);
		assertNoPageErrors(settingsPage, "wallpaper settings");
		await settingsPage.context().close();
	}

	const homePage = await createPage(browser, { width: 1920, height: 1080 });
	await verifyHomeEffects(homePage);
	assertNoPageErrors(
		homePage,
		"1920x1080 home",
		homeOnly ? ["Could not find Cubism 4 runtime"] : [],
	);
	await homePage.context().close();

	if (homeOnly) {
		console.log("Home-only 1920x1080 effects passed.");
	} else {
		const compactDesktopPage = await createPage(browser, {
			width: 1440,
			height: 1000,
		});
		await goto(compactDesktopPage, "/", "#home-hero");
		await compactDesktopPage.locator("#work-status").waitFor({
			state: "visible",
			timeout: 8_000,
		});
		await waitForHeroOpening(compactDesktopPage);
		assertHeroIdentityGeometry(
			await readHeroIdentityGeometry(compactDesktopPage),
			"1440px",
		);
		assertNoPageErrors(compactDesktopPage, "compact desktop home");
		await compactDesktopPage.context().close();

		const hiddenCharacterPage = await createPage(browser, {
			width: 900,
			height: 900,
		});
		await verifyHiddenCharacterFollowDisabled(hiddenCharacterPage);
		assertNoPageErrors(hiddenCharacterPage, "900px home");
		await hiddenCharacterPage.context().close();

		const reducedMotionPage = await createPage(
			browser,
			{ width: 1920, height: 1080 },
			"reduce",
		);
		await verifyReducedMotionInteractiveEffects(reducedMotionPage);
		assertNoPageErrors(reducedMotionPage, "reduced-motion home");
		await reducedMotionPage.context().close();

		const mobilePage = await createPage(browser, { width: 390, height: 844 });
		await verifyMobileShutterDisabled(mobilePage);
		assertNoPageErrors(mobilePage, "mobile home");
		await mobilePage.context().close();
	}
} finally {
	await browser.close();
}

console.log("Home wallpaper and motion effects passed.");
