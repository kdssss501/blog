import { XMLParser } from "fast-xml-parser";
import sanitizeHtml from "sanitize-html";
import type {
	FriendFeedEntry,
	FriendFeedResponse,
	FriendFeedSource,
} from "@/features/friend-feed";
import type { FriendLink } from "@/features/friends";
import { friendsConfig } from "../../../config/friendsConfig.ts";
import {
	type StorageAdapter,
	type StorageEnvironment,
	storageGetJSON,
	storageSetJSON,
} from "../../storage/index.ts";
import { getUnifiedAdminAccess } from "../admin-auth.ts";
import { jsonResponse } from "../http.ts";

const CACHE_KEY = "friend-feed:cache:v1";
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_FEED_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 8_000;

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	removeNSPrefix: true,
	textNodeName: "#text",
});

function toArray<Value>(value: Value | Value[] | undefined): Value[] {
	if (value === undefined) return [];
	return Array.isArray(value) ? value : [value];
}

function readText(value: unknown): string {
	if (typeof value === "string" || typeof value === "number") {
		return String(value).trim();
	}
	if (value && typeof value === "object" && "#text" in value) {
		return readText((value as { "#text": unknown })["#text"]);
	}
	return "";
}

function cleanExcerpt(value: unknown): string {
	return sanitizeHtml(readText(value), {
		allowedTags: [],
		allowedAttributes: {},
	})
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 220);
}

