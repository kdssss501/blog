import assert from "node:assert/strict";
import {
	createDailyXiaoThoughts,
	getPublishedXiaoThoughts,
} from "../../src/features/xiao/model/thoughts.ts";

const morning = new Date("2026-07-22T00:00:00.000Z");
const thoughts = createDailyXiaoThoughts(morning, [
	{ src: "/assets/illustrations/example.webp", alt: "测试图片" },
]);
assert.deepEqual(
	thoughts.map((thought) => thought.id),
	[
		"xiao-2026-07-22-morning",
		"xiao-2026-07-22-afternoon",
		"xiao-2026-07-22-night",
	],
);
assert.deepEqual(
	thoughts.map((thought) => thought.publishedAt),
	[
		"2026-07-22T00:00:00.000Z",
		"2026-07-22T06:00:00.000Z",
		"2026-07-22T13:00:00.000Z",
	],
);
assert.equal(getPublishedXiaoThoughts(morning).length, 1);
assert.equal(
	getPublishedXiaoThoughts(new Date("2026-07-22T05:59:59.999Z")).length,
	1,
);
assert.equal(
	getPublishedXiaoThoughts(new Date("2026-07-22T06:00:00.000Z")).length,
	2,
);
assert.equal(
	getPublishedXiaoThoughts(new Date("2026-07-22T13:00:00.000Z")).length,
	3,
);
assert.deepEqual(
	createDailyXiaoThoughts(morning),
	createDailyXiaoThoughts(new Date("2026-07-22T03:30:00.000Z")),
);

console.log("Xiao thought checks passed.");
