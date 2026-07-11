import type { ActivityRecord } from "@/utils/activity-content";
import { getLocalActivityGalleryUrl } from "@/utils/activity-gallery";

export const LOCAL_ACTIVITY_IMAGE_PREFIX = "/gallery/gpt-img2-2026/";

function createActivityBody(
	heading: string,
	imageUrl: string,
	imageAlt: string,
	paragraphs: string[],
): string {
	return [`## ${heading}`, `![${imageAlt}](${imageUrl})`, ...paragraphs].join(
		"\n\n",
	);
}

export function getDefaultActivities(now = Date.now()): ActivityRecord[] {
	return [
		{
			id: "activity-001",
			slug: "gallery-note-01",
			title: "图集手记 01｜把节奏放轻一点",
			excerpt: "第一组动态改成了本地图册图文，先把今天的状态慢慢放轻。",
			content: "图集手记 01，把节奏放轻一点。",
			body: createActivityBody(
				"图集手记 01｜把节奏放轻一点",
				getLocalActivityGalleryUrl("1.webp"),
				"图集 01 对应配图",
				[
					"这次把动态内容统一换成了本地图册里的固定配图，列表和详情都直接走同一套图片来源。",
					"图注：图集 01 适合放在最前面，像给一天留出一个更轻的开场。",
				],
			),
			createdAt: now - 86400000 * 5,
			updatedAt: now - 86400000 * 5,
			images: [
				{
					url: getLocalActivityGalleryUrl("1.webp"),
					alt: "图集 01 对应配图",
					source: "manual",
				},
			],
		},
		{
			id: "activity-002",
			slug: "gallery-note-02",
			title: "图集手记 02｜把注意力重新收回来",
			excerpt: "第二组图文更适合写整理和回收注意力的瞬间。",
			content: "图集手记 02，把注意力重新收回来。",
			body: createActivityBody(
				"图集手记 02｜把注意力重新收回来",
				getLocalActivityGalleryUrl("2.webp"),
				"图集 02 对应配图",
				[
					"很多时候内容不需要太满，只要让图片和文字站在同一个节奏上，页面就会自然安静下来。",
					"图注：图集 02 作为第二条动态，负责承接整理、回看和重新聚焦的内容。",
				],
			),
			createdAt: now - 86400000 * 4,
			updatedAt: now - 86400000 * 4,
			images: [
				{
					url: getLocalActivityGalleryUrl("2.webp"),
					alt: "图集 02 对应配图",
					source: "manual",
				},
			],
		},
		{
			id: "activity-003",
			slug: "gallery-note-03",
			title: "图集手记 03｜留一段安静给自己",
			excerpt: "第三条动态保留了一点空白感，适合写慢下来之后的情绪。",
			content: "图集手记 03，留一段安静给自己。",
			body: createActivityBody(
				"图集手记 03｜留一段安静给自己",
				getLocalActivityGalleryUrl("3.webp"),
				"图集 03 对应配图",
				[
					"把动态统一成固定图库之后，详情页阅读会干净很多，图片不再到处跳来源。",
					"图注：图集 03 对应的是一段更安静的文字，重点不在热闹，而在状态被慢慢放平。",
				],
			),
			createdAt: now - 86400000 * 3,
			updatedAt: now - 86400000 * 3,
			images: [
				{
					url: getLocalActivityGalleryUrl("3.webp"),
					alt: "图集 03 对应配图",
					source: "manual",
				},
			],
		},
		{
			id: "activity-004",
			slug: "gallery-note-04",
			title: "图集手记 04｜把情绪也顺手整理一下",
			excerpt: "第四条图文更适合写回顾、复盘和把情绪放稳的片段。",
			content: "图集手记 04，把情绪也顺手整理一下。",
			body: createActivityBody(
				"图集手记 04｜把情绪也顺手整理一下",
				getLocalActivityGalleryUrl("4.webp"),
				"图集 04 对应配图",
				[
					"页面里那些会抢视线的杂项被拿掉之后，动态终于更像一组连续的图文记录，而不是临时拼起来的卡片。",
					"图注：图集 04 这一条主要承接复盘感，文字和图片一起把情绪压回稳定区间。",
				],
			),
			createdAt: now - 86400000 * 2,
			updatedAt: now - 86400000 * 2,
			images: [
				{
					url: getLocalActivityGalleryUrl("4.webp"),
					alt: "图集 04 对应配图",
					source: "manual",
				},
			],
		},
		{
			id: "activity-005",
			slug: "gallery-note-05",
			title: "图集手记 05｜白天和灵感都在慢慢变亮",
			excerpt: "第五条动态用来接住白天里那些逐渐变清晰的小想法。",
			content: "图集手记 05，白天和灵感都在慢慢变亮。",
			body: createActivityBody(
				"图集手记 05｜白天和灵感都在慢慢变亮",
				getLocalActivityGalleryUrl("5.webp"),
				"图集 05 对应配图",
				[
					"这批内容现在统一从本地图库读取，首图、正文图和详情页图廊终于都能保持同一来源。",
					"图注：图集 05 这一条更偏向白天、灵感和逐渐清晰下来的状态感。",
				],
			),
			createdAt: now - 86400000,
			updatedAt: now - 86400000,
			images: [
				{
					url: getLocalActivityGalleryUrl("5.webp"),
					alt: "图集 05 对应配图",
					source: "manual",
				},
			],
		},
		{
			id: "activity-006",
			slug: "gallery-note-06",
			title: "图集手记 06｜把今天收进最后一张图里",
			excerpt: "最后一条动态收尾，把整批图文记录落到统一的本地图库规则上。",
			content: "图集手记 06，把今天收进最后一张图里。",
			body: createActivityBody(
				"图集手记 06｜把今天收进最后一张图里",
				getLocalActivityGalleryUrl("6.webp"),
				"图集 06 对应配图",
				[
					"这一轮动态内容已经不再混用远程生成图，后续就算重新拉取数据，也会优先落回本地图库路径。",
					"图注：图集 06 负责收尾，让整批动态都落在同一个图片目录和同一种图文结构里。",
				],
			),
			createdAt: now - 3600000 * 6,
			updatedAt: now - 3600000 * 6,
			images: [
				{
					url: getLocalActivityGalleryUrl("6.webp"),
					alt: "图集 06 对应配图",
					source: "manual",
				},
			],
		},
	];
}

export function shouldResetActivities(items: ActivityRecord[]): boolean {
	if (!Array.isArray(items) || items.length === 0) return true;
	return items.some((item) => {
		const images = Array.isArray(item.images) ? item.images : [];
		const body = String(item.body || item.content || "");
		const hasLocalImage = images.some((image) =>
			String(image?.url || "").startsWith(LOCAL_ACTIVITY_IMAGE_PREFIX),
		);
		return !hasLocalImage || !body.includes(LOCAL_ACTIVITY_IMAGE_PREFIX);
	});
}