function stableId(input: string): string {
	let hash = 2166136261;
	for (let index = 0; index < input.length; index += 1) {
		hash ^= input.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}

function getAtomLink(value: unknown): string {
	for (const item of toArray(value)) {
		if (typeof item === "string") return item;
		if (!item || typeof item !== "object") continue;
		const link = item as Record<string, unknown>;
		if ((!link["@_rel"] || link["@_rel"] === "alternate") && link["@_href"]) {
			return String(link["@_href"]);
		}
	}
	return "";
}

function normalizeHttpUrl(value: string, base: string): string {
	try {
		const url = new URL(value, base);
		return url.protocol === "http:" || url.protocol === "https:"
			? url.href
			: "";
	} catch {
		return "";
	}
}

function normalizeDate(value: unknown): string {
	const parsed = new Date(readText(value));
	return Number.isNaN(parsed.getTime())
		? new Date(0).toISOString()
		: parsed.toISOString();
}

export function parseFriendFeedXml(
	xml: string,
	source: FriendFeedSource,
): FriendFeedEntry[] {
	const document = parser.parse(xml) as Record<string, unknown>;
	const rssChannel = (
		document.rss as { channel?: Record<string, unknown> } | undefined
	)?.channel;
	const rssItems = toArray(
		rssChannel?.item as
			| Record<string, unknown>
			| Record<string, unknown>[]
			| undefined,
	);
	const atomFeed = document.feed as Record<string, unknown> | undefined;
	const atomItems = toArray(
		atomFeed?.entry as
			| Record<string, unknown>
			| Record<string, unknown>[]
			| undefined,
	);
	const rawItems = rssItems.length > 0 ? rssItems : atomItems;

	return rawItems.slice(0, 20).flatMap((item) => {
		const title = readText(item.title);
		const rawLink =
			rssItems.length > 0 ? readText(item.link) : getAtomLink(item.link);
		const link = normalizeHttpUrl(rawLink, source.siteUrl);
		if (!title || !link) return [];
		const publishedAt = normalizeDate(
			item.pubDate ?? item.published ?? item.updated ?? item.date,
		);
		const excerpt = cleanExcerpt(
			item.description ?? item.summary ?? item.content ?? "",
		);
		return [
			{
				id: `${source.id}-${stableId(readText(item.guid ?? item.id) || link)}`,
				sourceId: source.id,
				sourceName: source.name,
				sourceUrl: source.siteUrl,
				sourceAvatar: source.avatar,
				title,
				url: link,
				publishedAt,
				excerpt,
			},
		];
	});
}

export function createFriendFeedSources(
	friends: FriendLink[],
): FriendFeedSource[] {
	return friends.flatMap((friend, index) => {
		if (!friend.enabled || !friend.feedUrl) return [];
		let feedUrl: URL;
		try {
			feedUrl = new URL(friend.feedUrl);
		} catch {
			return [];
		}
		if (feedUrl.protocol !== "https:") return [];
		return [
			{
				id: `friend-${index}-${stableId(friend.siteurl)}`,
				name: friend.title,
				siteUrl: friend.siteurl,
				feedUrl: feedUrl.href,
				avatar: friend.imgurl,
			},
		];
	});
}

export function getFriendFeedSources(): FriendFeedSource[] {
	return createFriendFeedSources(friendsConfig);
}

async function fetchSource(
	source: FriendFeedSource,
): Promise<FriendFeedEntry[]> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(source.feedUrl, {
			headers: {
				Accept:
					"application/atom+xml, application/rss+xml, application/xml, text/xml",
			},
			signal: controller.signal,
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const declaredLength = Number(response.headers.get("content-length") ?? 0);
		if (declaredLength > MAX_FEED_BYTES) throw new Error("feed is too large");
		const xml = await response.text();
		if (xml.length > MAX_FEED_BYTES) throw new Error("feed is too large");
		return parseFriendFeedXml(xml, source);
	} finally {
		clearTimeout(timer);
	}
}

async function refreshFriendFeed(
	storage: StorageAdapter,
	sources: FriendFeedSource[],
): Promise<FriendFeedResponse> {
	const results = await Promise.allSettled(sources.map(fetchSource));
	const failures: string[] = [];
	const entries: FriendFeedEntry[] = [];
	for (let index = 0; index < results.length; index += 1) {
		const result = results[index];
		if (result.status === "fulfilled") entries.push(...result.value);
		else failures.push(sources[index].id);
	}
	const response: FriendFeedResponse = {
		entries: entries
			.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
			.slice(0, 60),
		sources,
		failures,
		updatedAt: new Date().toISOString(),
	};
	await storageSetJSON(storage, CACHE_KEY, response);
	return response;
}

function filterResponse(response: FriendFeedResponse, sourceId: string | null) {
	return sourceId
		? {
				...response,
				entries: response.entries.filter(
					(entry) => entry.sourceId === sourceId,
				),
			}
		: response;
}

export async function handleFriendFeedRequest(
	storage: StorageAdapter,
	request: Request,
	url: URL,
	env: StorageEnvironment,
): Promise<Response> {
	const sources = getFriendFeedSources();
	const cached = await storageGetJSON<FriendFeedResponse>(storage, CACHE_KEY);
	const sourceId = url.searchParams.get("friend");

	if (request.method === "POST") {
		const access = await getUnifiedAdminAccess(
			request,
			env.BLOG_ADMIN_TOKEN,
			undefined,
			"Friend feed",
		);
		if (!access.granted) {
			return jsonResponse({ error: access.error }, access.status);
		}
		return jsonResponse(
			filterResponse(await refreshFriendFeed(storage, sources), sourceId),
		);
	}

	if (request.method !== "GET")
		return jsonResponse({ error: "Method Not Allowed" }, 405);
	if (sources.length === 0) {
		return jsonResponse({
			entries: [],
			sources: [],
			failures: [],
			updatedAt: new Date().toISOString(),
		});
	}
	if (cached && Date.now() - Date.parse(cached.updatedAt) < CACHE_TTL_MS) {
		return jsonResponse(filterResponse(cached, sourceId));
	}
	try {
		return jsonResponse(
			filterResponse(await refreshFriendFeed(storage, sources), sourceId),
		);
	} catch {
		if (cached)
			return jsonResponse(filterResponse({ ...cached, stale: true }, sourceId));
		return jsonResponse({
			entries: [],
			sources,
			failures: sources.map((source) => source.id),
			updatedAt: new Date().toISOString(),
			stale: true,
		});
	}
}
