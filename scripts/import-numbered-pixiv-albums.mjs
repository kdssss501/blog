import { createHash } from "node:crypto";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
	ARTWORK_CATALOG_PATH,
	ARTWORK_PUBLIC_ROOT,
	getArtworkKey,
	normalizeArtworkCatalog,
} from "./lib/artwork-manifest.mjs";

const SOURCE_ROOT = path.resolve(
	"PixivCrawler/downloads/monthly-albums-hq-numbered-2026-07-24",
);
const LICENSE = "用户提供素材；公开发布前请再次确认作品使用许可";
const ALBUMS = Object.freeze({
	"05": { slug: "05-original", theme: "原创", folder: "original" },
	"06": { slug: "06-blue-archive", theme: "蔚蓝档案", folder: "blue-archive" },
	"07": { slug: "07-azur-lane", theme: "碧蓝航线", folder: "azur-lane" },
	"08": {
		slug: "08-genshin-impact",
		theme: "原神",
		folder: "genshin-impact",
	},
	"09": {
		slug: "09-arknights-endfield",
		theme: "明日方舟：终末地",
		folder: "arknights-endfield",
	},
	10: {
		slug: "10-zenless-zone-zero",
		theme: "绝区零",
		folder: "zenless-zone-zero",
	},
});
const IMAGE_PATTERN = /\.(?:avif|jpe?g|png|tiff?|webp)$/i;

function quote(value) {
	return JSON.stringify(String(value));
}

function assertSafeFilename(filename, label) {
	if (
		typeof filename !== "string" ||
		!IMAGE_PATTERN.test(filename) ||
		path.basename(filename) !== filename
	) {
		throw new Error(`${label} 包含无效图片文件名。`);
	}
}

async function exists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

function albumDocument(album, config, items) {
	const photos = items
		.map(
			(item) =>
				`  - src: ${quote(item.catalog.image)}\n` +
				`    alt: ${quote(item.catalog.alt)}\n` +
				`    caption: ${quote(`${item.title} · ${item.catalog.artist}`)}\n` +
				`    artworkId: ${quote(item.catalog.artworkId)}\n` +
				`    artist: ${quote(item.catalog.artist)}\n` +
				`    sourceUrl: ${quote(item.catalog.sourceUrl)}\n` +
				`    sensitive: ${item.sensitive}`,
		)
		.join("\n");
	return (
		"---\n" +
		`title: ${quote(album.title)}\n` +
		`subtitle: ${quote("Pixiv 高清编号精选 · 20 张")}\n` +
		"date: 2026-07-24\n" +
		`location: ${quote("Pixiv")}\n` +
		`tags: [${[config.theme, "Pixiv", "插画", "含成人向内容"].map(quote).join(", ")}]\n` +
		"contentRating: mixed\n" +
		"draft: false\n" +
		`photos:\n${photos}\n` +
		"---\n"
	);
}

async function loadBatch(sourceRoot) {
	const batchPath = path.join(sourceRoot, "album-batch.json");
	const batch = JSON.parse(
		(await readFile(batchPath, "utf8")).replace(/^\uFEFF/, ""),
	);
	if (!Array.isArray(batch.albums)) {
		throw new Error("album-batch.json 缺少 albums 数组。");
	}
	const albumByNumber = new Map(
		batch.albums.map((album) => [String(album.album_number), album]),
	);
	const seenArtworkIds = new Set();
	const preparedAlbums = [];

	for (const [albumNumber, config] of Object.entries(ALBUMS)) {
		const album = albumByNumber.get(albumNumber);
		if (!album || !Array.isArray(album.photos) || album.photos.length !== 20) {
			throw new Error(`${albumNumber} 相册必须恰好包含 20 张图片。`);
		}
		const items = [];
		for (const [index, photo] of album.photos.entries()) {
			const label = `${albumNumber}.photos[${index}]`;
			assertSafeFilename(photo.source_file, label);
			const artworkId = String(photo.artwork_id || "");
			if (!/^\d+$/.test(artworkId)) throw new Error(`${label} 缺少作品 ID。`);
			if (seenArtworkIds.has(artworkId)) {
				throw new Error(`批次中存在重复作品 ID：${artworkId}`);
			}
			seenArtworkIds.add(artworkId);
			const sourcePath = path.join(sourceRoot, albumNumber, photo.source_file);
			if (!(await exists(sourcePath)))
				throw new Error(`缺少源图片：${sourcePath}`);
			const metadata = await sharp(sourcePath).metadata();
			if (!metadata.width || !metadata.height) {
				throw new Error(`无法读取图片尺寸：${sourcePath}`);
			}
			const title = String(photo.title || artworkId).trim();
			const artist = String(photo.artist || "未知画师").trim();
			const image = `/assets/illustrations/${config.folder}/${artworkId}-p0.webp`;
			items.push({
				rank: index,
				title,
				sourcePath,
				sensitive:
					Number(photo.x_restrict) > 0 || Number(photo.sensitivity_level) >= 6,
				catalog: {
					artworkId,
					page: 0,
					artist,
					title,
					sourceUrl: `https://www.pixiv.net/artworks/${artworkId}`,
					license: LICENSE,
					permission: "user-provided",
					theme: config.theme,
					alt: `${config.theme} 插画：${title}`,
					image,
				},
			});
		}
		preparedAlbums.push({ album, config, items });
	}
	return preparedAlbums;
}

