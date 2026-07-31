import {
	type ActivityImage,
	type ActivityRecord,
	createActivitySlug,
	getDefaultActivities,
	normalizeActivity,
	shouldResetActivities,
} from "@/features/activity";
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

async function requireActivityAdmin(
	request: Request,
	env: StorageEnvironment,
): Promise<Response | null> {
	const access = await getUnifiedAdminAccess(
		request,
		env.BLOG_ADMIN_TOKEN,
		env.ACTIVITY_ADMIN_TOKEN,
		"Activity",
	);
	return access.granted
		? null
		: jsonResponse({ error: access.error }, access.status);
}

async function getActivity(
	storage: StorageAdapter,
	slug: string,
): Promise<ActivityRecord | null> {
	return storageGetJSON<ActivityRecord>(storage, `activity:item:${slug}`);
}

async function setActivity(
	storage: StorageAdapter,
	activity: ActivityRecord,
): Promise<void> {
	await storageSetJSON(storage, `activity:item:${activity.slug}`, activity);
}

async function getActivities(
	storage: StorageAdapter,
): Promise<ActivityRecord[]> {
	const ids = await storageGetList(storage, "activity:list");
	return (
		await Promise.all(ids.map((slug) => getActivity(storage, slug)))
	).filter((activity): activity is ActivityRecord => activity !== null);
}

async function resetActivities(
	storage: StorageAdapter,
): Promise<ActivityRecord[]> {
	const defaults = getDefaultActivities();
	for (const slug of await storageGetList(storage, "activity:list")) {
		await storage.delete(`activity:item:${slug}`);
	}
	for (const activity of defaults) await setActivity(storage, activity);
	await storageSetList(
		storage,
		"activity:list",
		defaults.map((activity) => activity.slug),
	);
	return defaults;
}

function parseImages(value: unknown): ActivityImage[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((item) => {
		if (!item || typeof item !== "object") return [];
		const image = item as Record<string, unknown>;
		if (typeof image.url !== "string" || !image.url) return [];
		const source =
			image.source === "gpt" ||
			image.source === "manual" ||
			image.source === "legacy"
				? image.source
				: undefined;
		return [
			{
				url: image.url,
				...(typeof image.alt === "string" ? { alt: image.alt } : {}),
				...(typeof image.prompt === "string" ? { prompt: image.prompt } : {}),
				...(source ? { source } : {}),
			},
		];
	});
}

async function getCurrentActivities(
	storage: StorageAdapter,
): Promise<ActivityRecord[]> {
	const activities = await getActivities(storage);
	return shouldResetActivities(activities)
		? resetActivities(storage)
		: activities;
}

async function handleGet(storage: StorageAdapter, url: URL): Promise<Response> {
	const activities = await getCurrentActivities(storage);
	const slug = url.searchParams.get("slug");
	if (slug) {
		const activity =
			activities.find((item) => item.slug === slug) ||
			(await getActivity(storage, slug));
		return activity
			? jsonResponse(normalizeActivity(activity))
			: jsonResponse({ error: "Activity not found" }, 404);
	}
	activities.sort((left, right) => right.createdAt - left.createdAt);
	return jsonResponse({
		items: activities.map((activity) => normalizeActivity(activity)),
		total: activities.length,
	});
}

