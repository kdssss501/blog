export const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

export async function readJsonObject(
	request: Request,
): Promise<Record<string, unknown>> {
	const value: unknown = await request.json().catch(() => ({}));
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: {};
}

export function readString(
	object: Record<string, unknown>,
	key: string,
	fallback = "",
): string {
	return typeof object[key] === "string" ? object[key] : fallback;
}

export function jsonResponse(
	data: unknown,
	status = 200,
	headers?: HeadersInit,
): Response {
	const responseHeaders = new Headers(corsHeaders);
	responseHeaders.set("Content-Type", "application/json");
	new Headers(headers).forEach((value, key) => {
		responseHeaders.set(key, value);
	});
	return new Response(JSON.stringify(data), {
		status,
		headers: responseHeaders,
	});
}
