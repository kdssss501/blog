import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { loadEnv } from "vite";

export const VAMPIRE_LIVE2D_BASE_PATH = "/__local-vampire/v1";
export const VAMPIRE_LIVE2D_MODEL_URL = `${VAMPIRE_LIVE2D_BASE_PATH}/model.model3.json`;

const EXPRESSION_FILES = [
	["blood-body", "blood-body.exp3.json"],
	["blood-face", "blood-face.exp3.json"],
	["circleeyes", "circleeyes.exp3.json"],
	["click", "click.exp3.json"],
	["hearteyes", "hearteyes.exp3.json"],
	["knife", "knife.exp3.json"],
	["mad", "mad.exp3.json"],
	["mc", "mc.exp3.json"],
	["mouse", "mouse.exp3.json"],
	["sad", "sad.exp3.json"],
	["shy", "shy.exp3.json"],
	["stareyes", "stareyes.exp3.json"],
];

const EXPRESSION_PARAMETER_IDS = [
	"PARAMblood1",
	"PARAMBLOOD2",
	"PARAMWHITEEYE",
	"Paramclick",
	"PARAMhearteye",
	"PARAMhands_1",
	"PARAMhands_2",
	"PARAMhands_3",
	"PARAMANGRY",
	"PARAMTEARS",
	"PARAM_BROW_L_Y",
	"PARAM_BROW_L_FORM",
	"PARAM_BROW_R_FORM",
	"PARAM_BROW_R_Y",
	"PARAMSHY",
	"PARAMstareye",
];

const NEUTRAL_RESET = {
	Version: 3,
	FadeInTime: 0.35,
	FadeOutTime: 0.35,
	Parameters: EXPRESSION_PARAMETER_IDS.map((Id) => ({
		Id,
		Value: 0,
		Blend: "Add",
	})),
};

const SOURCE_ROUTES = new Map([
	[
		`${VAMPIRE_LIVE2D_BASE_PATH}/model.moc3`,
		{ source: "吸血鬼.moc3", contentType: "application/octet-stream" },
	],
	[
		`${VAMPIRE_LIVE2D_BASE_PATH}/model.physics3.json`,
		{
			source: "吸血鬼.physics3.json",
			contentType: "application/json; charset=utf-8",
		},
	],
	[
		`${VAMPIRE_LIVE2D_BASE_PATH}/model.cdi3.json`,
		{
			source: "吸血鬼.cdi3.json",
			contentType: "application/json; charset=utf-8",
		},
	],
	[
		`${VAMPIRE_LIVE2D_BASE_PATH}/textures/texture-00.png`,
		{ source: "吸血鬼.8192/texture_00.png", contentType: "image/png" },
	],
	[
		`${VAMPIRE_LIVE2D_BASE_PATH}/textures/texture-01.png`,
		{ source: "吸血鬼.8192/texture_01.png", contentType: "image/png" },
	],
	[
		`${VAMPIRE_LIVE2D_BASE_PATH}/textures/texture-02.png`,
		{ source: "吸血鬼.8192/texture_02.png", contentType: "image/png" },
	],
	[
		`${VAMPIRE_LIVE2D_BASE_PATH}/textures/texture-03.png`,
		{ source: "吸血鬼.8192/texture_03.png", contentType: "image/png" },
	],
	[
		`${VAMPIRE_LIVE2D_BASE_PATH}/motions/idle.motion3.json`,
		{
			source: "Scene1.motion3.json",
			contentType: "application/json; charset=utf-8",
		},
	],
]);

for (const [name, source] of EXPRESSION_FILES) {
	SOURCE_ROUTES.set(
		`${VAMPIRE_LIVE2D_BASE_PATH}/expressions/${name}.exp3.json`,
		{ source, contentType: "application/json; charset=utf-8" },
	);
}

const MODEL_SOURCE_FILE = "吸血鬼.model3.json";
const NEUTRAL_RESET_PATH = `${VAMPIRE_LIVE2D_BASE_PATH}/expressions/neutral-reset.exp3.json`;
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

function isInsideRoot(root, target) {
	const relative = path.relative(root, target);
	return (
		relative !== "" &&
		relative !== ".." &&
		!relative.startsWith(`..${path.sep}`) &&
		!path.isAbsolute(relative)
	);
}

function setResponseHeaders(res, contentType, contentLength) {
	res.setHeader("Cache-Control", "no-store");
	res.setHeader("Content-Type", contentType);
	res.setHeader("Content-Length", String(contentLength));
	res.setHeader("X-Content-Type-Options", "nosniff");
}

function sendBuffer(req, res, statusCode, contentType, body) {
	res.statusCode = statusCode;
	setResponseHeaders(res, contentType, body.byteLength);
	if (req.method === "HEAD") res.end();
	else res.end(body);
}

function sendJson(req, res, statusCode, payload) {
	sendBuffer(
		req,
		res,
		statusCode,
		JSON_CONTENT_TYPE,
		Buffer.from(JSON.stringify(payload)),
	);
}

