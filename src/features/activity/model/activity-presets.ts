import type { ActivityRecord } from "./activity-content";

export const ACTIVITY_PRESET_VERSION = "dumpling-theme-73b9759";

const REFERENCE_MOMENTS: ActivityRecord[] = [
	{
		id: "dumpling-moment-2026-05-28",
		slug: "2026-05-28-exploring",
		content:
			"在读 Astro 的文档，v5 的 Content Layer API 真的很强大，做博客正合适。",
		body: "在读 Astro 的文档，v5 的 Content Layer API 真的很强大，做博客正合适。",
		presentationVersion: ACTIVITY_PRESET_VERSION,
		createdAt: new Date("2026-05-28T12:00:00+08:00").getTime(),
		updatedAt: new Date("2026-05-28T12:00:00+08:00").getTime(),
		tags: ["阅读", "技术"],
		location: "咖啡馆",
		images: [],
	},
	{
		id: "dumpling-moment-2026-05-29",
		slug: "2026-05-29-building",
		content: "花了一个下午折腾侧边栏组件和主题色。这套配置系统真的太灵活了！🎨",
		body: "花了一个下午折腾侧边栏组件和主题色。这套配置系统真的太灵活了！🎨",
		presentationVersion: ACTIVITY_PRESET_VERSION,
		createdAt: new Date("2026-05-29T12:00:00+08:00").getTime(),
		updatedAt: new Date("2026-05-29T12:00:00+08:00").getTime(),
		tags: ["编程", "Astro"],
		location: "家中",
		images: [],
	},
	{
		id: "dumpling-moment-2026-05-30",
		slug: "2026-05-30-hello",
		content: "用 Dumpling 主题搭建的博客总算上线了！一切都很完美 🎉",
		body: "用 Dumpling 主题搭建的博客总算上线了！一切都很完美 🎉",
		presentationVersion: ACTIVITY_PRESET_VERSION,
		createdAt: new Date("2026-05-30T12:00:00+08:00").getTime(),
		updatedAt: new Date("2026-05-30T12:00:00+08:00").getTime(),
		tags: ["生活", "博客"],
		location: "互联网",
		device: "网页端",
		images: [],
	},
];

export function getDefaultActivities(): ActivityRecord[] {
	return REFERENCE_MOMENTS.map((item) => ({
		...item,
		tags: [...(item.tags ?? [])],
		images: [...(item.images ?? [])],
	}));
}

export function shouldResetActivities(items: ActivityRecord[]): boolean {
	return (
		items.length !== REFERENCE_MOMENTS.length ||
		items.some((item) => item.presentationVersion !== ACTIVITY_PRESET_VERSION)
	);
}
