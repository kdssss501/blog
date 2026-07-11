const LOCAL_ACTIVITY_GALLERY_BASE = "/gallery/gpt-img2-2026";

export const ACTIVITY_GALLERY_FILES = [
	"1.webp",
	"2.webp",
	"3.webp",
	"4.webp",
	"5.webp",
	"6.webp",
	"7.webp",
	"16.webp",
	"20.webp",
	"21.webp",
	"22.webp",
	"24.webp",
];

export function getLocalActivityGalleryUrl(fileName: string): string {
	return `${LOCAL_ACTIVITY_GALLERY_BASE}/${fileName}`;
}

function hashSeed(seed: string): number {
	let hash = 0;
	for (let index = 0; index < seed.length; index += 1) {
		hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
	}
	return hash;
}

export function pickLocalActivityGalleryFile(seed: string): string {
	if (!ACTIVITY_GALLERY_FILES.length) return "1.webp";
	const hash = hashSeed(seed || "activity-gallery");
	return ACTIVITY_GALLERY_FILES[hash % ACTIVITY_GALLERY_FILES.length];
}

export function pickLocalActivityGalleryUrl(seed: string): string {
	return getLocalActivityGalleryUrl(pickLocalActivityGalleryFile(seed));
}
