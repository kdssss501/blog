import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { createTtsGatewayHandler } from "../src/server/tts/gateway.ts";
import { createLocalGptSovitsRuntime } from "../src/server/tts/node-runtime.ts";

const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const fileEnvironment = loadEnv(
	process.env.NODE_ENV || "development",
	projectRoot,
	"",
);
const readEnvironment = (name) =>
	process.env[name]?.trim() || fileEnvironment[name]?.trim() || "";

function readPositiveInteger(name, fallback, maximum) {
	const value = readEnvironment(name) || String(fallback);
	if (!/^\d+$/u.test(value)) throw new Error(`${name} 必须是正整数。`);
	const parsed = Number(value);
	if (parsed < 1 || parsed > maximum) {
		throw new Error(`${name} 必须在 1 到 ${maximum} 之间。`);
	}
	return parsed;
}

function requestHeaders(source) {
	const headers = new Headers();
	for (const [name, value] of Object.entries(source)) {
		if (Array.isArray(value)) headers.set(name, value.join(", "));
		else if (typeof value === "string") headers.set(name, value);
	}
	return headers;
}

async function requestBody(request, maximumBytes) {
	if (request.method === "GET" || request.method === "HEAD") return undefined;
	const chunks = [];
	let total = 0;
	let tooLarge = false;
	for await (const chunk of request) {
		const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		total += bytes.byteLength;
		if (total <= maximumBytes) chunks.push(bytes);
		else tooLarge = true;
	}
	if (tooLarge) {
		const error = new Error("Request Too Large");
		error.status = 413;
		throw error;
	}
	return Buffer.concat(chunks);
}

async function writeResponse(response, outgoing) {
	outgoing.statusCode = response.status;
	response.headers.forEach((value, name) => {
		outgoing.setHeader(name, value);
	});
	if (!response.body) {
		outgoing.end();
		return;
	}
	const bytes = Buffer.from(await response.arrayBuffer());
	outgoing.end(bytes);
}

async function main() {
	const token = readEnvironment("TTS_SERVICE_TOKEN");
	if (token.length < 32) {
		throw new Error(
			"缺少安全的 TTS_SERVICE_TOKEN；请设置至少 32 个字符的随机值。",
		);
	}
	const port = readPositiveInteger("TTS_GATEWAY_PORT", 8788, 65_535);
	const maxPending = readPositiveInteger("TTS_GATEWAY_MAX_PENDING", 3, 20);
	const runtime = createLocalGptSovitsRuntime({ projectRoot });
	const handleRequest = createTtsGatewayHandler({
		runtime,
		token,
		maxPending,
	});

	const server = createServer(async (incoming, outgoing) => {
		try {
			const body = await requestBody(incoming, 4_096);
			const request = new Request(
				new URL(incoming.url || "/", `http://127.0.0.1:${port}`),
				{
					method: incoming.method,
					headers: requestHeaders(incoming.headers),
					...(body ? { body } : {}),
				},
			);
			await writeResponse(await handleRequest(request), outgoing);
		} catch (error) {
			const status = Number(error?.status) || 500;
			outgoing.statusCode = status;
			outgoing.setHeader("Cache-Control", "no-store");
			outgoing.setHeader("Content-Type", "application/json; charset=utf-8");
			outgoing.end(
				JSON.stringify({
					code: status === 413 ? "TTS_REQUEST_TOO_LARGE" : "TTS_GATEWAY_ERROR",
					error: status === 413 ? "Request Too Large" : "语音网关处理失败。",
				}),
			);
		}
	});

	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(port, "127.0.0.1", resolve);
	});
	console.log(`[TTS Gateway] http://127.0.0.1:${port}`);
	console.log("[TTS Gateway] 仅监听回环地址，外部访问必须经过受保护 Tunnel。");

	const close = () => server.close(() => process.exit(0));
	process.once("SIGINT", close);
	process.once("SIGTERM", close);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
