import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4321";
const localOrigin = new URL(baseUrl).origin;
const browserPath =
	process.env.PLAYWRIGHT_BROWSER ||
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const outputDirectory =
	process.env.E2E_VISUAL_DIR || path.resolve("test-results/visual");

await mkdir(outputDirectory, { recursive: true });

async function blockExternalSubresources(page) {
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
}

const browser = await chromium.launch({
	headless: true,
	executablePath: browserPath,
});

async function assertNonBlankImage(buffer, label) {
	const stats = await sharp(buffer).stats();
	const variation = stats.channels.reduce(
		(total, channel) => total + channel.stdev,
		0,
	);
	if (variation < 3) {
		throw new Error(
			`${label} appears blank (variation ${variation.toFixed(2)})`,
		);
	}
	console.log(`${label} variation ${variation.toFixed(2)}`);
}

async function assertChromaticImage(buffer, label) {
	const { data, info } = await sharp(buffer)
		.removeAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const hueBins = Array.from({ length: 6 }, () => 0);
	for (let offset = 0; offset < data.length; offset += info.channels) {
		const red = data[offset];
		const green = data[offset + 1];
		const blue = data[offset + 2];
		const maximum = Math.max(red, green, blue);
		const minimum = Math.min(red, green, blue);
		const delta = maximum - minimum;
		if (maximum < 110 || delta < 70) continue;
		let hue = 0;
		if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
		else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
		else hue = 60 * ((red - green) / delta + 4);
		if (hue < 0) hue += 360;
		hueBins[Math.min(5, Math.floor(hue / 60))] += 1;
	}
	if (hueBins.filter((count) => count >= 40).length < 4) {
		throw new Error(`${label} lost its rainbow colors: ${hueBins.join(",")}`);
	}
}

