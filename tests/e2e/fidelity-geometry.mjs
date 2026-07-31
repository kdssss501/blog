import { existsSync } from "node:fs";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4321";
const localOrigin = new URL(baseUrl).origin;
const browserPath =
	process.env.PLAYWRIGHT_BROWSER ||
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const tolerance = 4;
const viewports = [
	{ name: "desktop-1440", width: 1440, height: 1000 },
	{ name: "desktop-1920", width: 1920, height: 1000 },
	{ name: "tablet", width: 768, height: 1024 },
	{ name: "mobile", width: 390, height: 844 },
];

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

function assertWithin(actual, expected, label, allowed = tolerance) {
	if (Math.abs(actual - expected) > allowed) {
		throw new Error(`${label}: ${actual.toFixed(2)} vs ${expected.toFixed(2)}`);
	}
}

function assertSpread(values, label) {
	const spread = Math.max(...values) - Math.min(...values);
	if (spread > tolerance) {
		throw new Error(`${label} spread is ${spread.toFixed(2)}px`);
	}
}

async function assertNoOverflow(page, label) {
	const metrics = await page.evaluate(() => ({
		innerWidth: window.innerWidth,
		scrollWidth: document.documentElement.scrollWidth,
	}));
	if (metrics.scrollWidth > metrics.innerWidth + 1) {
		throw new Error(
			`${label} horizontal overflow: ${metrics.scrollWidth} > ${metrics.innerWidth}`,
		);
	}
}

