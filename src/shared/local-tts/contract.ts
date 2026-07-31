export const LOCAL_TTS_EMOTIONS = ["neutral", "happy", "sad", "angry"] as const;

export type LocalTtsEmotion = (typeof LOCAL_TTS_EMOTIONS)[number];

const EMOTION_ALIASES: Readonly<Record<string, LocalTtsEmotion>> = {
	neutral: "neutral",
	calm: "neutral",
	curious: "neutral",
	confused: "neutral",
	surprised: "neutral",
	happy: "neutral",
	excited: "neutral",
	affectionate: "happy",
	shy: "happy",
	sad: "sad",
	concerned: "sad",
	tired: "sad",
	anxiety: "sad",
	anxious: "sad",
	anger: "angry",
	angry: "angry",
	mad: "angry",
	warning: "angry",
};

export interface LocalTtsSynthesisInput {
	text: string;
	emotion: LocalTtsEmotion;
}

export interface LocalTtsAudio {
	bytes: ArrayBuffer;
	contentType: "audio/wav";
	emotion: LocalTtsEmotion;
}

export interface LocalTtsHealth {
	available: boolean;
	model: "v2ProPlus";
	referencesReady: boolean;
	upstreamReady: boolean;
	reason?: string;
}

export interface LocalTtsRuntime {
	synthesize(input: LocalTtsSynthesisInput): Promise<LocalTtsAudio>;
	health(): Promise<LocalTtsHealth>;
}

export class LocalTtsRuntimeError extends Error {
	readonly code: string;
	readonly status: number;

	constructor(code: string, message: string, status: number) {
		super(message);
		this.name = "LocalTtsRuntimeError";
		this.code = code;
		this.status = status;
	}
}

export type LocalTtsInputResult =
	| { ok: true; value: LocalTtsSynthesisInput }
	| { ok: false; code: string; error: string };

const ALLOWED_INPUT_FIELDS = new Set(["text", "emotion"]);
const JAPANESE_CHARACTER_PATTERN =
	/^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}々〆ヵヶー、。！？…・「」『』（）〜～]+$/u;
const JAPANESE_KANA_PATTERN = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const SENTENCE_SEPARATOR_PATTERN = /[。！？]+/u;

function hasControlCharacter(value: string): boolean {
	for (const character of value) {
		const code = character.codePointAt(0) ?? 0;
		if (code <= 31 || code === 127) return true;
	}
	return false;
}

export function resolveLocalTtsEmotion(value: unknown): LocalTtsEmotion | null {
	if (typeof value !== "string") return null;
	return EMOTION_ALIASES[value.trim().toLowerCase()] ?? null;
}

export function normalizeLocalTtsInput(value: unknown): LocalTtsInputResult {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {
			ok: false,
			code: "TTS_INVALID_BODY",
			error: "语音请求必须是 JSON 对象。",
		};
	}
	const source = value as Record<string, unknown>;
	const unsupportedFields = Object.keys(source).filter(
		(key) => !ALLOWED_INPUT_FIELDS.has(key),
	);
	if (unsupportedFields.length > 0) {
		return {
			ok: false,
			code: "TTS_UNSUPPORTED_FIELDS",
			error: "语音请求只允许 text 与 emotion 字段。",
		};
	}

	const emotion = resolveLocalTtsEmotion(source.emotion);
	if (!emotion) {
		return {
			ok: false,
			code: "TTS_INVALID_EMOTION",
			error: "不支持该语音情绪。",
		};
	}
	if (typeof source.text !== "string") {
		return {
			ok: false,
			code: "TTS_INVALID_TEXT",
			error: "语音文本不能为空。",
		};
	}

	const text = source.text.normalize("NFC");
	if (!text || text !== text.trim() || text.length > 96) {
		return {
			ok: false,
			code: "TTS_INVALID_TEXT",
			error: "语音文本必须是 1 到 96 个连续字符。",
		};
	}
	if (
		hasControlCharacter(text) ||
		!JAPANESE_CHARACTER_PATTERN.test(text) ||
		!JAPANESE_KANA_PATTERN.test(text)
	) {
		return {
			ok: false,
			code: "TTS_JAPANESE_ONLY",
			error: "语音文本只允许连续的日语正文。",
		};
	}

	const sentenceCount = text
		.split(SENTENCE_SEPARATOR_PATTERN)
		.filter(Boolean).length;
	if (sentenceCount < 1 || sentenceCount > 3) {
		return {
			ok: false,
			code: "TTS_SENTENCE_LIMIT",
			error: "语音文本必须包含 1 到 3 句日语。",
		};
	}

	return { ok: true, value: { text, emotion } };
}
