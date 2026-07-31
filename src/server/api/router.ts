import type { PixivCrawlerRuntime } from "@/shared/pixiv-crawler/contract";
import type { LocalTtsRuntime } from "../../shared/local-tts/contract";
import {
	getStorage,
	type StorageAdapter,
	type StorageEnvironment,
	StorageUnavailableError,
	type VercelKVClient,
} from "../storage";
import type { LocalContentAssetWriter } from "../storage/assets";
import { corsHeaders, jsonResponse } from "./http";
import { handleActivityRequest } from "./routes/activity";
import { handleAdminSessionRequest } from "./routes/admin-session";
import { handleAIChatRequest } from "./routes/ai-chat";
import { handleContentRequest } from "./routes/content";
import { handleFriendFeedRequest } from "./routes/friend-feed";
import { handleGuestbookRequest } from "./routes/guestbook";
import { handleLocalTtsRequest } from "./routes/local-tts";
import { handleMigrationRequest } from "./routes/migrations";
import { handleNotebookRequest } from "./routes/notebook";
import { handlePixivCrawlerRequest } from "./routes/pixiv-crawler";
import { handlePostsRequest } from "./routes/posts";
import { handleSiteConfigRequest } from "./routes/site-config";

export interface ApiRuntimeDependencies {
	localAssetWriter?: LocalContentAssetWriter;
	localTts?: LocalTtsRuntime;
	pixivCrawler?: PixivCrawlerRuntime;
	storageFallback?: StorageAdapter;
	vercelKV?: VercelKVClient;
}

export async function handleApiRequest(
	request: Request,
	env: StorageEnvironment = {},
	dependencies: ApiRuntimeDependencies = {},
): Promise<Response> {
	const url = new URL(request.url);
	const runtimeEnv = env;
	const path = url.pathname.replace(/\/+$/, "") || "/";

	if (path === "/api/ai-chat") {
		return handleAIChatRequest(request, runtimeEnv);
	}
	if (path === "/api/admin/session") {
		return handleAdminSessionRequest(request, runtimeEnv);
	}
	if (path === "/api/pixiv-crawler") {
		return handlePixivCrawlerRequest(request, dependencies.pixivCrawler);
	}

	if (request.method === "OPTIONS") {
		return new Response(null, { headers: corsHeaders });
	}
	if (path === "/api/xiao/tts") {
		return handleLocalTtsRequest(request, dependencies.localTts);
	}
	if (path === "/api/xiao/tts/health") {
		return handleLocalTtsRequest(request, dependencies.localTts, true);
	}

	try {
		const storage = await getStorage(runtimeEnv, {
			fallback: dependencies.storageFallback,
			vercelKV: dependencies.vercelKV,
		});

		if (url.pathname.startsWith("/api/guestbook")) {
			return await handleGuestbookRequest(storage, request, url);
		}
		if (path === "/api/admin/migrations/dumpling-theme") {
			return await handleMigrationRequest(storage, request, runtimeEnv);
		}
		if (url.pathname.startsWith("/api/notebook")) {
			return await handleNotebookRequest(storage, request, url, runtimeEnv);
		}
		if (url.pathname.startsWith("/api/activity")) {
			return await handleActivityRequest(storage, request, url, runtimeEnv);
		}
		if (path === "/api/content" || path.startsWith("/api/content/")) {
			return await handleContentRequest(
				storage,
				request,
				url,
				runtimeEnv,
				dependencies.localAssetWriter,
			);
		}
		if (url.pathname.startsWith("/api/friend-feed")) {
			return await handleFriendFeedRequest(storage, request, url, runtimeEnv);
		}
		if (url.pathname.startsWith("/api/posts/")) {
			return await handlePostsRequest(storage, request, url, runtimeEnv);
		}
		if (path === "/api/site-config") {
			return await handleSiteConfigRequest(storage, request, runtimeEnv);
		}
		return new Response("Not Found", { status: 404 });
	} catch (error) {
		if (error instanceof StorageUnavailableError) {
			return jsonResponse({ error: error.message }, 503);
		}
		console.error("[API Error]", error);
		return jsonResponse({ error: "Internal Server Error" }, 500);
	}
}
