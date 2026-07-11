export const GALLERY_IMAGES: string[] = [
	"1.webp", "2.webp", "3.webp", "4.webp", "5.webp", "6.webp", "7.webp",
	"16.webp", "20.webp", "21.webp", "22.webp", "24.webp", "25.webp",
	"26.webp", "27.webp", "28.webp", "41.webp", "42.webp", "43.webp",
	"44.webp", "50.webp", "80.webp", "100.webp", "101.webp", "102.webp",
	"103.webp", "104.webp", "105.webp", "107.webp", "200.webp", "201.webp",
	"202.webp", "203.webp", "204.webp", "205.webp"
];

export function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
}

export function getCoverImage(cover: string, name: string): string {
	if (cover && (cover.indexOf("data:") === 0 || cover.indexOf("http") === 0)) {
		return cover;
	}
	let imgIndex = 0;
	if (cover && cover.indexOf("default-") === 0) {
		const num = parseInt(cover.replace("default-", ""), 10);
		if (!isNaN(num) && num >= 1 && num <= GALLERY_IMAGES.length) {
			imgIndex = num - 1;
		}
	}
	if (imgIndex < 0 || imgIndex >= GALLERY_IMAGES.length) {
		imgIndex = hashString(name || "n") % GALLERY_IMAGES.length;
	}
	return "/gallery/gpt-img2-2026/" + GALLERY_IMAGES[imgIndex];
}