export type CinematicClipId = "saber-prologue" | "fgo-art-cut";

export type CinematicClip = {
	id: CinematicClipId;
	title: string;
	duration: number;
	poster: string;
	webm: string;
	mp4: string;
};

export const CINEMATIC_CLIPS: Record<CinematicClipId, CinematicClip> = {
	"saber-prologue": {
		id: "saber-prologue",
		title: "阿尔托莉雅 · 白昼序章",
		duration: 2.5,
		poster: "/assets/videos/fate/saber-prologue-poster.webp",
		webm: "/assets/videos/fate/saber-prologue.webm",
		mp4: "/assets/videos/fate/saber-prologue.mp4",
	},
	"fgo-art-cut": {
		id: "fgo-art-cut",
		title: "FGO · 艺术瞬间",
		duration: 2.5,
		poster: "/assets/videos/fate/fgo-art-cut-poster.webp",
		webm: "/assets/videos/fate/fgo-art-cut.webm",
		mp4: "/assets/videos/fate/fgo-art-cut.mp4",
	},
};

export function isCinematicClipId(value: string | undefined): value is CinematicClipId {
	return Boolean(value && value in CINEMATIC_CLIPS);
}
