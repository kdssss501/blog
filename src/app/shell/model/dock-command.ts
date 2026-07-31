export type DockCommandId =
	| "home"
	| "theme"
	| "search"
	| "tools"
	| "menu"
	| "guestbook"
	| "comment"
	| "xiao"
	| "music"
	| "settings"
	| "categories"
	| "announcement"
	| "tags"
	| "toc"
	| "posts"
	| "books"
	| "spine"
	| "toggle"
	| "top";

export type DockDrawerId =
	| "announcement"
	| "guestbook"
	| "music"
	| "settings"
	| "tags"
	| "toc";

export type DockCommandAction =
	| { type: "navigate"; path: string }
	| { type: "drawer"; drawer: DockDrawerId }
	| { type: "scroll"; target: "top" | string }
	| { type: "theme" }
	| { type: "search" }
	| { type: "xiao" }
	| { type: "spine" }
	| { type: "surface"; surface: "desktop" | "tools" | "menu" };

export type DockVisibility =
	| "always"
	| "non-home"
	| "article"
	| "comments"
	| "toc"
	| "book-detail"
	| "scrolled";

export interface DockCommand {
	id: DockCommandId;
	label: string;
	icon: string;
	action: DockCommandAction;
	visibility: DockVisibility;
}

export interface DockRuntimeContext {
	pathname: string;
	scrollY: number;
	hasComments: boolean;
	hasToc: boolean;
}

export const dockCommands = {
	home: {
		id: "home",
		label: "主页",
		icon: "material-symbols:home-outline-rounded",
		action: { type: "navigate", path: "/" },
		visibility: "non-home",
	},
	theme: {
		id: "theme",
		label: "主题",
		icon: "material-symbols:wb-sunny-outline-rounded",
		action: { type: "theme" },
		visibility: "always",
	},
	search: {
		id: "search",
		label: "搜索",
		icon: "material-symbols:search-rounded",
		action: { type: "search" },
		visibility: "always",
	},
	tools: {
		id: "tools",
		label: "工具",
		icon: "material-symbols:grid-view-outline-rounded",
		action: { type: "surface", surface: "tools" },
		visibility: "always",
	},
	menu: {
		id: "menu",
		label: "菜单",
		icon: "material-symbols:menu-rounded",
		action: { type: "surface", surface: "menu" },
		visibility: "always",
	},
	guestbook: {
		id: "guestbook",
		label: "留言板",
		icon: "material-symbols:edit-note",
		action: { type: "drawer", drawer: "guestbook" },
		visibility: "always",
	},
	comment: {
		id: "comment",
		label: "页面评论",
		icon: "mingcute:comment-line",
		action: { type: "scroll", target: "#post-comments" },
		visibility: "comments",
	},
	xiao: {
		id: "xiao",
		label: "小爱助手",
		icon: "material-symbols:auto-awesome-rounded",
		action: { type: "xiao" },
		visibility: "always",
	},
	music: {
		id: "music",
		label: "音乐",
		icon: "material-symbols:music-note-rounded",
		action: { type: "drawer", drawer: "music" },
		visibility: "always",
	},
	settings: {
		id: "settings",
		label: "主题设置",
		icon: "material-symbols:palette-outline",
		action: { type: "drawer", drawer: "settings" },
		visibility: "always",
	},
	categories: {
		id: "categories",
		label: "分类",
		icon: "material-symbols:category-outline-rounded",
		action: { type: "navigate", path: "/categories/" },
		visibility: "always",
	},
	announcement: {
		id: "announcement",
		label: "公告",
		icon: "material-symbols:notifications-outline-rounded",
		action: { type: "drawer", drawer: "announcement" },
		visibility: "always",
	},
	tags: {
		id: "tags",
		label: "标签",
		icon: "material-symbols:label-outline-rounded",
		action: { type: "drawer", drawer: "tags" },
		visibility: "always",
	},
	toc: {
		id: "toc",
		label: "目录",
		icon: "material-symbols:format-list-bulleted-rounded",
		action: { type: "drawer", drawer: "toc" },
		visibility: "toc",
	},
	posts: {
		id: "posts",
		label: "全部文章",
		icon: "material-symbols:article-outline-rounded",
		action: { type: "navigate", path: "/posts/" },
		visibility: "article",
	},
	books: {
		id: "books",
		label: "返回书架",
		icon: "material-symbols:menu-book-outline-rounded",
		action: { type: "navigate", path: "/books/" },
		visibility: "book-detail",
	},
	spine: {
		id: "spine",
		label: "角色模型",
		icon: "material-symbols:accessibility-new-rounded",
		action: { type: "spine" },
		visibility: "always",
	},
	toggle: {
		id: "toggle",
		label: "展开",
		icon: "material-symbols:more-horiz",
		action: { type: "surface", surface: "desktop" },
		visibility: "always",
	},
	top: {
		id: "top",
		label: "回到顶部",
		icon: "material-symbols:keyboard-arrow-up-rounded",
		action: { type: "scroll", target: "top" },
		visibility: "scrolled",
	},
} as const satisfies Record<DockCommandId, DockCommand>;

export const DESKTOP_PINNED_COMMANDS = [
	"theme",
	"guestbook",
	"toggle",
] as const satisfies readonly DockCommandId[];

export const DESKTOP_EXPANDED_COMMANDS = [
	"comment",
	"xiao",
	"music",
	"search",
	"settings",
	"categories",
	"announcement",
	"home",
	"toc",
	"posts",
	"books",
	"spine",
	"top",
] as const satisfies readonly DockCommandId[];

export const MOBILE_PRIMARY_COMMANDS = [
	"home",
	"theme",
	"search",
	"tools",
	"menu",
] as const satisfies readonly DockCommandId[];

export const MOBILE_TOOL_COMMANDS = [
	"guestbook",
	"xiao",
	"music",
	"announcement",
	"settings",
	"tags",
	"categories",
	"comment",
	"toc",
	"posts",
	"books",
	"top",
	"spine",
] as const satisfies readonly DockCommandId[];

function normalizePath(pathname: string): string {
	return pathname.replace(/\/+$/, "") || "/";
}

export function isGuestbookPathname(pathname: string): boolean {
	const normalized = normalizePath(pathname);
	return normalized === "/guestbook" || normalized === "/life/guestbook";
}

export function isDockCommandVisible(
	command: DockCommand,
	context: DockRuntimeContext,
): boolean {
	const pathname = normalizePath(context.pathname);
	const isArticle = pathname === "/posts" || pathname.startsWith("/posts/");
	const isBookDetail = pathname.startsWith("/books/") && pathname !== "/books";
	if (command.id === "guestbook" && isGuestbookPathname(pathname)) return false;

	switch (command.visibility) {
		case "always":
			return true;
		case "non-home":
			return pathname !== "/";
		case "article":
			return isArticle;
		case "comments":
			return context.hasComments;
		case "toc":
			return isArticle && context.hasToc;
		case "book-detail":
			return isBookDetail;
		case "scrolled":
			return context.scrollY > 200;
	}
}
