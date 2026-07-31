import assert from "node:assert/strict";
import {
	mergeMomentActivities,
	toXiaoMomentActivity,
} from "../../src/features/activity/model/moments.ts";

const user = {
	id: "user-1",
	origin: "user",
	slug: "user-1",
	title: "个人动态",
	excerpt: "内容",
	body: "内容",
	html: "<p>内容</p>",
	overview: {
		readingMinutes: 1,
		sectionCount: 1,
		imageCount: 0,
		updatedLabel: "2026/07/23 08:30",
	},
	createdAt: Date.parse("2026-07-23T00:30:00.000Z"),
	updatedAt: Date.parse("2026-07-23T00:30:00.000Z"),
	coverImage: "",
	images: [],
};

const thought = toXiaoMomentActivity({
	id: "xiao-2026-07-23-morning",
	title: "小爱心想 · 晨间",
	content: "早上好。",
	publishedAt: "2026-07-23T00:00:00.000Z",
});

assert.equal(thought.origin, "xiao");
assert.equal(thought.slug, thought.id);
assert.deepEqual(
	mergeMomentActivities([user], [thought]).map((item) => item.id),
	["user-1", "xiao-2026-07-23-morning"],
);
assert.equal(
	mergeMomentActivities([user], [thought, thought]).filter(
		(item) => item.id === thought.id,
	).length,
	1,
);

const staticReplacement = {
	...user,
	id: "obsidian:user-1",
	title: "Obsidian 版本",
};
assert.equal(
	mergeMomentActivities([user], [staticReplacement])[0].title,
	"Obsidian 版本",
);

console.log("Moment merge checks passed.");
