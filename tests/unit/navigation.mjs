import assert from "node:assert/strict";
import { createNavigation } from "../../src/app/navigation/create-navigation.ts";

const allPages = {
	friends: true,
	sponsor: true,
	guestbook: true,
	gallery: true,
	collections: true,
	calendar: true,
	notebook: true,
	activity: true,
	album: true,
	friendFeed: true,
	books: true,
	moviesGames: true,
	musicPage: true,
	changelog: true,
	routines: true,
	places: true,
	projects: true,
	write: true,
	config: true,
	xiao: true,
};

const navigation = createNavigation(allPages);

assert.deepEqual(
	navigation.links.map((link) => link.name),
	["主页", "小恶魔", "文章", "网站导航", "动态", "记录", "关于"],
);
assert.equal(navigation.links[1].url, "/live2D/");
assert.equal(navigation.links[1].children, undefined);

const groups = Object.fromEntries(
	navigation.links
		.filter((link) => link.children)
		.map((link) => [link.name, link.children.map((child) => child.name)]),
);
assert.deepEqual(groups.文章, ["文章列表", "分类", "归档", "写文章"]);
assert.deepEqual(groups.动态, ["说说", "相册", "留言板", "笔记本", "朋友动态"]);
assert.deepEqual(groups.记录, [
	"书架",
	"影视游戏",
	"音乐",
	"更新日志",
	"日历",
	"规划",
	"足迹",
]);
assert.deepEqual(groups.关于, ["关于", "友链", "赞助", "站点配置"]);

const disabled = createNavigation(
	Object.fromEntries(Object.keys(allPages).map((key) => [key, false])),
);
assert.deepEqual(
	disabled.links.map((link) => link.name),
	["主页", "文章", "动态", "记录", "关于"],
);

console.log("Navigation checks passed.");
