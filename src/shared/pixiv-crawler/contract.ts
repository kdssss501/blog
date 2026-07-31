export const PIXIV_CRAWLER_MODES = ["keyword", "ranking", "user"] as const;

export type PixivCrawlerMode = (typeof PIXIV_CRAWLER_MODES)[number];
export type PixivCrawlerState =
	| "unavailable"
	| "idle"
	| "running"
	| "succeeded"
	| "failed"
	| "cancelled";

export interface PixivCrawlerStartInput {
	mode: PixivCrawlerMode;
	query: string;
	count: number;
	date?: string;
}

export interface PixivCrawlerStatus {
	available: boolean;
	state: PixivCrawlerState;
	reason?: string;
	jobId?: string;
	mode?: PixivCrawlerMode;
	query?: string;
	count?: number;
	startedAt?: string;
	finishedAt?: string;
	outputPath?: string;
	imageCount?: number;
	command?: string;
	log?: string;
}

export type PixivCrawlerInputResult =
	| { ok: true; value: PixivCrawlerStartInput }
	| { ok: false; error: string };

function validDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const parsed = new Date(`${value}T00:00:00Z`);
	return (
		!Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
	);
}

function hasControlCharacter(value: string): boolean {
	for (const character of value) {
		const code = character.charCodeAt(0);
		if (code <= 31 || code === 127) return true;
	}
	return false;
}

export function normalizePixivCrawlerInput(
	value: unknown,
): PixivCrawlerInputResult {
	if (!value || typeof value !== "object") {
		return { ok: false, error: "请求参数格式不正确。" };
	}
	const source = value as Record<string, unknown>;
	const mode = typeof source.mode === "string" ? source.mode : "";
	if (!PIXIV_CRAWLER_MODES.includes(mode as PixivCrawlerMode)) {
		return { ok: false, error: "不支持的采集模式。" };
	}

	const count = Number(source.count);
	if (!Number.isInteger(count) || count < 1 || count > 30) {
		return { ok: false, error: "采集数量必须是 1 到 30 的整数。" };
	}

	const query = typeof source.query === "string" ? source.query.trim() : "";
	if (hasControlCharacter(query)) {
		return { ok: false, error: "查询条件包含不支持的控制字符。" };
	}

	if (mode === "keyword" && (query.length < 1 || query.length > 60)) {
		return { ok: false, error: "关键词长度必须是 1 到 60 个字符。" };
	}
	if (mode === "user" && !/^\d{4,20}$/.test(query)) {
		return { ok: false, error: "画师 UID 必须是 4 到 20 位数字。" };
	}

	const date = typeof source.date === "string" ? source.date : "";
	if (mode === "ranking" && date && !validDate(date)) {
		return { ok: false, error: "排行榜日期格式不正确。" };
	}

	return {
		ok: true,
		value: {
			mode: mode as PixivCrawlerMode,
			query: mode === "ranking" ? "" : query,
			count,
			...(mode === "ranking" && date ? { date } : {}),
		},
	};
}

export interface PixivCrawlerRuntime {
	getStatus(): Promise<PixivCrawlerStatus>;
	start(input: PixivCrawlerStartInput): Promise<PixivCrawlerStatus>;
	cancel(): Promise<PixivCrawlerStatus>;
}
