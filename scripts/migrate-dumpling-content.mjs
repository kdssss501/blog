import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const migrationId = "dumpling-theme-73b9759";
const storePath = resolve("data/store.json");
const backupPath = resolve(`data/backups/${migrationId}.json`);
const apply = process.argv.includes("--apply");
const markerKey = `migration:${migrationId}`;

const moments = [
	{
		id: "dumpling-moment-2026-05-28",
		slug: "2026-05-28-exploring",
		body: "在读 Astro 的文档，v5 的 Content Layer API 真的很强大，做博客正合适。",
		tags: ["阅读", "技术"],
		location: "咖啡馆",
		date: "2026-05-28",
	},
	{
		id: "dumpling-moment-2026-05-29",
		slug: "2026-05-29-building",
		body: "花了一个下午折腾侧边栏组件和主题色。这套配置系统真的太灵活了！🎨",
		tags: ["编程", "Astro"],
		location: "家中",
		date: "2026-05-29",
	},
	{
		id: "dumpling-moment-2026-05-30",
		slug: "2026-05-30-hello",
		body: "用 Dumpling 主题搭建的博客总算上线了！一切都很完美 🎉",
		tags: ["生活", "博客"],
		location: "互联网",
		device: "网页端",
		date: "2026-05-30",
	},
].map((item) => {
	const timestamp = new Date(`${item.date}T12:00:00+08:00`).getTime();
	return {
		id: item.id,
		slug: item.slug,
		content: item.body,
		body: item.body,
		presentationVersion: migrationId,
		createdAt: timestamp,
		updatedAt: timestamp,
		tags: item.tags,
		location: item.location,
		device: item.device || "",
		images: [],
	};
});

const notebook = {
	id: "nb_dumpling_sample",
	notebook: "示例日记本",
	title: "示例日记本",
	date: "2026-05-30",
	content: "这是一个示例日记本。你可以在笔记本管理页中继续创建更多日记本。",
	cover: "",
	createdAt: new Date("2026-05-30T12:00:00+08:00").getTime(),
	updatedAt: new Date("2026-05-30T12:00:00+08:00").getTime(),
};

const store = existsSync(storePath)
	? JSON.parse(readFileSync(storePath, "utf8"))
	: {};
const replaced = Object.keys(store).filter(
	(key) => key.startsWith("activity:") || key.startsWith("notebook:"),
);
const alreadyApplied = typeof store[markerKey] === "string";

console.log(
	JSON.stringify(
		{
			migrationId,
			mode: apply ? "apply" : "preview",
			alreadyApplied,
			replacedKeys: replaced.length,
			importedActivities: moments.length,
			importedNotebooks: 1,
			backupPath,
		},
		null,
		2,
	),
);

if (!apply) process.exit(0);
if (alreadyApplied) process.exit(0);

mkdirSync(dirname(backupPath), { recursive: true });
writeFileSync(
	backupPath,
	JSON.stringify(
		Object.fromEntries(replaced.map((key) => [key, store[key]])),
		null,
		2,
	),
);
for (const key of replaced) delete store[key];
for (const moment of moments) {
	store[`activity:item:${moment.slug}`] = JSON.stringify(moment);
}
store["activity:list"] = JSON.stringify(moments.map((moment) => moment.slug));
store[`notebook:entry:${notebook.id}`] = JSON.stringify(notebook);
store["notebook:list"] = JSON.stringify([notebook.id]);
store["notebook:counter"] = "1";
store[markerKey] = JSON.stringify({
	appliedAt: Date.now(),
	backupPath,
});
writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`);
