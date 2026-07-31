import {
	homeConfig,
	live2dModelConfig,
	musicPlayerConfig,
	sidebarLayoutConfig,
	siteConfig,
	spineModelConfig,
} from "@/config";
import {
	normalizePublicSiteConfig,
	type PublicSiteConfig,
	validatePublicSiteConfig,
} from "@/features/admin";
import {
	type StorageAdapter,
	type StorageEnvironment,
	storageGetJSON,
	storageSetJSON,
} from "../../storage";
import { getUnifiedAdminAccess } from "../admin-auth";
import { jsonResponse, readJsonObject } from "../http";

const CONFIG_KEY = "site-config:public:v1";

function defaultConfig(): PublicSiteConfig {
	return {
		title: siteConfig.title,
		subtitle: siteConfig.subtitle,
		description: siteConfig.description || "",
		siteUrl: siteConfig.site_url,
		authorName: homeConfig.displayName || homeConfig.name,
		accentHue: siteConfig.themeColor.hue,
		themeMode: siteConfig.themeColor.defaultMode || "system",
		wallpaperMode: "none",
		sakuraEnabled: false,
		defaultPostLayout: siteConfig.postListLayout.defaultMode,
		allowPostLayoutSwitch: siteConfig.postListLayout.allowSwitch,
		postsPerPage: siteConfig.pagination.postsPerPage,
		sidebarPosition: sidebarLayoutConfig.position,
		homeStatus: homeConfig.bio?.[0] || "",
		announcement: "",
		pageWidth: siteConfig.pageWidth || 100,
		cardBorder: siteConfig.card.border,
		wallpaperDesktop: homeConfig.hero?.backgroundImage || "",
		wallpaperMobile: homeConfig.hero?.backgroundImageMobile || "",
		bannerTitle: siteConfig.title,
		wavesEnabled: true,
		sakuraCount: 21,
		postGridColumns: siteConfig.postListLayout.grid.columns || 3,
		postMasonry: siteConfig.postListLayout.grid.masonry,
		musicEnabled: musicPlayerConfig.showInNavbar !== false,
		live2dEnabled: live2dModelConfig.enable,
		spineEnabled: spineModelConfig.enable,
		profileBio: homeConfig.bio?.[0] || "",
		leftSidebarWidgets: sidebarLayoutConfig.leftComponents
			.filter((component) => component.enable)
			.map((component) => component.type),
		rightSidebarWidgets: sidebarLayoutConfig.rightComponents
			.filter((component) => component.enable)
			.map((component) => component.type),
		pageFlags: { ...siteConfig.pages },
		updatedAt: 0,
	};
}

async function getConfig(storage: StorageAdapter): Promise<PublicSiteConfig> {
	const fallback = defaultConfig();
	const stored = await storageGetJSON<Record<string, unknown>>(
		storage,
		CONFIG_KEY,
	);
	return stored ? normalizePublicSiteConfig(stored, fallback) : fallback;
}

export async function handleSiteConfigRequest(
	storage: StorageAdapter,
	request: Request,
	env: StorageEnvironment,
): Promise<Response> {
	if (request.method === "GET") {
		return jsonResponse({ config: await getConfig(storage) });
	}

	const access = await getUnifiedAdminAccess(
		request,
		env.BLOG_ADMIN_TOKEN,
		undefined,
		"Blog",
	);
	if (!access.granted) {
		return jsonResponse({ error: access.error }, access.status);
	}

	if (request.method === "DELETE") {
		await storage.delete(CONFIG_KEY);
		return jsonResponse({ config: defaultConfig(), reset: true });
	}
	if (request.method !== "PUT" && request.method !== "POST") {
		return jsonResponse({ error: "Method Not Allowed" }, 405);
	}
	const config = {
		...normalizePublicSiteConfig(
			await readJsonObject(request),
			await getConfig(storage),
		),
		updatedAt: Date.now(),
	};
	const errors = validatePublicSiteConfig(config);
	if (errors.length > 0) {
		return jsonResponse({ error: "Validation failed", errors }, 422);
	}
	await storageSetJSON(storage, CONFIG_KEY, config);
	return jsonResponse({ config });
}
