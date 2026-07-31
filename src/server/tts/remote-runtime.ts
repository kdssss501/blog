import {
	type LocalTtsAudio,
	type LocalTtsEmotion,
	type LocalTtsHealth,
	type LocalTtsRuntime,
	LocalTtsRuntimeError,
	type LocalTtsSynthesisInput,
} from "../../shared/local-tts/contract.ts";

const DEFAULT_REQUEST_TIMEOUT_MS = 45_000;
const DEFAULT_HEALTH_TIMEOUT_MS = 3_000;

type Fetcher = typeof fetch;

export interface RemoteTtsRuntimeOptions {
	baseUrl: string;
	token: string;
	fetcher?: Fetcher;
	requestTimeoutMs?: number;
	healthTimeoutMs?: number;
}

function normalizeBaseUrl(value: string): string {
	const url = new URL(value.trim());
	const loopback = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
	if (url.protocol !== "https:" && !loopback.has(url.hostname)) {
		throw new Error("远程 TTS 网关必须使用 HTTPS，只有回环地址允许 HTTP。");
	}
	url.pathname = url.pathname.replace(/\/+$/u, "");
	url.search = "";
	url.hash = "";
	return url.toString().replace(/\/$/u, "");
}

function isWav(bytes: ArrayBuffer): boolean {
	if (bytes.byteLength < 12) return false;
	const data = new Uint8Array(bytes);
	return (
		data[0] === 0x52 &&
		data[1] === 0x49 &&
		data[2] === 0x46 &&
		data[3] === 0x46 &&
		data[8] === 0x57 &&
		data[9] === 0x41 &&
		data[10] === 0x56 &&
		data[11] === 0x45
	);
}

function unavailableHealth(reason: string): LocalTtsHealth {
	return {
		available: false,
		model: "v2ProPlus",
		referencesReady: false,
		upstreamReady: false,
		reason,
	};
}

function readEmotion(value: string | null, fallback: LocalTtsEmotion) {
	return value === "neutral" ||
		value === "happy" ||
		value === "sad" ||
		value === "angry"
		? value
		: fallback;
}

export function createRemoteTtsRuntime(
	options: RemoteTtsRuntimeOptions,
): LocalTtsRuntime {
	const baseUrl = normalizeBaseUrl(options.baseUrl);
	const token = options.token.trim();
	if (token.length < 32) {
		throw new Error("TTS_SERVICE_TOKEN 至少需要 32 个字符。");
	}
	const fetcher = options.fetcher ?? fetch;
	const requestTimeoutMs =
		options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
	const healthTimeoutMs = options.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;
	const headers = {
		Accept: "application/json",
		Authorization: `Bearer ${token}`,
	};

	return {
		async health(): Promise<LocalTtsHealth> {
			let response: Response;
			try {
				response = await fetcher(`${baseUrl}/health`, {
					headers,
					signal: AbortSignal.timeout(healthTimeoutMs),
				});
			} catch {
				return unavailableHealth("无法连接远程语音网关。");
			}
			if (response.status === 401 || response.status === 403) {
				return unavailableHealth("远程语音网关鉴权失败。");
			}
			if (!response.ok) {
				return unavailableHealth(`远程语音网关返回 HTTP ${response.status}。`);
			}
			const value = (await response
				.json()
				.catch(() => null)) as Partial<LocalTtsHealth> | null;
			if (!value || value.model !== "v2ProPlus") {
				return unavailableHealth("远程语音网关返回了无效健康状态。");
			}
			return {
				available: value.available === true,
				model: "v2ProPlus",
				referencesReady: value.referencesReady === true,
				upstreamReady: value.upstreamReady === true,
				...(typeof value.reason === "string" ? { reason: value.reason } : {}),
			};
		},

		async synthesize(input: LocalTtsSynthesisInput): Promise<LocalTtsAudio> {
			let response: Response;
			try {
				response = await fetcher(`${baseUrl}/v1/tts`, {
					method: "POST",
					headers: {
						...headers,
						Accept: "audio/wav",
						"Content-Type": "application/json",
					},
					body: JSON.stringify(input),
					signal: AbortSignal.timeout(requestTimeoutMs),
				});
			} catch {
				throw new LocalTtsRuntimeError(
					"TTS_UPSTREAM_UNAVAILABLE",
					"无法连接远程语音网关。",
					503,
				);
			}

			if (response.status === 401 || response.status === 403) {
				throw new LocalTtsRuntimeError(
					"TTS_GATEWAY_AUTH_FAILED",
					"远程语音网关鉴权失败。",
					503,
				);
			}
			if (response.status === 429) {
				throw new LocalTtsRuntimeError(
					"TTS_GATEWAY_BUSY",
					"语音请求较多，请稍后重试。",
					429,
				);
			}
			if (!response.ok) {
				throw new LocalTtsRuntimeError(
					"TTS_UPSTREAM_REJECTED",
					`远程语音网关拒绝了请求（HTTP ${response.status}）。`,
					502,
				);
			}

			let bytes: ArrayBuffer;
			try {
				bytes = await response.arrayBuffer();
			} catch {
				throw new LocalTtsRuntimeError(
					"TTS_UPSTREAM_UNAVAILABLE",
					"读取远程语音时连接中断。",
					503,
				);
			}
			if (
				!response.headers.get("content-type")?.includes("audio/") ||
				!isWav(bytes)
			) {
				throw new LocalTtsRuntimeError(
					"TTS_INVALID_AUDIO",
					"远程语音网关未返回有效 WAV 音频。",
					502,
				);
			}
			return {
				bytes,
				contentType: "audio/wav",
				emotion: readEmotion(
					response.headers.get("x-local-tts-emotion"),
					input.emotion,
				),
			};
		},
	};
}

export function createRemoteTtsRuntimeFromEnv(
	env: Record<string, unknown>,
): LocalTtsRuntime | undefined {
	const baseUrl = env.TTS_UPSTREAM_URL;
	const token = env.TTS_SERVICE_TOKEN;
	if (typeof baseUrl !== "string" || typeof token !== "string")
		return undefined;
	if (!baseUrl.trim() || !token.trim()) return undefined;
	try {
		return createRemoteTtsRuntime({ baseUrl, token });
	} catch {
		return undefined;
	}
}