async function captureShell(name, viewport, openShell) {
	const page = await browser.newPage({ viewport });
	await blockExternalSubresources(page);
	await page.goto(`${baseUrl}/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	await openShell(page);
	const output = path.join(outputDirectory, `${name}.png`);
	await page.screenshot({ path: output });
	console.log(`saved ${output}`);
	await page.close();
}

async function assertGuestbookGeometry(page, viewport) {
	await page
		.locator(".guestbook-page--page .guestbook-chat")
		.waitFor({ state: "visible" });
	const geometry = await page.evaluate(() => {
		const bounds = (selector) => {
			const rect = document.querySelector(selector)?.getBoundingClientRect();
			return rect
				? {
						x: rect.x,
						y: rect.y,
						width: rect.width,
						height: rect.height,
						bottom: rect.bottom,
					}
				: null;
		};
		return {
			chat: bounds(".guestbook-page--page .guestbook-chat"),
			header: bounds(".guestbook-page--page .guestbook-chat__header"),
			workspace: bounds(".guestbook-page--page .guestbook-chat__workspace"),
			conversation: bounds(
				".guestbook-page--page .guestbook-chat__conversation",
			),
			messages: bounds(".guestbook-page--page .guestbook-chat__messages"),
			sidebar: bounds(".guestbook-page--page .guestbook-chat__sidebar"),
			editor: bounds(".guestbook-page--page .guestbook-composer__editor"),
			desktopSidebarToggleDisplay: getComputedStyle(
				document.querySelector(
					".guestbook-page--page .guestbook-chat__sidebar-toggle",
				),
			).display,
			dock: bounds("#mobile-dock"),
			innerHeight: window.innerHeight,
			scrollHeight: document.documentElement.scrollHeight,
		};
	});
	for (const key of [
		"chat",
		"header",
		"workspace",
		"conversation",
		"messages",
		"sidebar",
	]) {
		if (!geometry[key]) throw new Error(`guestbook ${key} bounds missing`);
	}

	if (viewport.width === 1920 && viewport.height === 1000) {
		if (Math.abs(geometry.chat.width - 1440) > 4) {
			throw new Error(
				`guestbook shell width is ${geometry.chat.width}, expected 1440`,
			);
		}
		if (Math.abs(geometry.chat.x + geometry.chat.width / 2 - 960) > 4) {
			throw new Error("guestbook shell is not centered");
		}
		if (
			Math.abs(geometry.conversation.width / geometry.sidebar.width - 4) > 0.12
		) {
			throw new Error("guestbook workspace is not 80/20");
		}
		if (
			Math.abs(geometry.chat.y - 82) > 2 ||
			Math.abs(geometry.chat.bottom - (viewport.height - 12)) > 2 ||
			Math.abs(geometry.header.height - 69) > 2 ||
			Math.abs(geometry.scrollHeight - viewport.height) > 2
		) {
			throw new Error("guestbook does not match the reference vertical frame");
		}
		if (
			!geometry.editor ||
			Math.abs(geometry.editor.y - geometry.messages.bottom - 16) > 2 ||
			Math.abs(geometry.editor.bottom - (geometry.chat.bottom - 1)) > 2
		) {
			throw new Error("guestbook composer does not match the reference frame");
		}
		if (geometry.desktopSidebarToggleDisplay !== "none") {
			throw new Error("guestbook desktop member toggle should be hidden");
		}
	}

	if (viewport.width < 769) {
		if (!geometry.editor || !geometry.dock) {
			throw new Error("mobile guestbook editor or dock bounds missing");
		}
		if (geometry.editor.bottom > geometry.dock.y - 4) {
			throw new Error("guestbook editor overlaps the mobile dock");
		}
	}
}

async function capturePage(name, route, viewport) {
	const page = await browser.newPage({ viewport });
	await blockExternalSubresources(page);
	await page.goto(`${baseUrl}${route}`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	const loader = page.locator("#page-loader");
	if ((await loader.count()) > 0) {
		await loader.waitFor({ state: "hidden", timeout: 12_000 });
	}
	await page.waitForFunction(
		() => !document.documentElement.classList.contains("is-page-loading"),
		undefined,
		{ timeout: 12_000 },
	);
	await page.waitForTimeout(500);
	const content = page.locator("#content-wrapper");
	await content.waitFor({ state: "visible", timeout: 12_000 });
	if (route === "/") {
		await page.locator("#home-hero").waitFor({ state: "visible" });
		if (viewport.width >= 1400) {
			await page.waitForFunction(
				() => document.querySelectorAll("#home-hero canvas").length >= 2,
				undefined,
				{ timeout: 8_000 },
			);
			const titleBox = await page.locator(".home-hero__name").boundingBox();
			if (!titleBox) throw new Error("home title bounds are unavailable");
			const titleBuffer = await page.screenshot({ clip: titleBox });
			await assertChromaticImage(titleBuffer, "home title");
		}
	}
	if (route === "/moments/") {
		await page.locator(".moment-card").first().waitFor({ state: "visible" });
	}
	if (route === "/calendar/") {
		await page.locator(".calendar-grid-wrap").waitFor({ state: "visible" });
	}
	if (route === "/guestbook/") {
		await assertGuestbookGeometry(page, viewport);
	}
	if (route === "/album/crawler/") {
		await page
			.locator(".pixiv-studio__workspace")
			.waitFor({ state: "visible" });
		await page.waitForFunction(
			() =>
				document
					.querySelector(".pixiv-studio__status")
					?.textContent?.includes("等待任务") ?? false,
			undefined,
			{ timeout: 12_000 },
		);
	}
	const contentMetrics = await content.evaluate((element) => {
		const style = getComputedStyle(element);
		const rect = element.getBoundingClientRect();
		return {
			opacity: Number(style.opacity),
			width: rect.width,
			height: rect.height,
			textLength: element.textContent?.trim().length ?? 0,
		};
	});
	if (
		contentMetrics.opacity < 0.95 ||
		contentMetrics.width < 100 ||
		contentMetrics.height < 40 ||
		contentMetrics.textLength === 0
	) {
		throw new Error(
			`${route} main content is not visibly rendered: ${JSON.stringify(contentMetrics)}`,
		);
	}
	if (
		route.startsWith("/posts/") &&
		route !== "/posts/" &&
		viewport.width >= 1400
	) {
		for (const selector of [
			"#article-catalog-wrapper",
			"#article-toc-wrapper",
		]) {
			if (!(await page.locator(selector).isVisible())) {
				throw new Error(`article desktop navigation is hidden: ${selector}`);
			}
		}
	}
	const output = path.join(outputDirectory, `${name}.png`);
	const buffer = await page.screenshot({ path: output });
	await assertNonBlankImage(buffer, `${route} ${viewport.width}px screenshot`);
	console.log(`saved ${output}`);
	await page.close();
}

async function captureHomeEffects() {
	const viewport = { width: 1920, height: 1000 };
	const page = await browser.newPage({ viewport });
	await blockExternalSubresources(page);
	await page.goto(`${baseUrl}/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	await page.locator("#home-hero").waitFor({ state: "visible" });

	const deck = page.locator("[data-photo-deck]");
	await deck.scrollIntoViewIfNeeded();
	await page.waitForTimeout(350);
	const perspective = await deck.evaluate((element) => {
		const stage = element.querySelector("[data-photo-deck-stage]");
		const active = element.querySelector(
			'[data-photo-deck-card][data-active="true"]',
		);
		const side = element.querySelector(
			'[data-photo-deck-card][data-position="1"]',
		);
		const stageRect = stage.getBoundingClientRect();
		const activeRect = active.getBoundingClientRect();
		return {
			count: element.querySelectorAll("[data-photo-deck-card]").length,
			perspective: getComputedStyle(stage).perspective,
			centerDelta: Math.abs(
				activeRect.x +
					activeRect.width / 2 -
					(stageRect.x + stageRect.width / 2),
			),
			activeOpacity: Number(getComputedStyle(active).opacity),
			sideOpacity: Number(getComputedStyle(side).opacity),
			sideTransform: getComputedStyle(side).transform,
		};
	});
	if (
		perspective.count !== 4 ||
		perspective.perspective === "none" ||
		perspective.centerDelta > 3 ||
		perspective.activeOpacity < 0.98 ||
		perspective.sideOpacity >= perspective.activeOpacity ||
		!perspective.sideTransform.startsWith("matrix3d")
	) {
		throw new Error(
			`PhotoDeck perspective regression: ${JSON.stringify(perspective)}`,
		);
	}
	const deckIndex = await deck
		.locator('[data-photo-deck-card][data-active="true"]')
		.getAttribute("data-index");
	await deck.locator("[data-photo-deck-next]").click();
	if (
		(await deck
			.locator('[data-photo-deck-card][data-active="true"]')
			.getAttribute("data-index")) === deckIndex
	) {
		throw new Error("PhotoDeck next control did not advance");
	}
	const deckBuffer = await page.screenshot({
		path: path.join(outputDirectory, "home-photo-deck-wide.png"),
	});
	await assertNonBlankImage(deckBuffer, "home PhotoDeck perspective");

	const display = page.locator("#home-display-layer");
	await page.waitForFunction(
		() =>
			document.querySelector("#home-display-layer")?.dataset.displayReady ===
			"ready",
		undefined,
		{ timeout: 12_000 },
	);
	const range = await display.evaluate((element) => ({
		top:
			(element.closest(".pin-spacer") ?? element).getBoundingClientRect().top +
			window.scrollY,
		distance:
			Number(element.dataset.cinematicScrollDistance || 0) ||
			Number(element.dataset.scrollDistance || 0) +
				Number(element.dataset.shutterScrollDistance || 0),
	}));
	const seek = async (predicate, label) => {
		for (let step = 32; step <= 88; step += 2) {
			await page.evaluate(
				({ top, distance, progress }) =>
					window.scrollTo(0, top + distance * progress),
				{ ...range, progress: step / 100 },
			);
			await page.waitForTimeout(45);
			const state = await display.evaluate(() => {
				const bounds = (selector) => {
					const rect = document.querySelector(selector).getBoundingClientRect();
					return {
						x: rect.x,
						y: rect.y,
						width: rect.width,
						height: rect.height,
						bottom: rect.bottom,
					};
				};
				return {
					panels: [...document.querySelectorAll("[data-shutter-panel]")].map(
						(element) => Number(getComputedStyle(element).opacity),
					),
					foregroundOpacity: Number(
						getComputedStyle(
							document.querySelector("[data-shutter-interlude-fg]"),
						).opacity,
					),
					stripTop: bounds("[data-shutter-interlude-strip-left]"),
					stripBottom: bounds("[data-shutter-interlude-strip-right]"),
					foreground: bounds("[data-shutter-interlude-fg]"),
				};
			});
			if (predicate(state)) return state;
		}
		throw new Error(`Unable to seek ${label}`);
	};

	const fiveColumns = await display.evaluate((element) => {
		const rail = element.querySelector(".home-portfolio-shutter__rail");
		return {
			width: rail.getBoundingClientRect().width,
			tracks: getComputedStyle(rail)
				.gridTemplateColumns.split(" ")
				.map(Number.parseFloat),
			directions: [...rail.querySelectorAll("[data-shutter-panel]")].map(
				(panel) => panel.dataset.direction,
			),
		};
	});
	if (
		fiveColumns.tracks.length !== 5 ||
		Math.max(...fiveColumns.tracks) - Math.min(...fiveColumns.tracks) > 4 ||
		Math.abs(
			fiveColumns.tracks.reduce((sum, value) => sum + value, 0) -
				fiveColumns.width,
		) > 2 ||
		fiveColumns.directions.join(",") !== "down,up,down,up,down"
	) {
		throw new Error(
			`five-column shutter regression: ${JSON.stringify(fiveColumns)}`,
		);
	}
	await seek(
		(state) =>
			state.panels.every((opacity) => opacity > 0.98) &&
			state.foregroundOpacity < 0.1,
		"five-column shutter",
	);
	const shutterBuffer = await page.screenshot({
		path: path.join(outputDirectory, "home-five-columns-wide.png"),
	});
	await assertNonBlankImage(shutterBuffer, "home five-column shutter");

	const secondAct = await seek(
		(state) =>
			state.foregroundOpacity > 0.95 &&
			Math.abs(state.stripTop.x) < 4 &&
			Math.abs(state.stripBottom.x) < 4,
		"home second act",
	);
	if (
		Math.abs(secondAct.stripTop.width - viewport.width) > 2 ||
		Math.abs(secondAct.stripBottom.width - viewport.width) > 2 ||
		secondAct.stripTop.bottom >= secondAct.stripBottom.y ||
		secondAct.foreground.height < viewport.height * 0.75
	) {
		throw new Error(
			`home second-act geometry regression: ${JSON.stringify(secondAct)}`,
		);
	}
	const secondActBuffer = await page.screenshot({
		path: path.join(outputDirectory, "home-second-act-wide.png"),
	});
	await assertNonBlankImage(secondActBuffer, "home second act");
	await page.close();
}

async function captureAdminPage(name, route, heading, viewport) {
	const token = process.env.E2E_BLOG_ADMIN_TOKEN;
	if (!token) return;
	const page = await browser.newPage({ viewport });
	await blockExternalSubresources(page);
	await page.goto(`${baseUrl}${route}`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	await page.getByLabel("管理员 Token").fill(token);
	await page.getByRole("button", { name: "进入", exact: true }).click();
	await page.getByRole("heading", { name: heading }).waitFor();
	await page.waitForTimeout(350);
	const metrics = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		innerWidth: window.innerWidth,
	}));
	if (metrics.scrollWidth > metrics.innerWidth + 1) {
		throw new Error(
			`${route} horizontal overflow (${metrics.scrollWidth} > ${metrics.innerWidth})`,
		);
	}
	const buffer = await page.screenshot({
		path: path.join(outputDirectory, `${name}.png`),
	});
	await assertNonBlankImage(
		buffer,
		`${route} authenticated ${viewport.width}px`,
	);
	await page.close();
}

