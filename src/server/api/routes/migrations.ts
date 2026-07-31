import {
	applyDumplingMigration,
	previewDumplingMigration,
} from "../../migrations/dumpling-theme";
import type { StorageAdapter, StorageEnvironment } from "../../storage";
import { getUnifiedAdminAccess } from "../admin-auth";
import { jsonResponse, readJsonObject } from "../http";

export async function handleMigrationRequest(
	storage: StorageAdapter,
	request: Request,
	env: StorageEnvironment,
): Promise<Response> {
	if (request.method !== "POST") {
		return jsonResponse({ error: "Method Not Allowed" }, 405);
	}
	const access = await getUnifiedAdminAccess(
		request,
		env.BLOG_ADMIN_TOKEN,
		undefined,
		"Blog",
	);
	if (!access.granted) {
		return jsonResponse({ error: access.error }, access.status);
	}
	const body = await readJsonObject(request);
	const mode = body.mode === "apply" ? "apply" : "preview";
	const report =
		mode === "apply"
			? await applyDumplingMigration(storage)
			: await previewDumplingMigration(storage);
	return jsonResponse({ mode, ...report });
}
