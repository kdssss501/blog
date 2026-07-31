import { getCollection } from "astro:content";
import {
	type ActivityImage,
	type ActivityRecord,
	createActivitySlug,
	type NormalizedActivity,
	normalizeActivity,
} from "./model/activity-content";

function imageList(value: string | string[]): ActivityImage[] {
	const images = Array.isArray(value) ? value : value ? [value] : [];
	return images
		.filter((url) => /^(?:https:\/\/|\/)/i.test(url))
		.map((url) => ({ url, source: "manual" as const }));
}

export async function getObsidianActivities(): Promise<NormalizedActivity[]> {
	const entries = await getCollection("moments", ({ data }) => !data.draft);
	return entries
		.map((entry) => {
			const published = entry.data.published.getTime();
			const updated = entry.data.updated?.getTime() ?? published;
			const slug = createActivitySlug(entry.data.slug || entry.id);
			const record: ActivityRecord = {
				id: `obsidian:${entry.id}`,
				slug,
				title: entry.data.title,
				content: entry.body ?? "",
				body: entry.body ?? "",
				images: imageList(entry.data.images),
				author: entry.data.author,
				avatar: entry.data.avatar,
				tags: entry.data.tags,
				location: entry.data.location,
				device: entry.data.device,
				createdAt: published,
				updatedAt: updated,
			};
			return normalizeActivity(record);
		})
		.sort((left, right) => right.createdAt - left.createdAt);
}
