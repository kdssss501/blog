import type { CollectionEntry } from "astro:content";
import type { ArtworkAttribution } from "@/shared/content/artwork";

export type PostEntry = CollectionEntry<"posts">;

export type PostForList = {
	id: string;
	data: PostEntry["data"];
};

export type Tag = {
	name: string;
	count: number;
};

export type Category = {
	name: string;
	count: number;
	url: string;
};

export type CatalogGroup = {
	name: string;
	count: number;
	posts: PostForList[];
	isCurrent: boolean;
};

export type ArticleListTag = {
	name: string;
	url: string;
};

export type ArticleListPost = {
	id: string;
	title: string;
	url: string;
	publishedIso: string;
	publishedText: string;
	category: string;
	categoryUrl: string;
	tags: ArticleListTag[];
	description: string;
	imageUrl: string;
	imageApiUrls: string[];
	imageReferrerPolicy: string;
	imageAttribution?: ArtworkAttribution;
	pinned: boolean;
	password: boolean;
};