async function goto(page, route, ready) {
	await page.goto(`${baseUrl}${route}`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	if ((await page.locator("html[hidden]").count()) > 0) {
		throw new Error(`${route} unexpectedly hides the document root`);
	}
	await page
		.locator(ready)
		.first()
		.waitFor({ state: "visible", timeout: 12_000 });
	await page.waitForTimeout(350);
}

async function verifyPosts(page, viewport) {
	await goto(page, "/posts/", ".article-feed-card");
	await assertNoOverflow(page, `${viewport.name} posts`);

	const cards = page.locator(".article-feed-card");
	const feed = page.locator(".article-feed");
	const switcher = page.locator(".article-layout-switch");
	const leftSidebar = page.locator("#left-sidebar");
	const rightSidebar = page.locator("#right-sidebar");
	const layout = await feed.getAttribute("data-layout");

	if (viewport.width >= 1200) {
		if (!(await leftSidebar.isVisible()) || !(await rightSidebar.isVisible())) {
			throw new Error(`${viewport.name} must show both sidebars`);
		}
		if (layout !== "grid") {
			throw new Error(
				`${viewport.name} default layout is ${layout}, expected grid`,
			);
		}
		if ((await cards.count()) < 3) {
			throw new Error(`${viewport.name} does not render three article cards`);
		}

		const firstRowCount = 3;
		const boxes = await Promise.all(
			Array.from({ length: firstRowCount }, (_, index) =>
				cards.nth(index).boundingBox(),
			),
		);
		if (boxes.some((box) => !box))
			throw new Error("article card bounds missing");
		assertSpread(
			boxes.map((box) => box.y),
			`${viewport.name} first-row y`,
		);
		assertSpread(
			boxes.map((box) => box.width),
			`${viewport.name} first-row width`,
		);
		assertSpread(
			boxes.map((box) => box.height),
			`${viewport.name} first-row height`,
		);
		for (const [index, box] of boxes.entries()) {
			const difference =
				Math.abs(box.width - box.height) / Math.max(box.width, box.height);
			if (difference > 0.2) {
				throw new Error(
					`${viewport.name} card ${index + 1} is not near-square (${box.width.toFixed(2)}x${box.height.toFixed(2)})`,
				);
			}
		}

		const mediaBox = await cards
			.first()
			.locator(".article-feed-card__media")
			.boundingBox();
		if (!mediaBox) throw new Error("article cover bounds missing");
		assertWithin(
			mediaBox.width / mediaBox.height,
			2,
			`${viewport.name} cover ratio`,
			0.08,
		);

		await switcher.click();
		await page.waitForFunction(
			() =>
				document.querySelector(".article-feed")?.getAttribute("data-layout") ===
				"list",
		);
		await page.reload({ waitUntil: "domcontentloaded" });
		if ((await feed.getAttribute("data-layout")) !== "list") {
			throw new Error(`${viewport.name} layout preference was not persisted`);
		}
		return;
	}

	if ((await leftSidebar.isVisible()) || (await rightSidebar.isVisible())) {
		throw new Error(`${viewport.name} must hide desktop sidebars`);
	}
	if (layout !== "list") {
		throw new Error(
			`${viewport.name} layout is ${layout}, expected forced list`,
		);
	}
	if (!(await switcher.isDisabled())) {
		throw new Error(`${viewport.name} layout switch must be disabled`);
	}
	if ((await cards.count()) > 1) {
		const first = await cards.nth(0).boundingBox();
		const second = await cards.nth(1).boundingBox();
		if (!first || !second || second.y <= first.y + tolerance) {
			throw new Error(`${viewport.name} article cards are not stacked`);
		}
	}
}

async function verifyGuestbook(page, viewport) {
	await goto(page, "/guestbook/", ".guestbook-page--page .guestbook-chat");
	await assertNoOverflow(page, `${viewport.name} guestbook`);

	const geometry = await page.evaluate(() => {
		const bounds = (selector) => {
			const rect = document.querySelector(selector)?.getBoundingClientRect();
			return rect
				? {
						x: rect.x,
						y: rect.y,
						width: rect.width,
						height: rect.height,
						right: rect.right,
						bottom: rect.bottom,
					}
				: null;
		};
		return {
			main: bounds("#main-grid"),
			page: bounds(".guestbook-page--page"),
			chat: bounds(".guestbook-page--page .guestbook-chat"),
			workspace: bounds(".guestbook-page--page .guestbook-chat__workspace"),
			conversation: bounds(
				".guestbook-page--page .guestbook-chat__conversation",
			),
			sidebar: bounds(".guestbook-page--page .guestbook-chat__sidebar"),
			editor: bounds(".guestbook-page--page .guestbook-composer__editor"),
			dock: bounds("#mobile-dock"),
			innerWidth: window.innerWidth,
			innerHeight: window.innerHeight,
			scrollHeight: document.documentElement.scrollHeight,
		};
	});

	for (const key of [
		"main",
		"page",
		"chat",
		"workspace",
		"conversation",
		"sidebar",
	]) {
		if (!geometry[key])
			throw new Error(`${viewport.name} guestbook ${key} bounds missing`);
	}

	if (viewport.width === 1920 && viewport.height === 1000) {
		assertWithin(geometry.main.width, 1440, "guestbook wide shell width");
		assertWithin(
			geometry.main.x + geometry.main.width / 2,
			viewport.width / 2,
			"guestbook wide shell center",
		);
		assertWithin(
			geometry.chat.x + geometry.chat.width / 2,
			viewport.width / 2,
			"guestbook chat center",
		);
		assertWithin(geometry.chat.y, 82, "guestbook reference top inset", 2);
		assertWithin(
			geometry.chat.bottom,
			viewport.height - 12,
			"guestbook reference bottom inset",
			2,
		);
		assertWithin(
			geometry.chat.height,
			viewport.height - 12 - geometry.chat.y,
			"guestbook fills available viewport height",
			2,
		);
		assertWithin(
			geometry.conversation.width / geometry.sidebar.width,
			4,
			"guestbook 80/20 workspace ratio",
			0.12,
		);
		assertWithin(
			geometry.conversation.width + geometry.sidebar.width,
			geometry.workspace.width,
			"guestbook workspace columns fill width",
			2,
		);
		assertWithin(
			geometry.scrollHeight,
			viewport.height,
			"guestbook wide document height",
			2,
		);
	}

	if (viewport.width <= 768) {
		if (!geometry.editor || !geometry.dock) {
			throw new Error("mobile guestbook editor or dock bounds missing");
		}
		if (geometry.editor.bottom > geometry.dock.y - 4) {
			throw new Error("mobile guestbook editor overlaps the bottom dock");
		}
	}
}

async function verifyGuestbookDock(page, viewport) {
	await goto(page, "/", "#home-hero");
	await page.locator('#floating-dock [data-dock-command="toggle"]').click();
	await page.locator('#floating-dock [data-dock-command="guestbook"]').click();

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
	const handle = await drawer.locator("[data-dock-drag-handle]").boundingBox();
	if (!initial || !handle)
		throw new Error("guestbook dock drawer bounds missing");
	assertWithin(
		initial.x + initial.width / 2,
		viewport.width / 2,
		"guestbook drawer horizontal center",
		3,
	);
	assertWithin(
		initial.y + initial.height / 2,
		viewport.height / 2,
		"guestbook drawer vertical center",
		3,
	);

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
		!(await drawer.evaluate((element) =>
			element.classList.contains("is-positioned"),
		))
	) {
		throw new Error(
			"guestbook drawer was not marked as positioned after dragging",
		);
	}
	if (moved.x - initial.x < 80 || moved.y - initial.y < 30) {
		throw new Error("guestbook drawer did not follow the drag gesture");
	}
	if (
		moved.x < 8 - tolerance ||
		moved.y < 8 - tolerance ||
		moved.x + moved.width > viewport.width - 8 + tolerance ||
		moved.y + moved.height > viewport.height - 8 + tolerance
	) {
		throw new Error("guestbook drawer escaped the viewport after dragging");
	}
}

