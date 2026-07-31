import { kv } from "@vercel/kv";
import { getLocalPixivCrawlerRuntime } from "../pixiv-crawler/node-runtime";
import type { StorageEnvironment, VercelKVClient } from "../storage";
import {
	getLocalFileStorage,
	writeLocalContentAsset,
} from "../storage/node-file";
import { getLocalGptSovitsRuntime } from "../tts/node-runtime";
import { createRemoteTtsRuntimeFromEnv } from "../tts/remote-runtime";
import { handleApiRequest } from "./router";

function isHostedRuntime(env: StorageEnvironment) {
	return (
		env.NODE_ENV === "production" ||
		env.VERCEL === "1" ||
		env.CF_PAGES === "1" ||
		env.CF_PAGES === true
	);
}

export function handleNodeApiRequest(
	request: Request,
	env: StorageEnvironment = process.env,
): Promise<Response> {
	const hosted = isHostedRuntime(env);
	const localTts = hosted
		? createRemoteTtsRuntimeFromEnv(env)
		: getLocalGptSovitsRuntime();
	return handleApiRequest(request, env, {
		vercelKV: kv as unknown as VercelKVClient,
		...(localTts ? { localTts } : {}),
		...(hosted
			? {}
			: {
					storageFallback: getLocalFileStorage(),
					localAssetWriter: writeLocalContentAsset,
					pixivCrawler: getLocalPixivCrawlerRuntime(),
				}),
	});
}

export default {
	fetch: handleNodeApiRequest,
};
