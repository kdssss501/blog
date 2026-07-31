import assert from "node:assert/strict";
import { normalizePixivCrawlerInput } from "../../src/shared/pixiv-crawler/contract.ts";

assert.deepEqual(
	normalizePixivCrawlerInput({ mode: "keyword", query: " 鸣潮 ", count: 12 }),
	{ ok: true, value: { mode: "keyword", query: "鸣潮", count: 12 } },
);
assert.deepEqual(
	normalizePixivCrawlerInput({
		mode: "ranking",
		query: "ignored",
		count: 8,
		date: "2026-07-23",
	}),
	{
		ok: true,
		value: { mode: "ranking", query: "", count: 8, date: "2026-07-23" },
	},
);
assert.equal(
	normalizePixivCrawlerInput({ mode: "user", query: "abc", count: 5 }).ok,
	false,
);
assert.equal(
	normalizePixivCrawlerInput({ mode: "keyword", query: "x", count: 31 }).ok,
	false,
);
assert.equal(
	normalizePixivCrawlerInput({ mode: "ranking", count: 5, date: "2026-02-31" })
		.ok,
	false,
);

console.log("Pixiv crawler contract checks passed.");
