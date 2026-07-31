export const DISPLAY_PREFERENCES_VERSION = 2 as const;
export const DISPLAY_PREFERENCES_STORAGE_KEY = "blog:display-preferences:v2";

export type DisplayThemeMode = "light" | "dark" | "system";
export type WallpaperMode = "banner" | "full" | "overlay" | "none";
export type PostLayoutMode = "list" | "grid";

export interface DisplayPreferencesV2 {
	version: typeof DISPLAY_PREFERENCES_VERSION;
	theme: DisplayThemeMode;
	hue: number;
	wallpaperMode: WallpaperMode;
	sakura: boolean;
	postLayout: PostLayoutMode;
	/** 首页壁纸上的站点标题是否可见。 */
	wallpaperTitle: boolean;
	/** 是否在壁纸层轮播已配置的图片。 */
	wallpaperCarousel: boolean;
	/** 是否启用页面指针水波纹反馈。 */
	waterRipple: boolean;
	/** 是否启用主题、壁纸和表面渐变过渡。 */
	gradientTransition: boolean;
	/** 透明壁纸模式下的背景可见度（20-100）。 */
	overlayOpacity: number;
	/** 透明壁纸模式下的背景模糊半径（0-24px）。 */
	overlayBlur: number;
	/** 透明壁纸模式下卡片的不透明度（20-96）。 */
	overlayCardOpacity: number;
}

export interface DisplayPreferencesDefaults {
	theme?: DisplayThemeMode;
	hue?: number;
	wallpaperMode?: WallpaperMode;
	sakura?: boolean;
	postLayout?: PostLayoutMode;
	wallpaperTitle?: boolean;
	wallpaperCarousel?: boolean;
	waterRipple?: boolean;
	gradientTransition?: boolean;
	overlayOpacity?: number;
	overlayBlur?: number;
	overlayCardOpacity?: number;
}

export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

const THEME_MODES = new Set<DisplayThemeMode>(["light", "dark", "system"]);
const WALLPAPER_MODES = new Set<WallpaperMode>([
	"banner",
	"full",
	"overlay",
	"none",
]);
const POST_LAYOUTS = new Set<PostLayoutMode>(["list", "grid"]);

export function clampHue(value: unknown, fallback = 310): number {
	const parsed =
		typeof value === "number" ? value : Number.parseInt(String(value), 10);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(360, Math.max(0, Math.round(parsed)));
}

function readTheme(
	value: unknown,
	fallback: DisplayThemeMode,
): DisplayThemeMode {
	return THEME_MODES.has(value as DisplayThemeMode)
		? (value as DisplayThemeMode)
		: fallback;
}

function readWallpaperMode(
	value: unknown,
	fallback: WallpaperMode,
): WallpaperMode {
	if (value === "fullscreen") return "full";
	return WALLPAPER_MODES.has(value as WallpaperMode)
		? (value as WallpaperMode)
		: fallback;
}

function clampNumber(
	value: unknown,
	fallback: number,
	minimum: number,
	maximum: number,
): number {
	if (value === null || value === undefined || value === "") return fallback;
	const parsed = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function readPostLayout(
	value: unknown,
	fallback: PostLayoutMode,
): PostLayoutMode {
	return POST_LAYOUTS.has(value as PostLayoutMode)
		? (value as PostLayoutMode)
		: fallback;
}

export function createDefaultDisplayPreferences(
	defaults: DisplayPreferencesDefaults = {},
): DisplayPreferencesV2 {
	return {
		version: DISPLAY_PREFERENCES_VERSION,
		theme: readTheme(defaults.theme, "light"),
		hue: clampHue(defaults.hue, 310),
		wallpaperMode: readWallpaperMode(defaults.wallpaperMode, "none"),
		sakura: defaults.sakura === true,
		postLayout: readPostLayout(defaults.postLayout, "grid"),
		wallpaperTitle: defaults.wallpaperTitle ?? true,
		wallpaperCarousel: defaults.wallpaperCarousel === true,
		waterRipple: defaults.waterRipple ?? true,
		gradientTransition: defaults.gradientTransition ?? true,
		overlayOpacity: clampNumber(defaults.overlayOpacity, 88, 20, 100),
		overlayBlur: clampNumber(defaults.overlayBlur, 2, 0, 24),
		overlayCardOpacity: clampNumber(defaults.overlayCardOpacity, 68, 20, 96),
	};
}

function parseStoredPreferences(
	raw: string | null,
): Partial<DisplayPreferencesV2> {
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object"
			? (parsed as Partial<DisplayPreferencesV2>)
			: {};
	} catch {
		return {};
	}
}

