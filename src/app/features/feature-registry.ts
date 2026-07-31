import type { SiteConfig } from "../../types/config";

export type FeatureGroup =
	| "primary"
	| "articles"
	| "navigation"
	| "activity"
	| "records"
	| "about";
export type PageFeatureFlag = keyof SiteConfig["pages"];

export type FeatureId =
	| "home"
	| "collections"
	| "projects"
	| "archive"
	| "categories"
	| "postList"
	| "write"
	| "friends"
	| "guestbook"
	| "activity"
	| "calendar"
	| "gallery"
	| "album"
	| "sponsor"
	| "notebook"
	| "friendFeed"
	| "xiao"
	| "music"
	| "books"
	| "moviesGames"
	| "changelog"
	| "routines"
	| "places"
	| "config"
	| "about";

export interface FeatureDefinition {
	id: FeatureId;
	label: string;
	path: string;
	icon: string;
	group: FeatureGroup;
	flag?: PageFeatureFlag;
}

export const featureRegistry = {
	home: {
		id: "home",
		label: "主页",
		path: "/",
		icon: "material-symbols:home-outline-rounded",
		group: "primary",
	},
	collections: {
		id: "collections",
		label: "网站导航",
		path: "/collections/",
		icon: "material-symbols:explore-outline-rounded",
		group: "navigation",
		flag: "collections",
	},
	projects: {
		id: "projects",
		label: "项目",
		path: "/projects/",
		icon: "material-symbols:deployed-code-outline",
		group: "navigation",
		flag: "projects",
	},
	archive: {
		id: "archive",
		label: "归档",
		path: "/archive/",
		icon: "material-symbols:archive-outline-rounded",
		group: "articles",
	},
	categories: {
		id: "categories",
		label: "分类",
		path: "/categories/",
		icon: "material-symbols:category-outline-rounded",
		group: "articles",
	},
	postList: {
		id: "postList",
		label: "文章列表",
		path: "/posts/",
		icon: "material-symbols:article-outline-rounded",
		group: "articles",
	},
	write: {
		id: "write",
		label: "写文章",
		path: "/write/",
		icon: "material-symbols:edit-square-outline-rounded",
		group: "articles",
		flag: "write",
	},
	friends: {
		id: "friends",
		label: "友链",
		path: "/friends/",
		icon: "material-symbols:group-outline-rounded",
		group: "about",
		flag: "friends",
	},
	guestbook: {
		id: "guestbook",
		label: "留言板",
		path: "/life/guestbook/",
		icon: "material-symbols:chat-bubble-outline-rounded",
		group: "activity",
		flag: "guestbook",
	},
	activity: {
		id: "activity",
		label: "说说",
		path: "/moments/",
		icon: "material-symbols:forum-outline-rounded",
		group: "activity",
		flag: "activity",
	},
	calendar: {
		id: "calendar",
		label: "日历",
		path: "/calendar/",
		icon: "material-symbols:calendar-month-outline-rounded",
		group: "records",
		flag: "calendar",
	},
	gallery: {
		id: "gallery",
		label: "旧相册入口",
		path: "/gallery/",
		icon: "material-symbols:photo-library-outline-rounded",
		group: "activity",
		flag: "gallery",
	},
	album: {
		id: "album",
		label: "相册",
		path: "/album/",
		icon: "material-symbols:photo-library-outline-rounded",
		group: "activity",
		flag: "album",
	},
	sponsor: {
		id: "sponsor",
		label: "赞助",
		path: "/sponsor/",
		icon: "material-symbols:favorite-outline-rounded",
		group: "about",
		flag: "sponsor",
	},
	notebook: {
		id: "notebook",
		label: "笔记本",
		path: "/life/notebooks/",
		icon: "material-symbols:menu-book-outline-rounded",
		group: "activity",
		flag: "notebook",
	},
	friendFeed: {
		id: "friendFeed",
		label: "朋友动态",
		path: "/pengyou/",
		icon: "material-symbols:dynamic-feed-rounded",
		group: "activity",
		flag: "friendFeed",
	},
	xiao: {
		id: "xiao",
		label: "小恶魔",
		path: "/live2D/",
		icon: "material-symbols:auto-awesome-rounded",
		group: "primary",
		flag: "xiao",
	},
	music: {
		id: "music",
		label: "音乐",
		path: "/music/",
		icon: "material-symbols:graphic-eq-rounded",
		group: "records",
		flag: "musicPage",
	},
	books: {
		id: "books",
		label: "书架",
		path: "/books/",
		icon: "material-symbols:local-library-outline-rounded",
		group: "records",
		flag: "books",
	},
	moviesGames: {
		id: "moviesGames",
		label: "影视游戏",
		path: "/movies-games/",
		icon: "material-symbols:movie-outline-rounded",
		group: "records",
		flag: "moviesGames",
	},
	changelog: {
		id: "changelog",
		label: "更新日志",
		path: "/changelog/",
		icon: "material-symbols:history-rounded",
		group: "records",
		flag: "changelog",
	},
	routines: {
		id: "routines",
		label: "规划",
		path: "/life/routines/",
		icon: "material-symbols:event-note-outline-rounded",
		group: "records",
		flag: "routines",
	},
	places: {
		id: "places",
		label: "足迹",
		path: "/life/places/",
		icon: "material-symbols:map-outline-rounded",
		group: "records",
		flag: "places",
	},
	config: {
		id: "config",
		label: "站点配置",
		path: "/config/",
		icon: "material-symbols:settings-outline-rounded",
		group: "about",
		flag: "config",
	},
	about: {
		id: "about",
		label: "关于",
		path: "/about/",
		icon: "material-symbols:person-outline-rounded",
		group: "about",
	},
} as const satisfies Record<FeatureId, FeatureDefinition>;

export function isFeatureEnabled(
	id: FeatureId,
	pageFlags: SiteConfig["pages"],
): boolean {
	const feature = featureRegistry[id];
	return "flag" in feature ? pageFlags[feature.flag] : true;
}

export function getEnabledFeatures(
	pageFlags: SiteConfig["pages"],
): FeatureDefinition[] {
	return Object.values(featureRegistry).filter((feature) =>
		isFeatureEnabled(feature.id, pageFlags),
	);
}
