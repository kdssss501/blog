import { createHash } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import {
	ARTWORK_CATALOG_PATH,
	ARTWORK_PUBLIC_ROOT,
	buildCatalogItem,
	getArtworkKey,
	getArtworkOutputPath,
	normalizeArtworkCatalog,
	normalizeArtworkManifest,
	resolveManifestSourcePath,
} from "./lib/artwork-manifest.mjs";

const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
	".avif",
	".jpeg",
	".jpg",
	".png",
	".tif",
	".tiff",
	".webp",
]);

async function readJson(filePath, label) {
	let text;
	try {
		text = await readFile(filePath, "utf8");
	} catch (error) {
		throw new Error(`无法读取${label} ${filePath}：${error.message}`);
	}
	try {
		return JSON.parse(text.replace(/^\uFEFF/, ""));
	} catch (error) {
		throw new Error(`${label}不是有效 JSON：${error.message}`);
	}
}

async function readCatalog() {
	try {
		return normalizeArtworkCatalog(
			await readJson(ARTWORK_CATALOG_PATH, "公开目录"),
		);
	} catch (error) {
		if (error.code === "ENOENT") return { version: 1, items: [] };
		throw error;
	}
}

async function prepareArtwork(item, manifestPath) {
	const sourcePath = resolveManifestSourcePath(manifestPath, item.sourceFile);
	const extension = path.extname(sourcePath).toLowerCase();
	if (!ALLOWED_EXTENSIONS.has(extension)) {
		throw new Error(
			`${getArtworkKey(item)} 不支持 ${extension || "无扩展名"} 文件。`,
		);
	}
	const sourceStat = await stat(sourcePath);
	if (!sourceStat.isFile()) throw new Error(`${sourcePath} 不是普通文件。`);
	if (sourceStat.size > MAX_SOURCE_BYTES) {
		throw new Error(`${sourcePath} 超过 50 MiB 导入上限。`);
	}

	const { data, info } = await sharp(sourcePath)
		.rotate()
		.resize({
			width: 2560,
			height: 2560,
			fit: "inside",
			withoutEnlargement: true,
		})
		.webp({ quality: 88, effort: 5 })
		.toBuffer({ resolveWithObject: true });
	if (!info.width || !info.height) {
		throw new Error(`${sourcePath} 无法取得有效图片尺寸。`);
	}
	if (info.width < 640 || info.height < 640) {
		throw new Error(
			`${sourcePath} 转换后尺寸为 ${info.width}x${info.height}，短边不得小于 640px。`,
		);
	}

	const sha256 = createHash("sha256").update(data).digest("hex");
	return {
		item,
		data,
		outputPath: getArtworkOutputPath(item),
		catalogItem: buildCatalogItem(item, {
			width: info.width,
			height: info.height,
			sha256,
		}),
	};
}

function printFrontmatter(item) {
	console.log(`\n${getArtworkKey(item)} Frontmatter：`);
	console.log(`image: ${item.image}`);
	console.log("imageAttribution:");
	console.log(`  artist: ${JSON.stringify(item.artist)}`);
	console.log(`  sourceUrl: ${item.sourceUrl}`);
	console.log(`  license: ${JSON.stringify(item.license)}`);
	console.log(`  permission: ${item.permission}`);
	console.log(`  theme: ${JSON.stringify(item.theme)}`);
}

export async function importAuthorizedArtwork({ manifestPath, apply = false }) {
	const resolvedManifestPath = path.resolve(manifestPath);
	const manifest = normalizeArtworkManifest(
		await readJson(resolvedManifestPath, "授权清单"),
	);
	const catalog = await readCatalog();
	const catalogKeys = new Set(catalog.items.map(getArtworkKey));
	for (const item of manifest.items) {
		const key = getArtworkKey(item);
		if (catalogKeys.has(key)) throw new Error(`${key} 已存在于公开目录。`);
	}

	const prepared = [];
	for (const item of manifest.items) {
		prepared.push(await prepareArtwork(item, resolvedManifestPath));
	}

	console.log(`授权清单校验通过：${prepared.length} 个作品页。`);
	for (const entry of prepared) {
		console.log(
			`- ${getArtworkKey(entry.item)} -> ${path.relative(ARTWORK_PUBLIC_ROOT, entry.outputPath)} (${entry.catalogItem.width}x${entry.catalogItem.height})`,
		);
	}
	if (!apply) {
		console.log("当前为检查模式；添加 --apply 后才会写入图片和公开目录。 ");
		return {
			applied: false,
			items: prepared.map((entry) => entry.catalogItem),
		};
	}

	const writtenFiles = [];
	try {
		for (const entry of prepared) {
			await mkdir(path.dirname(entry.outputPath), { recursive: true });
			await writeFile(entry.outputPath, entry.data, { flag: "wx" });
			writtenFiles.push(entry.outputPath);
		}
		const nextCatalog = normalizeArtworkCatalog({
			version: catalog.version,
			derivedAssets: catalog.derivedAssets,
			items: [
				...catalog.items,
				...prepared.map((entry) => entry.catalogItem),
			].sort(
				(a, b) =>
					a.theme.localeCompare(b.theme, "zh-CN") ||
					getArtworkKey(a).localeCompare(getArtworkKey(b), "en"),
			),
		});
		await writeFile(
			ARTWORK_CATALOG_PATH,
			`${JSON.stringify(nextCatalog, null, 2)}\n`,
			"utf8",
		);
		for (const item of prepared.map((entry) => entry.catalogItem)) {
			printFrontmatter(item);
		}
		return { applied: true, items: prepared.map((entry) => entry.catalogItem) };
	} catch (error) {
		await Promise.all(
			writtenFiles.map((filePath) => unlink(filePath).catch(() => undefined)),
		);
		throw error;
	}
}

function parseArguments(argv) {
	let manifestPath = "";
	let apply = false;
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--apply") {
			apply = true;
			continue;
		}
		if (argument === "--manifest") {
			manifestPath = argv[index + 1] || "";
			index += 1;
			continue;
		}
		throw new Error(`未知参数：${argument}`);
	}
	if (!manifestPath) {
		throw new Error("请使用 --manifest <私有授权清单.json> 指定导入清单。 ");
	}
	return { manifestPath, apply };
}

async function main() {
	try {
		await importAuthorizedArtwork(parseArguments(process.argv.slice(2)));
	} catch (error) {
		console.error(`[artwork:import] ${error.message}`);
		process.exitCode = 1;
	}
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	await main();
}
