import artworkCatalog from "../../../public/assets/illustrations/catalog.json";
import {
	ARTWORK_PERMISSIONS,
	type ArtworkAttribution,
	type ArtworkPermission,
	type ArtworkTheme,
} from "./artwork";

const ARTICLE_ALBUMS = [
	{ id: "01-eva", theme: "EVA", pathSegment: "/eva/" },
	{
		id: "02-wuthering-waves",
		theme: "鸣潮",
		pathSegment: "/wuthering-waves/",
	},
	{
		id: "03-mushoku-tensei",
		theme: "无职转生",
		pathSegment: "/mushoku-tensei/",
	},
	{
		id: "04-fate",
		theme: "命运王座",
		pathSegment: "/fate-throne/",
	},
] as const;

interface CatalogArtwork {
	artist: string;
	sourceUrl: string;
	license: string;
	permission: string;
	theme: string;
	alt: string;
	image: string;
	width: number;
	height: number;
}

export interface ArticleAlbumCover {
	albumId: (typeof ARTICLE_ALBUMS)[number]["id"];
	imageUrl: string;
	alt: string;
	attribution: ArtworkAttribution;
}

function stableHash(value: string): number {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function isArtworkPermission(value: string): value is ArtworkPermission {
	return ARTWORK_PERMISSIONS.includes(value as ArtworkPermission);
}

const albumCoverGroups = ARTICLE_ALBUMS.map((album) => {
	const allItems = (artworkCatalog.items as CatalogArtwork[]).filter(
		(item) =>
			item.image.includes(album.pathSegment) &&
			item.theme === album.theme &&
			isArtworkPermission(item.permission),
	);
	// 横图和接近方形的作品在 2:1 文章封面中保留更多主体。
	const cropFriendlyItems = allItems.filter(
		(item) =>
			item.width > 0 && item.height > 0 && item.width / item.height >= 0.85,
	);
	return {
		...album,
		items: cropFriendlyItems.length > 0 ? cropFriendlyItems : allItems,
	};
});

export const ARTICLE_ALBUM_COVER_COUNT = albumCoverGroups.reduce(
	(total, album) => total + album.items.length,
	0,
);

export function getArticleAlbumCover(
	seed: string,
	ordinal = stableHash(`${seed}:album`),
): ArticleAlbumCover {
	const normalizedOrdinal = Math.max(0, Math.trunc(ordinal));
	const album = albumCoverGroups[normalizedOrdinal % albumCoverGroups.length];
	const albumRound = Math.floor(normalizedOrdinal / albumCoverGroups.length);
	const item =
		album.items[
			(stableHash(`${seed}:image`) + albumRound * 7) % album.items.length
		];
	if (!item) {
		throw new Error(`文章封面相册 ${album.id} 没有可用图片。`);
	}

	return {
		albumId: album.id,
		imageUrl: item.image,
		alt: item.alt,
		attribution: {
			artist: item.artist,
			sourceUrl: item.sourceUrl,
			license: item.license,
			permission: item.permission as ArtworkPermission,
			theme: item.theme as ArtworkTheme,
		},
	};
}
