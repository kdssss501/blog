import assert from "node:assert/strict";
import {
	ContentAssetStorageUnavailableError,
	storeContentImage,
} from "../../src/server/storage/assets.ts";

const pngSignature = Uint8Array.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const mismatch = new File([pngSignature], "fake.jpg", { type: "image/jpeg" });
await assert.rejects(
	() => storeContentImage(mismatch, {}),
	/content does not match/i,
);

const png = new File([pngSignature], "pixel.png", { type: "image/png" });
await assert.rejects(
	() =>
		storeContentImage(png, {
			CONTENT_ASSET_EXTERNAL_UPLOAD_URL: "https://127.0.0.1/upload",
		}),
	/public HTTPS endpoint/i,
);

await assert.rejects(
	() => storeContentImage(png, { NODE_ENV: "production" }),
	(error) => error instanceof ContentAssetStorageUnavailableError,
);

let storedKey = "";
const stored = await storeContentImage(png, {
	CONTENT_ASSETS: {
		async put(key, value, options) {
			storedKey = key;
			assert.equal(value.byteLength, pngSignature.byteLength);
			assert.equal(options.httpMetadata.contentType, "image/png");
		},
	},
	CONTENT_ASSET_PUBLIC_BASE_URL: "https://cdn.example.test",
});
assert.equal(stored.key, storedKey);
assert.equal(stored.url, `https://cdn.example.test/${storedKey}`);

console.log("Content asset checks passed.");
