import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const root = path.resolve(process.env.PREVIEW_ROOT || "dist/client");
const buildRoot = path.resolve("dist");
const staticRoots = root === buildRoot ? [root] : [root, buildRoot];
const host = process.env.PREVIEW_HOST || "127.0.0.1";
const port = Number(process.env.PREVIEW_PORT || 4329);
const store = JSON.parse(readFileSync(path.resolve("data/store.json"), "utf8"));
const legacyRedirects = new Map([
	["/activity/", "/moments/"],
	["/activity/admin/", "/moments/admin/"],
	["/activity/view/", "/moments/"],
	["/notebook/", "/life/notebooks/"],
	["/notebook/admin/", "/life/notebooks/admin/"],
	["/gallery/", "/album/"],
	["/list/", "/posts/"],
]);

const contentTypes = new Map([
	[".avif", "image/avif"],
	[".css", "text/css; charset=utf-8"],
	[".gif", "image/gif"],
	[".html", "text/html; charset=utf-8"],
	[".ico", "image/x-icon"],
	[".jpeg", "image/jpeg"],
	[".jpg", "image/jpeg"],
	[".js", "text/javascript; charset=utf-8"],
	[".json", "application/json; charset=utf-8"],
	[".mjs", "text/javascript; charset=utf-8"],
	[".mp3", "audio/mpeg"],
	[".mp4", "video/mp4"],
	[".png", "image/png"],
	[".svg", "image/svg+xml; charset=utf-8"],
	[".webm", "video/webm"],
	[".webp", "image/webp"],
	[".xml", "application/xml; charset=utf-8"],
]);

function resolveRequest(url) {
	const pathname = decodeURIComponent(new URL(url, `http://${host}`).pathname);
	const relative = pathname.replace(/^\/+/, "");
	const candidates = [relative, path.join(relative, "index.html")];
	if (!relative) candidates.unshift("index.html");

	for (const staticRoot of staticRoots) {
		for (const candidate of candidates) {
			const file = path.resolve(staticRoot, candidate);
			if (!file.startsWith(`${staticRoot}${path.sep}`) && file !== staticRoot) {
				continue;
			}
			if (existsSync(file) && statSync(file).isFile()) return file;
		}
	}
	return null;
}

function readStoreList(key, itemPrefix) {
	const ids = JSON.parse(store[key] || "[]");
	return ids
		.map((id) => {
			const value = store[`${itemPrefix}${id}`];
			return value ? JSON.parse(value) : null;
		})
		.filter(Boolean);
}

function escapeHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

function normalizePreviewActivity(entry) {
	const body = String(entry.body || entry.content || "").trim();
	const images = Array.isArray(entry.images) ? entry.images : [];
	return {
		...entry,
		origin: "user",
		title: entry.title || body.slice(0, 26),
		excerpt: entry.excerpt || body.slice(0, 120),
		body,
		html: body
			.split(/\n{2,}/)
			.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
			.join(""),
		overview: {
			readingMinutes: 1,
			sectionCount: 1,
			imageCount: images.length,
			updatedLabel: new Date(entry.updatedAt).toISOString(),
		},
		coverImage: images[0]?.url || entry.image || "",
		images,
		author: entry.author || "",
		avatar: entry.avatar || "",
		tags: Array.isArray(entry.tags) ? entry.tags : [],
		location: entry.location || "",
		device: entry.device || "",
	};
}

function previewPublishedContent(url) {
	const kind = url.searchParams.get("kind");
	const limit = Math.max(
		1,
		Math.min(50, Number(url.searchParams.get("limit")) || 20),
	);
	const items = readStoreList("content:published:list", "content:published:")
		.filter((entry) => entry.draft === false && (!kind || entry.kind === kind))
		.toSorted(
			(left, right) =>
				Date.parse(right.published || "") - Date.parse(left.published || "") ||
				Number(right.updatedAt || 0) - Number(left.updatedAt || 0),
		)
		.map((entry) => ({
			kind: entry.kind,
			title: entry.title,
			slug: entry.slug,
			description: entry.description || "",
			category: entry.category || "",
			notebook: entry.notebook || "",
			tags: Array.isArray(entry.tags) ? entry.tags : [],
			published: entry.published || "",
			cover: entry.cover || "",
			images: Array.isArray(entry.images) ? entry.images : [],
			location: entry.location || "",
			device: entry.device || "",
			author: entry.author || "",
			updatedAt: Number(entry.updatedAt || 0),
			url:
				entry.url ||
				`/content/view/?kind=${encodeURIComponent(entry.kind)}&slug=${encodeURIComponent(entry.slug)}`,
		}));

	return { items: items.slice(0, limit), total: items.length };
}

