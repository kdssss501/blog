import assert from "node:assert/strict";
import { getCoverImage } from "../../src/features/notebook/model/notebook-covers.ts";
import {
	groupNotebookEntries,
	mergeNotebookEntries,
	sortNotebookEntries,
	summarizeNotebookContent,
} from "../../src/features/notebook/model/notebook-groups.ts";

const entry = (id, notebook, date, updatedAt, content = "") => ({
	id,
	notebook,
	title: id,
	date,
	content,
	cover: "",
	createdAt: updatedAt,
	updatedAt,
});

const entries = [
	entry(
		"old",
		"未配置分组",
		"2026-01-01",
		10,
		"# 标题\n[链接](https://example.com) 正文",
	),
	entry("newer", "未配置分组", "2026-01-02", 20),
	entry("other", "另一个分组", "2026-01-03", 30),
];

assert.deepEqual(
	sortNotebookEntries(entries).map((item) => item.id),
	["other", "newer", "old"],
);
assert.deepEqual(
	entries.map((item) => item.id),
	["old", "newer", "other"],
);
assert.deepEqual(
	groupNotebookEntries(entries).map((group) => group.name),
	["另一个分组", "未配置分组"],
);
assert.equal(summarizeNotebookContent(entries[0].content), "标题 正文");
assert.notEqual(getCoverImage("", "分组 A"), getCoverImage("", "分组 B"));
assert.match(getCoverImage("default-2", "任意"), /\/2\.webp$/);

const staticEntry = {
	...entries[0],
	id: "obsidian:old",
	content: "Obsidian 内容",
};
assert.equal(
	mergeNotebookEntries(entries, [staticEntry]).find(
		(item) => item.title === "old",
	).content,
	"Obsidian 内容",
);

console.log("Notebook model checks passed.");
