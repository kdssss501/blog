import {
	type LocalTtsRuntime,
	LocalTtsRuntimeError,
	normalizeLocalTtsInput,
} from "../../../shared/local-tts/contract.ts";
import { corsHeaders, jsonResponse } from "../http.ts";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
let synthesisQueue: Promise<void> = Promise.resolve();

function enqueueSynthesis<T>(task: () => Promise<T>): Promise<T> {
	const result = synthesisQueue.then(task, task);
	synthesisQueue = result.then(
		() => undefined,
		() => undefined,
	);
	return result;
}

function unavailableResponse(): Response {
	return jsonResponse(
		{
			code: "LOCAL_TTS_UNAVAILABLE",
			error: "GPT-SoVITS 语音服务当前不可用。",
		},
		503,
	);
}

function isTrustedTtsRequest(request: Request): boolean {
	const url = new URL(request.url);
	const fetchSite = request.headers.get("sec-fetch-site");
	if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
		return false;
	}

	const origin = request.headers.get("origin");
	if (origin) {
		try {
			if (new URL(origin).origin !== url.origin) return false;
		} catch {
			return false;
		}
	}
	if (LOOPBACK_HOSTS.has(url.hostname)) return true;
	return fetchSite === "same-origin" || origin === url.origin;
}

function forbiddenResponse(): Response {
	return jsonResponse(
		{
			code: "LOCAL_TTS_FORBIDDEN",
			error: "只允许从本机同源页面调用语音服务。",
		},
		403,
	);
}

export async function handleLocalTtsRequest(
	request: Request,
	runtime: LocalTtsRuntime | undefined,
	healthOnly = false,
): Promise<Response> {
	if (healthOnly) {
		if (request.method !== "GET") {
			return jsonResponse(
				{ code: "METHOD_NOT_ALLOWED", error: "Method Not Allowed" },
				405,
				{
					Allow: "GET",
				},
			);
		}
		if (!runtime) return unavailableResponse();
		if (!isTrustedTtsRequest(request)) return forbiddenResponse();
		const status = await runtime.health();
		return jsonResponse(status, status.available ? 200 : 503);
	}

	if (request.method !== "POST") {
		return jsonResponse(
			{ code: "METHOD_NOT_ALLOWED", error: "Method Not Allowed" },
			405,
			{
				Allow: "POST",
			},
		);
	}
	if (!runtime) return unavailableResponse();
	if (!isTrustedTtsRequest(request)) return forbiddenResponse();

	const body: unknown = await request.json().catch(() => null);
	const parsed = normalizeLocalTtsInput(body);
	if (!parsed.ok) {
		return jsonResponse({ code: parsed.code, error: parsed.error }, 400);
	}

	try {
		const audio = await enqueueSynthesis(() =>
			runtime.synthesize(parsed.value),
		);
		const headers = new Headers(corsHeaders);
		headers.set("Cache-Control", "no-store");
		headers.set("Content-Length", String(audio.bytes.byteLength));
		headers.set("Content-Type", audio.contentType);
		headers.set("X-Local-TTS-Emotion", audio.emotion);
		return new Response(audio.bytes, { status: 200, headers });
	} catch (error) {
		if (error instanceof LocalTtsRuntimeError) {
			return jsonResponse(
				{ code: error.code, error: error.message },
				error.status,
			);
		}
		console.error("[local-tts] Unexpected error", error);
		return jsonResponse(
			{ code: "TTS_INTERNAL_ERROR", error: "本地语音合成失败。" },
			500,
		);
	}
}
