import type { SidebarLayoutConfig } from "../types/config";

export const sidebarLayoutConfig: SidebarLayoutConfig = {
	enable: true,
	position: "both",
	tabletSidebar: "left",
	showBothSidebarsOnPostPage: true,
	leftComponents: [
		{
			type: "profile",
			enable: true,
			position: "top",
			showOnPostPage: true,
			variants: ["default", "social"],
		},
		{
			type: "calendar",
			enable: true,
			position: "top",
			showOnPostPage: false,
			variants: ["posts", "social"],
		},
		{
			type: "stats",
			enable: true,
			position: "sticky",
			showOnPostPage: true,
		},
	],
	rightComponents: [
		{
			type: "hotRanking",
			enable: true,
			position: "top",
			showOnPostPage: false,
			variants: ["posts", "social"],
		},
		{
			type: "quote",
			enable: true,
			position: "top",
			showOnPostPage: false,
			variants: ["posts", "social"],
		},
		{
			type: "recentPosts",
			enable: true,
			position: "sticky",
			showOnPostPage: false,
			variants: ["posts", "social"],
		},
		{
			type: "sidebarToc",
			enable: true,
			position: "sticky",
			showOnPostPage: true,
			showOnNonPostPage: false,
			variants: ["default"],
		},
	],
	mobileBottomComponents: [
		{
			type: "profile",
			enable: true,
			showOnPostPage: true,
		},
		{
			type: "recentPosts",
			enable: true,
			showOnPostPage: false,
		},
	],
};
