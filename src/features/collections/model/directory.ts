export type CollectionDirectoryItem = {
	name: string;
	url: string;
	description: string;
	icon?: string;
	enabled?: boolean;
};

export type CollectionDirectoryGroup = {
	category: string;
	items: CollectionDirectoryItem[];
};

export const COLLECTIONS_FILTER_STORAGE_KEY = "collections:selected-category";

/**
 * 将配置层的工具分组整理成稳定的展示模型。
 * 空分类和禁用条目在进入 UI 前移除，避免页面组件重复处理配置细节。
 */
export function normalizeCollectionGroups(
	groups: readonly CollectionDirectoryGroup[],
	preferredOrder: readonly string[] = [],
): CollectionDirectoryGroup[] {
	const order = new Map(
		preferredOrder.map((category, index) => [category, index]),
	);

	return groups
		.map((group) => ({
			category: group.category.trim(),
			items: group.items.filter((item) => item.enabled !== false),
		}))
		.filter((group) => group.category.length > 0 && group.items.length > 0)
		.sort((left, right) => {
			const leftOrder = order.get(left.category) ?? Number.MAX_SAFE_INTEGER;
			const rightOrder = order.get(right.category) ?? Number.MAX_SAFE_INTEGER;
			return leftOrder - rightOrder;
		});
}

export function getCollectionCategories(
	groups: readonly CollectionDirectoryGroup[],
): string[] {
	return ["all", ...groups.map((group) => group.category)];
}

export function resolveCollectionCategory(
	candidate: string | null | undefined,
	available: readonly string[],
	fallback = "all",
): string {
	if (candidate && available.includes(candidate)) return candidate;
	return available.includes(fallback) ? fallback : (available[0] ?? fallback);
}

export type ClockSnapshot = {
	dateLabel: string;
	timeLabel: string;
	iso: string;
};

/** 固定使用 Asia/Shanghai，避免客户端时区导致展示不一致。 */
export function getBeijingClockSnapshot(
	date: Date = new Date(),
): ClockSnapshot {
	const dateParts = new Intl.DateTimeFormat("zh-CN", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		weekday: "long",
	}).formatToParts(date);
	const timeLabel = new Intl.DateTimeFormat("zh-CN", {
		timeZone: "Asia/Shanghai",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	}).format(date);
	const value = (type: Intl.DateTimeFormatPartTypes) =>
		dateParts.find((part) => part.type === type)?.value ?? "";
	const year = value("year");
	const month = value("month");
	const day = value("day");
	const weekday = value("weekday");

	return {
		dateLabel: `${year}年${month}月${day}日 | ${weekday}`,
		timeLabel,
		iso: date.toISOString(),
	};
}
