import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
	ARTWORK_CATALOG_PATH,
	ARTWORK_PUBLIC_ROOT,
	getArtworkKey,
	normalizeArtworkCatalog,
} from "./lib/artwork-manifest.mjs";

async function collectArtworkFiles(directory) {
	const files = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await collectArtworkFiles(fullPath)));
		} else if (entry.isFile() && entry.name !== "catalog.json") {
			files.push(fullPath);
		}
	}
	return files;
}

function pathFromPublicUrl(imageUrl) {
	return path.join(
		ARTWORK_PUBLIC_ROOT,
		imageUrl.replace(/^\/assets\/illustrations\//, ""),
	);
}

const catalog = normalizeArtworkCatalog(
	JSON.parse(
		(await readFile(ARTWORK_CATALOG_PATH, "utf8")).replace(/^\uFEFF/, ""),
	),
);

const dumplingManifest = JSON.parse(
	await readFile(path.resolve("docs/dumpling-assets.json"), "utf8"),
);
for (const item of dumplingManifest.items ?? []) {
	try {
		const digest = createHash("sha256")
			.update(await readFile(path.resolve(item.path)))
			.digest("hex");
		if (digest !== item.sha256) {
			console.error(`Dumpling 资源摘要不一致：${item.path}`);
			process.exitCode = 1;
		}
	} catch {
		console.error(`缺少 Dumpling 资源：${item.path}`);
		process.exitCode = 1;
	}
}
const files = await collectArtworkFiles(ARTWORK_PUBLIC_ROOT);
const catalogAssets = [
	...catalog.items.map((item) => ({ image: item.image, sha256: item.sha256 })),
	...catalog.derivedAssets,
];
const expectedFiles = new Set(
	catalogAssets.map((item) => path.normalize(pathFromPublicUrl(item.image))),
);
const actualFiles = new Set(files.map((filePath) => path.normalize(filePath)));

const missing = [...expectedFiles].filter(
	(filePath) => !actualFiles.has(filePath),
);
const orphaned = [...actualFiles].filter(
	(filePath) => !expectedFiles.has(filePath),
);
if (missing.length || orphaned.length) {
	for (const filePath of missing)
		console.error(`缺少目录声明的插图：${filePath}`);
	for (const filePath of orphaned)
		console.error(`发现没有目录声明的插图：${filePath}`);
	process.exitCode = 1;
} else {
	for (const item of catalogAssets) {
		const filePath = pathFromPublicUrl(item.image);
		const digest = createHash("sha256")
			.update(await readFile(filePath))
			.digest("hex");
		if (digest !== item.sha256) {
			console.error(`插图内容与目录摘要不一致：${getArtworkKey(item)}`);
			process.exitCode = 1;
		}
	}
}

if (!process.exitCode) {
	console.log(
		`Artwork asset check passed (${catalog.items.length} authorized images, ${catalog.derivedAssets.length} derived images, ${dumplingManifest.items.length} Dumpling assets).`,
	);
}
