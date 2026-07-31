import assert from "node:assert/strict";
import {
	getBeijingClockSnapshot,
	getCollectionCategories,
	normalizeCollectionGroups,
	resolveCollectionCategory,
} from "../../src/features/collections/model/directory.ts";

const groups = normalizeCollectionGroups(
	[
		{ category: "  空分类 ", items: [] },
		{
			category: "工具",
			items: [
				{
					name: "禁用",
					url: "https://invalid.example",
					description: "",
					enabled: false,
				},
				{
					name: "可用",
					url: "https://example.com",
					description: "",
					enabled: true,
				},
			],
		},
		{
			category: "学习",
			items: [
				{ name: "课程", url: "https://example.com/learn", description: "" },
			],
		},
	],
	["学习", "工具"],
);

assert.deepEqual(
	groups.map((group) => group.category),
	["学习", "工具"],
);
assert.deepEqual(
	groups[1].items.map((item) => item.name),
	["可用"],
);
assert.deepEqual(getCollectionCategories(groups), ["all", "学习", "工具"]);
assert.equal(
	resolveCollectionCategory("工具", getCollectionCategories(groups)),
	"工具",
);
assert.equal(
	resolveCollectionCategory("missing", getCollectionCategories(groups)),
	"all",
);

const snapshot = getBeijingClockSnapshot(new Date("2026-07-22T00:00:00.000Z"));
assert.match(snapshot.dateLabel, /2026年07月22日/);
assert.equal(snapshot.timeLabel, "08:00:00");
assert.equal(snapshot.iso, "2026-07-22T00:00:00.000Z");

console.log("Collections model checks passed.");
