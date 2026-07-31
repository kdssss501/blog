import type { FriendLink } from "./types";

export type FriendPage = {
	items: FriendLink[];
	page: number;
	totalPages: number;
	totalItems: number;
};

export function getFriendTags(items: FriendLink[]): string[] {
	return [...new Set(items.flatMap((item) => item.tags ?? []))].sort((a, b) =>
		a.localeCompare(b),
	);
}

export function filterFriends(items: FriendLink[], tag: string): FriendLink[] {
	if (!tag || tag === "all") return items;
	return items.filter((item) => item.tags?.includes(tag));
}

export function paginateFriends(
	items: FriendLink[],
	page: number,
	pageSize: number,
): FriendPage {
	const safePageSize = Math.max(1, Math.floor(pageSize) || 1);
	const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
	const safePage = Math.min(totalPages, Math.max(1, Math.floor(page) || 1));
	const start = (safePage - 1) * safePageSize;
	return {
		items: items.slice(start, start + safePageSize),
		page: safePage,
		totalPages,
		totalItems: items.length,
	};
}
