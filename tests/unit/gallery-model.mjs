import assert from "node:assert/strict";
import {
	createGalleryHash,
	galleryAlbumMatchesTag,
	getGalleryNavigationIndex,
	getGalleryTags,
	normalizeGalleryTag,
	normalizeGalleryView,
	parseGalleryHash,
} from "../../src/features/gallery/model/gallery-directory.ts";

assert.equal(parseGalleryHash("#gallery-network"), "network");
assert.equal(parseGalleryHash("#gallery-LOCAL"), "local");
assert.equal(parseGalleryHash("#other"), null);
assert.equal(createGalleryHash("local"), "#gallery-local");
assert.equal(normalizeGalleryView("invalid"), "local");

const tags = getGalleryTags([
	{ tags: ["旅行", "日常"] },
	{ tags: ["日常", "  摄影  "] },
]);
assert.deepEqual(
	tags,
	["旅行", "日常", "摄影"].sort((a, b) => a.localeCompare(b, "zh-CN")),
);
assert.equal(normalizeGalleryTag("摄影", tags), "摄影");
assert.equal(normalizeGalleryTag("不存在", tags), "all");
assert.equal(galleryAlbumMatchesTag(["旅行"], "旅行"), true);
assert.equal(galleryAlbumMatchesTag(["旅行"], "日常"), false);
assert.equal(galleryAlbumMatchesTag([], "all"), true);

assert.equal(getGalleryNavigationIndex(0, 3, "ArrowLeft"), 2);
assert.equal(getGalleryNavigationIndex(2, 3, "ArrowRight"), 0);
assert.equal(getGalleryNavigationIndex(1, 3, "Home"), 0);
assert.equal(getGalleryNavigationIndex(1, 3, "End"), 2);

console.log("gallery model tests passed");
