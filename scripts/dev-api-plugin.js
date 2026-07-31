import { loadEnv } from "vite";

async function forwardResponseBody(response, outgoing) {
	if (!response.body) {
		outgoing.end();
		return;
	}
	const reader = response.body.getReader();
	try {
		while (true) {
			const next = await reader.read();
			if (next.done) break;
			if (outgoing.destroyed) {
				await reader.cancel();
				return;
			}
			const canContinue = outgoing.write(Buffer.from(next.value));
			if (!canContinue) {
				await new Promise((resolve) => outgoing.once("drain", resolve));
			}
		}
		outgoing.end();
	} finally {
		reader.releaseLock();
	}
}

/**
 * 开发模式 API 适配器：把 /api/* 请求转交给生产共用的 Functions 入口。
 */
export default function devApiPlugin() {
	let fileEnvironment = {};
	const environmentKeys = [
		"BLOG_ADMIN_TOKEN",
		"NOTEBOOK_ADMIN_TOKEN",
		"ACTIVITY_ADMIN_TOKEN",
		"GITHUB_CONTENT_TOKEN",
		"GITHUB_REPOSITORY",
		"GITHUB_BRANCH",
		"AI_API_KEY",
		"ALLOWED_ORIGINS",
		"PUBLIC_SITE_URL",
	];
	const getDevEnvironment = () =>
		Object.fromEntries(
			environmentKeys.flatMap((key) => {
				const value = process.env[key] ?? fileEnvironment[key];
				return typeof value === "string" && value.trim() ? [[key, value]] : [];
			}),
		);

	return {
		name: "dev-api-plugin",
		apply: "serve",
		enforce: "pre",
		configResolved(config) {
			fileEnvironment = loadEnv(config.mode, config.envDir, "");
		},
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				const requestPath = req.url;
				if (!requestPath?.startsWith("/api/")) return next();

				try {
					const mod = await server.ssrLoadModule(
						"/src/server/api/node-runtime.ts",
					);
					const handler = mod.default;
					if (typeof handler?.fetch !== "function") {
						throw new Error("API handler does not expose fetch()");
					}

					const host =
						req.headers.host ||
						`127.0.0.1:${server.config.server.port || 4321}`;
					const request = new Request(new URL(requestPath, `http://${host}`), {
						method: req.method,
						headers: new Headers(req.headers),
						body:
							req.method !== "GET" && req.method !== "HEAD" ? req : undefined,
						duplex: "half",
					});

					const response = await handler.fetch(request, getDevEnvironment());
					res.statusCode = response.status;
					response.headers.forEach((value, key) => {
						res.setHeader(key, value);
					});
					await forwardResponseBody(response, res);
				} catch (error) {
					console.error("[dev-api-plugin] Error:", error);
					res.statusCode = 500;
					res.setHeader("Content-Type", "application/json");
					res.end(JSON.stringify({ error: String(error) }));
				}
			});
		},
	};
}
