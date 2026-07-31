export const ARTWORK_THEMES = [
	"鸣潮",
	"命运王座",
	"EVA",
	"Re:Zero",
	"无职转生",
	"原创",
	"蔚蓝档案",
	"碧蓝航线",
	"原神",
	"明日方舟：终末地",
	"绝区零",
] as const;

export const ARTWORK_PERMISSIONS = [
	"artist-authorized",
	"official-license",
	"self-owned",
	"user-provided",
] as const;

export type ArtworkTheme = (typeof ARTWORK_THEMES)[number];
export type ArtworkPermission = (typeof ARTWORK_PERMISSIONS)[number];

export interface ArtworkAttribution {
	artist: string;
	sourceUrl: string;
	license: string;
	permission: ArtworkPermission;
	theme: ArtworkTheme;
}

export function formatArtworkCredit(attribution: ArtworkAttribution): string {
	return `插图：${attribution.artist} · ${attribution.theme}`;
}