async function seekHomeState(page, predicate, label) {
	const root = page.locator("#home-display-layer");
	await page.waitForFunction(
		() =>
			document.querySelector("#home-display-layer")?.dataset.displayReady ===
			"ready",
		undefined,
		{ timeout: 12_000 },
	);
	const range = await root.evaluate((element) => ({
		top:
			(element.closest(".pin-spacer") ?? element).getBoundingClientRect().top +
			window.scrollY,
		distance:
			Number(element.dataset.cinematicScrollDistance || 0) ||
			Number(element.dataset.scrollDistance || 0) +
				Number(element.dataset.shutterScrollDistance || 0),
	}));
	for (let step = 32; step <= 88; step += 1) {
		await page.evaluate(
			({ top, distance, progress }) =>
				window.scrollTo(0, top + distance * progress),
			{ ...range, progress: step / 100 },
		);
		await page.waitForTimeout(45);
		const state = await root.evaluate(() => {
			const opacity = (selector) =>
				Number(getComputedStyle(document.querySelector(selector)).opacity);
			const bounds = (selector) => {
				const rect = document.querySelector(selector).getBoundingClientRect();
				return {
					x: rect.x,
					y: rect.y,
					width: rect.width,
					height: rect.height,
					right: rect.right,
					bottom: rect.bottom,
				};
			};
			return {
				panelOpacity: [
					...document.querySelectorAll("[data-shutter-panel]"),
				].map((element) => Number(getComputedStyle(element).opacity)),
				backgroundOpacity: opacity("[data-shutter-interlude-bg]"),
				foregroundOpacity: opacity("[data-shutter-interlude-fg]"),
				stripTop: bounds("[data-shutter-interlude-strip-left]"),
				stripBottom: bounds("[data-shutter-interlude-strip-right]"),
				foreground: bounds("[data-shutter-interlude-fg]"),
			};
		});
		if (predicate(state)) return state;
	}
	throw new Error(`Unable to seek home ${label} state`);
}

