import type { StorageEnvironment } from "../storage";
import { createRemoteTtsRuntimeFromEnv } from "../tts/remote-runtime";
import { handleApiRequest } from "./router";

export function handleHostedApiRequest(
	request: Request,
	env: StorageEnvironment = process.env,
): Promise<Response> {
	const remoteTts = createRemoteTtsRuntimeFromEnv(env);
	return handleApiRequest(request, env, {
		...(remoteTts ? { localTts: remoteTts } : {}),
	});
}

export default {
	fetch: handleHostedApiRequest,
};
