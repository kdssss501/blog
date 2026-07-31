export interface PublicSiteConfig {
	title: string;
	subtitle: string;
	description: string;
	siteUrl: string;
	authorName: string;
	accentHue: number;
	themeMode: "light" | "dark" | "system";
	wallpaperMode: "banner" | "full" | "overlay" | "none";
	sakuraEnabled: boolean;
	defaultPostLayout: "list" | "grid";
	allowPostLayoutSwitch: boolean;
	postsPerPage: number;
	sidebarPosition: "left" | "right" | "both";
	homeStatus: string;
	announcement: string;
	pageWidth: number;
	cardBorder: boolean;
	wallpaperDesktop: string;
	wallpaperMobile: string;
	bannerTitle: string;
	wavesEnabled: boolean;
	sakuraCount: number;
	postGridColumns: 2 | 3;
	postMasonry: boolean;
	musicEnabled: boolean;
	live2dEnabled: boolean;
	spineEnabled: boolean;
	profileBio: string;
	leftSidebarWidgets: string[];
	rightSidebarWidgets: string[];
	pageFlags: Record<string, boolean>;
	updatedAt: number;
}

function choice<T extends string>(
	value: unknown,
	fallback: T,
	options: readonly T[],
): T {
	return typeof value === "string" && options.includes(value as T)
		? (value as T)
		: fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function integer(
	value: unknown,
	fallback: number,
	minimum: number,
	maximum: number,
): number {
	const parsed = Number(value);
	return Number.isFinite(parsed)
		? Math.max(minimum, Math.min(maximum, Math.round(parsed)))
		: fallback;
}

function text(value: unknown, fallback: string, maxLength: number): string {
	return typeof value === "string"
		? value.trim().slice(0, maxLength)
		: fallback;
}

function stringArray(
	value: unknown,
	fallback: string[],
	maximumItems = 24,
): string[] {
	if (!Array.isArray(value)) return [...fallback];
	return value
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim().slice(0, 60))
		.filter(Boolean)
		.slice(0, maximumItems);
}

function booleanRecord(
	value: unknown,
	fallback: Record<string, boolean>,
): Record<string, boolean> {
	const source = value && typeof value === "object" ? value : {};
	return Object.fromEntries(
		Object.entries(fallback).map(([key, defaultValue]) => [
			key,
			typeof (source as Record<string, unknown>)[key] === "boolean"
				? (source as Record<string, boolean>)[key]
				: defaultValue,
		]),
	);
}

export function normalizePublicSiteConfig(
	value: Record<string, unknown>,
	fallback: PublicSiteConfig,
): PublicSiteConfig {
	const hue = Number(value.accentHue);
	return {
		title: text(value.title, fallback.title, 80),
		subtitle: text(value.subtitle, fallback.subtitle, 120),
		description: text(value.description, fallback.description, 300),
		siteUrl: text(value.siteUrl, fallback.siteUrl, 240),
		authorName: text(value.authorName, fallback.authorName, 60),
		accentHue: Number.isFinite(hue)
			? Math.max(0, Math.min(360, Math.round(hue)))
			: fallback.accentHue,
		themeMode: choice(value.themeMode, fallback.themeMode, [
			"light",
			"dark",
			"system",
		]),
		wallpaperMode: choice(value.wallpaperMode, fallback.wallpaperMode, [
			"banner",
			"full",
			"overlay",
			"none",
		]),
		sakuraEnabled: bool(value.sakuraEnabled, fallback.sakuraEnabled),
		defaultPostLayout: choice(
			value.defaultPostLayout,
			fallback.defaultPostLayout,
			["list", "grid"],
		),
		allowPostLayoutSwitch: bool(
			value.allowPostLayoutSwitch,
			fallback.allowPostLayoutSwitch,
		),
		postsPerPage: integer(value.postsPerPage, fallback.postsPerPage, 1, 50),
		sidebarPosition: choice(value.sidebarPosition, fallback.sidebarPosition, [
			"left",
			"right",
			"both",
		]),
		homeStatus: text(value.homeStatus, fallback.homeStatus, 160),
		announcement: text(value.announcement, fallback.announcement, 500),
		pageWidth: integer(value.pageWidth, fallback.pageWidth, 48, 140),
		cardBorder: bool(value.cardBorder, fallback.cardBorder),
		wallpaperDesktop: text(
			value.wallpaperDesktop,
			fallback.wallpaperDesktop,
			500,
		),
		wallpaperMobile: text(value.wallpaperMobile, fallback.wallpaperMobile, 500),
		bannerTitle: text(value.bannerTitle, fallback.bannerTitle, 120),
		wavesEnabled: bool(value.wavesEnabled, fallback.wavesEnabled),
		sakuraCount: integer(value.sakuraCount, fallback.sakuraCount, 0, 100),
		postGridColumns: Number(value.postGridColumns) === 2 ? 2 : 3,
		postMasonry: bool(value.postMasonry, fallback.postMasonry),
		musicEnabled: bool(value.musicEnabled, fallback.musicEnabled),
		live2dEnabled: bool(value.live2dEnabled, fallback.live2dEnabled),
		spineEnabled: bool(value.spineEnabled, fallback.spineEnabled),
		profileBio: text(value.profileBio, fallback.profileBio, 240),
		leftSidebarWidgets: stringArray(
			value.leftSidebarWidgets,
			fallback.leftSidebarWidgets,
		),
		rightSidebarWidgets: stringArray(
			value.rightSidebarWidgets,
			fallback.rightSidebarWidgets,
		),
		pageFlags: booleanRecord(value.pageFlags, fallback.pageFlags),
		updatedAt:
			typeof value.updatedAt === "number"
				? value.updatedAt
				: fallback.updatedAt,
	};
}

export function validatePublicSiteConfig(config: PublicSiteConfig): string[] {
	const errors: string[] = [];
	if (!config.title) errors.push("站点名称不能为空");
	if (!config.description) errors.push("站点描述不能为空");
	if (!config.authorName) errors.push("作者名称不能为空");
	try {
		const url = new URL(config.siteUrl);
		if (url.protocol !== "https:" && url.protocol !== "http:")
			throw new Error();
	} catch {
		errors.push("站点 URL 必须是有效的 HTTP(S) 地址");
	}
	for (const [label, value] of [
		["桌面壁纸", config.wallpaperDesktop],
		["移动壁纸", config.wallpaperMobile],
	] as const) {
		if (!value || value.startsWith("/")) continue;
		try {
			const url = new URL(value);
			if (url.protocol !== "https:" && url.protocol !== "http:")
				throw new Error();
		} catch {
			errors.push(`${label}必须是站内路径或有效的 HTTP(S) 地址`);
		}
	}
	return errors;
}
