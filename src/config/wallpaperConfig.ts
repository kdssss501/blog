export type WallpaperSlide = {
	src: string;
	alt: string;
	label: string;
	position: string;
};

export const wallpaperConfig = {
	autoplayMs: 12_000,
	slides: [
		{
			src: "/assets/illustrations/wuthering-waves/123672850-p0.webp",
			alt: "守岸人立于潮汐之间",
			label: "SHOREKEEPER",
			position: "46% 22%",
		},
		{
			src: "/assets/illustrations/wuthering-waves/125838182-p0.webp",
			alt: "锦鲤与鸣潮角色",
			label: "RESONANCE",
			position: "57% 30%",
		},
		{
			src: "/assets/illustrations/wuthering-waves/137680111-p0.webp",
			alt: "城市高空的千咲",
			label: "CHISA",
			position: "52% 23%",
		},
		{
			src: "/assets/illustrations/wuthering-waves/132439582-p0.webp",
			alt: "霓虹空间中的鸣潮角色",
			label: "AFTERGLOW",
			position: "50% 24%",
		},
	] satisfies WallpaperSlide[],
} as const;