async function convertItem(item) {
	const { data, info } = await sharp(item.sourcePath)
		.rotate()
		.resize({
			width: 2560,
			height: 2560,
			fit: "inside",
			withoutEnlargement: true,
		})
		.webp({ quality: 86, effort: 5 })
		.toBuffer({ resolveWithObject: true });
	if (!info.width || !info.height) {
		throw new Error(`转换后无法读取图片尺寸：${item.sourcePath}`);
	}
	return {
		...item.catalog,
		width: info.width,
		height: info.height,
		sha256: createHash("sha256").update(data).digest("hex"),
		data,
	};
}

async function applyImport(preparedAlbums) {
	const originalCatalogText = await readFile(ARTWORK_CATALOG_PATH, "utf8");
	const originalCatalog = JSON.parse(
		originalCatalogText.replace(/^\uFEFF/, ""),
	);
	const catalogByKey = new Map(
		(originalCatalog.items || []).map((item) => [getArtworkKey(item), item]),
	);
	const imageDigests = new Set(
		(originalCatalog.items || []).map((item) => item.sha256).filter(Boolean),
	);
	const newFiles = [];
	const previousAlbumFiles = new Map();
	const importedItems = [];

	try {
		for (const { items } of preparedAlbums) {
			for (const item of items) {
				const key = getArtworkKey(item.catalog);
				const existing = catalogByKey.get(key);
				if (existing) {
					if (
						existing.image !== item.catalog.image ||
						existing.theme !== item.catalog.theme
					) {
						throw new Error(`${key} 已被其他主题占用。`);
					}
					const existingPath = path.join(
						ARTWORK_PUBLIC_ROOT,
						existing.image.replace(/^\/assets\/illustrations\//, ""),
					);
					if (!(await exists(existingPath))) {
						throw new Error(`${key} 已登记但图片缺失。`);
					}
					item.catalog = existing;
					continue;
				}

				const converted = await convertItem(item);
				if (imageDigests.has(converted.sha256)) {
					throw new Error(`${key} 与已有插图内容重复。`);
				}
				imageDigests.add(converted.sha256);
				const outputPath = path.join(
					ARTWORK_PUBLIC_ROOT,
					converted.image.replace(/^\/assets\/illustrations\//, ""),
				);
				await mkdir(path.dirname(outputPath), { recursive: true });
				await writeFile(outputPath, converted.data, { flag: "wx" });
				newFiles.push(outputPath);
				delete converted.data;
				item.catalog = converted;
				catalogByKey.set(key, converted);
				importedItems.push(converted);
			}
		}

		const nextCatalog = {
			...originalCatalog,
			version: 1,
			items: [...catalogByKey.values()].sort(
				(left, right) =>
					left.theme.localeCompare(right.theme, "zh-CN") ||
					getArtworkKey(left).localeCompare(getArtworkKey(right), "en"),
			),
		};
		normalizeArtworkCatalog(nextCatalog);
		await writeFile(
			ARTWORK_CATALOG_PATH,
			`${JSON.stringify(nextCatalog, null, 2)}\n`,
			"utf8",
		);

		const albumRoot = path.resolve("src/content/album");
		await mkdir(albumRoot, { recursive: true });
		for (const prepared of preparedAlbums) {
			const albumPath = path.join(albumRoot, `${prepared.config.slug}.md`);
			previousAlbumFiles.set(
				albumPath,
				(await exists(albumPath)) ? await readFile(albumPath, "utf8") : null,
			);
			await writeFile(
				albumPath,
				albumDocument(prepared.album, prepared.config, prepared.items),
				"utf8",
			);
		}
		return importedItems.length;
	} catch (error) {
		await writeFile(ARTWORK_CATALOG_PATH, originalCatalogText, "utf8").catch(
			() => undefined,
		);
		await Promise.all(
			newFiles.map((filePath) => unlink(filePath).catch(() => undefined)),
		);
		await Promise.all(
			[...previousAlbumFiles].map(([filePath, content]) =>
				content === null
					? unlink(filePath).catch(() => undefined)
					: writeFile(filePath, content, "utf8"),
			),
		);
		throw error;
	}
}

async function main() {
	const apply = process.argv.includes("--apply");
	const unknown = process.argv
		.slice(2)
		.filter((argument) => argument !== "--apply");
	if (unknown.length) throw new Error(`未知参数：${unknown.join(" ")}`);
	const preparedAlbums = await loadBatch(SOURCE_ROOT);
	const total = preparedAlbums.reduce(
		(sum, album) => sum + album.items.length,
		0,
	);
	const sensitive = preparedAlbums.reduce(
		(sum, album) => sum + album.items.filter((item) => item.sensitive).length,
		0,
	);
	console.log(
		`编号相册校验通过：${preparedAlbums.length} 册，${total} 张，其中 ${sensitive} 张需敏感内容遮罩。`,
	);
	if (!apply) {
		console.log("当前为检查模式；添加 --apply 后才会转换图片并生成相册。");
		return;
	}
	const imported = await applyImport(preparedAlbums);
	console.log(
		`编号相册导入完成：新增 ${imported} 张图片，生成 ${preparedAlbums.length} 册相册。`,
	);
}

main().catch((error) => {
	console.error(`[albums:import-numbered] ${error.message}`);
	process.exitCode = 1;
});
