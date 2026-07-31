import type { NormalizedActivity } from "./activity-content";

export interface XiaoMomentInput {
	id: string;
	title: string;
	content: string;
	publishedAt: string;
	image?: string;
	imageAlt?: string;
}

function formatPublishedAt(timestamp: number): string {
	return new Intl.DateTimeFormat("zh-CN", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).format(new Date(timestamp));
}

export function toXiaoMomentActivity(
	thought: XiaoMomentInput,
): NormalizedActivity {
	const timestamp = Date.parse(thought.publishedAt);
	const images = thought.image
		? [
				{
					url: thought.image,
					alt: thought.imageAlt || thought.title,
					source: "manual" as const,
				},
			]
		: [];

	return {
		id: thought.id,
		origin: "xiao",
		slug: thought.id,
		title: thought.title,
		excerpt: thought.content,
		body: thought.content,
		html: `<p>${thought.content}</p>`,
		overview: {
			readingMinutes: 1,
			sectionCount: 1,
			imageCount: images.length,
			updatedLabel: formatPublishedAt(timestamp),
		},
		createdAt: timestamp,
		updatedAt: timestamp,
		coverImage: thought.image || "",
		images,
		author: "小爱",
		avatar: "",
		tags: ["小爱心想"],
		location: "心想",
		device: "",
	};
}

export function mergeMomentActivities(
	primaryItems: NormalizedActivity[],
	secondaryItems: NormalizedActivity[],
): NormalizedActivity[] {
	const itemsByIdentity = new Map<string, NormalizedActivity>();
	for (const item of [...primaryItems, ...secondaryItems]) {
		itemsByIdentity.set(item.slug || item.id, item);
	}
	return [...itemsByIdentity.values()].sort(
		(left, right) => right.createdAt - left.createdAt,
	);
}