function createRuntimeModel(sourceModel) {
	if (
		typeof sourceModel !== "object" ||
		sourceModel === null ||
		Array.isArray(sourceModel)
	) {
		throw new TypeError("Invalid source model3 document");
	}

	const fileReferences =
		typeof sourceModel.FileReferences === "object" &&
		sourceModel.FileReferences !== null &&
		!Array.isArray(sourceModel.FileReferences)
			? sourceModel.FileReferences
			: {};

	return {
		...sourceModel,
		FileReferences: {
			...fileReferences,
			Moc: "model.moc3",
			Textures: [
				"textures/texture-00.png",
				"textures/texture-01.png",
				"textures/texture-02.png",
				"textures/texture-03.png",
			],
			Physics: "model.physics3.json",
			DisplayInfo: "model.cdi3.json",
			Expressions: [
				...EXPRESSION_FILES.map(([Name]) => ({
					Name,
					File: `expressions/${Name}.exp3.json`,
				})),
				{
					Name: "neutral-reset",
					File: "expressions/neutral-reset.exp3.json",
				},
			],
			Motions: {
				...(fileReferences.Motions ?? {}),
				Idle: [{ File: "motions/idle.motion3.json" }],
			},
		},
	};
}

async function resolveSourceFile(sourceRoot, relativePath) {
	const candidate = await realpath(path.resolve(sourceRoot, relativePath));
	if (!isInsideRoot(sourceRoot, candidate)) {
		throw new Error("Source asset resolved outside the configured root");
	}
	return candidate;
}

async function serveSourceFile(req, res, sourceRoot, route) {
	const sourcePath = await resolveSourceFile(sourceRoot, route.source);
	const sourceStat = await stat(sourcePath);
	if (!sourceStat.isFile()) throw new Error("Source asset is not a file");

	res.statusCode = 200;
	setResponseHeaders(res, route.contentType, sourceStat.size);
	if (req.method === "HEAD") {
		res.end();
		return;
	}

	await pipeline(createReadStream(sourcePath), res);
}

export default function vampireLive2dPlugin(options = {}) {
	let sourceRoot = null;

	return {
		name: "vampire-live2d-dev-proxy",
		apply: "serve",
		enforce: "pre",
		async configResolved(config) {
			const environment = loadEnv(config.mode, config.envDir, "");
			const configuredSource =
				options.sourceDir ??
				process.env.VAMPIRE_LIVE2D_SOURCE_DIR ??
				environment.VAMPIRE_LIVE2D_SOURCE_DIR;
			if (!configuredSource?.trim()) return;

			try {
				const candidate = path.isAbsolute(configuredSource)
					? configuredSource
					: path.resolve(config.root, configuredSource);
				const resolved = await realpath(candidate);
				const sourceStat = await stat(resolved);
				if (!sourceStat.isDirectory()) return;
				sourceRoot = resolved;
			} catch {
				config.logger.warn(
					"[vampire-live2d] VAMPIRE_LIVE2D_SOURCE_DIR is unavailable; local model routes are disabled.",
				);
			}
		},
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				const requestUrl = req.url;
				if (!requestUrl) return next();
				const rawPathname = requestUrl.split(/[?#]/u, 1)[0];
				const targetsProxy =
					rawPathname === VAMPIRE_LIVE2D_BASE_PATH ||
					rawPathname.startsWith(`${VAMPIRE_LIVE2D_BASE_PATH}/`);
				if (!targetsProxy) return next();

				let pathname;
				try {
					pathname = new URL(requestUrl, "http://localhost").pathname;
				} catch {
					sendJson(req, res, 400, { error: "Invalid asset URL" });
					return;
				}

				if (
					pathname !== VAMPIRE_LIVE2D_BASE_PATH &&
					!pathname.startsWith(`${VAMPIRE_LIVE2D_BASE_PATH}/`)
				) {
					sendJson(req, res, 404, { error: "Asset not found" });
					return;
				}

				if (req.method !== "GET" && req.method !== "HEAD") {
					res.setHeader("Allow", "GET, HEAD");
					sendJson(req, res, 405, { error: "Method not allowed" });
					return;
				}

				const isKnownPath =
					pathname === VAMPIRE_LIVE2D_MODEL_URL ||
					pathname === NEUTRAL_RESET_PATH ||
					SOURCE_ROUTES.has(pathname);
				if (!isKnownPath) {
					sendJson(req, res, 404, { error: "Asset not found" });
					return;
				}

				if (!sourceRoot) {
					sendJson(req, res, 503, {
						error: "Local Vampire Live2D source is unavailable",
					});
					return;
				}

				try {
					if (pathname === VAMPIRE_LIVE2D_MODEL_URL) {
						const sourcePath = await resolveSourceFile(
							sourceRoot,
							MODEL_SOURCE_FILE,
						);
						const sourceModel = JSON.parse(await readFile(sourcePath, "utf8"));
						const body = Buffer.from(
							JSON.stringify(createRuntimeModel(sourceModel)),
						);
						sendBuffer(req, res, 200, JSON_CONTENT_TYPE, body);
						return;
					}

					if (pathname === NEUTRAL_RESET_PATH) {
						const body = Buffer.from(JSON.stringify(NEUTRAL_RESET));
						sendBuffer(req, res, 200, JSON_CONTENT_TYPE, body);
						return;
					}

					const route = SOURCE_ROUTES.get(pathname);
					await serveSourceFile(req, res, sourceRoot, route);
				} catch (error) {
					if (req.destroyed || res.destroyed) return;
					if (error?.code === "ENOENT") {
						sendJson(req, res, 404, { error: "Asset not found" });
						return;
					}
					server.config.logger.error(
						`[vampire-live2d] Failed to serve ${pathname}`,
					);
					if (!res.headersSent) {
						sendJson(req, res, 500, { error: "Failed to serve asset" });
					} else {
						res.destroy();
					}
				}
			});
		},
	};
}