async function handleCreate(
	storage: StorageAdapter,
	request: Request,
): Promise<Response> {
	const body = await readJsonObject(request);
	const title = escapeHtml(readString(body, "title").trim());
	const content = readString(body, "content").trim();
	if (!title || !content) {
		return jsonResponse({ error: "Title and content are required" }, 400);
	}
	const baseSlug = createActivitySlug(readString(body, "slug", title));
	let slug = baseSlug;
	let suffix = 1;
	while (await getActivity(storage, slug)) {
		slug = `${baseSlug}-${suffix}`;
		suffix += 1;
	}
	const now = Date.now();
	const activity: ActivityRecord = {
		id: now.toString(),
		slug,
		title,
		excerpt: escapeHtml(readString(body, "excerpt").trim()),
		content,
		body: content,
		images: parseImages(body.images),
		author: escapeHtml(readString(body, "author").trim()),
		avatar: readString(body, "avatar").trim(),
		tags: Array.isArray(body.tags)
			? body.tags
					.filter((tag): tag is string => typeof tag === "string")
					.map((tag) => escapeHtml(tag.trim()))
					.filter(Boolean)
			: [],
		location: escapeHtml(readString(body, "location").trim()),
		device: escapeHtml(readString(body, "device").trim()),
		createdAt: now,
		updatedAt: now,
	};
	await setActivity(storage, activity);
	const ids = await storageGetList(storage, "activity:list");
	ids.unshift(slug);
	await storageSetList(storage, "activity:list", ids);
	return jsonResponse(normalizeActivity(activity), 201);
}

async function handleUpdate(
	storage: StorageAdapter,
	request: Request,
	url: URL,
): Promise<Response> {
	const slug = url.searchParams.get("slug");
	if (!slug) return jsonResponse({ error: "Slug is required" }, 400);
	const activity = await getActivity(storage, slug);
	if (!activity) return jsonResponse({ error: "Activity not found" }, 404);
	const body = await readJsonObject(request);
	const title = escapeHtml(
		readString(body, "title", activity.title || "").trim(),
	);
	const content = readString(
		body,
		"content",
		activity.body || activity.content || "",
	).trim();
	if (!title || !content) {
		return jsonResponse({ error: "Title and content are required" }, 400);
	}
	activity.title = title;
	activity.excerpt = escapeHtml(
		readString(body, "excerpt", activity.excerpt || "").trim(),
	);
	activity.content = content;
	activity.body = content;
	if (Array.isArray(body.images)) activity.images = parseImages(body.images);
	if (typeof body.author === "string") {
		activity.author = escapeHtml(body.author.trim());
	}
	if (typeof body.avatar === "string") activity.avatar = body.avatar.trim();
	if (Array.isArray(body.tags)) {
		activity.tags = body.tags
			.filter((tag): tag is string => typeof tag === "string")
			.map((tag) => escapeHtml(tag.trim()))
			.filter(Boolean);
	}
	if (typeof body.location === "string") {
		activity.location = escapeHtml(body.location.trim());
	}
	if (typeof body.device === "string") {
		activity.device = escapeHtml(body.device.trim());
	}
	activity.updatedAt = Date.now();
	await setActivity(storage, activity);
	return jsonResponse(normalizeActivity(activity));
}

async function handleDelete(
	storage: StorageAdapter,
	url: URL,
): Promise<Response> {
	const slug = url.searchParams.get("slug");
	if (!slug) return jsonResponse({ error: "Slug is required" }, 400);
	if (!(await getActivity(storage, slug))) {
		return jsonResponse({ error: "Activity not found" }, 404);
	}
	await storage.delete(`activity:item:${slug}`);
	const ids = (await storageGetList(storage, "activity:list")).filter(
		(existingSlug) => existingSlug !== slug,
	);
	await storageSetList(storage, "activity:list", ids);
	return jsonResponse({ success: true });
}

export async function handleActivityRequest(
	storage: StorageAdapter,
	request: Request,
	url: URL,
	env: StorageEnvironment,
): Promise<Response> {
	const segments = url.pathname.split("/").filter(Boolean).slice(2);
	if (segments.join("/") === "admin-check" && request.method === "GET") {
		const denied = await requireActivityAdmin(request, env);
		return denied ?? jsonResponse({ authenticated: true });
	}
	if (segments.length !== 0) return new Response("Not Found", { status: 404 });
	if (request.method === "GET") return handleGet(storage, url);
	if (isAdminWriteMethod(request.method)) {
		const denied = await requireActivityAdmin(request, env);
		if (denied) return denied;
	}
	if (request.method === "POST") return handleCreate(storage, request);
	if (request.method === "PUT") return handleUpdate(storage, request, url);
	if (request.method === "DELETE") return handleDelete(storage, url);
	return new Response("Not Found", { status: 404 });
}
