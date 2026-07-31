export type XiaoThoughtPeriod = "morning" | "afternoon" | "night";

export interface XiaoThoughtAsset {
	src: string;
	alt: string;
}

export interface XiaoThought {
	id: string;
	origin: "xiao";
	period: XiaoThoughtPeriod;
	periodLabel: string;
	title: string;
	content: string;
	publishedAt: string;
	image?: string;
	imageAlt?: string;
}

interface BeijingDateParts {
	year: number;
	month: number;
	day: number;
	hour: number;
}

const PERIODS = [
	{ id: "morning", label: "晨间", hour: 8 },
	{ id: "afternoon", label: "午后", hour: 14 },
	{ id: "night", label: "夜晚", hour: 21 },
] as const;

const THOUGHT_COPY: Record<XiaoThoughtPeriod, string[]> = {
	morning: [
		"把今天最重要的一件事先写下来，完成它之后再处理噪声。",
		"清晨适合给复杂问题留一块安静的空白，答案常常会自己浮出来。",
		"先整理桌面，再整理思路。秩序不必完美，只要足够开始。",
		"今天也从一个可以完成的小动作开始。",
	],
	afternoon: [
		"长时间盯着同一个问题时，离开屏幕走几分钟也是工作的一部分。",
		"午后的进度不需要追赶上午，只需要继续向前。",
		"如果方案变得越来越复杂，试着重新写一遍真正要解决的问题。",
		"留一点余量给意外，节奏会比速度更可靠。",
	],
	night: [
		"把没有完成的事情放进明天，而不是继续放在今晚的脑海里。",
		"今天留下的笔记，会成为下一次开始时最短的路。",
		"关掉最后一个窗口之前，记得承认今天已经完成的部分。",
		"夜晚适合收束，不适合审判自己。",
	],
};

function getBeijingDateParts(now: Date): BeijingDateParts {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		hourCycle: "h23",
	}).formatToParts(now);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((part) => part.type === type)?.value ?? 0);
	return {
		year: get("year"),
		month: get("month"),
		day: get("day"),
		hour: get("hour"),
	};
}

function dateKey(parts: BeijingDateParts): string {
	return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function stableHash(value: string): number {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function getPublishDate(parts: BeijingDateParts, hour: number): Date {
	return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour - 8));
}

export function createDailyXiaoThoughts(
	now: Date,
	assets: XiaoThoughtAsset[] = [],
): XiaoThought[] {
	const parts = getBeijingDateParts(now);
	const day = dateKey(parts);
	return PERIODS.map((period) => {
		const seed = stableHash(`${day}:${period.id}`);
		const copy = THOUGHT_COPY[period.id];
		const asset = assets.length > 0 ? assets[seed % assets.length] : undefined;
		return {
			id: `xiao-${day}-${period.id}`,
			origin: "xiao",
			period: period.id,
			periodLabel: period.label,
			title: `吸血鬼心想 · ${period.label}`,
			content: copy[seed % copy.length],
			publishedAt: getPublishDate(parts, period.hour).toISOString(),
			image: asset?.src,
			imageAlt: asset?.alt,
		};
	});
}

export function getPublishedXiaoThoughts(
	now: Date,
	assets: XiaoThoughtAsset[] = [],
): XiaoThought[] {
	return createDailyXiaoThoughts(now, assets).filter(
		(thought) => Date.parse(thought.publishedAt) <= now.getTime(),
	);
}
