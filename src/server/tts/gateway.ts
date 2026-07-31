import {
	type LocalTtsRuntime,
	LocalTtsRuntimeError,
	normalizeLocalTtsInput,
} from "../../shared/local-tts/contract.ts";

const MAX_REQUEST_BYTES = 4_096;

export interface TtsGatewayOptions {
	runtime: LocalTtsRuntime;
	token: string;
	maxPending?: number;
}

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Cache-Control": "no-store",
			"Content-Type": "application/json; charset=utf-8",
			...headers,
		},
	});
}

function tokensMatch(actual: string, expected: string): boolean {
	const length = Math.max(actual.length, expected.length);
	let mismatch = actual.length ^ expected.length;
	for (let index = 0; index < length; index += 1) {
		mismatch |=
			(actual.charCodeAt(index % Math.max(actual.length, 1)) || 0) ^
			(expected.charCodeAt(index % Math.max(expected.length, 1)) || 0);
	}
	return mismatch === 0;
}

function isAuthorized(request: Request, token: string): boolean {
	const authorization = request.headers.get("authorization") ?? "";
	return tokensMatch(authorization, `Bearer ${token}`);
}

export function createTtsGatewayHandler(options: TtsGatewayOptions) {
	const token = options.token.trim();
	if (token.length < 32) {
		throw new Error("TTS_SERVICE_TOKEN 至少需要 32 个字符。");
	}
	const maxPending = Math.max(1, options.maxPending ?? 3);
	let pending = 0;
	let synthesisQueue: Promise<void> = Promise.resolve();

	const enqueue = async <T>(task: () => Promise<T>): Promise<T> => {
		if (pending >= maxPending) {
			throw new LocalTtsRuntimeError(
				"TTS_GATEWAY_BUSY",
				"语音队列已满，请稍后重试。",
				429,
			);
		}
		pending += 1;
		const result = synthesisQueue.then(task, task);
		synthesisQueue = result.then(
			() => undefined,
			() => undefined,
		);
		try {
			return await result;
		} finally {
			pending -= 1;
		}
	};

	return async function handleTtsGatewayRequest(
		request: Request,
	): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname.replace(/\/+$/u, "") || "/";
		if (path !== "/health" && path !== "/v1/tts") {
			return jsonResponse({ code: "NOT_FOUND", error: "Not Found" }, 404);
		}
		if (!isAuthorized(request, token)) {
			return jsonResponse(
				{ code: "TTS_GATEWAY_UNAUTHORIZED", error: "Unauthorized" },
				401,
				{ "WWW-Authenticate": "Bearer" },
			);
		}

		if (path === "/health") {
			if (request.method !== "GET") {
				return jsonResponse(
					{ code: "METHOD_NOT_ALLOWED", error: "Method Not Allowed" },
					405,
					{ Allow: "GET" },
				);
			}
			const health = await options.runtime.health();
			return jsonResponse(health, health.available ? 200 : 503);
		}

		if (request.method !== "POST") {
			return jsonResponse(
				{ code: "METHOD_NOT_ALLOWED", error: "Method Not Allowed" },
				405,
				{ Allow: "POST" },
			);
		}
		const contentLength = Number(request.headers.get("content-length") ?? 0);
		if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
			return jsonResponse(
				{ code: "TTS_REQUEST_TOO_LARGE", error: "Request Too Large" },
				413,
			);
		}
		const raw = await request.text();
		if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
			return jsonResponse(
				{ code: "TTS_REQUEST_TOO_LARGE", error: "Request Too Large" },
				413,
			);
		}
		const body: unknown = (() => {
			try {
				return JSON.parse(raw);
			} catch {
				return null;
			}
		})();
		const parsed = normalizeLocalTtsInput(body);
		if (!parsed.ok) {
			return jsonResponse({ code: parsed.code, error: parsed.error }, 400);
		}

		try {
			const audio = await enqueue(() =>
				options.runtime.synthesize(parsed.value),
			);
			return new Response(audio.bytes, {
				status: 200,
				headers: {
					"Cache-Control": "no-store",
					"Content-Length": String(audio.bytes.byteLength),
					"Content-Type": audio.contentType,
					"X-Local-TTS-Emotion": audio.emotion,
				},
			});
		} catch (error) {
			if (error instanceof LocalTtsRuntimeError) {
				return jsonResponse(
					{ code: error.code, error: error.message },
					error.status,
					error.status === 429 ? { "Retry-After": "3" } : undefined,
				);
			}
			console.error("[tts-gateway] Unexpected error", error);
			return jsonResponse(
				{ code: "TTS_INTERNAL_ERROR", error: "语音网关处理失败。" },
				500,
			);
		}
	};
}