await captureShell(
	"desktop-settings",
	{ width: 1440, height: 1000 },
	async (page) => {
		await page.locator('#floating-dock [data-dock-command="toggle"]').click();
		await page.locator('#floating-dock [data-dock-command="settings"]').click();
		await page
			.locator('[data-dock-drawer="settings"]')
			.waitFor({ state: "visible" });
		await page.waitForTimeout(250);
		const opacity = await page
			.locator('[data-dock-drawer="settings"]')
			.evaluate((node) => getComputedStyle(node).opacity);
		if (Number(opacity) < 0.95)
			throw new Error("settings drawer did not finish opening");
	},
);

await captureShell(
	"desktop-guestbook-dragged",
	{ width: 1920, height: 1000 },
	async (page) => {
		await page.locator('#floating-dock [data-dock-command="toggle"]').click();
		await page
			.locator('#floating-dock [data-dock-command="guestbook"]')
			.click();
		const drawer = page.locator('[data-dock-drawer="guestbook"]');
		await drawer.waitFor({ state: "visible" });
		await page.waitForFunction(() => {
			const element = document.querySelector('[data-dock-drawer="guestbook"]');
			if (!element || element.classList.contains("dock-drawer-closed")) {
				return false;
			}
			const box = element.getBoundingClientRect();
			return (
				Math.abs(box.left + box.width / 2 - window.innerWidth / 2) <= 2 &&
				Math.abs(box.top + box.height / 2 - window.innerHeight / 2) <= 2
			);
		});
		const initial = await drawer.boundingBox();
		const handle = await drawer
			.locator("[data-dock-drag-handle]")
			.boundingBox();
		if (!initial || !handle)
			throw new Error("guestbook drawer bounds unavailable");
		if (
			Math.abs(initial.x + initial.width / 2 - 960) > 3 ||
			Math.abs(initial.y + initial.height / 2 - 500) > 3
		) {
			throw new Error("guestbook drawer did not open in the viewport center");
		}
		await page.screenshot({
			path: path.join(outputDirectory, "desktop-guestbook-centered.png"),
		});
		await page.mouse.move(
			handle.x + handle.width * 0.45,
			handle.y + handle.height / 2,
		);
		await page.mouse.down();
		await page.mouse.move(
			handle.x + handle.width * 0.45 + 120,
			handle.y + handle.height / 2 + 56,
			{ steps: 8 },
		);
		await page.mouse.up();
		const moved = await drawer.boundingBox();
		if (
			!moved ||
			moved.x - initial.x < 80 ||
			moved.y - initial.y < 30 ||
			!(await drawer.evaluate((element) =>
				element.classList.contains("is-positioned"),
			))
		) {
			throw new Error("guestbook drawer drag interaction failed");
		}
	},
);

