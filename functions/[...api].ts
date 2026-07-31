import { handleApiRequest } from "../src/server/api/router";
import type { StorageEnvironment } from "./_storage";

export interface Env extends StorageEnvironment {}

interface CloudflareContext {
	request: Request;
	env: Env;
}

export function onRequest(context: CloudflareContext): Promise<Response> {
	return handleApiRequest(context.request, context.env);
}

export default {
	fetch(request: Request, env: Env): Promise<Response> {
		return handleApiRequest(request, env);
	},
};
