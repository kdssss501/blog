import {
	normalizePixivCrawlerInput,
	type PixivCrawlerRuntime,
} from "@/shared/pixiv-crawler/contract";
import { jsonResponse, readJsonObject } from "../http";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

function isTrustedLocalWrite(request: Request): boolean {
	const url = new URL(request.url);
	const fetchSite = request.headers.get("sec-fetch-site");
	return (
		LOOPBACK_HOSTS.has(url.hostname) &&
		(!fetchSite || fetchSite === "same-origin" || fetchSite === "none") &&
		request.headers.get("x-pixiv-crawler-client") === "album-studio"
	);
}

export async function handlePixivCrawlerRequest(
	request: Request,
	runtime?: PixivCrawlerRuntime,
): Promise<Response> {
	if (request.method === "GET") {
		return jsonResponse(
			runtime
				? await runtime.getStatus()
				: {
						available: false,
						state: "unavailable",
						reason: "PixivCrawler 只在本机开发预览中运行。",
					},
		);
	}

	if (!runtime) {
		return jsonResponse(
			{ error: "PixivCrawler 只在本机开发预览中运行。" },
			501,
		);
	}
	if (!isTrustedLocalWrite(request)) {
		return jsonResponse({ error: "只允许从本机相册采集台发起任务。" }, 403);
	}

	if (request.method === "DELETE") {
		return jsonResponse(await runtime.cancel());
	}
	if (request.method !== "POST") {
		return jsonResponse({ error: "Method Not Allowed" }, 405);
	}

	const parsed = normalizePixivCrawlerInput(await readJsonObject(request));
	if (!parsed.ok) return jsonResponse({ error: parsed.error }, 400);
	const previous = await runtime.getStatus();
	if (previous.state === "running") {
		return jsonResponse({ ...previous, error: "已有采集任务正在运行。" }, 409);
	}
	return jsonResponse(await runtime.start(parsed.value), 202);
}
