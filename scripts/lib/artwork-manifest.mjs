import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	ARTWORK_PERMISSIONS,
	ARTWORK_THEMES,
} from "../../src/shared/content/artwork.ts";

export const ARTWORK_CATALOG_VERSION = 1;
export const ARTWORK_THEME_FOLDERS = Object.freeze({
	鸣潮: "wuthering-waves",
	命运王座: "fate-throne",
	EVA: "eva",
	"Re:Zero": "re-zero",
	无职转生: "mushoku-tensei",
	原创: "original",
	蔚蓝档案: "blue-archive",
	碧蓝航线: "azur-lane",
	原神: "genshin-impact",
	"明日方舟：终末地": "arknights-endfield",
	绝区零: "zenless-zone-zero",
});

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
export const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
export const ARTWORK_PUBLIC_ROOT = path.join(
	REPOSITORY_ROOT,
	"public",
	"assets",
	"illustrations",
);
export const ARTWORK_CATALOG_PATH = path.join(
	ARTWORK_PUBLIC_ROOT,
	"catalog.json",
);

function assertRecord(value, label) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label} 必须是对象。`);
	}
	return value;
}

function readRequiredString(record, key, label) {
	const value = record[key];
	if (typeof value !== "string" || !value.trim()) {
		throw new Error(`${label}.${key} 必须是非空字符串。`);
	}
	return value.trim();
}

function readPage(record, label) {
	const page = record.page ?? 0;
	if (!Number.isInteger(page) || page < 0) {
		throw new Error(`${label}.page 必须是大于等于 0 的整数。`);
	}
	return page;
}

function normalizePixivSourceUrl(sourceUrl, artworkId, label) {
	let parsed;
	try {
		parsed = new URL(sourceUrl);
	} catch {
		throw new Error(`${label}.sourceUrl 不是有效 URL。`);
	}
	if (
		parsed.protocol !== "https:" ||
		!new Set(["pixiv.net", "www.pixiv.net"]).has(parsed.hostname) ||
		parsed.username ||
		parsed.password
	) {
		throw new Error(`${label}.sourceUrl 必须是公开的 HTTPS Pixiv 作品页。`);
	}
	const match = parsed.pathname.match(
		/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?artworks\/(\d+)\/?$/i,
	);
	if (!match || match[1] !== artworkId) {
		throw new Error(`${label}.sourceUrl 中的作品 ID 必须与 artworkId 一致。`);
	}
	return `https://www.pixiv.net/artworks/${artworkId}`;
}

function normalizePublicFields(record, label) {
	const artworkId = readRequiredString(record, "artworkId", label);
	if (!/^\d+$/.test(artworkId)) {
		throw new Error(`${label}.artworkId 只能包含数字。`);
	}
	const page = readPage(record, label);
	const artist = readRequiredString(record, "artist", label);
	const license = readRequiredString(record, "license", label);
	const alt = readRequiredString(record, "alt", label);
	const permission = readRequiredString(record, "permission", label);
	if (!ARTWORK_PERMISSIONS.includes(permission)) {
		throw new Error(
			`${label}.permission 必须是 ${ARTWORK_PERMISSIONS.join("、")} 之一。`,
		);
	}
	const theme = readRequiredString(record, "theme", label);
	if (!ARTWORK_THEMES.includes(theme)) {
		throw new Error(
			`${label}.theme 必须是 ${ARTWORK_THEMES.join("、")} 之一。`,
		);
	}
	const sourceUrl = normalizePixivSourceUrl(
		readRequiredString(record, "sourceUrl", label),
		artworkId,
		label,
	);

	return {
		artworkId,
		page,
		artist,
		sourceUrl,
		license,
		permission,
		theme,
		alt,
	};
}

export function getArtworkKey(item) {
	return `${item.artworkId}:p${item.page}`;
}

export function getArtworkImageUrl(item) {
	const folder = ARTWORK_THEME_FOLDERS[item.theme];
	if (!folder) throw new Error(`不支持的插图主题：${item.theme}`);
	return `/assets/illustrations/${folder}/${item.artworkId}-p${item.page}.webp`;
}