await captureShell(
	"mobile-tools",
	{ width: 390, height: 844 },
	async (page) => {
		await page.locator('#mobile-dock [data-dock-command="tools"]').click();
		await page
			.locator("#mobile-dock-sheet.is-open")
			.waitFor({ state: "visible" });
		await page.waitForTimeout(350);
		const sheetBox = await page.locator("#mobile-dock-sheet").boundingBox();
		const dockBox = await page.locator("#mobile-dock").boundingBox();
		const lastItemBox = await page
			.locator('#mobile-dock-sheet [data-dock-command="categories"]')
			.boundingBox();
		if (!sheetBox || !dockBox || !lastItemBox) {
			throw new Error("mobile shell bounds are unavailable");
		}
		if (sheetBox.y + sheetBox.height > dockBox.y - 4) {
			throw new Error("mobile tools sheet overlaps the bottom dock");
		}
		if (lastItemBox.y + lastItemBox.height > sheetBox.y + sheetBox.height + 1) {
			throw new Error("mobile tools item overflows its sheet");
		}
	},
);

for (const viewport of [
	{ name: "desktop", width: 1440, height: 1000 },
	{ name: "mobile", width: 390, height: 844 },
]) {
	await capturePage(`home-${viewport.name}`, "/", viewport);
	await capturePage(`posts-${viewport.name}`, "/posts/", viewport);
	await capturePage(`guestbook-${viewport.name}`, "/guestbook/", viewport);
	await capturePage(`moments-${viewport.name}`, "/moments/", viewport);
	await capturePage(`calendar-${viewport.name}`, "/calendar/", viewport);
	await capturePage(`notebook-${viewport.name}`, "/notebook/", viewport);
	await capturePage(
		`article-${viewport.name}`,
		"/posts/ai/ai-blog-ai-zero-editing/",
		viewport,
	);
	await capturePage(`categories-${viewport.name}`, "/categories/", viewport);
	await capturePage(`friends-${viewport.name}`, "/friends/", viewport);
	await capturePage(`collections-${viewport.name}`, "/collections/", viewport);
	await capturePage(`gallery-${viewport.name}`, "/gallery/", viewport);
	await capturePage(`rss-${viewport.name}`, "/rss/", viewport);
	await capturePage(`xiao-${viewport.name}`, "/live2D/", viewport);
	await capturePage(
		`pixiv-crawler-${viewport.name}`,
		"/album/crawler/",
		viewport,
	);
	await captureAdminPage(
		`write-${viewport.name}`,
		"/write/",
		"文章工作台",
		viewport,
	);
	await captureAdminPage(
		`config-${viewport.name}`,
		"/config/",
		"公开配置",
		viewport,
	);
}

await capturePage("guestbook-wide", "/guestbook/", {
	width: 1920,
	height: 1000,
});
await captureHomeEffects();

for (const viewport of [
	{ name: "desktop", width: 1440, height: 1000 },
	{ name: "mobile", width: 390, height: 844 },
]) {
	const page = await browser.newPage({ viewport });
	await blockExternalSubresources(page);
	await page.goto(`${baseUrl}/music/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	const canvas = page.locator(".music-visualizer canvas").first();
	await canvas.waitFor({ state: "visible", timeout: 30_000 });
	await page.waitForTimeout(1_500);
	const buffer = await canvas.screenshot({
		path: path.join(outputDirectory, `music-${viewport.name}.png`),
	});
	await assertNonBlankImage(buffer, `music ${viewport.name} canvas`);
	await page.close();
}

await browser.close();
