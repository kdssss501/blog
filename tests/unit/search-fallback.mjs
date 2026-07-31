import assert from "node:assert/strict";
import { filterFallbackPosts } from "../../src/features/search/model/fallback-search.ts";

const posts = [
	{
		id: "ai/hello world",
		title: "<AI> 搜索实践",
		description: "Cloudflare Vectorize 后备检索",
		category: "学习文档",
	},
	{
		id: "projects/cache",
		title: "缓存设计",
		description: "Redis 数据结构",
		category: "实践笔记",
	},
];

const titleResults = filterFallbackPosts(posts, "AI");
assert.equal(titleResults.length, 1);
assert.equal(titleResults[0].meta.title, "&lt;AI&gt; 搜索实践");
assert.equal(titleResults[0].url, "/posts/ai/hello%20world/");

const descriptionResults = filterFallbackPosts(posts, "vectorize");
assert.equal(descriptionResults.length, 1);
assert.match(descriptionResults[0].excerpt, /后备检索/);

const categoryResults = filterFallbackPosts(posts, "实践笔记", 1);
assert.equal(categoryResults.length, 1);
assert.equal(filterFallbackPosts(posts, "").length, 0);

console.log("Search fallback checks passed.");
