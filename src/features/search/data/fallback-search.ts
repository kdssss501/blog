import type { SearchResult } from "@/global";
import { createApiUrl } from "@/shared/http";
import { url as formatUrl } from "@/utils/url-utils";
import {
	type FallbackSearchPost,
	filterFallbackPosts,
} from "../model/fallback-search";

export async function searchFallbackPosts(
	query: string,
): Promise<SearchResult[]> {
	const response = await fetch(createApiUrl("api", "allPostMeta.json"));
	if (!response.ok) {
		throw new Error(`Fallback search failed: ${response.status}`);
	}
	const posts = (await response.json()) as FallbackSearchPost[];
	return filterFallbackPosts(posts, query).map((result) => ({
		...result,
		url: formatUrl(result.url),
	}));
}
