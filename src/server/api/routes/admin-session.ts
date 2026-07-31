import type { StorageEnvironment } from "../../storage";
import {
	clearAdminSessionCookie,
	createAdminSession,
	createAdminSessionCookie,
	getUnifiedAdminAccess,
} from "../admin-auth";
import { jsonResponse, readJsonObject, readString } from "../http";

export async function handleAdminSessionRequest(
	request: Request,
	env: StorageEnvironment,
): Promise<Response> {
	if (request.method === "DELETE") {
		return jsonResponse({ authenticated: false }, 200, {
			"Set-Cookie": clearAdminSessionCookie(),
		});
	}

	if (request.method === "GET") {
		const access = await getUnifiedAdminAccess(
			request,
			env.BLOG_ADMIN_TOKEN,
			undefined,
			"Blog",
		);
		return access.granted
			? jsonResponse({ authenticated: true, expiresIn: 7200 })
			: access.status === 401
				? jsonResponse({ authenticated: false })
				: jsonResponse(
						{ authenticated: false, error: access.error },
						access.status,
					);
	}

	if (request.method !== "POST") {
		return jsonResponse({ error: "Method Not Allowed" }, 405);
	}

	const expected =
		typeof env.BLOG_ADMIN_TOKEN === "string" ? env.BLOG_ADMIN_TOKEN.trim() : "";
	if (!expected) {
		return jsonResponse(
			{ error: "Blog administration is not configured" },
			503,
		);
	}
	const body = await readJsonObject(request);
	if (readString(body, "token") !== expected) {
		return jsonResponse({ error: "Unauthorized" }, 401);
	}
	const session = await createAdminSession(expected);
	return jsonResponse({ authenticated: true, expiresIn: 7200 }, 200, {
		"Set-Cookie": createAdminSessionCookie(session),
	});
}
