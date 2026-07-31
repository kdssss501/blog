import assert from "node:assert/strict";
import {
	normalizePostDocument,
	normalizePostSlug,
	validatePostDocument,
} from "../../src/features/writing/model/post-document.ts";

assert.equal(normalizePostSlug("  Hello, Astro 6!  "), "hello-astro-6");

const document = normalizePostDocument({
	title: "一篇新文章",
	slug: "Astro Draft",
	description: "用于验证写作模型。",
	category: "AI Notes",
	tags: ["Astro", " Svelte ", ""],
	published: "2026-07-23",
	draft: false,
	body: "# 正文",
});

assert.equal(document.slug, "astro-draft");
assert.equal(document.category, "ai-notes");
assert.deepEqual(document.tags, ["Astro", "Svelte"]);
assert.equal(document.draft, false);
assert.deepEqual(validatePostDocument(document), []);
assert.deepEqual(
	validatePostDocument(normalizePostDocument({})).map((issue) => issue.field),
	["title", "slug", "description", "category", "published", "body"],
);

console.log("Post document checks passed.");
