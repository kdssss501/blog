import assert from "node:assert/strict";
import {
	normalizePublicSiteConfig,
	validatePublicSiteConfig,
} from "../../src/features/admin/model/public-site-config.ts";

const fallback = {
	title: "默认站点",
	subtitle: "默认副标题",
	description: "默认描述",
	siteUrl: "https://example.com",
	authorName: "作者",
	accentHue: 165,
	themeMode: "system",
	wallpaperMode: "none",
	sakuraEnabled: false,
	defaultPostLayout: "grid",
	allowPostLayoutSwitch: true,
	postsPerPage: 10,
	sidebarPosition: "both",
	homeStatus: "记录生活",
	announcement: "",
	pageWidth: 100,
	cardBorder: true,
	wallpaperDesktop: "/assets/images/home/home.webp",
	wallpaperMobile: "/assets/images/home/home-mobile.webp",
	bannerTitle: "默认站点",
	wavesEnabled: true,
	sakuraCount: 21,
	postGridColumns: 3,
	postMasonry: false,
	musicEnabled: true,
	live2dEnabled: true,
	spineEnabled: false,
	profileBio: "记录生活",
	leftSidebarWidgets: ["profile", "announcement"],
	rightSidebarWidgets: ["stats", "calendar"],
	pageFlags: { guestbook: true, album: true },
	updatedAt: 0,
};

const config = normalizePublicSiteConfig(
	{
		title: "新站点",
		accentHue: 999,
		postsPerPage: 999,
		pageWidth: 999,
		leftSidebarWidgets: ["profile", "", 42],
		pageFlags: { guestbook: false, unknown: false },
		themeMode: "unknown",
		BLOG_ADMIN_TOKEN: "must-not-appear",
	},
	fallback,
);
assert.equal(config.title, "新站点");
assert.equal(config.accentHue, 360);
assert.equal(config.postsPerPage, 50);
assert.equal(config.pageWidth, 140);
assert.deepEqual(config.leftSidebarWidgets, ["profile"]);
assert.deepEqual(config.pageFlags, { guestbook: false, album: true });
assert.equal(config.themeMode, "system");
assert.equal("BLOG_ADMIN_TOKEN" in config, false);
assert.deepEqual(validatePublicSiteConfig(config), []);
assert.deepEqual(
	validatePublicSiteConfig({ ...config, siteUrl: "javascript:alert(1)" }),
	["站点 URL 必须是有效的 HTTP(S) 地址"],
);

console.log("Public site config checks passed.");
