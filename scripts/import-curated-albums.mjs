import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const GROUPS = {
	"01_EVA": {
		title: "EVA",
		theme: "EVA",
		folder: "eva",
		tags: ["EVA", "角色", "插画"],
	},
	"02_Wuthering_Waves": {
		title: "鸣潮",
		theme: "鸣潮",
		folder: "wuthering-waves",
		tags: ["鸣潮", "角色", "插画"],
	},
	"03_Mushoku_Tensei": {
		title: "无职转生",
		theme: "无职转生",
		folder: "mushoku-tensei",
		tags: ["无职转生", "角色", "插画"],
	},
	"04_Fate": {
		title: "Fate",
		theme: "命运王座",
		folder: "fate-throne",
		tags: ["Fate", "命运王座", "插画"],
	},
};

const IMAGE_PATTERN = /\.(?:avif|jpe?g|png|tiff?|webp)$/i;
const ARTWORK_ID_PATTERN = /^\d+__(\d+)__/;
const normalizePath = (value) => value.replaceAll("\\", "/");

async function walk(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await walk(absolute)));
		else if (entry.isFile()) files.push(absolute);
	}
	return files;
}

function quote(value) {
	return JSON.stringify(String(value));
}

function albumDocument(group, items) {
	const photos = items
		.map(
			(item) =>
				`  - src: ${quote(item.image)}\n    alt: ${quote(item.alt)}\n    caption: ${quote(`${item.title} · ${item.artist}`)}`,
		)
		.join("\n");
	return `---\ntitle: ${quote(group.title)}\nsubtitle: ${quote(`来自 Pixiv 的 ${group.title} 主题精选`)}\ndate: 2026-07-23\nlocation: "Pixiv"\ntags: [${group.tags.map(quote).join(", ")}]\ndraft: false\nphotos:\n${photos}\n---\n`;
}

async function main() {
	const sourceRoot = path.resolve(
		process.argv[2] || "PixivCrawler/downloads/curated_2026-07-23",
	);
	const manifest = JSON.parse(
		await readFile(path.join(sourceRoot, "manifest.json"), "utf8"),
	);
	const manifestItems = new Map();
	for (const theme of manifest.themes || []) {
		for (const item of theme.items || [])
			manifestItems.set(String(item.artwork_id), item);
	}

	const publicRoot = path.resolve("public/assets/illustrations");
	const albumRoot = path.resolve("src/content/album");
	const catalogPath = path.join(publicRoot, "catalog.json");
	const previousCatalog = JSON.parse(await readFile(catalogPath, "utf8"));
	const catalogByKey = new Map(
		(previousCatalog.items || []).map((item) => [
			`${item.artworkId}:p${item.page}`,
			item,
		]),
	);
	const files = (await walk(sourceRoot)).filter((file) =>
		IMAGE_PATTERN.test(file),
	);

	for (const [prefix, group] of Object.entries(GROUPS)) {
		const groupFiles = files.filter((file) =>
			normalizePath(path.relative(sourceRoot, file)).startsWith(`${prefix}__`),
		);
		const imported = [];
		for (const sourceFile of groupFiles) {
			const match = path.basename(sourceFile).match(ARTWORK_ID_PATTERN);
			if (!match) continue;
			const artworkId = match[1];
			const metadata = manifestItems.get(artworkId);
			const outputDirectory = path.join(publicRoot, group.folder);
			const outputPath = path.join(outputDirectory, `${artworkId}-p0.webp`);
			await mkdir(outputDirectory, { recursive: true });
			const { data, info } = await sharp(sourceFile)
				.rotate()
				.resize({
					width: 1920,
					height: 1920,
					fit: "inside",
					withoutEnlargement: true,
				})
				.webp({ quality: 82, effort: 5 })
				.toBuffer({ resolveWithObject: true });
			await writeFile(outputPath, data);
			const relativeParts = normalizePath(
				path.relative(sourceRoot, sourceFile),
			).split("/");
			const artistFromPath = relativeParts[1]
				?.replace(/^artist-/, "")
				.replace(/__uid-.*$/, "");
			const titleFromFile = path
				.basename(sourceFile)
				.replace(ARTWORK_ID_PATTERN, "")
				.replace(/\.[^.]+$/, "");
			const item = {
				artworkId,
				page: 0,
				artist: metadata?.artist_name || artistFromPath || "未知画师",
				title: metadata?.title || titleFromFile || group.title,
				sourceUrl:
					metadata?.source_url || `https://www.pixiv.net/artworks/${artworkId}`,
				license: "用户提供素材；公开发布前请再次确认作品使用许可",
				permission: "user-provided",
				theme: group.theme,
				alt: `${group.title} 插画：${metadata?.title || titleFromFile || artworkId}`,
				image: `/assets/illustrations/${group.folder}/${artworkId}-p0.webp`,
				width: info.width,
				height: info.height,
				sha256: createHash("sha256").update(data).digest("hex"),
			};
			catalogByKey.set(`${artworkId}:p0`, item);
			imported.push(item);
		}
		imported.sort((left, right) =>
			left.artworkId.localeCompare(right.artworkId, "en"),
		);
		await mkdir(albumRoot, { recursive: true });
		await writeFile(
			path.join(albumRoot, `${prefix.toLowerCase().replaceAll("_", "-")}.md`),
			albumDocument(group, imported),
			"utf8",
		);
		console.log(`${group.title}: ${imported.length} 张`);
	}

	const catalog = {
		version: 1,
		items: [...catalogByKey.values()].sort(
			(left, right) =>
				left.theme.localeCompare(right.theme, "zh-CN") ||
				left.artworkId.localeCompare(right.artworkId, "en"),
		),
	};
	await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

await main();