function previewApiResponse(url, method) {
	const pathname = url.pathname.replace(/\/$/, "");
	if (pathname === "/api/site-config" && method === "GET") {
		const config = store["site-config:public:v1"];
		return {
			status: 200,
			body: { config: config ? JSON.parse(config) : null },
		};
	}
	if (pathname === "/api/admin/session" && method === "GET") {
		return { status: 200, body: { authenticated: false } };
	}
	if (pathname === "/api/friend-feed" && method === "GET") {
		return {
			status: 200,
			body: JSON.parse(
				store["friend-feed:cache:v1"] ||
					'{"entries":[],"sources":[],"failures":[],"updatedAt":"1970-01-01T00:00:00.000Z"}',
			),
		};
	}
	if (pathname === "/api/content/published" && method === "GET") {
		return { status: 200, body: previewPublishedContent(url) };
	}
	if (pathname === "/api/activity/admin-check") {
		return { status: 503, body: { error: "Admin token is not configured" } };
	}
	if (pathname === "/api/activity") {
		if (method !== "GET") {
			return { status: 503, body: { error: "Admin token is not configured" } };
		}
		const items = readStoreList("activity:list", "activity:item:")
			.map(normalizePreviewActivity)
			.toSorted((left, right) => right.createdAt - left.createdAt);
		return { status: 200, body: { items, total: items.length } };
	}
	if (pathname === "/api/notebook/admin-check") {
		return { status: 503, body: { error: "Admin token is not configured" } };
	}
	if (url.pathname === "/api/notebook/") {
		if (method !== "GET") {
			return { status: 503, body: { error: "Admin token is not configured" } };
		}
		const notebook = url.searchParams.get("notebook");
		const entries = readStoreList("notebook:list", "notebook:entry:")
			.filter((entry) => !notebook || entry.notebook === notebook)
			.toSorted((left, right) => right.createdAt - left.createdAt);
		return { status: 200, body: { entries, total: entries.length } };
	}
	if (pathname === "/api/guestbook" && method === "GET") {
		const messages = readStoreList("guestbook:list", "guestbook:msg:").toSorted(
			(left, right) => right.createdAt - left.createdAt,
		);
		const offset = Number(url.searchParams.get("offset") || 0);
		const limit = Number(url.searchParams.get("limit") || 20);
		return {
			status: 200,
			body: {
				messages: messages.slice(offset, offset + limit),
				total: messages.length,
			},
		};
	}
	return null;
}

const server = createServer((request, response) => {
	if (!request.url) return response.writeHead(400).end();

	const url = new URL(request.url, `http://${host}`);
	const method = request.method || "GET";
	const isLegacyGalleryPage =
		url.pathname.startsWith("/gallery/") &&
		!/[.][a-z0-9]+$/i.test(url.pathname);
	const legacyRedirect =
		legacyRedirects.get(url.pathname) ||
		(isLegacyGalleryPage ? "/album/" : null);
	if (legacyRedirect) {
		response.writeHead(301, { Location: legacyRedirect }).end();
		return;
	}
	const apiResponse = previewApiResponse(url, method);
	if (apiResponse) {
		response.writeHead(apiResponse.status, {
			"Cache-Control": "no-store",
			"Content-Type": "application/json; charset=utf-8",
		});
		response.end(JSON.stringify(apiResponse.body));
		return;
	}
	if (!["GET", "HEAD"].includes(method)) return response.writeHead(405).end();

	const file = resolveRequest(request.url);
	if (!file) {
		response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
		response.end("Not found");
		return;
	}

	response.writeHead(200, {
		"Cache-Control": "no-store",
		"Content-Type":
			contentTypes.get(path.extname(file).toLowerCase()) ||
			"application/octet-stream",
	});
	if (request.method === "HEAD") response.end();
	else createReadStream(file).pipe(response);
});

server.listen(port, host, () => {
	console.log(`Static preview: http://${host}:${port}`);
});
