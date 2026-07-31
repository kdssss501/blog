import assert from "node:assert/strict";
import { sortPostEntries } from "../../src/features/posts/model/sort.ts";
import { buildTagGraphData } from "../../src/features/posts/model/tag-graph.ts";

const entry = (id, published, pinned = false, tags = []) => ({
	id,
	data: {
		title: id,
		published: new Date(published),
		pinned,
		tags,
	},
});

const original = [
	entry("same-z", "2026-01-01", false),
	entry("pinned", "2025-01-01", true),
	entry("same-a", "2026-01-01", false),
];
const sorted = sortPostEntries(original);
assert.deepEqual(
	sorted.map((post) => post.id),
	["pinned", "same-a", "same-z"],
);
assert.deepEqual(
	original.map((post) => post.id),
	["same-z", "pinned", "same-a"],
);

const graph = buildTagGraphData(
	[
		{
			title: "one",
			url: "/one/",
			published: "2026-01-01",
			tags: ["Astro", "Web"],
		},
		{
			title: "two",
			url: "/two/",
			published: "2026-01-02",
			tags: ["Astro", "Web", "Astro"],
		},
		{
			title: "three",
			url: "/three/",
			published: "2026-01-03",
			tags: ["Astro"],
		},
	],
	2,
);
assert.equal(graph.nodes.find((node) => node.name === "Astro")?.value, 3);
assert.equal(graph.links.length, 1);
assert.equal(graph.links[0].value, 2);

console.log("Posts model checks passed.");