async function verifyHomeVisuals(page, viewport) {
	await goto(page, "/", "#home-hero");
	await assertNoOverflow(page, `${viewport.name} home`);

	const heroTextFlow = await page.evaluate(() => {
		const bounds = (selector) => {
			const rect = document.querySelector(selector)?.getBoundingClientRect();
			return rect ? { top: rect.top, bottom: rect.bottom } : null;
		};
		return [
			bounds(".home-hero__occupation"),
			bounds(".home-hero__name"),
			bounds(".home-hero__name-badge"),
			bounds(".home-hero__tagline"),
		];
	});
	if (heroTextFlow.some((item) => !item)) {
		throw new Error("home hero text bounds are incomplete");
	}
	for (let index = 0; index < heroTextFlow.length - 1; index += 1) {
		if (heroTextFlow[index].bottom > heroTextFlow[index + 1].top + 1) {
			throw new Error(`home hero text overlaps at flow index ${index}`);
		}
	}

	const deck = page.locator("[data-photo-deck]");
	await deck.scrollIntoViewIfNeeded();
	await page.waitForTimeout(300);
	const deckGeometry = await deck.evaluate((element) => {
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
			stagePerspective: getComputedStyle(stage).perspective,
			activeCenter: activeRect.x + activeRect.width / 2,
			stageCenter: stageRect.x + stageRect.width / 2,
			activeOpacity: Number(getComputedStyle(active).opacity),
			sideOpacity: Number(getComputedStyle(side).opacity),
			sideTransform: getComputedStyle(side).transform,
		};
	});
	if (deckGeometry.count !== 4)
		throw new Error(
			`PhotoDeck expected four landscape cards, got ${deckGeometry.count}`,
		);
	if (deckGeometry.stagePerspective === "none")
		throw new Error("PhotoDeck perspective is disabled");
	assertWithin(
		deckGeometry.activeCenter,
		deckGeometry.stageCenter,
		"PhotoDeck active card center",
		3,
	);
	if (
		deckGeometry.activeOpacity < 0.98 ||
		deckGeometry.sideOpacity >= deckGeometry.activeOpacity ||
		!deckGeometry.sideTransform.startsWith("matrix3d")
	) {
		throw new Error(
			"PhotoDeck does not render a clear center with receding side cards",
		);
	}

	const activeBefore = await deck
		.locator('[data-photo-deck-card][data-active="true"]')
		.getAttribute("data-index");
	await deck.locator("[data-photo-deck-next]").click();
	const activeAfter = await deck
		.locator('[data-photo-deck-card][data-active="true"]')
		.getAttribute("data-index");
	if (activeBefore === activeAfter)
		throw new Error("PhotoDeck next control did not advance");
	const stageBox = await deck.locator("[data-photo-deck-stage]").boundingBox();
	if (!stageBox) throw new Error("PhotoDeck stage bounds missing");
	await page.mouse.move(
		stageBox.x + stageBox.width / 2 + 70,
		stageBox.y + stageBox.height / 2,
	);
	await page.mouse.down();
	await page.mouse.move(
		stageBox.x + stageBox.width / 2 - 110,
		stageBox.y + stageBox.height / 2,
		{ steps: 8 },
	);
	await page.mouse.up();
	const activeAfterDrag = await deck
		.locator('[data-photo-deck-card][data-active="true"]')
		.getAttribute("data-index");
	if (activeAfterDrag === activeAfter)
		throw new Error("PhotoDeck drag did not advance");

	if (viewport.width < 769) return;

	const shutter = page.locator("#home-display-layer");
	const shutterGrid = await shutter.evaluate((element) => {
		const rail = element.querySelector(".home-portfolio-shutter__rail");
		const tracks = getComputedStyle(rail)
			.gridTemplateColumns.split(" ")
			.map(Number.parseFloat);
		return {
			railWidth: rail.getBoundingClientRect().width,
			tracks,
			directions: [...rail.querySelectorAll("[data-shutter-panel]")].map(
				(panel) => panel.dataset.direction,
			),
		};
	});
	if (shutterGrid.tracks.length !== 5)
		throw new Error("home shutter is not five columns");
	assertSpread(shutterGrid.tracks, "home shutter equal columns");
	assertWithin(
		shutterGrid.tracks.reduce((sum, value) => sum + value, 0),
		shutterGrid.railWidth,
		"home shutter columns fill viewport",
		2,
	);
	if (shutterGrid.directions.join(",") !== "down,up,down,up,down") {
		throw new Error(
			`home shutter direction pattern is ${shutterGrid.directions.join(",")}`,
		);
	}

	const fivePanel = await seekHomeState(
		page,
		(state) =>
			state.panelOpacity.every((value) => value > 0.98) &&
			state.backgroundOpacity < 0.05 &&
			state.foregroundOpacity < 0.1,
		"five-panel",
	);
	if (
		fivePanel.stripTop.x > -viewport.width * 0.95 ||
		fivePanel.stripBottom.x < viewport.width * 0.95
	) {
		throw new Error("home five-panel hold is contaminated by the second act");
	}

	const secondAct = await seekHomeState(
		page,
		(state) =>
			state.foregroundOpacity > 0.95 &&
			Math.abs(state.stripTop.x) < tolerance &&
			Math.abs(state.stripBottom.x) < tolerance,
		"second-act",
	);
	for (const [name, strip] of [
		["top", secondAct.stripTop],
		["bottom", secondAct.stripBottom],
	]) {
		assertWithin(
			strip.width,
			viewport.width,
			`home second-act ${name} strip width`,
			2,
		);
		if (
			strip.height < viewport.height * 0.42 ||
			strip.height > viewport.height * 0.46
		) {
			throw new Error(`home second-act ${name} strip ratio is incorrect`);
		}
	}
	const stripGap = secondAct.stripBottom.y - secondAct.stripTop.bottom;
	if (stripGap < viewport.height * 0.025 || stripGap > viewport.height * 0.06) {
		throw new Error("home second-act black divider ratio is incorrect");
	}
	assertWithin(
		secondAct.stripTop.y,
		viewport.height - secondAct.stripBottom.bottom,
		"home second-act outer black margins",
		3,
	);
	assertWithin(
		secondAct.foreground.x + secondAct.foreground.width / 2,
		viewport.width / 2,
		"home second-act foreground center",
		3,
	);
	if (
		secondAct.foreground.width < viewport.width * 0.25 ||
		secondAct.foreground.height < viewport.height * 0.75
	) {
		throw new Error("home second-act transparent foreground is undersized");
	}
}

