import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4321";
const localOrigin = new URL(baseUrl).origin;
const browserPath =
	process.env.PLAYWRIGHT_BROWSER ||
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const soulLinkProperties = [
	"--xiao-breath",
	"--xiao-head-x",
	"--xiao-head-y",
	"--xiao-head-z",
	"--xiao-gaze-x",
	"--xiao-gaze-y",
	"--xiao-smile",
	"--xiao-valence",
	"--xiao-arousal",
	"--xiao-dominance",
];
const legacyShellSelector = [
	"#pio",
	"#live2d-widget",
	"#live2d-canvas",
	"#live2d-trigger",
	"#floating-dock",
	"#mobile-dock",
	"#mobile-dock-overlay",
	"#mobile-dock-sheet",
].join(", ");

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

async function installChatStream(page) {
	await page.addInitScript(() => {
		const nativeFetch = window.fetch.bind(window);
		let retryAttempts = 0;
		window.fetch = (input, init = {}) => {
			const requestUrl =
				typeof input === "string"
					? input
					: input instanceof Request
						? input.url
						: String(input);
			const url = new URL(requestUrl, window.location.href);
			if (!/\/api\/ai-chat\/?$/.test(url.pathname)) {
				return nativeFetch(input, init);
			}
			const question = JSON.parse(String(init.body ?? "{}")).question ?? "";
			if (question === "__xiao_e2e_retry__" && ++retryAttempts === 1) {
				return Promise.resolve(
					new Response(JSON.stringify({ error: "temporary test error" }), {
						status: 503,
						headers: { "Content-Type": "application/json" },
					}),
				);
			}
			const replies = {
				__xiao_e2e_soullink__: "已经修好，测试成功。我来检查代码。",
				__xiao_e2e_affection__: "谢谢你，晚安。请鼓起脸颊，嘟嘴亲吻一下。",
				__xiao_e2e_confused__: "我不太确定，需要再确认，露出狡黠的歪嘴。",
				__xiao_e2e_chew__: "一起吃一口蛋糕，慢慢咀嚼。",
				__xiao_e2e_warning__: "危险，立即停止并保护自己。",
				__xiao_e2e_manual_priority__: "已经修好，我来检查代码。",
			};
			const text =
				question === "__xiao_e2e_retry__"
					? "retry complete"
					: (replies[question] ?? "streaming test reply");
			const encoder = new TextEncoder();
			return Promise.resolve(
				new Response(
					new ReadableStream({
						start(controller) {
							if (question === "__xiao_e2e_soullink__") {
								setTimeout(() => {
									controller.enqueue(
										encoder.encode(
											`data: {"type":"chunk","text":"${text}"}\n\n`,
										),
									);
								}, 250);
								setTimeout(() => {
									controller.enqueue(
										encoder.encode('data: {"type":"done"}\n\n'),
									);
									controller.close();
								}, 900);
								return;
							}
							setTimeout(() => {
								controller.enqueue(
									encoder.encode(
										`data: {"type":"chunk","text":"${text}"}\n\ndata: {"type":"done"}\n\n`,
									),
								);
								controller.close();
							}, 250);
						},
					}),
					{ headers: { "Content-Type": "text/event-stream; charset=utf-8" } },
				),
			);
		};
	});
}

