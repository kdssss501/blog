import I18nKey from "@/i18n/i18nKey";
import type { EventType } from "@/utils/calendar-events";

// 4 类事件的颜色/图标/标签映射
// 颜色用 Tailwind 任意值类，整页主基调黑白，色彩仅用于色条 / 圆点 / 胶囊
// 修改这里即可调整全站日历配色

export type EventTypeMeta = {
	type: EventType;
	labelKey: I18nKey;
	icon: string;
	// 主色：用于色条 background 和圆点
	dotClass: string;
	barClass: string;
	// 胶囊背景（低饱和度，配合深色文字）
	chipClass: string;
};

export const eventTypeMeta: Record<EventType, EventTypeMeta> = {
	holiday: {
		type: "holiday",
		labelKey: I18nKey.calendarHoliday,
		icon: "material-symbols:celebration",
		dotClass: "bg-red-500 dark:bg-red-400",
		barClass: "bg-red-500 dark:bg-red-400",
		chipClass: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
	},
	birthday: {
		type: "birthday",
		labelKey: I18nKey.calendarBirthday,
		icon: "material-symbols:cake",
		dotClass: "bg-pink-500 dark:bg-pink-400",
		barClass: "bg-pink-500 dark:bg-pink-400",
		chipClass:
			"bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
	},
	schedule: {
		type: "schedule",
		labelKey: I18nKey.calendarSchedule,
		icon: "material-symbols:event",
		dotClass: "bg-sky-500 dark:bg-sky-400",
		barClass: "bg-sky-500 dark:bg-sky-400",
		chipClass: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
	},
	post: {
		type: "post",
		labelKey: I18nKey.calendarPost,
		icon: "material-symbols:article",
		dotClass: "bg-neutral-700 dark:bg-neutral-300",
		barClass: "bg-neutral-700 dark:bg-neutral-300",
		chipClass:
			"bg-neutral-100 text-neutral-700 dark:bg-neutral-700/40 dark:text-neutral-300",
	},
};
