/**
 * Vite 插件：在 dev 模式下拦截 /api/ 请求，使用 functions/[...api].ts 的处理逻辑
 * 构建模式下不生效，生产环境由 Cloudflare Pages Functions 处理
 */
import { pathToFileURL } from "node:url";

let apiHandler = null;

async function loadHandler() {
	if (apiHandler) return apiHandler;
	try {
		// 动态导入 functions/[...api].ts 的处理逻辑
		const functionsPath = pathToFileURL(
			require("path").resolve(process.cwd(), "functions/[...api].ts")
		).href;
		// 使用 vite 的 ssrLoadModule 来加载 TS 文件
		return null; // 实际加载在 configureServer 中完成
	} catch {
		return null;
	}
}

export default function devApiPlugin() {
	return {
		name: "dev-api-plugin",
		apply: "serve", // 仅在 dev 模式生效
		configureServer(server) {
			// 拦截 /api/ 开头的请求
			server.middlewares.use(async (req, res, next) => {
				const url = req.url;
				if (!url || !url.startsWith("/api/")) {
					return next();
				}

				try {
					// 使用 vite 的 ssrLoadModule 加载 functions 模块
					const mod = await server.ssrLoadModule("/functions/[...api].ts");
					const handler = mod.default;

					if (!handler || !handler.fetch) {
						res.statusCode = 500;
						res.setHeader("Content-Type", "application/json");
						res.end(JSON.stringify({ error: "API handler not loaded" }));
						return;
					}

					// 构造完整的 URL
					const fullUrl = `http://localhost:${server.config.server.port || 4321}${url}`;
					const request = new Request(fullUrl, {
						method: req.method,
						headers: new Headers(req.headers),
						body: req.method !== "GET" && req.method !== "HEAD" ? req : undefined,
						duplex: "half",
					});

					const response = await handler.fetch(
						request,
						{},
						{ waitUntil: async (p) => p }
					);

					res.statusCode = response.status;
					response.headers.forEach((value, key) => {
						res.setHeader(key, value);
					});

					const body = await response.text();
					res.end(body);
				} catch (err) {
					console.error("[dev-api-plugin] Error:", err);
					res.statusCode = 500;
					res.setHeader("Content-Type", "application/json");
					res.end(JSON.stringify({ error: String(err) }));
				}
			});
		},
	};
}
