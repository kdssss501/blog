import type { NotebookEntry } from "@/features/notebook";
import {
	type StorageAdapter,
	type StorageEnvironment,
	storageGetJSON,
	storageGetList,
	storageSetJSON,
	storageSetList,
} from "../../storage";
import { getUnifiedAdminAccess, isAdminWriteMethod } from "../admin-auth";
import { escapeHtml, jsonResponse, readJsonObject, readString } from "../http";

async function requireNotebookAdmin(
	request: Request,
	env: StorageEnvironment,
): Promise<Response | null> {
	const access = await getUnifiedAdminAccess(
		request,
		env.BLOG_ADMIN_TOKEN,
		env.NOTEBOOK_ADMIN_TOKEN,
		"Notebook",
	);
	return access.granted
		? null
		: jsonResponse({ error: access.error }, access.status);
}

async function getEntry(
	storage: StorageAdapter,
	id: string,
): Promise<NotebookEntry | null> {
	return storageGetJSON<NotebookEntry>(storage, `notebook:entry:${id}`);
}

async function setEntry(
	storage: StorageAdapter,
	entry: NotebookEntry,
): Promise<void> {
	await storageSetJSON(storage, `notebook:entry:${entry.id}`, entry);
}

async function getNextId(storage: StorageAdapter): Promise<string> {
	const counter = Number((await storage.get("notebook:counter")) || "0") + 1;
	await storage.set("notebook:counter", String(counter));
	return `nb_${String(counter).padStart(3, "0")}`;
}

async function handleList(
	storage: StorageAdapter,
	url: URL,
): Promise<Response> {
	const ids = await storageGetList(storage, "notebook:list");
	let entries = (
		await Promise.all(ids.map((id) => getEntry(storage, id)))
	).filter((entry): entry is NotebookEntry => entry !== null);
	const notebook = url.searchParams.get("notebook");
	if (notebook)
		entries = entries.filter((entry) => entry.notebook === notebook);
	entries.sort((left, right) => right.createdAt - left.createdAt);
	return jsonResponse({ entries, total: entries.length });
}

async function handleCreate(
	storage: StorageAdapter,
	request: Request,
): Promise<Response> {
	const body = await readJsonObject(request);
	const notebook = escapeHtml(readString(body, "notebook").trim());
	const title = escapeHtml(readString(body, "title").trim());
	const content = readString(body, "content").trim();
	if (!notebook || !title || !content) {
		return jsonResponse(
			{ error: "notebook, title, content are required" },
			400,
		);
	}
	const now = Date.now();
	const entry: NotebookEntry = {
		id: await getNextId(storage),
		notebook,
		title,
		date: readString(body, "date", new Date().toISOString().slice(0, 10)),
		content,
		cover: readString(body, "cover").trim(),
		createdAt: now,
		updatedAt: now,
	};
	await setEntry(storage, entry);
	const ids = await storageGetList(storage, "notebook:list");
	ids.unshift(entry.id);
	await storageSetList(storage, "notebook:list", ids);
	return jsonResponse(entry, 201);
}

async function handleUpdate(
	storage: StorageAdapter,
	id: string,
	request: Request,
): Promise<Response> {
	const entry = await getEntry(storage, id);
	if (!entry) return jsonResponse({ error: "Not found" }, 404);
	const body = await readJsonObject(request);
	if (typeof body.notebook === "string") {
		entry.notebook = escapeHtml(body.notebook.trim());
	}
	if (typeof body.title === "string") {
		entry.title = escapeHtml(body.title.trim());
	}
	if (typeof body.content === "string") entry.content = body.content;
	if (typeof body.date === "string") entry.date = body.date;
	if (typeof body.cover === "string") entry.cover = body.cover;
	entry.updatedAt = Date.now();
	await setEntry(storage, entry);
	return jsonResponse(entry);
}

async function handleDelete(
	storage: StorageAdapter,
	id: string,
): Promise<Response> {
	if (!(await getEntry(storage, id))) {
		return jsonResponse({ error: "Not found" }, 404);
	}
	await storage.delete(`notebook:entry:${id}`);
	const ids = (await storageGetList(storage, "notebook:list")).filter(
		(existingId) => existingId !== id,
	);
	await storageSetList(storage, "notebook:list", ids);
	return jsonResponse({ success: true, id });
}

export async function handleNotebookRequest(
	storage: StorageAdapter,
	request: Request,
	url: URL,
	env: StorageEnvironment,
): Promise<Response> {
	const segments = url.pathname.split("/").filter(Boolean).slice(2);
	if (segments.join("/") === "admin-check" && request.method === "GET") {
		const denied = await requireNotebookAdmin(request, env);
		return denied ?? jsonResponse({ authenticated: true });
	}
	if (request.method === "GET" && segments.length === 0) {
		return handleList(storage, url);
	}
	if (request.method === "GET" && segments.length === 1) {
		const entry = await getEntry(storage, segments[0]);
		return entry
			? jsonResponse(entry)
			: jsonResponse({ error: "Not found" }, 404);
	}
	if (isAdminWriteMethod(request.method)) {
		const denied = await requireNotebookAdmin(request, env);
		if (denied) return denied;
	}
	if (request.method === "POST" && segments.length === 0) {
		return handleCreate(storage, request);
	}
	if (request.method === "PUT" && segments.length === 1) {
		return handleUpdate(storage, segments[0], request);
	}
	if (request.method === "DELETE" && segments.length === 1) {
		return handleDelete(storage, segments[0]);
	}
	return new Response("Not Found", { status: 404 });
}
