// Node-only bridge between the site API and the local GPT-SoVITS process.
import { access } from "node:fs/promises";
import path from "node:path";
import {
	type LocalTtsAudio,
	type LocalTtsEmotion,
	type LocalTtsHealth,
	type LocalTtsRuntime,
	LocalTtsRuntimeError,
	type LocalTtsSynthesisInput,
} from "../../shared/local-tts/contract.ts";

export const GPT_SOVITS_BASE_URL = "http://127.0.0.1:9880";

export const V2_PRO_PLUS_LOW_LATENCY_PARAMETERS = {
	text_lang: "all_ja",
	prompt_lang: "all_ja",
	top_k: 10,
	top_p: 0.9,
	temperature: 0.8,
	text_split_method: "cut0",
	batch_size: 1,
	batch_threshold: 0.75,
	split_bucket: false,
	speed_factor: 1.05,
	fragment_interval: 0.1,
	seed: -1,
	media_type: "wav",
	streaming_mode: 3,
	parallel_infer: false,
	repetition_penalty: 1.35,
	sample_steps: 32,
	super_sampling: false,
	overlap_length: 2,
	min_chunk_length: 16,
} as const;

interface ReferenceProfile {
	segments: readonly [string, string];
	promptText: string;
}

export const GPT_SOVITS_REFERENCE_PROFILES: Readonly<
	Record<LocalTtsEmotion, ReferenceProfile>
> = {
	neutral: {
		segments: ["欣慰", "はいそうですねルディ身長大きくなりましたね.wav"],
		promptText: "はいそうですねルディ身長大きくなりましたね",
	},
	happy: {
		segments: [
			"害羞",
			"えっと、ルーデオスさん、その、ありがとうございました.wav",
		],
		promptText: "えっと、ルーデオスさん、その、ありがとうございました",
	},
	sad: {
		segments: ["委屈", "だって仕方ないじゃないですか好きなんですよ.wav"],
		promptText: "だって仕方ないじゃないですか好きなんですよ",
	},
	angry: {
		segments: [
			"责备",
			"もし妊娠でもしてしまったらどうする気なのですかまったく.wav",
		],
		promptText: "もし妊娠でもしてしまったらどうする気なのですかまったく",
	},
};

type Fetcher = typeof fetch;
type FileExists = (filePath: string) => Promise<boolean>;

export interface LocalGptSovitsOptions {
	fetcher?: Fetcher;
	fileExists?: FileExists;
	projectRoot?: string;
	requestTimeoutMs?: number;
	healthTimeoutMs?: number;
}

async function defaultFileExists(filePath: string): Promise<boolean> {
	return access(filePath).then(
		() => true,
		() => false,
	);
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

export function getGptSovitsReferenceRoot(projectRoot = process.cwd()): string {
	return path.resolve(projectRoot, "GPT-SoVITS-v2pro-20250604", "参考音频实例");
}

export function getGptSovitsReferencePath(
	emotion: LocalTtsEmotion,
	projectRoot = process.cwd(),
): string {
	const root = getGptSovitsReferenceRoot(projectRoot);
	const target = path.resolve(
		root,
		...GPT_SOVITS_REFERENCE_PROFILES[emotion].segments,
	);
	const relative = path.relative(root, target);
	if (relative.startsWith("..") || path.isAbsolute(relative)) {
		throw new LocalTtsRuntimeError(
			"TTS_REFERENCE_INVALID",
			"本地语音参考配置无效。",
			500,
		);
	}
	return target;
}

export function createLocalGptSovitsRuntime(
	options: LocalGptSovitsOptions = {},
): LocalTtsRuntime {
	const fetcher = options.fetcher ?? fetch;
	const fileExists = options.fileExists ?? defaultFileExists;
	const projectRoot = options.projectRoot ?? process.cwd();
	const requestTimeoutMs = options.requestTimeoutMs ?? 45_000;
	const healthTimeoutMs = options.healthTimeoutMs ?? 1_500;

	const referenceEntries = Object.keys(GPT_SOVITS_REFERENCE_PROFILES).map(
		(emotion) =>
			[
				emotion as LocalTtsEmotion,
				getGptSovitsReferencePath(emotion as LocalTtsEmotion, projectRoot),
			] as const,
	);
	const referencePaths = Object.fromEntries(referenceEntries) as Record<
		LocalTtsEmotion,
		string
	>;

	const health = async (): Promise<LocalTtsHealth> => {
		const referencesReady = (
			await Promise.all(Object.values(referencePaths).map(fileExists))
		).every(Boolean);
		let upstreamReady = false;
		try {
			const response = await fetcher(`${GPT_SOVITS_BASE_URL}/openapi.json`, {
				headers: { Accept: "application/json" },
				signal: AbortSignal.timeout(healthTimeoutMs),
			});
			upstreamReady = response.ok;
		} catch {
			upstreamReady = false;
		}
		return {
			available: referencesReady && upstreamReady,
			model: "v2ProPlus",
			referencesReady,
			upstreamReady,
			...(!referencesReady
				? { reason: "本地日语参考音频不完整。" }
				: !upstreamReady
					? { reason: "GPT-SoVITS 尚未在 127.0.0.1:9880 就绪。" }
					: {}),
		};
	};

	return {
		health,
		async synthesize(input: LocalTtsSynthesisInput): Promise<LocalTtsAudio> {
			const profile = GPT_SOVITS_REFERENCE_PROFILES[input.emotion];
			const refAudioPath = referencePaths[input.emotion];
			if (!(await fileExists(refAudioPath))) {
				throw new LocalTtsRuntimeError(
					"TTS_REFERENCE_MISSING",
					"该情绪的本地日语参考音频不存在。",
					503,
				);
			}

			let response: Response;
			try {
				response = await fetcher(`${GPT_SOVITS_BASE_URL}/tts`, {
					method: "POST",
					headers: {
						Accept: "audio/wav",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						text: input.text,
						ref_audio_path: refAudioPath,
						prompt_text: profile.promptText,
						...V2_PRO_PLUS_LOW_LATENCY_PARAMETERS,
					}),
					signal: AbortSignal.timeout(requestTimeoutMs),
				});
			} catch {
				throw new LocalTtsRuntimeError(
					"TTS_UPSTREAM_UNAVAILABLE",
					"无法连接本机 GPT-SoVITS 服务。",
					503,
				);
			}

			if (!response.ok) {
				throw new LocalTtsRuntimeError(
					"TTS_UPSTREAM_REJECTED",
					`GPT-SoVITS 拒绝了合成请求（HTTP ${response.status}）。`,
					502,
				);
			}
			let bytes: ArrayBuffer;
			try {
				bytes = await response.arrayBuffer();
			} catch {
				throw new LocalTtsRuntimeError(
					"TTS_UPSTREAM_UNAVAILABLE",
					"读取本机 GPT-SoVITS 音频时连接中断。",
					503,
				);
			}
			if (
				!response.headers.get("content-type")?.includes("audio/") ||
				!isWav(bytes)
			) {
				throw new LocalTtsRuntimeError(
					"TTS_INVALID_AUDIO",
					"GPT-SoVITS 未返回有效 WAV 音频。",
					502,
				);
			}
			return { bytes, contentType: "audio/wav", emotion: input.emotion };
		},
	};
}

let runtime: LocalTtsRuntime | undefined;

export function getLocalGptSovitsRuntime(): LocalTtsRuntime {
	runtime ??= createLocalGptSovitsRuntime();
	return runtime;
}
