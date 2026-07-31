import assert from "node:assert/strict";
import {
	getArtworkImageUrl,
	normalizeArtworkCatalog,
	normalizeArtworkManifest,
} from "../../scripts/lib/artwork-manifest.mjs";

const validItem = {
	artworkId: "123456789",
	page: 0,
	artist: "示例画师",
	sourceUrl: "https://www.pixiv.net/artworks/123456789?tracking=removed",
	license: "画师授权用于本站展示",
	permission: "artist-authorized",
	theme: "鸣潮",
	alt: "雨夜中的角色插图",
	sourceFile: "C:/private/123456789.png",
	permissionEvidence: "private-archive/message-2026-07-22",
};

const manifest = normalizeArtworkManifest({ version: 1, items: [validItem] });
assert.equal(
	manifest.items[0].sourceUrl,
	"https://www.pixiv.net/artworks/123456789",
);
assert.equal(
	getArtworkImageUrl(manifest.items[0]),
	"/assets/illustrations/wuthering-waves/123456789-p0.webp",
);
assert.equal(
	getArtworkImageUrl({ ...manifest.items[0], theme: "原创" }),
	"/assets/illustrations/original/123456789-p0.webp",
);
assert.equal(
	getArtworkImageUrl({ ...manifest.items[0], theme: "明日方舟：终末地" }),
	"/assets/illustrations/arknights-endfield/123456789-p0.webp",
);

assert.throws(
	() =>
		normalizeArtworkManifest({
			version: 1,
			items: [{ ...validItem, sourceUrl: "https://i.pximg.net/example.jpg" }],
		}),
	/公开的 HTTPS Pixiv 作品页/,
);
assert.throws(
	() =>
		normalizeArtworkManifest({
			version: 1,
			items: [{ ...validItem, sourceUrl: "https://www.pixiv.net/artworks/1" }],
		}),
	/作品 ID 必须与 artworkId 一致/,
);
assert.throws(
	() =>
		normalizeArtworkManifest({
			version: 1,
			items: [{ ...validItem, permission: "unknown" }],
		}),
	/permission 必须是/,
);
assert.throws(
	() =>
		normalizeArtworkManifest({
			version: 1,
			items: [validItem, validItem],
		}),
	/重复作品页/,
);

const catalog = normalizeArtworkCatalog({
	version: 1,
	derivedAssets: [
		{
			sourceImage: "/assets/illustrations/wuthering-waves/123456789-p0.webp",
			image: "/assets/illustrations/wuthering-waves/123456789-p0-blur.webp",
			width: 480,
			height: 270,
			sha256: "b".repeat(64),
			transform: "blur-12",
		},
	],
	items: [
		{
			...validItem,
			image: "/assets/illustrations/wuthering-waves/123456789-p0.webp",
			width: 1600,
			height: 900,
			sha256: "a".repeat(64),
		},
	],
});
assert.equal(catalog.items[0].width, 1600);
assert.equal("permissionEvidence" in catalog.items[0], false);
assert.equal("sourceFile" in catalog.items[0], false);
assert.equal(catalog.derivedAssets[0].transform, "blur-12");

console.log("Artwork manifest checks passed.");
