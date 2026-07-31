import assert from "node:assert/strict";
import {
	normalizeContentDocument,
	parseContentMarkdown,
	serializeContentDocument,
	validateContentDocument,
} from "../../src/features/writing/model/content-document.ts";

const moment = parseContentMarkdown(
	`---
title: 夜间更新
published: 2026-07-24
tags: [博客, 记录]
location: 书桌
images:
  - /uploads/content/example.webp
---

今天把内容工作流重新整理了一遍。`,
	"moment",
);

assert.equal(moment.kind, "moment");
assert.equal(moment.slug, "夜间更新");
assert.deepEqual(moment.tags, ["博客", "记录"]);
assert.deepEqual(validateContentDocument(moment), []);
assert.match(serializeContentDocument(moment), /location: 书桌/);

const notebook = normalizeContentDocument(
	{
		kind: "notebook",
		title: "动效预算",
		notebook: "博客维护",
		published: "2026-07-24",
		body: "记录每个页面可以使用的动画数量。",
	},
	"notebook",
);
assert.equal(notebook.notebook, "博客维护");
assert.deepEqual(validateContentDocument(notebook), []);

const legacyNotebook = parseContentMarkdown(
	`---
title: 旧模板兼容
name: 迁移笔记本
date: 2026-07-24
---

旧模板仍然可以被读取。`,
	"notebook",
);
assert.equal(legacyNotebook.notebook, "迁移笔记本");
assert.match(serializeContentDocument(legacyNotebook), /notebook: 迁移笔记本/);

const invalidPost = normalizeContentDocument({ kind: "post" }, "post");
assert.deepEqual(
	validateContentDocument(invalidPost).map((issue) => issue.field),
	["published", "body", "description"],
);

const rejectedImage = normalizeContentDocument(
	{
		kind: "moment",
		title: "图片检查",
		published: "2026-07-24",
		body: "正文",
		images: ["javascript:alert(1)", "https://cdn.example.com/a.webp"],
	},
	"moment",
);
assert.deepEqual(rejectedImage.images, ["https://cdn.example.com/a.webp"]);

console.log("Content document checks passed.");