export function getArtworkOutputPath(item) {
	return path.join(
		ARTWORK_PUBLIC_ROOT,
		getArtworkImageUrl(item).replace(/^\/assets\/illustrations\//, ""),
	);
}

export function normalizeArtworkManifest(value) {
	const manifest = assertRecord(value, "manifest");
	if (manifest.version !== ARTWORK_CATALOG_VERSION) {
		throw new Error(`manifest.version 必须是 ${ARTWORK_CATALOG_VERSION}。`);
	}
	if (!Array.isArray(manifest.items) || manifest.items.length === 0) {
		throw new Error("manifest.items 必须至少包含一个作品。 ");
	}

	const keys = new Set();
	const items = manifest.items.map((value, index) => {
		const label = `manifest.items[${index}]`;
		const record = assertRecord(value, label);
		const normalized = {
			...normalizePublicFields(record, label),
			sourceFile: readRequiredString(record, "sourceFile", label),
			permissionEvidence: readRequiredString(
				record,
				"permissionEvidence",
				label,
			),
		};
		const key = getArtworkKey(normalized);
		if (keys.has(key)) throw new Error(`授权清单包含重复作品页：${key}`);
		keys.add(key);
		return normalized;
	});

	return { version: ARTWORK_CATALOG_VERSION, items };
}

export function normalizeArtworkCatalog(value) {
	const catalog = assertRecord(value, "catalog");
	if (catalog.version !== ARTWORK_CATALOG_VERSION) {
		throw new Error(`catalog.version 必须是 ${ARTWORK_CATALOG_VERSION}。`);
	}
	if (!Array.isArray(catalog.items)) {
		throw new Error("catalog.items 必须是数组。 ");
	}

	const keys = new Set();
	const items = catalog.items.map((value, index) => {
		const label = `catalog.items[${index}]`;
		const record = assertRecord(value, label);
		const normalized = normalizePublicFields(record, label);
		const key = getArtworkKey(normalized);
		if (keys.has(key)) throw new Error(`公开目录包含重复作品页：${key}`);
		keys.add(key);

		const image = readRequiredString(record, "image", label);
		if (image !== getArtworkImageUrl(normalized)) {
			throw new Error(`${label}.image 与作品 ID 或主题目录不一致。`);
		}
		const width = record.width;
		const height = record.height;
		if (
			!Number.isInteger(width) ||
			width <= 0 ||
			!Number.isInteger(height) ||
			height <= 0
		) {
			throw new Error(`${label} 必须包含有效的 width 和 height。`);
		}
		const sha256 = readRequiredString(record, "sha256", label).toLowerCase();
		if (!/^[a-f0-9]{64}$/.test(sha256)) {
			throw new Error(`${label}.sha256 必须是 64 位十六进制摘要。`);
		}

		return { ...normalized, image, width, height, sha256 };
	});
	const sourceImages = new Set(items.map((item) => item.image));
	const derivedRecords = catalog.derivedAssets ?? [];
	if (!Array.isArray(derivedRecords)) {
		throw new Error("catalog.derivedAssets 必须是数组。 ");
	}
	const derivedImages = new Set();
	const derivedAssets = derivedRecords.map((value, index) => {
		const label = `catalog.derivedAssets[${index}]`;
		const record = assertRecord(value, label);
		const sourceImage = readRequiredString(record, "sourceImage", label);
		if (!sourceImages.has(sourceImage)) {
			throw new Error(`${label}.sourceImage 必须指向已登记的原始插图。`);
		}
		const image = readRequiredString(record, "image", label);
		if (
			!image.startsWith("/assets/illustrations/") ||
			image.includes("..") ||
			!image.endsWith(".webp") ||
			image === sourceImage
		) {
			throw new Error(
				`${label}.image 必须是 illustrations 下独立的 WebP 文件。`,
			);
		}
		if (derivedImages.has(image)) {
			throw new Error(`catalog.derivedAssets 包含重复文件：${image}`);
		}
		derivedImages.add(image);
		const width = record.width;
		const height = record.height;
		if (
			!Number.isInteger(width) ||
			width <= 0 ||
			!Number.isInteger(height) ||
			height <= 0
		) {
			throw new Error(`${label} 必须包含有效的 width 和 height。`);
		}
		const sha256 = readRequiredString(record, "sha256", label).toLowerCase();
		if (!/^[a-f0-9]{64}$/.test(sha256)) {
			throw new Error(`${label}.sha256 必须是 64 位十六进制摘要。`);
		}
		const transform = readRequiredString(record, "transform", label);
		return { sourceImage, image, width, height, sha256, transform };
	});

	return { version: ARTWORK_CATALOG_VERSION, items, derivedAssets };
}

export function buildCatalogItem(item, imageMetadata) {
	return {
		artworkId: item.artworkId,
		page: item.page,
		artist: item.artist,
		sourceUrl: item.sourceUrl,
		license: item.license,
		permission: item.permission,
		theme: item.theme,
		alt: item.alt,
		image: getArtworkImageUrl(item),
		width: imageMetadata.width,
		height: imageMetadata.height,
		sha256: imageMetadata.sha256,
	};
}

export function resolveManifestSourcePath(manifestPath, sourceFile) {
	return path.resolve(path.dirname(path.resolve(manifestPath)), sourceFile);
}
