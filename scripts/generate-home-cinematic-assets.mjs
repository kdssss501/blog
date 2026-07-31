import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const assetDir = path.join(
	projectRoot,
	"public",
	"assets",
	"illustrations",
	"fate-throne",
);
const sourceNames = [
	"98522947-p0.webp",
	"89514781-p0.webp",
	"84782057-p0.webp",
	"87446888-p0.webp",
	"101297457-p0.webp",
];
const derivedAssets = [];

for (const sourceName of sourceNames) {
	const source = path.join(assetDir, sourceName);
	const output = path.join(
		assetDir,
		sourceName.replace(/\.webp$/, "-blur.webp"),
	);
	const info = await sharp(source)
		.resize({ width: 480, withoutEnlargement: true })
		.blur(12)
		.modulate({ brightness: 0.72, saturation: 0.68 })
		.webp({ quality: 52, effort: 6 })
		.toFile(output);
	const sha256 = createHash("sha256")
		.update(await readFile(output))
		.digest("hex");
	derivedAssets.push({
		sourceImage: `/assets/illustrations/fate-throne/${sourceName}`,
		image: `/assets/illustrations/fate-throne/${path.basename(output)}`,
		width: info.width,
		height: info.height,
		sha256,
		transform:
			"resize-width-480_blur-12_brightness-0.72_saturation-0.68_webp-q52",
	});
	console.log(path.relative(projectRoot, output));
}

const catalogPath = path.join(
	projectRoot,
	"public",
	"assets",
	"illustrations",
	"catalog.json",
);
const catalog = JSON.parse(
	(await readFile(catalogPath, "utf8")).replace(/^\uFEFF/, ""),
);
const generatedSources = new Set(derivedAssets.map((item) => item.sourceImage));
catalog.derivedAssets = [
	...(Array.isArray(catalog.derivedAssets)
		? catalog.derivedAssets.filter(
				(item) => !generatedSources.has(item.sourceImage),
			)
		: []),
	...derivedAssets,
].sort((left, right) => left.image.localeCompare(right.image, "en"));
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