async function verifyDumplingPages(page, viewport) {
	await goto(page, "/moments/", ".moment-card");
	await assertNoOverflow(page, `${viewport.name} moments`);
	if ((await page.locator(".moment-card").count()) < 4) {
		throw new Error(
			`${viewport.name} must render migrated and Obsidian moments`,
		);
	}
	if (
		!(await page
			.locator(".moment-card")
			.filter({ hasText: "把散落的想法收回 Markdown" })
			.first()
			.isVisible())
	) {
		throw new Error(`${viewport.name} is missing the Obsidian moment`);
	}
	if ((await page.locator(".moment-card--xiao").count()) !== 0) {
		throw new Error(`${viewport.name} moments include Xiao-only content`);
	}

	await goto(page, "/life/notebooks/", ".notebook-card");
	await assertNoOverflow(page, `${viewport.name} notebooks`);
	const notebookHref = await page
		.locator(".notebook-card")
		.first()
		.getAttribute("href");
	if (!notebookHref?.startsWith("/life/notebooks/")) {
		throw new Error(`${viewport.name} notebook link is not canonical`);
	}

	await goto(page, "/album/", ".collection-album-card");
	await assertNoOverflow(page, `${viewport.name} album`);
	if ((await page.locator(".collection-album-card").count()) === 0) {
		throw new Error(`${viewport.name} migrated album is missing`);
	}
}

async function verifyMobileLive2D(page) {
	const live2dRequests = [];
	page.on("request", (request) => {
		if (/live2d|cubism|pixi/i.test(request.url()))
			live2dRequests.push(request.url());
	});
	await goto(page, "/posts/", "#live2d-trigger.visible");
	if (!(await page.locator("#live2d-trigger").isVisible())) {
		throw new Error("mobile Live2D entry is hidden");
	}
	if (live2dRequests.length !== 0) {
		throw new Error(
			"mobile Live2D downloaded resources before entry activation",
		);
	}
	await page.locator("#live2d-trigger").click();
	await page.waitForTimeout(500);
	if (live2dRequests.length === 0) {
		throw new Error("mobile Live2D entry did not start lazy loading");
	}
}

const browser = await chromium.launch({
	headless: true,
	...(existsSync(browserPath) ? { executablePath: browserPath } : {}),
});
const failures = [];

try {
	for (const viewport of viewports) {
		const page = await browser.newPage({
			viewport: { width: viewport.width, height: viewport.height },
		});
		await blockExternalSubresources(page);
		try {
			await verifyPosts(page, viewport);
			await verifyGuestbook(page, viewport);
			await verifyDumplingPages(page, viewport);
			if ([1920, 390].includes(viewport.width)) {
				await verifyHomeVisuals(page, viewport);
			}
			if (viewport.width === 1920) await verifyGuestbookDock(page, viewport);
			if (viewport.name === "mobile") await verifyMobileLive2D(page);
			console.log(`${viewport.name} geometry OK`);
		} catch (error) {
			failures.push(`${viewport.name}: ${error.message}`);
		} finally {
			await page.close();
		}
	}
} finally {
	await browser.close();
}

if (failures.length > 0) {
	throw new Error(`Fidelity geometry failed:\n${failures.join("\n")}`);
}

console.log(`Fidelity geometry passed (${viewports.length} viewports).`);