export function readDisplayPreferences(
	storage: Pick<StorageLike, "getItem"> | undefined,
	defaults: DisplayPreferencesDefaults = {},
): DisplayPreferencesV2 {
	const base = createDefaultDisplayPreferences(defaults);
	if (!storage) return base;

	const stored = parseStoredPreferences(
		storage.getItem(DISPLAY_PREFERENCES_STORAGE_KEY),
	);
	const legacyWallpaper = storage.getItem("wallpaperMode");
	const legacyBackground = storage.getItem("blog-background-mode");
	const migratedWallpaper = legacyWallpaper
		? legacyWallpaper
		: legacyBackground === "wallpaper"
			? "full"
			: legacyBackground === "plain"
				? "none"
				: undefined;
	const legacySakura = storage.getItem("sakuraEnabled");

	return {
		version: DISPLAY_PREFERENCES_VERSION,
		theme: readTheme(stored.theme ?? storage.getItem("theme"), base.theme),
		hue: clampHue(stored.hue ?? storage.getItem("hue"), base.hue),
		wallpaperMode: readWallpaperMode(
			stored.wallpaperMode ?? migratedWallpaper,
			base.wallpaperMode,
		),
		sakura:
			typeof stored.sakura === "boolean"
				? stored.sakura
				: legacySakura === null
					? base.sakura
					: legacySakura === "true",
		postLayout: readPostLayout(
			stored.postLayout ?? storage.getItem("postListLayout"),
			base.postLayout,
		),
		wallpaperTitle:
			typeof stored.wallpaperTitle === "boolean"
				? stored.wallpaperTitle
				: readLegacyBoolean(storage, "wallpaperTitle", base.wallpaperTitle),
		wallpaperCarousel:
			typeof stored.wallpaperCarousel === "boolean"
				? stored.wallpaperCarousel
				: readLegacyBoolean(
						storage,
						"wallpaperCarousel",
						base.wallpaperCarousel,
					),
		waterRipple:
			typeof stored.waterRipple === "boolean"
				? stored.waterRipple
				: readLegacyBoolean(storage, "waterRipple", base.waterRipple),
		gradientTransition:
			typeof stored.gradientTransition === "boolean"
				? stored.gradientTransition
				: readLegacyBoolean(
						storage,
						"gradientTransition",
						base.gradientTransition,
					),
		overlayOpacity: clampNumber(
			stored.overlayOpacity ??
				storage.getItem("overlayOpacity") ??
				storage.getItem("wallpaperOpacity"),
			base.overlayOpacity,
			20,
			100,
		),
		overlayBlur: clampNumber(
			stored.overlayBlur ??
				storage.getItem("overlayBlur") ??
				storage.getItem("backgroundBlur"),
			base.overlayBlur,
			0,
			24,
		),
		overlayCardOpacity: clampNumber(
			stored.overlayCardOpacity ??
				storage.getItem("overlayCardOpacity") ??
				storage.getItem("cardOpacity"),
			base.overlayCardOpacity,
			20,
			96,
		),
	};
}

function readLegacyBoolean(
	storage: Pick<StorageLike, "getItem">,
	key: string,
	fallback: boolean,
): boolean {
	const value = storage.getItem(key);
	return value === null ? fallback : value === "true";
}

export function writeDisplayPreferences(
	storage: StorageLike,
	preferences: DisplayPreferencesV2,
): DisplayPreferencesV2 {
	const normalized = readDisplayPreferences(
		{
			getItem(key) {
				if (key === DISPLAY_PREFERENCES_STORAGE_KEY) {
					return JSON.stringify(preferences);
				}
				return null;
			},
		},
		preferences,
	);

	storage.setItem(DISPLAY_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
	storage.setItem("theme", normalized.theme);
	storage.setItem("hue", String(normalized.hue));
	storage.setItem(
		"wallpaperMode",
		normalized.wallpaperMode === "full"
			? "fullscreen"
			: normalized.wallpaperMode,
	);
	storage.setItem(
		"blog-background-mode",
		normalized.wallpaperMode === "none" ? "plain" : "wallpaper",
	);
	storage.setItem("sakuraEnabled", String(normalized.sakura));
	storage.setItem("postListLayout", normalized.postLayout);
	storage.setItem("wallpaperTitle", String(normalized.wallpaperTitle));
	storage.setItem("wallpaperCarousel", String(normalized.wallpaperCarousel));
	storage.setItem("waterRipple", String(normalized.waterRipple));
	storage.setItem("gradientTransition", String(normalized.gradientTransition));
	storage.setItem("overlayOpacity", String(normalized.overlayOpacity));
	storage.setItem("overlayBlur", String(normalized.overlayBlur));
	storage.setItem("overlayCardOpacity", String(normalized.overlayCardOpacity));
	// 旧版脚本仍读取这些键，迁移期保持同值。
	storage.setItem("wallpaperOpacity", String(normalized.overlayOpacity));
	storage.setItem("backgroundBlur", String(normalized.overlayBlur));
	storage.setItem("cardOpacity", String(normalized.overlayCardOpacity));
	return normalized;
}

export function patchDisplayPreferences(
	storage: StorageLike,
	patch: Partial<Omit<DisplayPreferencesV2, "version">>,
	defaults: DisplayPreferencesDefaults = {},
): DisplayPreferencesV2 {
	const current = readDisplayPreferences(storage, defaults);
	return writeDisplayPreferences(storage, {
		...current,
		...patch,
		version: DISPLAY_PREFERENCES_VERSION,
	});
}
