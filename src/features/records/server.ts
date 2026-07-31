import { getCollection } from "astro:content";
import type {
	BangumiCategory,
	BangumiEntry,
	ChangelogEntry,
	PlaceEntry,
	RoutineEntry,
} from "./model/types";

function normalizeId(id: string): string {
	return id.replace(/\\/g, "/").replace(/\.(?:md|mdx|ya?ml)$/i, "");
}

export async function getBangumiEntries(
	categories?: BangumiCategory[],
): Promise<BangumiEntry[]> {
	const entries = await getCollection("bangumi");
	return entries
		.filter((entry) => !categories || categories.includes(entry.data.category))
		.map((entry) => {
			const id = normalizeId(entry.id);
			const base =
				entry.data.category === "book" ? "/books/" : "/movies-games/";
			return {
				id,
				title: entry.data.title,
				nameCn: entry.data.name_cn,
				category: entry.data.category,
				subcategory: entry.data.subcategory,
				status: entry.data.status,
				image: entry.data.image,
				link: entry.data.link || `${base}${id}/`,
				score: entry.data.score,
				comment: entry.data.comment,
				tags: entry.data.tags,
				published: entry.data.published?.toISOString(),
			};
		})
		.sort(
			(a, b) =>
				new Date(b.published ?? 0).getTime() -
				new Date(a.published ?? 0).getTime(),
		);
}

export async function getChangelogEntries(): Promise<ChangelogEntry[]> {
	const entries = await getCollection("changelog");
	return entries
		.map((entry) => ({
			id: normalizeId(entry.id),
			version: entry.data.version,
			date: entry.data.date.toISOString(),
			time: entry.data.time,
			type: entry.data.type,
			description: entry.data.description,
		}))
		.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export async function getRoutineEntries(): Promise<RoutineEntry[]> {
	const entries = await getCollection("routines");
	return entries
		.map((entry) => ({
			id: normalizeId(entry.id),
			name: entry.data.name,
			time: entry.data.time,
			description: entry.data.description,
			icon: entry.data.icon,
			color: entry.data.color,
			updatedAt: entry.data.updatedAt?.toISOString(),
		}))
		.sort(
			(a, b) =>
				new Date(b.updatedAt ?? 0).getTime() -
				new Date(a.updatedAt ?? 0).getTime(),
		);
}

export async function getPlaceEntries(): Promise<PlaceEntry[]> {
	const entries = await getCollection("places");
	return entries
		.map((entry) => ({
			id: normalizeId(entry.id),
			title: entry.data.title,
			province: entry.data.province,
			city: entry.data.city,
			experience: entry.data.experience,
			visitCount: entry.data.visitCount,
			date: entry.data.date?.toISOString(),
			lat: entry.data.lat,
			lng: entry.data.lng,
		}))
		.sort(
			(a, b) =>
				new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime(),
		);
}