async function openXiaoPage(browser, viewport, contextOptions = {}) {
	const context = await browser.newContext({
		viewport,
		...contextOptions,
	});
	await context.addInitScript(() => {
		sessionStorage.setItem("blog:vampire:intro:v1", "complete");
	});
	const page = await context.newPage();
	const runtimeErrors = [];
	page.on("pageerror", (error) => runtimeErrors.push(error.message));
	page.on("console", (message) => {
		if (message.type() !== "error") return;
		const sourceUrl = message.location().url;
		if (sourceUrl && new URL(sourceUrl, baseUrl).origin !== localOrigin) return;
		runtimeErrors.push(
			`${message.text()} @ ${sourceUrl || "unknown local resource"}`,
		);
	});
	await installChatStream(page);
	await blockExternalSubresources(page);
	const response = await page.goto(`${baseUrl}/live2D/`, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	assert.ok(response && response.status() < 400, `HTTP ${response?.status()}`);
	await page.locator(".xiao-hub").waitFor({ state: "visible" });
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
	return { context, page, runtimeErrors };
}

async function assertSoulLinkStage(page) {
	const stage = page.locator(".xiao-stage");
	const host = stage.locator("[data-live2d-host]");
	const mode = await host.getAttribute("data-model-mode");
	assert.ok(
		["live2d", "fallback"].includes(mode),
		`unexpected model mode ${mode}`,
	);
	if (process.env.E2E_REQUIRE_LIVE2D === "1") {
		assert.equal(
			mode,
			"live2d",
			"the configured source model did not reach SoulLink",
		);
	}
	assert.equal(await host.getAttribute("data-phase"), "idle");
	assert.ok(await host.getAttribute("data-emotion"));
	assert.equal(
		(
			await stage.locator(".xiao-stage__model-state strong").textContent()
		)?.trim(),
		mode === "live2d" ? "LIVE2D" : "LOCAL MODEL",
	);
	assert.equal(await stage.locator("[data-xiao-character-art]").count(), 0);
	if (mode === "live2d") {
		await host.locator("canvas").waitFor({ state: "attached" });
		assert.equal(
			await host.getAttribute("data-missing-parameter-count"),
			"0",
			"the SoulLink profile references a parameter missing from the vampire model",
		);
		const assetAudit = await page.evaluate(async () => {
			const base = "/__local-vampire/v1";
			const manifestResponse = await fetch(`${base}/model.model3.json`);
			const manifest = await manifestResponse.json();
			const references = manifest.FileReferences ?? {};
			const files = [
				references.Moc,
				references.Physics,
				references.DisplayInfo,
				...(references.Textures ?? []),
				...(references.Expressions ?? []).map((entry) => entry.File),
				...Object.values(references.Motions ?? {}).flatMap((entries) =>
					entries.map((entry) => entry.File),
				),
			].filter(Boolean);
			const statuses = await Promise.all(
				files.map(async (file) => ({
					file,
					status: (await fetch(`${base}/${file}`, { method: "HEAD" })).status,
				})),
			);
			return {
				manifestStatus: manifestResponse.status,
				expressions: (references.Expressions ?? []).map((entry) => entry.Name),
				textureCount: references.Textures?.length ?? 0,
				idleMotionCount: references.Motions?.Idle?.length ?? 0,
				statuses,
			};
		});
		assert.equal(assetAudit.manifestStatus, 200);
		assert.equal(assetAudit.textureCount, 4);
		assert.equal(assetAudit.idleMotionCount, 1);
		assert.deepEqual(assetAudit.expressions.sort(), [
			"blood-body",
			"blood-face",
			"circleeyes",
			"click",
			"hearteyes",
			"knife",
			"mad",
			"mc",
			"mouse",
			"neutral-reset",
			"sad",
			"shy",
			"stareyes",
		]);
		assert.deepEqual(
			assetAudit.statuses.filter((entry) => entry.status !== 200),
			[],
			`local vampire assets failed: ${JSON.stringify(assetAudit.statuses)}`,
		);
	} else {
		await stage.locator("[data-model-fallback]").waitFor({ state: "visible" });
	}

	const values = await host.evaluate((element, properties) => {
		return properties.map((property) =>
			element.style.getPropertyValue(property),
		);
	}, soulLinkProperties);
	assert.ok(
		values.every((value) => value !== "" && Number.isFinite(Number(value))),
		`SoulLink CSS variables are incomplete: ${JSON.stringify(values)}`,
	);
	return { host, mode };
}

async function assertWorkspaceIsolation(page) {
	assert.equal(await page.locator(legacyShellSelector).count(), 0);
	const metrics = await page.evaluate(() => {
		const shell = document.querySelector("[data-xiao-shell]");
		const bounds = shell?.getBoundingClientRect();
		return {
			scrollWidth: document.documentElement.scrollWidth,
			scrollHeight: document.documentElement.scrollHeight,
			innerWidth: window.innerWidth,
			innerHeight: window.innerHeight,
			shell: bounds
				? {
						x: bounds.x,
						y: bounds.y,
						width: bounds.width,
						height: bounds.height,
					}
				: null,
		};
	});
	assert.ok(
		metrics.scrollWidth <= metrics.innerWidth + 1,
		"horizontal overflow",
	);
	assert.ok(
		metrics.scrollHeight <= metrics.innerHeight + 1,
		"vertical overflow",
	);
	assert.deepEqual(metrics.shell, {
		x: 0,
		y: 0,
		width: metrics.innerWidth,
		height: metrics.innerHeight,
	});
}

async function assertAccessibleChat(page) {
	const chat = page.getByLabel("和吸血鬼对话");
	assert.equal(await chat.getAttribute("aria-label"), "和吸血鬼对话");
	assert.equal(
		await chat.locator(".xiao-chat__transcript").getAttribute("aria-live"),
		"polite",
	);
	assert.equal(
		await chat
			.getByRole("textbox", { name: "写给吸血鬼", includeHidden: true })
			.count(),
		1,
	);
	return chat;
}

async function assertNativeVampireControls(page, host, stage, chat) {
	await page.getByRole("button", { name: "表情与动作" }).click();
	const library = page.getByLabel("模型表情与动作");
	await library.waitFor({ state: "visible" });

	for (const [label, expression, parameterIds] of [
		["脸红", "shy", ["PARAMSHY"]],
		[
			"哭哭",
			"sad",
			[
				"PARAMTEARS",
				"PARAM_BROW_L_Y",
				"PARAM_BROW_L_FORM",
				"PARAM_BROW_R_FORM",
				"PARAM_BROW_R_Y",
			],
		],
		["黑脸生气", "mad", ["PARAMANGRY"]],
		["爱心眼", "hearteyes", ["PARAMhearteye"]],
		["星星眼", "stareyes", ["PARAMstareye"]],
		["蚊香眼", "circleeyes", ["PARAMWHITEEYE"]],
	]) {
		await library.getByRole("button", { name: label, exact: true }).click();
		assert.equal(
			await host.getAttribute("data-performance-expression"),
			expression,
		);
		assert.equal(
			await host.getAttribute("data-native-animation-expression"),
			expression,
		);
		assert.deepEqual(
			(await host.getAttribute("data-native-suppressed-parameters"))
				.split(",")
				.sort(),
			[...parameterIds].sort(),
			`${label} did not reach its authored exp3 parameter set`,
		);
	}
	for (const [label, id, parameterDataset] of [
		["麦克风", "mc", "nativeHandsMc"],
		["数位板", "mouse", "nativeHandsTablet"],
		["捧脸美工刀", "knife", "nativeHandsKnife"],
		["点击", "click", "nativeClick"],
	]) {
		await library.getByRole("button", { name: label, exact: true }).click();
		assert.equal(await host.getAttribute("data-performance-action"), id);
		assert.equal(
			await host.evaluate(
				(element, key) => Number(element.dataset[key]),
				parameterDataset,
			),
			1,
			`${label} did not reach its native Live2D parameter`,
		);
	}
	for (const [label, id, parameterDataset] of [
		["面部血迹", "blood-face", "nativeBloodFace"],
		["身体血迹", "blood-body", "nativeBloodBody"],
	]) {
		await library.getByRole("button", { name: label, exact: true }).click();
		assert.match(
			await host.getAttribute("data-performance-effects"),
			new RegExp(id),
		);
		assert.equal(
			await host.evaluate(
				(element, key) => Number(element.dataset[key]),
				parameterDataset,
			),
			1,
			`${label} did not reach its native Live2D parameter`,
		);
	}
	await library.getByRole("button", { name: "全部复位" }).click();
	assert.equal(await host.getAttribute("data-performance-expression"), "none");
	assert.equal(await host.getAttribute("data-performance-action"), "none");
	assert.equal(await host.getAttribute("data-performance-effects"), "none");
	await page.getByRole("button", { name: "表情与动作" }).click();

	await page.getByRole("button", { name: "装扮", exact: true }).click();
	const cosmeticsPanel = page.getByLabel("人物装扮面板");
	await cosmeticsPanel.waitFor({ state: "visible" });
	let cosmetics = JSON.parse(await host.getAttribute("data-cosmetics"));
	assert.equal(Object.keys(cosmetics).length, 17);

	await cosmeticsPanel.getByRole("button", { name: "白色形态" }).click();
	cosmetics = JSON.parse(await host.getAttribute("data-cosmetics"));
	assert.deepEqual(
		[cosmetics.outfitWhite, cosmetics.hairWhite, cosmetics.accessoryWhite],
		[1, 1, 1],
	);
	for (const [label, key] of [
		["发色", "hairWhite"],
		["发饰", "accessoryWhite"],
		["服装", "outfitWhite"],
	]) {
		const row = cosmeticsPanel.locator(".xiao-customize__row").filter({
			hasText: label,
		});
		await row.getByRole("button", { name: "黑", exact: true }).click();
		assert.equal(JSON.parse(await host.getAttribute("data-cosmetics"))[key], 0);
		await row.getByRole("button", { name: "白", exact: true }).click();
		assert.equal(JSON.parse(await host.getAttribute("data-cosmetics"))[key], 1);
	}
	await cosmeticsPanel.getByRole("button", { name: "黑色形态" }).click();

	const setCosmeticRange = async (label, value) => {
		const slider = cosmeticsPanel
			.locator("label")
			.filter({ hasText: label })
			.locator('input[type="range"]');
		assert.equal(await slider.count(), 1, `${label} slider is not unique`);
		await slider.evaluate((input, nextValue) => {
			input.value = String(nextValue);
			input.dispatchEvent(new Event("input", { bubbles: true }));
		}, value);
	};

	await setCosmeticRange("M 字刘海长度", -0.55);
	for (const label of ["创口贴", "环形", "十字架"]) {
		await cosmeticsPanel
			.getByRole("checkbox", { name: label, exact: true })
			.check();
	}
	cosmetics = JSON.parse(await host.getAttribute("data-cosmetics"));
	assert.deepEqual(
		[
			cosmetics.mBangsLength,
			cosmetics.hairpin1,
			cosmetics.hairpin2,
			cosmetics.hairpin3,
		],
		[-0.55, 1, 1, 1],
	);

	await cosmeticsPanel.getByRole("button", { name: "齐刘海" }).click();
	cosmetics = JSON.parse(await host.getAttribute("data-cosmetics"));
	assert.equal(cosmetics.bangsStyle, 1);
	assert.equal(cosmetics.hairpin2, 0);
	assert.equal(
		await cosmeticsPanel.getByRole("checkbox", { name: "环形" }).isDisabled(),
		true,
	);
	await setCosmeticRange("齐刘海长度", 0.45);
	await cosmeticsPanel.getByRole("button", { name: "M 字刘海" }).click();
	await cosmeticsPanel.getByRole("checkbox", { name: "环形" }).check();
	await cosmeticsPanel.getByRole("checkbox", { name: "呆毛" }).uncheck();
	await cosmeticsPanel.getByRole("checkbox", { name: "长发" }).check();

	for (const [label, expected] of [
		["无马尾", [0, 0, 0]],
		["左单", [1, 1, 0]],
		["右单", [1, 0, 1]],
		["双马尾", [1, 1, 1]],
	]) {
		await cosmeticsPanel.getByRole("button", { name: label }).click();
		cosmetics = JSON.parse(await host.getAttribute("data-cosmetics"));
		assert.deepEqual(
			[cosmetics.ponytails, cosmetics.ponytailLeft, cosmetics.ponytailRight],
			expected,
		);
	}

	await setCosmeticRange("侧发长度", 0.65);
	await setCosmeticRange("马尾长度", -0.4);
	await setCosmeticRange("长发长度", 0.55);
	cosmetics = JSON.parse(await host.getAttribute("data-cosmetics"));
	assert.deepEqual(
		{
			ahoge: cosmetics.ahoge,
			straightBangsLength: cosmetics.straightBangsLength,
			mBangsLength: cosmetics.mBangsLength,
			sideHairLength: cosmetics.sideHairLength,
			ponytailLength: cosmetics.ponytailLength,
			longHair: cosmetics.longHair,
			longHairLength: cosmetics.longHairLength,
		},
		{
			ahoge: 0,
			straightBangsLength: 0.45,
			mBangsLength: -0.55,
			sideHairLength: 0.65,
			ponytailLength: -0.4,
			longHair: 1,
			longHairLength: 0.55,
		},
	);
	await cosmeticsPanel.getByRole("button", { name: "恢复原装" }).click();
	cosmetics = JSON.parse(await host.getAttribute("data-cosmetics"));
	assert.deepEqual(cosmetics, {
		outfitWhite: 0,
		hairWhite: 0,
		accessoryWhite: 0,
		ahoge: 1,
		bangsStyle: 0,
		straightBangsLength: 0,
		mBangsLength: 0,
		sideHairLength: 0,
		ponytailLeft: 1,
		ponytailRight: 1,
		ponytails: 1,
		ponytailLength: 0,
		longHair: 0,
		longHairLength: 0,
		hairpin1: 0,
		hairpin2: 0,
		hairpin3: 0,
	});
	await cosmeticsPanel.getByRole("button", { name: "关闭装扮" }).click();

	const bounds = await stage.boundingBox();
	assert.ok(bounds, "stage bounds unavailable for pointer mapping");
	await page.mouse.move(
		bounds.x + bounds.width * 0.2,
		bounds.y + bounds.height * 0.32,
	);
	await page.waitForTimeout(650);
	const pointerLeft = await host.evaluate((element) => ({
		eyeX: Number(element.dataset.nativeEyeX),
		eyeY: Number(element.dataset.nativeEyeY),
		headX: Number(element.dataset.nativeHeadX),
		headY: Number(element.dataset.nativeHeadY),
	}));
	await page.mouse.move(
		bounds.x + bounds.width * 0.8,
		bounds.y + bounds.height * 0.32,
	);
	await page.waitForTimeout(650);
	const pointerRight = await host.evaluate((element) => ({
		eyeX: Number(element.dataset.nativeEyeX),
		eyeY: Number(element.dataset.nativeEyeY),
		headX: Number(element.dataset.nativeHeadX),
		headY: Number(element.dataset.nativeHeadY),
	}));
	assert.ok(
		pointerRight.eyeX - pointerLeft.eyeX > 0.7,
		"eyes did not follow the pointer",
	);
	assert.ok(
		pointerRight.headX - pointerLeft.headX > 3,
		"head did not follow the pointer",
	);
	await page.mouse.move(10, 10);
	await page.waitForTimeout(40);
	const pointerExit = await host.evaluate((element) => ({
		eyeY: Number(element.dataset.nativeEyeY),
		headY: Number(element.dataset.nativeHeadY),
		active: element.dataset.pointerActive,
	}));
	assert.equal(pointerExit.active, "false");
	assert.equal(
		Math.sign(pointerExit.eyeY),
		Math.sign(pointerRight.eyeY),
		"eye Y flipped direction when the pointer left the stage",
	);
	assert.ok(
		Math.abs(pointerExit.eyeY - pointerRight.eyeY) < 0.8,
		"eye Y did not decay smoothly after pointer exit",
	);
	assert.ok(
		Math.abs(pointerExit.headY - pointerRight.headY) < 2.5,
		"head Y lost its pointer offset immediately after pointer exit",
	);

	await page.getByRole("button", { name: "表情与动作" }).click();
	await page
		.getByLabel("模型表情与动作")
		.getByRole("button", { name: "数位板" })
		.click();
	await page.mouse.move(
		bounds.x + bounds.width * 0.72,
		bounds.y + bounds.height * 0.48,
	);
	await page.mouse.down();
	await page.waitForTimeout(220);
	const tablet = await host.evaluate((element) => ({
		x: Number(element.dataset.nativeMouseX),
		click: Number(element.dataset.nativeClick),
		pressed: element.dataset.pointerPressed,
	}));
	assert.ok(tablet.x > 0.25, "tablet X mapping did not follow the pointer");
	assert.equal(tablet.click, 1);
	assert.equal(tablet.pressed, "true");
	await page.mouse.up();
	await page.mouse.move(10, 10);
	await page.waitForTimeout(120);
	assert.equal(await host.getAttribute("data-pointer-active"), "false");
	await page
		.getByLabel("模型表情与动作")
		.getByRole("button", { name: "全部复位" })
		.click();
	await page.getByRole("button", { name: "表情与动作" }).click();

	const composer = chat.getByRole("textbox", { name: "写给吸血鬼" });
	await composer.fill("__xiao_e2e_soullink__");
	await chat.getByRole("button", { name: "封缄并发送" }).click();
	await page.waitForFunction(() => {
		const element = document.querySelector("[data-live2d-host]");
		return element?.dataset.phase === "streaming";
	});
	await chat
		.getByText("已经修好，测试成功。我来检查代码。", { exact: true })
		.waitFor();
	await page.waitForFunction(() => {
		const canvas = document.querySelector(".xiao-scene__effects");
		return canvas?.dataset.lastEffect === "envelope-flight";
	});
	assert.equal(
		await page
			.locator(".xiao-scene__effects")
			.getAttribute("data-envelope-frame-count"),
		"12",
	);
	assert.equal(
		await page
			.locator(".xiao-scene__effects")
			.getAttribute("data-envelope-frame-fps"),
		"10",
	);
	await page.waitForFunction(() => {
		const element = document.querySelector("[data-live2d-host]");
		return (
			element?.dataset.performanceScenario === "celebration" &&
			element.dataset.performanceExpression === "stareyes" &&
			element.dataset.performanceAction === "mouse"
		);
	});
	await page.waitForFunction(() => {
		const element = document.querySelector("[data-live2d-host]");
		return (
			Number(element?.dataset.soullinkParameterBeats) === 2 &&
			Number(element?.dataset.nativeForwardLean) > 2 &&
			Number(element?.dataset.nativeJawOpen) > 0.08
		);
	});
	await page.waitForFunction(
		() => {
			const element = document.querySelector("[data-live2d-host]");
			return Number(element?.dataset.nativeForwardLean) < 1.8;
		},
		undefined,
		{ timeout: 5_000 },
	);

	const sendParameterScenario = async ({
		question,
		reply,
		scenario,
		beatCount,
		minimums,
	}) => {
		await composer.fill(question);
		await chat.getByRole("button", { name: "封缄并发送" }).click();
		await chat.getByText(reply, { exact: true }).last().waitFor();
		await page.waitForFunction(
			(expected) => {
				const element = document.querySelector("[data-live2d-host]");
				if (!(element instanceof HTMLElement)) return false;
				if (
					expected.scenario &&
					element.dataset.performanceScenario !== expected.scenario
				) {
					return false;
				}
				if (
					Number(element.dataset.soullinkParameterBeats) !== expected.beatCount
				) {
					return false;
				}
				return Object.entries(expected.minimums).every(
					([key, minimum]) => Number(element.dataset[key]) > minimum,
				);
			},
			{ scenario, beatCount, minimums },
			{ timeout: 5_000 },
		);
	};

	await sendParameterScenario({
		question: "__xiao_e2e_affection__",
		reply: "谢谢你，晚安。请鼓起脸颊，嘟嘴亲吻一下。",
		scenario: "affection",
		beatCount: 2,
		minimums: {
			nativeForwardLean: 2,
			nativeCheekPuff: 0.2,
			nativeLipPress: 0.05,
			nativeMouthFunnel: 0.12,
			nativeMouthPucker: 0.16,
		},
	});
	await sendParameterScenario({
		question: "__xiao_e2e_confused__",
		reply: "我不太确定，需要再确认，露出狡黠的歪嘴。",
		scenario: "uncertain",
		beatCount: 2,
		minimums: { nativeMouthShrug: 0.18, nativeMouthSkew: 0.2 },
	});
	await sendParameterScenario({
		question: "__xiao_e2e_chew__",
		reply: "一起吃一口蛋糕，慢慢咀嚼。",
		beatCount: 5,
		minimums: { nativeJawOpen: 0.12, nativeCheekPuff: 0.08 },
	});
	await sendParameterScenario({
		question: "__xiao_e2e_warning__",
		reply: "危险，立即停止并保护自己。",
		scenario: "warning",
		beatCount: 2,
		minimums: { nativeLipPress: 0.18, nativeForwardLean: 2 },
	});
	assert.equal(
		await page
			.locator(".vampire-chibi-reaction")
			.getAttribute("data-expression"),
		"startled",
	);
	const brows = await host.evaluate((element) => ({
		left: Number(element.dataset.nativeBrowLY),
		right: Number(element.dataset.nativeBrowRY),
	}));
	assert.ok(Math.abs(brows.left) > 0.02, "warning did not drive the brows");
	assert.ok(
		Math.abs(brows.left - brows.right) < 0.08,
		"SoulLink did not drive both brows symmetrically",
	);

	await page.getByRole("button", { name: "表情与动作" }).click();
	const manualLibrary = page.getByLabel("模型表情与动作");
	await manualLibrary.getByRole("button", { name: "全部复位" }).click();
	await manualLibrary.getByRole("button", { name: "捧脸美工刀" }).click();
	await page.getByRole("button", { name: "表情与动作" }).click();
	await composer.fill("__xiao_e2e_manual_priority__");
	await chat.getByRole("button", { name: "封缄并发送" }).click();
	await chat.getByText("已经修好，我来检查代码。", { exact: true }).waitFor();
	await page.waitForFunction(() => {
		const element = document.querySelector("[data-live2d-host]");
		return (
			element?.dataset.performanceScenario === "celebration" &&
			element.dataset.performanceAction === "knife" &&
			element.dataset.performanceSource === "manual"
		);
	});
}

async function checkDesktop(browser) {
	const { context, page, runtimeErrors } = await openXiaoPage(browser, {
		width: 1920,
		height: 1080,
	});
	try {
		await assertSoulLinkStage(page);
		await assertWorkspaceIsolation(page);
		await assertAccessibleChat(page);
		const stage = await page.locator(".xiao-stage").boundingBox();
		const host = await page.locator("[data-live2d-host]").boundingBox();
		const canvasBefore = await page
			.locator("[data-live2d-host] canvas")
			.evaluate((canvas) => ({
				cssWidth: canvas.getBoundingClientRect().width,
				cssHeight: canvas.getBoundingClientRect().height,
				backingWidth: canvas.width,
				backingHeight: canvas.height,
			}));
		const chat = await page.locator(".xiao-chat").boundingBox();
		assert.ok(stage && host && chat, "desktop stage or chat is not visible");
		await page.getByRole("button", { name: "隐藏对话框" }).click();
		await page.locator(".xiao-chat").waitFor({ state: "hidden" });
		assert.equal(await page.locator(".xiao-chat").isVisible(), false);
		assert.equal(await page.locator(".xiao-chat__restore").isVisible(), true);
		const stableStage = await page.locator(".xiao-stage").boundingBox();
		const stableHost = await page.locator("[data-live2d-host]").boundingBox();
		const canvasAfter = await page
			.locator("[data-live2d-host] canvas")
			.evaluate((canvas) => ({
				cssWidth: canvas.getBoundingClientRect().width,
				cssHeight: canvas.getBoundingClientRect().height,
				backingWidth: canvas.width,
				backingHeight: canvas.height,
			}));
		assert.ok(stableStage && stableHost);
		assert.ok(Math.abs(stableStage.width - stage.width) <= 1);
		assert.ok(Math.abs(stableStage.height - stage.height) <= 1);
		assert.ok(Math.abs(stableHost.width - host.width) <= 1);
		assert.ok(Math.abs(stableHost.height - host.height) <= 1);
		assert.deepEqual(canvasAfter, canvasBefore);
		await page.getByRole("button", { name: "显示对话框" }).click();
		assert.equal(await page.locator(".xiao-chat").isVisible(), true);
		assert.equal(await page.locator(".xiao-mobile-switch").isVisible(), false);
		await assertNativeVampireControls(
			page,
			page.locator("[data-live2d-host]"),
			page.locator(".xiao-stage"),
			page.getByLabel("和吸血鬼对话"),
		);
		assert.deepEqual(runtimeErrors, []);
		console.log("desktop vampire workspace OK");
	} finally {
		await context.close();
	}
}

async function checkReducedMotion(browser) {
	const { context, page, runtimeErrors } = await openXiaoPage(
		browser,
		{ width: 1920, height: 1080 },
		{ reducedMotion: "reduce" },
	);
	try {
		await assertSoulLinkStage(page);
		assert.equal(await page.getByText("动态模型已暂停").count(), 0);
		assert.deepEqual(runtimeErrors, []);
		console.log("reduced-motion SoulLink stage OK");
	} finally {
		await context.close();
	}
}

async function checkMobile(browser) {
	const { context, page, runtimeErrors } = await openXiaoPage(browser, {
		width: 390,
		height: 844,
	});
	try {
		const { host } = await assertSoulLinkStage(page);
		await assertWorkspaceIsolation(page);
		const stage = page.locator(".xiao-stage");
		const chat = await assertAccessibleChat(page);
		assert.equal(await page.locator(".xiao-mobile-switch").isVisible(), true);
		assert.equal(await stage.isVisible(), true);
		assert.equal(await chat.isVisible(), false);
		await page.locator(".xiao-mobile-switch button").nth(1).click();
		assert.equal(await stage.isVisible(), false);
		assert.equal(await chat.isVisible(), true);

		const composer = chat.getByRole("textbox", { name: "写给吸血鬼" });
		const quickPrompt = chat.locator(".xiao-chat__quick button").first();
		const quickPromptText = (await quickPrompt.textContent())?.trim();
		assert.ok(quickPromptText);
		await quickPrompt.click();
		assert.equal(await composer.inputValue(), quickPromptText);

		const baselineEmotion = await host.getAttribute("data-emotion");
		await composer.fill("这件事让我很生气");
		await chat.getByRole("button", { name: "封缄并发送" }).click();
		const emotionHandle = await page.waitForFunction(() => {
			const element = document.querySelector("[data-live2d-host]");
			if (!(element instanceof HTMLElement) || element.dataset.emotion !== "anger") {
				return false;
			}
			return {
				emotion: element.dataset.emotion,
				valence: Number(element.style.getPropertyValue("--xiao-valence")),
			};
		});
		const immediateEmotionState = await emotionHandle.jsonValue();
		assert.equal(immediateEmotionState.emotion, "anger");
		assert.notEqual(immediateEmotionState.emotion, baselineEmotion);
		assert.ok(Number.isFinite(immediateEmotionState.valence));
		await chat.getByText("streaming test reply", { exact: true }).waitFor();

		await composer.fill("__xiao_e2e_retry__");
		await chat.getByRole("button", { name: "封缄并发送" }).click();
		const errorAlert = chat.getByRole("alert");
		await errorAlert.waitFor({ state: "visible" });
		await chat.getByRole("button", { name: "重试上一条消息" }).click();
		await chat.getByText("retry complete", { exact: true }).waitFor();
		assert.equal(await errorAlert.count(), 0);

	const effectsToggle = page.getByRole("button", { name: /舞台特效/ });
		const effectsBefore = await effectsToggle.getAttribute("aria-pressed");
		await effectsToggle.click();
		assert.notEqual(
			await effectsToggle.getAttribute("aria-pressed"),
			effectsBefore,
		);
		assert.equal(
			await page
				.locator(".xiao-hub")
				.evaluate((hub) => hub.classList.contains("effects-off")),
			true,
		);

		await page.locator(".xiao-mobile-switch button").first().click();
		assert.equal(await stage.isVisible(), true);
		assert.equal(await chat.isVisible(), false);
		assert.deepEqual(runtimeErrors, []);
		console.log("mobile vampire controls OK");
	} finally {
		await context.close();
	}
}

async function checkHardNavigationBoundary(browser) {
	const context = await browser.newContext({
		viewport: { width: 1920, height: 1080 },
	});
	const page = await context.newPage();
	try {
		await blockExternalSubresources(page);
		await page.goto(`${baseUrl}/`, {
			waitUntil: "domcontentloaded",
			timeout: 60_000,
		});
		await page.evaluate(() => {
			window.__xiaoNavigationSentinel = true;
		});
		const link = page.locator(
			'.navbar-nav > .dropdown-container > a[aria-label="小恶魔"]',
		);
		await link.waitFor({ state: "visible" });
		assert.equal(await link.getAttribute("href"), "/live2D/");
		assert.equal(
			await link.locator("xpath=..//*[@data-dropdown-menu]").count(),
			0,
		);
		await link.click();
		await page.waitForURL(/\/live2D\/$/, { timeout: 60_000 });
		assert.equal(
			await page.evaluate(() => window.__xiaoNavigationSentinel),
			undefined,
		);
		console.log("Xiao hard-navigation boundary OK");
	} finally {
		await context.close();
	}
}

async function checkLegacyRedirect(browser) {
	const page = await browser.newPage({
		viewport: { width: 1280, height: 800 },
	});
	try {
		const response = await page.goto(`${baseUrl}/xiao/`, {
			waitUntil: "domcontentloaded",
			timeout: 60_000,
		});
		assert.equal(response?.status(), 200);
		assert.match(page.url(), /\/live2D\/$/);
		console.log("legacy /xiao/ redirect OK");
	} finally {
		await page.close();
	}
}

const browser = await chromium.launch({
	headless: true,
	...(existsSync(browserPath) ? { executablePath: browserPath } : {}),
});

try {
	await checkDesktop(browser);
	await checkReducedMotion(browser);
	await checkMobile(browser);
	await checkHardNavigationBoundary(browser);
	await checkLegacyRedirect(browser);
	console.log("Xiao hub E2E passed.");
} finally {
	await browser.close();
}
