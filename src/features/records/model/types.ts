export type BangumiCategory =
	| "book"
	| "anime"
	| "movie"
	| "tv"
	| "documentary"
	| "game"
	| "music"
	| "real";

export interface BangumiEntry {
	id: string;
	title: string;
	nameCn: string;
	category: BangumiCategory;
	subcategory?: "movie" | "tv" | "anime" | "documentary";
	status: number;
	image: string;
	link: string;
	score?: number;
	comment: string;
	tags: string[];
	published?: string;
}

export type ChangelogType = "feature" | "improvement" | "fix" | "removal";

export interface ChangelogEntry {
	id: string;
	version: string;
	date: string;
	time: string;
	type: ChangelogType;
	description: string;
}

export interface RoutineEntry {
	id: string;
	name: string;
	time: string;
	description: string;
	icon: string;
	color: string;
	updatedAt?: string;
}

export interface PlaceEntry {
	id: string;
	title: string;
	province: string;
	city: string;
	experience: string;
	visitCount: number;
	date?: string;
	lat?: number;
	lng?: number;
}

export function getBangumiStatusLabel(
	category: BangumiCategory,
	status: number,
): string {
	const labels =
		category === "book"
			? ["想读", "读完", "在读", "搁置", "放弃"]
			: category === "game"
				? ["想玩", "玩过", "在玩", "搁置", "放弃"]
				: category === "music"
					? ["想听", "听过", "在听", "搁置", "放弃"]
					: ["想看", "看过", "在看", "搁置", "放弃"];
	return labels[status - 1] ?? "未知";
}

export function filterBangumiEntries(
	entries: BangumiEntry[],
	category: BangumiCategory | "all",
	status: number | "all",
): BangumiEntry[] {
	return entries.filter(
		(entry) =>
			(category === "all" || entry.category === category) &&
			(status === "all" || entry.status === status),
	);
}
