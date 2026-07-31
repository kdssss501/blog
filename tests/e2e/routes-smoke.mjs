import { existsSync } from "node:fs";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4321";
const localOrigin = new URL(baseUrl).origin;
const browserPath =
	process.env.PLAYWRIGHT_BROWSER ||
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const routes = [
	"/",
	"/posts/",
	"/list/",
	"/archive/",
	"/categories/",
	"/calendar/",
	"/friends/",
	"/guestbook/",
	"/activity/",
	"/moments/",
	"/notebook/",
	"/gallery/",
	"/rss/",
	"/music/",
	"/sponsor/",
	"/about/",
	"/search/",
	"/collections/",
	"/projects/",
	"/pengyou/",
	"/books/",
	"/movies-games/",
	"/changelog/",
	"/life/routines/",
	"/life/places/",
	"/album/",
	"/album/crawler/",
	"/life/notebooks/",
	"/live2D/",
	"/write/",
	"/config/",
];
const removedRoutes = ["/treehole/", "/treehole-admin/", "/api/treehole/"];
const viewports = [
	{ name: "desktop", width: 1440, height: 1000 },
	{ name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch({
	headless: true,
	...(existsSync(browserPath) ? { executablePath: browserPath } : {}),
});
const failures = [];

function isExpectedExternalFailure(message) {
	const text = message.text();
	if (text.includes("/api/admin/session/") && text.includes("503")) return true;
	if (text.includes("Failed to load Waline from all CDN sources")) return true;
	if (
		text.includes("Music Manager init error: Error: All Meting APIs failed")
	) {
		return true;
	}
	const sourceUrl = message.location().url;
	if (!sourceUrl) return false;
	try {
		const url = new URL(sourceUrl);
		if (
			url.origin === localOrigin &&
			url.pathname === "/api/admin/session/" &&
			text.includes("503")
		) {
			return true;
		}
		return url.origin !== localOrigin;
	} catch {
		return false;
	}
}

async function blockExternalSubresources(page) {
	await page.route("**/*", async (route) => {
		const requestUrl = route.request().url();
		try {
			const url = new URL(requestUrl);
			if (
				url.origin !== localOrigin &&
				url.origin !== "https://cubism.live2d.com" &&
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

async function checkApplicationShell(page, viewportName) {
	await page.goto(`${baseUrl}/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});

	if (viewportName === "desktop") {
		await page.evaluate(() => {
			localStorage.setItem("theme", "light");
			localStorage.setItem("blog-background-mode", "plain");
		});
		await page.reload({ waitUntil: "domcontentloaded" });
		await page.locator('#floating-dock [data-dock-command="toggle"]').click();
		await page.locator('#floating-dock [data-dock-command="settings"]').click();
		await page
			.locator('[data-dock-drawer="settings"]')
			.waitFor({ state: "visible" });
		await page.locator('#floating-dock [data-dock-command="theme"]').click();
		await page.waitForFunction(() =>
			document.documentElement.classList.contains("dark"),
		);
		await page.getByRole("button", { name: "全屏壁纸", exact: true }).click();
		if (
			(await page.locator("html").getAttribute("data-background-mode")) !==
			"wallpaper"
		) {
			throw new Error(
				"desktop background switch did not enable wallpaper mode",
			);
		}
		await page.getByRole("button", { name: "纯色背景", exact: true }).click();
		await page.locator('#floating-dock [data-dock-command="theme"]').click();
		await page.waitForFunction(
			() => !document.documentElement.classList.contains("dark"),
		);
		return;
	}

	await page.locator('#mobile-dock [data-dock-command="tools"]').click();
	await page
		.locator("#mobile-dock-sheet.is-open")
		.waitFor({ state: "visible" });
	for (const command of ["settings", "categories", "xiao"]) {
		const selector = `#mobile-dock-sheet [data-dock-command="${command}"]`;
		if (!(await page.locator(selector).isVisible())) {
			throw new Error(`mobile dock item is not visible: ${command}`);
		}
	}
	await page.locator("#mobile-dock-overlay").click();
}

async function checkFriends(page) {
	await page.goto(`${baseUrl}/friends/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});

	const directory = page.locator("friend-directory");
	const firstCardBox = await directory
		.locator(".friend-card-link")
		.first()
		.boundingBox();
	const expectedCardHeight = page.viewportSize()?.width < 641 ? 77.5 : 88;
	if (!firstCardBox || Math.abs(firstCardBox.height - expectedCardHeight) > 1) {
		throw new Error(
			`friend card height is not compact: ${firstCardBox?.height}`,
		);
	}
	await directory.locator("[data-tag='Docs']").click();
	const visibleTitles = await directory
		.locator(".friend-card:not([hidden]) .friend-card-title")
		.allTextContents();
	if (visibleTitles.length !== 1 || visibleTitles[0] !== "Firefly Docs") {
		throw new Error(
			`friend tag filter returned ${JSON.stringify(visibleTitles)}`,
		);
	}

	await directory.locator("[data-tag='all']").click();
	const nextButton = directory.locator("[data-page-next]");
	const itemCount = await directory.locator(".friend-card").count();
	const pageSize = Number(await directory.getAttribute("data-page-size"));
	if (itemCount > pageSize) {
		if (!(await nextButton.isVisible()) || (await nextButton.isDisabled())) {
			throw new Error("friend pagination is not available");
		}
		await nextButton.click();
		if (
			(
				await directory.locator(".friends-page-num.is-active").textContent()
			)?.trim() !== "2"
		) {
			throw new Error("friend pagination did not advance to page 2");
		}
	}

	await page.locator("[data-open-friend-rules]").click();
	const modal = page.locator("[data-friend-rules-dialog]");
	await modal.waitFor({ state: "visible" });
	if (!(await modal.locator("a[href^='mailto:']").isVisible())) {
		throw new Error("manual friend application mail link is missing");
	}
	await modal.locator("[data-close-friend-rules]").last().click();
	if (await modal.isVisible())
		throw new Error("friend rules modal did not close");
}

async function checkGuestbook(page) {
	const firstMessage = {
		id: "msg_901",
		author: "测试访客",
		content: "这是一条用于验证实时留言区域的测试留言。",
		time: "刚刚",
		createdAt: Date.now() - 60_000,
		device: "Web",
		votes: { agree: 2, disagree: 0, neutral: 0 },
	};
	const olderMessage = {
		...firstMessage,
		id: "msg_900",
		author: "较早访客",
		content: "这是一条分页加载的较早留言。",
		createdAt: Date.now() - 3_600_000,
	};
	let postCount = 0;

	await page.addInitScript(() => {
		delete window.__guestbook_data__;
	});
	await page.route("**/api/guestbook**", async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		if (request.method() === "GET") {
			const offset = Number(url.searchParams.get("offset") ?? 0);
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					messages: offset === 0 ? [firstMessage] : [olderMessage],
					total: 2,
				}),
			});
			return;
		}
		if (
			request.method() === "POST" &&
			(url.pathname.endsWith("/vote") || url.pathname.endsWith("/vote/"))
		) {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					...firstMessage,
					votes: { agree: 3, disagree: 0, neutral: 0 },
				}),
			});
			return;
		}
		postCount += 1;
		if (postCount > 1) {
			await route.fulfill({ status: 429, body: "Too many requests" });
			return;
		}
		const body = request.postDataJSON();
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				...firstMessage,
				id: "msg_902",
				author: body.author,
				content: body.content,
				createdAt: Date.now(),
				votes: { agree: 0, disagree: 0, neutral: 0 },
			}),
		});
	});

	await page.goto(`${baseUrl}/guestbook/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	const guestbookPage = page.locator(".guestbook-page--page");
	await guestbookPage.waitFor({ state: "visible" });
	await assertGuestbookDockState(page, true);
	const guestbookSections = [
		".guestbook-chat__header",
		".guestbook-chat__messages",
		".guestbook-chat__sidebar",
		".guestbook-composer",
	];
	for (const selector of guestbookSections) {
		if (!(await guestbookPage.locator(selector).isVisible())) {
			throw new Error(`guestbook section is unavailable: ${selector}`);
		}
	}

	await guestbookPage.locator(".guestbook-chat__history button").click();
	await guestbookPage
		.locator(".guestbook-chat__messages")
		.getByText(olderMessage.content, { exact: true })
		.waitFor();

	await guestbookPage.locator(".guestbook-composer__guest-profile").click();
	const profile = page.locator(".guestbook-profile-modal__panel");
	await profile.waitFor({ state: "visible" });
	await profile.locator("input").fill("自动化访客");
	await profile.locator('button[type="submit"]').click();
	const editor = guestbookPage.locator(".guestbook-composer textarea");
	await editor.fill("自动化提交的留言内容。");
	await guestbookPage.locator(".guestbook-composer__send").click();
	await guestbookPage
		.getByText("自动化提交的留言内容。", { exact: true })
		.waitFor();

	await editor.fill("触发频率限制的留言。");
	await guestbookPage.locator(".guestbook-composer__send").click();
	await guestbookPage
		.getByRole("alert")
		.filter({ hasText: "发送太频繁" })
		.waitFor();

	await navigateWithSwup(page, "/posts/");
	await assertGuestbookDockState(page, false);
	if (page.viewportSize()?.width >= 769) {
		await page.locator('#floating-dock [data-dock-command="toggle"]').click();
		await page
			.locator('#floating-dock [data-dock-command="guestbook"]')
			.click();
		const drawer = page.locator('[data-dock-drawer="guestbook"]');
		await drawer.waitFor({ state: "visible" });
		await page.waitForFunction(() => {
			const element = document.querySelector('[data-dock-drawer="guestbook"]');
			if (!element) return false;
			const box = element.getBoundingClientRect();
			return (
				Math.abs(box.left + box.width / 2 - window.innerWidth / 2) <= 2 &&
				Math.abs(box.top + box.height / 2 - window.innerHeight / 2) <= 2
			);
		});
		if (
			(await drawer.locator(".dock-drawer-popout").getAttribute("href")) !==
			"/guestbook/"
		) {
			throw new Error("guestbook dock popout does not use the canonical route");
		}
		const before = await drawer.boundingBox();
		const viewport = page.viewportSize();
		if (
			!before ||
			!viewport ||
			Math.abs(before.x + before.width / 2 - viewport.width / 2) > 2 ||
			Math.abs(before.y + before.height / 2 - viewport.height / 2) > 2
		) {
			throw new Error("guestbook dock drawer is not centered");
		}
		const handleBox = await drawer
			.locator("[data-dock-drag-handle]")
			.boundingBox();
		if (!handleBox) throw new Error("guestbook drag handle is missing");
		await page.mouse.move(handleBox.x + 80, handleBox.y + 18);
		await page.mouse.down();
		await page.mouse.move(handleBox.x + 140, handleBox.y + 58, { steps: 5 });
		await page.mouse.up();
		const after = await drawer.boundingBox();
		if (!after || after.x - before.x < 45 || after.y - before.y < 25) {
			throw new Error("guestbook dock drawer did not move with drag input");
		}
		await drawer.locator("[data-dock-close]").click();
	}

	await navigateWithSwup(page, "/guestbook/");
	await page.locator(".guestbook-page--page").waitFor({ state: "visible" });
	await assertGuestbookDockState(page, true);
	await navigateWithSwup(page, "/posts/");
	await assertGuestbookDockState(page, false);
}

async function navigateWithSwup(page, pathname) {
	await page.waitForFunction(
		() =>
			typeof window.navigateToPage === "function" &&
			typeof window.swup?.navigate === "function",
		undefined,
		{ timeout: 30_000 },
	);
	const navigationState = await page.evaluate(() => {
		const container = document.querySelector("#swup-container");
		if (!container) throw new Error("Swup container is unavailable");
		const containerMarker = crypto.randomUUID();
		container.dataset.routeSmokeMarker = containerMarker;
		window.__routeSmokeDocumentToken ??= crypto.randomUUID();
		return {
			containerMarker,
			documentToken: window.__routeSmokeDocumentToken,
		};
	});
	await page.evaluate((path) => {
		window.navigateToPage(path);
	}, pathname);
	await page.waitForURL((url) => url.pathname === pathname, {
		timeout: 30_000,
	});
	await page.waitForFunction(
		({ path, marker }) =>
			window.location.pathname === path &&
			document.querySelector("#swup-container")?.dataset.routeSmokeMarker !==
				marker,
		{ path: pathname, marker: navigationState.containerMarker },
		{ timeout: 30_000 },
	);
	const documentWasPreserved = await page.evaluate(
		(token) => window.__routeSmokeDocumentToken === token,
		navigationState.documentToken,
	);
	if (!documentWasPreserved) {
		throw new Error(`Swup navigation to ${pathname} performed a full reload`);
	}
}

async function assertGuestbookDockState(page, blocked) {
	const buttons = page.locator('[data-dock-command="guestbook"]');
	if ((await buttons.count()) < 2) {
		throw new Error("guestbook commands are not persistently rendered");
	}
	await page.waitForFunction(
		(expectedBlocked) =>
			[...document.querySelectorAll('[data-dock-command="guestbook"]')].every(
				(element) =>
					expectedBlocked
						? element.hidden &&
							element.disabled &&
							element.getAttribute("aria-disabled") === "true"
						: !element.hidden &&
							!element.disabled &&
							element.getAttribute("aria-disabled") !== "true",
			),
		blocked,
		{ timeout: 5_000 },
	);
	const states = await buttons.evaluateAll((elements) =>
		elements.map((element) => ({
			hidden: element.hidden,
			disabled: element.disabled,
			ariaDisabled: element.getAttribute("aria-disabled"),
		})),
	);
	if (
		states.some((state) =>
			blocked
				? !state.hidden || !state.disabled || state.ariaDisabled !== "true"
				: state.hidden || state.disabled || state.ariaDisabled === "true",
		)
	) {
		throw new Error(
			`guestbook command state is stale: ${JSON.stringify({ blocked, states })}`,
		);
	}
	const drawer = page.locator('[data-dock-drawer="guestbook"]');
	if (blocked) {
		if (
			!(await drawer.evaluate(
				(element) =>
					element.classList.contains("dock-drawer-closed") &&
					element.inert &&
					element.getAttribute("aria-hidden") === "true",
			))
		) {
			throw new Error(
				"guestbook drawer remained interactive on guestbook page",
			);
		}
	}
}

async function dispatchSearchShortcut(page) {
	await page.evaluate(() => {
		document.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "k",
				code: "KeyK",
				ctrlKey: true,
				bubbles: true,
			}),
		);
	});
}

async function checkSearch(page) {
	const aiRoute = "**/api/ai-chat**";
	let aiRequestCount = 0;
	await page.route(aiRoute, async (route) => {
		aiRequestCount += 1;
		if (aiRequestCount === 1) {
			await route.fulfill({
				status: 503,
				contentType: "application/json",
				body: JSON.stringify({ error: "AI service is not configured" }),
			});
			return;
		}
		if (aiRequestCount === 3) {
			await new Promise((resolve) => setTimeout(resolve, 2_000));
			await route
				.fulfill({
					status: 200,
					contentType: "text/event-stream; charset=utf-8",
					body: 'data: {"type":"done"}\n\n',
				})
				.catch(() => {});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: "text/event-stream; charset=utf-8",
			headers: { "Cache-Control": "no-cache" },
			body: [
				'data: {"type":"chunk","text":"自动化测试回答"}',
				'data: {"type":"refs","articles":[{"title":"参考文章","path":"/posts/ai/ai-blog-ai-zero-editing/","excerpt":"测试摘要"}]}',
				'data: {"type":"done"}',
				"",
			].join("\n\n"),
		});
	});

	try {
		await page.goto(`${baseUrl}/`, {
			waitUntil: "domcontentloaded",
			timeout: 60_000,
		});
		await page.evaluate(() => {
			for (const key of Object.keys(localStorage)) {
				if (key.startsWith("ai-chat:")) localStorage.removeItem(key);
			}
		});
		await page.waitForFunction(
			() => document.documentElement.dataset.searchModalReady === "true",
			undefined,
			{ timeout: 15_000 },
		);

		await dispatchSearchShortcut(page);
		const searchModal = page.locator(".search-modal-content");
		await searchModal.waitFor({ state: "visible" });
		const searchInput = page.getByRole("textbox", { name: "搜索文章" });
		if (
			!(await searchInput.evaluate((node) => node === document.activeElement))
		) {
			throw new Error("search shortcut did not focus the search input");
		}
		await searchInput.fill("AI");
		const firstSearchResult = page.locator(".search-result-item").first();
		await firstSearchResult.waitFor({ state: "visible" });
		const searchResultUrl = await firstSearchResult.getAttribute("href");
		if (!searchResultUrl?.startsWith("/posts/")) {
			throw new Error(`search result link is invalid: ${searchResultUrl}`);
		}
		await firstSearchResult.click();
		await page.waitForURL(new URL(searchResultUrl, baseUrl).href);
		await searchModal.waitFor({ state: "detached" });

		await dispatchSearchShortcut(page);
		await searchModal.waitFor({ state: "visible" });
		await dispatchSearchShortcut(page);
		const aiPanel = page.locator(".ai-panel");
		await aiPanel.waitFor({ state: "visible" });
		const aiInput = page.getByRole("textbox", { name: "向小爱助手提问" });
		await aiPanel.getByRole("button", { name: "带我认识这个博客" }).click();
		await aiPanel
			.getByText("小爱助手尚未配置或暂时不可用，请稍后再试。", {
				exact: true,
			})
			.waitFor();
		await aiInput.fill("请给出一条参考文章");
		await page.getByRole("button", { name: "发送" }).click();
		await aiPanel.getByText("自动化测试回答", { exact: true }).waitFor();
		const reference = aiPanel.getByRole("link", { name: /参考文章/ });
		if (
			(await reference.getAttribute("href")) !==
			"/posts/ai/ai-blog-ai-zero-editing/"
		) {
			throw new Error("AI search reference link is invalid");
		}
		await page.waitForFunction(() => {
			const sessions = localStorage.getItem("ai-chat:sessions");
			return sessions ? JSON.parse(sessions).length > 0 : false;
		});

		await page.getByTitle("新建会话").click();
		await aiPanel.getByText("想从哪里开始？", { exact: true }).waitFor();
		await page.getByTitle("历史会话").click();
		await aiPanel
			.locator(".ai-session-select")
			.filter({ hasText: "带我认识这个博客" })
			.click();
		await aiPanel.getByText("自动化测试回答", { exact: true }).waitFor();

		await page.getByTitle("新建会话").click();
		await aiInput.fill("请停止这次生成");
		await page.getByRole("button", { name: "发送" }).click();
		const stopButton = page.getByRole("button", { name: "停止生成" });
		await stopButton.waitFor({ state: "visible" });
		await stopButton.click();
		await aiPanel.getByText(/已取消/).waitFor();

		const viewport = page.viewportSize();
		if (viewport && viewport.width < 641) {
			await page.setViewportSize({ width: viewport.width, height: 560 });
			await page.waitForFunction(() => {
				const panel = document
					.querySelector(".ai-panel")
					?.getBoundingClientRect();
				const input = document
					.querySelector(".ai-input-area")
					?.getBoundingClientRect();
				return Boolean(
					panel &&
						input &&
						panel.top >= -1 &&
						panel.bottom <= window.innerHeight + 1 &&
						input.bottom <= window.innerHeight + 1,
				);
			});
			await page.setViewportSize(viewport);
		}
		await aiInput.press("Escape");
		await aiPanel.waitFor({ state: "detached" });
	} finally {
		await page.unroute(aiRoute);
	}
}

async function checkMusic(page, viewportName) {
	await page.goto(`${baseUrl}/music/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	await page.locator(".music-visualizer canvas").first().waitFor({
		state: "visible",
		timeout: 30_000,
	});
	await page.waitForFunction(
		() => window.__fireflyMusic?.getState().initialized === true,
		undefined,
		{ timeout: 30_000 },
	);
	const managerShape = await page.evaluate(() => {
		const manager = window.__fireflyMusic;
		return manager
			? ["togglePlay", "playNext", "playPrev", "setVolume", "seek"].every(
					(method) => typeof manager[method] === "function",
				)
			: false;
	});
	if (!managerShape)
		throw new Error("music manager public controls are missing");

	const beforeMode = await page.evaluate(
		() => window.__fireflyMusic?.getState().playMode,
	);
	const modeButton =
		viewportName === "desktop"
			? page
					.locator(".music-visualizer__toolbar .music-visualizer__tool-btn")
					.first()
			: page.getByRole("button", { name: "播放模式", exact: true });
	await modeButton.click();
	await page.waitForFunction(
		(previous) => window.__fireflyMusic?.getState().playMode !== previous,
		beforeMode,
	);

	const playlistButton =
		viewportName === "desktop"
			? page.getByRole("button", { name: "查看歌单" })
			: page.getByRole("button", { name: "歌单", exact: true });
	await playlistButton.click();
	const playlistPanel = page.locator("#music-visualizer-playlist-panel");
	await playlistPanel.waitFor({ state: "visible" });
	await page.getByRole("button", { name: "返回播放器" }).click();
	await playlistPanel.waitFor({ state: "detached" });

	await page.evaluate(() => {
		window.dispatchEvent(
			new CustomEvent("fm:track", {
				detail: { track: { name: "测试曲目", artist: "测试" }, index: 0 },
			}),
		);
		window.dispatchEvent(
			new CustomEvent("fm:play-state", { detail: { isPlaying: true } }),
		);
	});
	const progressSlider =
		viewportName === "desktop"
			? page.locator(".music-visualizer__progress-track")
			: page.locator(".music-visualizer__timeline-track");
	await progressSlider.focus();
	await progressSlider.press("ArrowRight");
	if ((await progressSlider.getAttribute("aria-valuenow")) !== "5") {
		throw new Error("music progress slider did not respond to ArrowRight");
	}
	await progressSlider.press("End");
	if ((await progressSlider.getAttribute("aria-valuenow")) !== "100") {
		throw new Error("music progress slider did not respond to End");
	}
	await progressSlider.press("Home");
	if ((await progressSlider.getAttribute("aria-valuenow")) !== "0") {
		throw new Error("music progress slider did not respond to Home");
	}

	if (viewportName === "desktop") {
		const volumeSlider = page.locator(".music-visualizer__volume-vtrack");
		const beforeVolume = Number(
			await volumeSlider.getAttribute("aria-valuenow"),
		);
		await volumeSlider.evaluate((node) => {
			node.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "ArrowDown",
					bubbles: true,
				}),
			);
		});
		const afterVolume = Number(
			await volumeSlider.getAttribute("aria-valuenow"),
		);
		if (!(afterVolume < beforeVolume)) {
			throw new Error("music volume slider did not respond to ArrowDown");
		}
	}
}

async function checkNotebook(page) {
	await page.goto(`${baseUrl}/life/notebooks/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	const directory = page.locator("notebook-directory");
	const cards = directory.locator(".notebook-card");
	await cards.first().waitFor({ state: "visible" });
	const firstCover = cards.first().locator(".notebook-card__image");
	await firstCover.waitFor({ state: "visible" });
	if (
		!(await firstCover.evaluate(
			(image) => image.complete && image.naturalWidth > 0,
		))
	) {
		throw new Error("notebook cover did not decode");
	}
	const groupCount = Number(
		await directory.locator("[data-notebook-total-groups]").textContent(),
	);
	const entryCount = Number(
		await directory.locator("[data-notebook-total-entries]").textContent(),
	);
	if (groupCount !== (await cards.count()) || entryCount < groupCount) {
		throw new Error("notebook statistics do not match rendered cards");
	}
	const detailUrl = await cards.first().getAttribute("href");
	if (!detailUrl) throw new Error("notebook detail link is missing");
	if (!detailUrl.startsWith("/life/notebooks/") || !detailUrl.endsWith("/")) {
		throw new Error(`notebook detail link is not canonical: ${detailUrl}`);
	}
	await page.goto(new URL(detailUrl, baseUrl).href, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	const detailCard = page.locator(".notebook-entry-card").first();
	await detailCard.waitFor({ state: "visible" });
	if (
		(
			await detailCard.locator(".notebook-entry-card__content").textContent()
		)?.trim().length < 10
	) {
		throw new Error(
			"notebook detail did not render the Obsidian or runtime content",
		);
	}
}

async function checkActivity(page) {
	await page.goto(`${baseUrl}/moments/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	const firstCard = page.locator(".moment-card").first();
	await firstCard.waitFor({ state: "visible" });
	if ((await page.locator(".moment-card").count()) < 2) {
		throw new Error("moments feed did not render enough cards");
	}
	if (
		(await firstCard.locator(".moment-card__copy").textContent())?.trim()
			.length < 20
	) {
		throw new Error("moment card content is incomplete");
	}
	if (
		!(await firstCard.locator(".moment-card__footer a").first().isVisible())
	) {
		throw new Error("moment tag link is missing");
	}
}

async function checkCalendar(page) {
	await page.goto(`${baseUrl}/calendar/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	const calendar = page.locator(".calendar-grid-wrap");
	await calendar.waitFor({ state: "visible" });
	const monthLabel = calendar.locator(".text-lg");
	const initialMonth = (await monthLabel.textContent())?.trim();
	if (!initialMonth || (await calendar.locator(".day-cell").count()) !== 42) {
		throw new Error("calendar month grid is incomplete");
	}
	await calendar.getByRole("button", { name: "Next month" }).click();
	if ((await monthLabel.textContent())?.trim() === initialMonth) {
		throw new Error("calendar next-month control did not change the month");
	}
	const backToToday = calendar.locator(".back-today-btn");
	await backToToday.click();
	if ((await monthLabel.textContent())?.trim() !== initialMonth) {
		throw new Error("calendar back-to-today control did not restore the month");
	}
	const anotherDay = calendar
		.locator(".day-cell.is-current:not(.is-selected)")
		.first();
	const selectedDay = (
		await anotherDay.locator(".day-num").textContent()
	)?.trim();
	if (!selectedDay) throw new Error("calendar selectable day is missing");
	await anotherDay.click();
	await page.waitForFunction(
		(day) =>
			document
				.querySelector(".calendar-grid-wrap .day-cell.is-selected .day-num")
				?.textContent?.trim() === day,
		selectedDay,
	);
}

async function checkPlaces(page) {
	await page.goto(`${baseUrl}/life/places/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	const state = await assertPlaceMapSettled(page);
	await navigateWithSwup(page, "/posts/");
	if (state === "fallback") await installAmapStub(page);
	await navigateWithSwup(page, "/life/places/");
	if (state === "fallback") {
		await page.waitForFunction(
			() => document.querySelector("#place-map")?.dataset.mapState === "ready",
			undefined,
			{ timeout: 5_000 },
		);
	}
	const returnedState = await assertPlaceMapSettled(page);
	if (state === "fallback" && returnedState !== "ready") {
		throw new Error(
			`existing AMap SDK branch was not used after SPA return: ${returnedState}`,
		);
	}
	if (
		state === "fallback" &&
		(await page.locator("#place-map [data-amap-stub='true']").count()) !== 1
	) {
		throw new Error("existing AMap SDK branch did not render the map surface");
	}
}

async function assertPlaceMapSettled(page) {
	const map = page.locator("#place-map");
	await map.waitFor({ state: "visible" });
	await page.waitForFunction(() =>
		["ready", "fallback"].includes(
			document.querySelector("#place-map")?.dataset.mapState ?? "",
		),
	);
	const state = await map.getAttribute("data-map-state");
	if (!state || !["ready", "fallback"].includes(state)) {
		throw new Error(`place map did not settle: ${state}`);
	}
	const box = await map.boundingBox();
	if (!box || box.width < 300 || box.height < 240) {
		throw new Error("place map canvas is too small");
	}
	if (
		state === "fallback" &&
		(await map.locator(".place-map-fallback__pin").count()) === 0
	) {
		throw new Error("place map fallback has no location pins");
	}
	return state;
}

async function installAmapStub(page) {
	await page.evaluate(() => {
		class StubMap {
			constructor(container) {
				const surface = document.createElement("div");
				surface.dataset.amapStub = "true";
				surface.style.cssText = "position:absolute;inset:0;background:#dde7df";
				container.append(surface);
			}
			add() {}
			setFitView() {}
			resize() {}
		}
		class StubMarker {
			constructor(options) {
				this.options = options;
			}
			on() {}
			getPosition() {
				return this.options.position;
			}
		}
		window.AMap = {
			Map: StubMap,
			Marker: StubMarker,
			MarkerCluster: class {},
			Pixel: class {},
			InfoWindow: class {
				open() {}
			},
		};
	});
}

async function canvasHasContent(canvas) {
	return canvas.evaluate((element) => {
		const context = element.getContext("2d", { willReadFrequently: true });
		if (!context || element.width === 0 || element.height === 0) return false;
		const width = Math.min(element.width, 320);
		const height = Math.min(element.height, 240);
		const pixels = context.getImageData(0, 0, width, height).data;
		let minimum = Number.POSITIVE_INFINITY;
		let maximum = Number.NEGATIVE_INFINITY;
		for (let index = 0; index < pixels.length; index += 4) {
			const value = pixels[index] + pixels[index + 1] + pixels[index + 2];
			minimum = Math.min(minimum, value);
			maximum = Math.max(maximum, value);
		}
		return maximum - minimum > 8;
	});
}

async function checkPosts(page) {
	await page.goto(`${baseUrl}/list/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	const articleCards = page.locator(".article-feed-card");
	await articleCards.first().waitFor({ state: "visible" });
	if ((await articleCards.count()) === 0) {
		throw new Error("article feed did not render any posts");
	}
	await articleCards.first().locator(".article-feed-card__title").waitFor({
		state: "visible",
	});
	const firstCover = articleCards
		.first()
		.locator(".article-feed-card__media img");
	await firstCover.waitFor({ state: "visible" });
	if (
		!(await firstCover.evaluate(
			(image) => image.complete && image.naturalWidth > 0,
		))
	) {
		throw new Error("article cover did not decode");
	}
	const firstCoverPath = new URL(await firstCover.getAttribute("src"), baseUrl)
		.pathname;
	if (
		!/^\/assets\/illustrations\/(?:eva|wuthering-waves|mushoku-tensei|fate-throne)\//.test(
			firstCoverPath,
		)
	) {
		throw new Error(`article cover is outside albums 01-04: ${firstCoverPath}`);
	}
	const feed = page.locator(".article-feed");
	const layoutSwitch = page.locator(".article-layout-switch");
	if ((await layoutSwitch.locator(".inline-icon svg").count()) !== 1) {
		throw new Error("skull article layout switch icon is missing");
	}
	let layout = await feed.getAttribute("data-layout");
	if (page.viewportSize()?.width >= 1200) {
		if (layout !== "grid") {
			await layoutSwitch.click();
			await page.waitForFunction(
				() =>
					document.querySelector(".article-feed")?.dataset.layout === "grid",
			);
			layout = "grid";
		}
		const columns = await feed.evaluate(
			(element) =>
				getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean)
					.length,
		);
		if (columns !== 3) {
			throw new Error(
				`1440px article grid must have three columns, got ${columns}`,
			);
		}
		await layoutSwitch.click();
		if ((await feed.getAttribute("data-layout")) === layout) {
			throw new Error("article layout switch did not change the layout");
		}
		await layoutSwitch.click();
		if ((await feed.getAttribute("data-layout")) !== "grid") {
			throw new Error("article layout switch did not restore the grid");
		}
	} else if (layout !== "list") {
		throw new Error("mobile article layout must remain a list");
	}

	const nextPage = page.locator(".article-list-pagination__btn").last();
	if (await nextPage.isVisible()) {
		await nextPage.click();
		if (
			(
				await page
					.locator(".article-list-pagination__page.is-active")
					.textContent()
			)?.trim() !== "2"
		) {
			throw new Error("article list pagination did not advance");
		}
		await page.locator(".article-list-pagination__page").first().click();
	}

	const firstPostUrl = await articleCards
		.first()
		.locator(".article-feed-card__title")
		.getAttribute("href");
	if (!firstPostUrl) throw new Error("article detail link is missing");
	const postResponse = await page.goto(new URL(firstPostUrl, baseUrl).href, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	if (!postResponse || postResponse.status() >= 400) {
		throw new Error(
			`article detail returned ${postResponse?.status() ?? "no response"}`,
		);
	}
	await page.locator("#post-container").waitFor({ state: "visible" });
	const detailCover = page.locator("#post-cover img, img#post-cover").first();
	await detailCover.waitFor({ state: "visible" });
	const detailCoverPath = new URL(
		await detailCover.getAttribute("src"),
		baseUrl,
	).pathname;
	if (
		!/^\/assets\/illustrations\/(?:eva|wuthering-waves|mushoku-tensei|fate-throne)\//.test(
			detailCoverPath,
		)
	) {
		throw new Error(
			`article detail cover is outside albums 01-04: ${detailCoverPath}`,
		);
	}

	await page.goto(`${baseUrl}/categories/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	const categoryCanvas = page.locator("category-rose canvas");
	const graphCanvas = page.locator("tag-graph canvas");
	await categoryCanvas.waitFor({ state: "visible" });
	await graphCanvas.waitFor({ state: "visible" });
	await page.waitForFunction(
		() =>
			document.querySelector("category-rose")?.dataset.chartReady === "true" &&
			document.querySelector("tag-graph")?.dataset.chartReady === "true",
		undefined,
		{ timeout: 15_000 },
	);
	if (!(await canvasHasContent(categoryCanvas))) {
		throw new Error("category chart canvas is blank");
	}
	if (!(await canvasHasContent(graphCanvas))) {
		throw new Error("tag graph canvas is blank");
	}

	const categoryUrl = await page
		.locator(".category-rose__list-item")
		.first()
		.getAttribute("href");
	if (!categoryUrl) throw new Error("category archive link is missing");
	await page.goto(new URL(categoryUrl, baseUrl).href, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	if ((await page.locator(".archive-panel .ap-post-link").count()) === 0) {
		throw new Error("category archive filter returned no posts");
	}
}

async function checkCollections(page) {
	await page.evaluate(() =>
		localStorage.removeItem("collections:selected-category"),
	);
	await page.goto(`${baseUrl}/collections/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});

	const directory = page.locator("collection-directory");
	await directory.waitFor({ state: "visible" });
	const tabs = directory.locator("[data-tools-tab]");
	if ((await tabs.count()) < 2)
		throw new Error("collection categories are unavailable");

	await tabs.first().focus();
	await page.keyboard.press("ArrowRight");
	const selectedCategory = await tabs.nth(1).getAttribute("data-tools-tab");
	if (
		!selectedCategory ||
		(await tabs.nth(1).getAttribute("aria-selected")) !== "true"
	) {
		throw new Error(
			"collection keyboard navigation did not select the next category",
		);
	}
	if (!page.url().endsWith(`#tools-${encodeURIComponent(selectedCategory)}`)) {
		throw new Error("collection category was not reflected in the URL hash");
	}
	const visibleGroups = directory.locator(
		"[data-tools-category-group]:visible",
	);
	if ((await visibleGroups.count()) !== 1) {
		throw new Error("collection filter did not isolate one category");
	}
	const storedCategory = await page.evaluate(() =>
		localStorage.getItem("collections:selected-category"),
	);
	if (storedCategory !== selectedCategory) {
		throw new Error("collection category was not persisted");
	}

	await page.goto(`${baseUrl}/collections/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	await directory.waitFor({ state: "visible" });
	if (
		(await directory
			.locator(`[data-tools-tab="${selectedCategory}"]`)
			.getAttribute("aria-selected")) !== "true"
	) {
		throw new Error("collection category was not restored from local storage");
	}
	const clock = directory.locator("[data-tools-clock]");
	if (!(await clock.textContent())?.match(/\d{2}:\d{2}:\d{2}/)) {
		throw new Error("collection Beijing clock is missing");
	}
}

async function checkGallery(page) {
	await page.goto(`${baseUrl}/album/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	const albums = page.locator(".collection-album-card");
	await albums.first().waitFor({ state: "visible" });
	const detailUrl = await albums.first().getAttribute("href");
	if (!detailUrl?.startsWith("/album/") || !detailUrl.endsWith("/")) {
		throw new Error(`album detail link is invalid: ${detailUrl}`);
	}
	await page.goto(new URL(detailUrl, baseUrl).href, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	if ((await page.locator(".album-detail__grid a").count()) === 0) {
		throw new Error("album detail did not render photos");
	}
	if (!(await page.locator(".album-detail__back").isVisible())) {
		throw new Error("album detail back link is missing");
	}
}

async function checkRss(page) {
	await page.goto(`${baseUrl}/rss/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	const copy = page.locator("rss-copy [data-rss-copy]");
	if (!(await copy.isVisible()))
		throw new Error("RSS copy control is unavailable");
	const feedUrl = await copy.getAttribute("data-url");
	if (!feedUrl?.endsWith("/rss.xml")) {
		throw new Error(`RSS feed URL is invalid: ${feedUrl}`);
	}
	if ((await page.locator(".rss-post-card").count()) === 0) {
		throw new Error("RSS recent posts are unavailable");
	}
}

async function checkAdminApiSecurity(page) {
	const expectedStatus =
		process.env.E2E_ADMIN_CONFIGURED === "true" ? 401 : 503;
	for (const resource of ["notebook", "activity"]) {
		const publicResponse = await page.request.get(
			`${baseUrl}/api/${resource}/`,
		);
		if (publicResponse.status() !== 200) {
			throw new Error(
				`${resource} public GET returned ${publicResponse.status()}`,
			);
		}
		const checkResponse = await page.request.get(
			`${baseUrl}/api/${resource}/admin-check/`,
		);
		if (checkResponse.status() !== expectedStatus) {
			throw new Error(
				`${resource} admin check returned ${checkResponse.status()}`,
			);
		}
		const writeResponse = await page.request.post(
			`${baseUrl}/api/${resource}/`,
			{
				data: {},
			},
		);
		if (writeResponse.status() !== expectedStatus) {
			throw new Error(
				`${resource} unauthenticated write returned ${writeResponse.status()}`,
			);
		}
	}
}

async function checkRemovedRoutes(page) {
	for (const route of removedRoutes) {
		const response = await page.request.get(`${baseUrl}${route}`);
		if (response.status() !== 404) {
			throw new Error(`${route} returned ${response.status()} instead of 404`);
		}
	}
}

/*
 * Superseded Xiao reference checks. The active assertion below targets the
 * vampire SoulLink runtime instead of the removed static workspace.
async function checkLegacyXiaoHub(browser, viewport) {
	const page = await browser.newPage({ viewport });
	await page.addInitScript(() => {
		const NativeDate = Date;
		const fixedTime = NativeDate.parse("2026-07-23T06:05:00.000Z");
		class FixedDate extends NativeDate {
			constructor(...args) {
				super(...(args.length > 0 ? args : [fixedTime]));
			}
			static now() {
				return fixedTime;
			}
		}
		window.Date = FixedDate;
	});
	try {
		const response = await page.goto(`${baseUrl}/live2D/`, {
			waitUntil: "commit",
			timeout: 60_000,
		});
		if (!response || response.status() >= 400) {
			throw new Error(`Xiao returned HTTP ${response?.status()}`);
		}
		await page.locator(".xiao-stage").waitFor({ state: "visible" });
		await page
			.locator('.xiao-stage__model-state[data-model-mode="live2d"]')
			.waitFor({ state: "visible", timeout: 120_000 });
		await page.locator("[data-live2d-host] canvas").waitFor({ state: "attached" });
		if (await page.locator("[data-model-fallback]").count()) {
			throw new Error("Xiao Live2D used its fallback state");
		}
		return;

		await page.goto(`${baseUrl}/live2D/`, {
			waitUntil: "domcontentloaded",
			timeout: 60_000,
		});
		await page.locator(".xiao-hub").waitFor({ state: "visible" });
		await page.waitForFunction(
			() => document.querySelectorAll(".xiao-thoughts article").length === 2,
		);
		const thoughtIds = await page
			.locator(".xiao-thoughts article")
			.evaluateAll((items) => items.map((item) => item.id));
		if (
			JSON.stringify(thoughtIds) !==
			JSON.stringify(["xiao-2026-07-23-morning", "xiao-2026-07-23-afternoon"])
		) {
			throw new Error(
				`unexpected Xiao thoughts: ${JSON.stringify(thoughtIds)}`,
			);
		}
		if ((await page.locator(".xiao-video iframe").count()) !== 0) {
			throw new Error("Bilibili iframe loaded before entering the viewport");
		}
		await page.locator(".xiao-video").first().scrollIntoViewIfNeeded();
		await page
			.locator(".xiao-video iframe")
			.first()
			.waitFor({ state: "attached" });

		const stage = page.locator(".xiao-stage");
		await stage.waitFor({ state: "attached" });
		await page.waitForFunction(
			() => document.querySelector(".xiao-stage")?.dataset.modelMode === "static",
			undefined,
			{ timeout: 5_000 },
		);
		if (
			(await stage.locator(".xiao-stage__model-state strong").textContent())
				?.trim() !== "STATIC PREVIEW"
		) {
			throw new Error("Xiao static model state is missing");
		}
		const posterLoaded = await stage.locator("[data-xiao-character-art] img").evaluate(
			(image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
		);
		if (!posterLoaded) throw new Error("Xiao stage poster failed to load");
		if (
			(await page
				.locator(
					"#pio, #live2d-widget, #live2d-trigger, #floating-dock, #mobile-dock, #mobile-dock-sheet",
				)
				.count()) !== 0
		) {
			throw new Error("legacy Live2D or dock shell leaked into the Xiao workspace");
		}

		await page.goto(`${baseUrl}/moments/`, {
			waitUntil: "domcontentloaded",
			timeout: 60_000,
		});
		if ((await page.locator(".moment-card--xiao").count()) !== 0) {
			throw new Error("Xiao thoughts must not be mixed into the moments feed");
		}
	} finally {
		await page.close();
	}
}

*/
async function checkXiaoHub(browser, viewport) {
	const page = await browser.newPage({ viewport });
	await blockExternalSubresources(page);
	try {
		await page.goto(`${baseUrl}/live2D/`, {
			waitUntil: "domcontentloaded",
			timeout: 60_000,
		});
		await page.locator(".xiao-hub").waitFor({ state: "visible" });
		const stage = page.locator(".xiao-stage");
		await stage.waitFor({ state: "attached" });
		await page.waitForFunction(
			() => {
				const host = document.querySelector("[data-live2d-host]");
				return (
					host instanceof HTMLElement &&
					["live2d", "fallback"].includes(host.dataset.modelMode ?? "")
				);
			},
			undefined,
			{ timeout: 120_000 },
		);
		const soulLinkHost = stage.locator("[data-live2d-host]");
		const modelMode = await soulLinkHost.getAttribute("data-model-mode");
		if (!new Set(["live2d", "fallback"]).has(modelMode)) {
			throw new Error(`unexpected SoulLink model mode: ${modelMode}`);
		}
		if (process.env.E2E_REQUIRE_LIVE2D === "1" && modelMode !== "live2d") {
			throw new Error("configured SoulLink model did not load as Live2D");
		}
		if ((await soulLinkHost.getAttribute("data-phase")) !== "idle") {
			throw new Error("SoulLink stage did not reach the idle phase");
		}
		if (!(await soulLinkHost.getAttribute("data-emotion"))) {
			throw new Error("SoulLink stage did not expose an emotion state");
		}
		if ((await stage.locator("[data-xiao-character-art]").count()) !== 0) {
			throw new Error(
				"legacy static character art leaked into the vampire stage",
			);
		}
		const chat = page.getByLabel("和吸血鬼对话");
		if (
			(await chat
				.locator(".xiao-chat__transcript")
				.getAttribute("aria-live")) !== "polite"
		) {
			throw new Error("vampire chat transcript is not announced politely");
		}
		if (
			(await chat
				.getByRole("textbox", { name: "写给吸血鬼", includeHidden: true })
				.count()) !== 1
		) {
			throw new Error("vampire chat composer is not accessible");
		}
		if (
			(await page
				.locator(
					"#pio, #live2d-widget, #live2d-trigger, #floating-dock, #mobile-dock, #mobile-dock-sheet",
				)
				.count()) !== 0
		) {
			throw new Error(
				"legacy Live2D or dock shell leaked into the vampire workspace",
			);
		}
	} finally {
		await page.close();
	}
}

async function checkAdminStudios(browser, viewport) {
	const token = process.env.E2E_BLOG_ADMIN_TOKEN;
	if (!token) return;
	const page = await browser.newPage({ viewport });
	await blockExternalSubresources(page);
	try {
		await page.goto(`${baseUrl}/write/`, {
			waitUntil: "domcontentloaded",
			timeout: 60_000,
		});
		await page.getByLabel("管理员 Token").fill(token);
		await page.getByRole("button", { name: "进入", exact: true }).click();
		await page.getByRole("heading", { name: "文章工作台" }).waitFor();
		await page.getByLabel("标题").fill("Playwright 草稿");
		await page.getByLabel("Slug").fill("playwright-draft");
		await page.getByLabel("摘要").fill("用于浏览器回归的临时草稿。");
		await page
			.getByLabel("Markdown 正文")
			.fill("# 浏览器回归\n\n预览内容已生成。");
		await page.getByTitle("保存草稿").click();
		await page.getByText("草稿已保存", { exact: true }).waitFor();
		await page.getByTitle("更新预览").click();
		await page.getByText("预览内容已生成。", { exact: true }).waitFor();
		page.once("dialog", (dialog) => dialog.accept());
		await page.getByRole("button", { name: "删除当前草稿" }).click();
		await page.getByText("草稿已删除", { exact: true }).waitFor();

		await page.goto(`${baseUrl}/config/`, {
			waitUntil: "domcontentloaded",
			timeout: 60_000,
		});
		await page.getByRole("heading", { name: "公开配置" }).waitFor();
		if (
			(await page.getByText(/GITHUB_CONTENT_TOKEN|BLOG_ADMIN_TOKEN/).count()) >
			0
		) {
			throw new Error("secret field is visible in public config studio");
		}
	} finally {
		await page.close();
	}
}

for (const viewport of viewports) {
	const page = await browser.newPage({ viewport });
	await blockExternalSubresources(page);
	const runtimeErrors = [];
	page.on("pageerror", (error) =>
		runtimeErrors.push(`pageerror: ${error.message}`),
	);
	page.on("console", (message) => {
		if (message.type() === "error" && !isExpectedExternalFailure(message)) {
			const source = message.location().url;
			runtimeErrors.push(
				`console: ${message.text()}${source ? ` (${source})` : ""}`,
			);
		}
	});

	for (const route of routes) {
		runtimeErrors.length = 0;
		const contentSelector =
			route === "/live2D/" ? "[data-xiao-shell]" : "#content-wrapper";
		try {
			const response = await page.goto(`${baseUrl}${route}`, {
				waitUntil: "domcontentloaded",
				timeout: 60_000,
			});
			await page.waitForFunction(
				(selector) => {
					const content = document.querySelector(selector);
					return !content || Number(getComputedStyle(content).opacity) >= 0.95;
				},
				contentSelector,
				{ timeout: 5_000 },
			);
			const metrics = await page.evaluate(
				(selector) => ({
					title: document.title,
					bodyTextLength: document.body?.innerText.length ?? 0,
					scrollWidth: document.documentElement.scrollWidth,
					innerWidth: window.innerWidth,
					unnamedButtons: [...document.querySelectorAll("button")]
						.filter((button) => {
							const rect = button.getBoundingClientRect();
							const style = getComputedStyle(button);
							const visible =
								rect.width > 0 &&
								rect.height > 0 &&
								style.display !== "none" &&
								style.visibility !== "hidden";
							const named = Boolean(
								button.textContent?.trim() ||
									button.getAttribute("aria-label") ||
									button.getAttribute("aria-labelledby") ||
									button.getAttribute("title"),
							);
							return visible && !named;
						})
						.map((button) =>
							button.id
								? `#${button.id}`
								: `.${[...button.classList].join(".")}`,
						),
					content: (() => {
						const element = document.querySelector(selector);
						if (!element) return null;
						const rect = element.getBoundingClientRect();
						return {
							opacity: Number(getComputedStyle(element).opacity),
							width: rect.width,
							height: rect.height,
							textLength: element.textContent?.trim().length ?? 0,
						};
					})(),
				}),
				contentSelector,
			);
			if (!response || response.status() >= 400) {
				throw new Error(`HTTP ${response?.status() ?? "no response"}`);
			}
			if (metrics.bodyTextLength === 0) throw new Error("empty document body");
			if (
				!metrics.content ||
				metrics.content.opacity < 0.95 ||
				metrics.content.width < 100 ||
				metrics.content.height < 40 ||
				metrics.content.textLength === 0
			) {
				throw new Error(
					`main content is not visible: ${JSON.stringify(metrics.content)}`,
				);
			}
			if (metrics.scrollWidth > metrics.innerWidth + 1) {
				throw new Error(
					`horizontal overflow (${metrics.scrollWidth} > ${metrics.innerWidth})`,
				);
			}
			if (metrics.unnamedButtons.length > 0) {
				throw new Error(
					`visible buttons have no accessible name: ${metrics.unnamedButtons.join(", ")}`,
				);
			}
			if (runtimeErrors.length > 0) {
				throw new Error(runtimeErrors.join(" | "));
			}
			console.log(
				`${viewport.name} ${route} OK ${JSON.stringify({ status: response.status(), title: metrics.title })}`,
			);
		} catch (error) {
			failures.push(`${viewport.name} ${route}: ${error.message}`);
			console.error(`FAIL ${viewport.name} ${route}: ${error.message}`);
		}
	}
	try {
		await checkApplicationShell(page, viewport.name);
		console.log(`${viewport.name} application shell OK`);
	} catch (error) {
		failures.push(`${viewport.name} application shell: ${error.message}`);
		console.error(`FAIL ${viewport.name} application shell: ${error.message}`);
	}
	try {
		await checkFriends(page);
		console.log(`${viewport.name} friends interactions OK`);
	} catch (error) {
		failures.push(`${viewport.name} friends interactions: ${error.message}`);
		console.error(
			`FAIL ${viewport.name} friends interactions: ${error.message}`,
		);
	}
	try {
		await checkGuestbook(page);
		console.log(`${viewport.name} guestbook interactions OK`);
	} catch (error) {
		failures.push(`${viewport.name} guestbook interactions: ${error.message}`);
		console.error(
			`FAIL ${viewport.name} guestbook interactions: ${error.message}`,
		);
	}
	try {
		await checkSearch(page);
		console.log(`${viewport.name} search interactions OK`);
	} catch (error) {
		failures.push(`${viewport.name} search interactions: ${error.message}`);
		console.error(
			`FAIL ${viewport.name} search interactions: ${error.message}`,
		);
	}
	try {
		await checkMusic(page, viewport.name);
		console.log(`${viewport.name} music interactions OK`);
	} catch (error) {
		failures.push(`${viewport.name} music interactions: ${error.message}`);
		console.error(`FAIL ${viewport.name} music interactions: ${error.message}`);
	}
	try {
		await checkNotebook(page);
		console.log(`${viewport.name} notebook interactions OK`);
	} catch (error) {
		failures.push(`${viewport.name} notebook interactions: ${error.message}`);
		console.error(
			`FAIL ${viewport.name} notebook interactions: ${error.message}`,
		);
	}
	try {
		await checkActivity(page);
		console.log(`${viewport.name} activity interactions OK`);
	} catch (error) {
		failures.push(`${viewport.name} activity interactions: ${error.message}`);
		console.error(
			`FAIL ${viewport.name} activity interactions: ${error.message}`,
		);
	}
	try {
		await checkCalendar(page);
		console.log(`${viewport.name} calendar interactions OK`);
	} catch (error) {
		failures.push(`${viewport.name} calendar interactions: ${error.message}`);
		console.error(
			`FAIL ${viewport.name} calendar interactions: ${error.message}`,
		);
	}
	try {
		await checkPlaces(page);
		console.log(`${viewport.name} places interactions OK`);
	} catch (error) {
		failures.push(`${viewport.name} places interactions: ${error.message}`);
		console.error(
			`FAIL ${viewport.name} places interactions: ${error.message}`,
		);
	}
	try {
		await checkPosts(page);
		console.log(`${viewport.name} posts interactions OK`);
	} catch (error) {
		failures.push(`${viewport.name} posts interactions: ${error.message}`);
		console.error(`FAIL ${viewport.name} posts interactions: ${error.message}`);
	}
	try {
		await checkCollections(page);
		console.log(`${viewport.name} collections interactions OK`);
	} catch (error) {
		failures.push(
			`${viewport.name} collections interactions: ${error.message}`,
		);
		console.error(
			`FAIL ${viewport.name} collections interactions: ${error.message}`,
		);
	}
	try {
		await checkGallery(page);
		console.log(`${viewport.name} gallery interactions OK`);
	} catch (error) {
		failures.push(`${viewport.name} gallery interactions: ${error.message}`);
		console.error(
			`FAIL ${viewport.name} gallery interactions: ${error.message}`,
		);
	}
	try {
		await checkRss(page);
		console.log(`${viewport.name} RSS page OK`);
	} catch (error) {
		failures.push(`${viewport.name} RSS page: ${error.message}`);
		console.error(`FAIL ${viewport.name} RSS page: ${error.message}`);
	}
	try {
		await checkAdminApiSecurity(page);
		console.log(`${viewport.name} admin API security OK`);
	} catch (error) {
		failures.push(`${viewport.name} admin API security: ${error.message}`);
		console.error(`FAIL ${viewport.name} admin API security: ${error.message}`);
	}
	try {
		await checkRemovedRoutes(page);
		console.log(`${viewport.name} removed routes OK`);
	} catch (error) {
		failures.push(`${viewport.name} removed routes: ${error.message}`);
		console.error(`FAIL ${viewport.name} removed routes: ${error.message}`);
	}
	await page.close();
	try {
		await checkXiaoHub(browser, viewport);
		console.log(`${viewport.name} Xiao hub interactions OK`);
	} catch (error) {
		failures.push(`${viewport.name} Xiao hub interactions: ${error.message}`);
		console.error(
			`FAIL ${viewport.name} Xiao hub interactions: ${error.message}`,
		);
	}
	try {
		await checkAdminStudios(browser, viewport);
		console.log(`${viewport.name} admin studios OK`);
	} catch (error) {
		failures.push(`${viewport.name} admin studios: ${error.message}`);
		console.error(`FAIL ${viewport.name} admin studios: ${error.message}`);
	}
}

await browser.close();
if (failures.length > 0) {
	console.error(`\n${failures.length} route checks failed.`);
	process.exit(1);
}
console.log(
	`\nRoute smoke passed: ${routes.length * viewports.length} checks.`,
);
