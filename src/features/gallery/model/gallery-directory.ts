import type { GalleryAlbum } from "@/types/config";

export const GALLERY_VIEWS = ["local", "network"] as const;
export type GalleryView = (typeof GALLERY_VIEWS)[number];

export type GalleryDirectoryAlbum = GalleryAlbum & {
	cover: string;
	photoCount: number;
};

export function isGalleryView(value: unknown): value is GalleryView {
	return GALLERY_VIEWS.includes(value as GalleryView);
}

export function parseGalleryHash(hash: string): GalleryView | null {
	const match = hash.match(/^#gallery-(local|network)$/i);
	const value = match?.[1]?.toLowerCase();
	return isGalleryView(value) ? value : null;
}

export function createGalleryHash(view: GalleryView): string {
	return `#gallery-${view}`;
}

export function normalizeGalleryView(
	value: unknown,
	fallback: GalleryView = "local",
): GalleryView {
	return isGalleryView(value) ? value : fallback;
}

export function getGalleryTags(albums: Pick<GalleryAlbum, "tags">[]): string[] {
	const normalizedTags = albums
		.flatMap((album) => album.tags ?? [])
		.map((tag) => tag.trim())
		.filter(Boolean);
	return [...new Set(normalizedTags)].sort((left, right) =>
		left.localeCompare(right, "zh-CN"),
	);
}

export function normalizeGalleryTag(
	value: unknown,
	availableTags: string[],
): string {
	if (value === "all") return "all";
	return typeof value === "string" && availableTags.includes(value)
		? value
		: "all";
}

export function galleryAlbumMatchesTag(
	tags: string[],
	selectedTag: string,
): boolean {
	return selectedTag === "all" || tags.includes(selectedTag);
}

export function getGalleryNavigationIndex(
	currentIndex: number,
	total: number,
	key: string,
): number {
	if (total <= 0) return -1;
	if (key === "Home") return 0;
	if (key === "End") return total - 1;
	if (key === "ArrowRight" || key === "ArrowDown") {
		return (Math.max(currentIndex, 0) + 1) % total;
	}
	if (key === "ArrowLeft" || key === "ArrowUp") {
		return (Math.max(currentIndex, 0) - 1 + total) % total;
	}
	return currentIndex;
}
