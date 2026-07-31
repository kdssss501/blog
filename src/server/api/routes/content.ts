import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import {
	type ContentDocumentInput,
	type ContentDraft,
	type ContentKind,
	getPublishedContentUrl,
	normalizeContentDocument,
	normalizePostSlug,
	type PublishedContentSummary,
	parseContentMarkdown,
	serializeContentDocument,
	validateContentDocument,
} from "@/features/writing/server";
import {
	type StorageAdapter,
	type StorageEnvironment,
	storageGetJSON,
	storageGetList,
	storageSetJSON,
	storageSetList,
	withStorageMutationLock,
} from "../../storage";
import {
	ContentAssetStorageUnavailableError,
	type LocalContentAssetWriter,
	storeContentImage,
} from "../../storage/assets";
import { getUnifiedAdminAccess } from "../admin-auth";
import { jsonResponse, readJsonObject } from "../http";

const DRAFT_INDEX = "content:draft:list";
const DRAFT_PREFIX = "content:draft:";
const PUBLISHED_INDEX = "content:published:list";
const PUBLISHED_PREFIX = "content:published:";
const PUBLISHED_SUMMARY_PREFIX = "content:published:summary:";
const CONTENT_KINDS: readonly ContentKind[] = ["post", "moment", "notebook"];
const DRAFT_ID_PATTERN = /^(?:post|moment|notebook)_\d{10,16}_[a-f0-9]{8}$/;
const PUBLIC_CACHE_HEADERS = {
	"Cache-Control": "public, max-age=30, stale-while-revalidate=120",
};

function isKind(value: string): value is ContentKind {
	return value === "post" || value === "moment" || value === "notebook";
}

function draftId(kind: ContentKind): string {
	return `${kind}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

async function requireAdmin(
	request: Request,
	env: StorageEnvironment,
): Promise<Response | null> {
	const access = await getUnifiedAdminAccess(
		request,
		env.BLOG_ADMIN_TOKEN,
		undefined,
		"Content",
	);
	return access.granted
		? null
		: jsonResponse({ error: access.error }, access.status);
}

async function renderPreview(document: ContentDocumentInput): Promise<string> {
	const rendered = await marked.parse(document.body, {
		async: true,
		gfm: true,
	});
	return sanitizeHtml(rendered, {
		allowedTags: sanitizeHtml.defaults.allowedTags.concat([
			"img",
			"figure",
			"figcaption",
		]),
		allowedAttributes: {
			...sanitizeHtml.defaults.allowedAttributes,
			a: ["href", "name", "target", "rel"],
			img: ["src", "alt", "title", "loading"],
			code: ["class"],
		},
		allowedSchemes: ["http", "https", "mailto"],
		allowProtocolRelative: false,
		enforceHtmlBoundary: true,
		transformTags: {
			a: (tagName, attribs) => ({
				tagName,
				attribs: {
					...attribs,
					...(attribs.target === "_blank"
						? { rel: "noopener noreferrer" }
						: {}),
				},
			}),
			img: (tagName, attribs) => ({
				tagName,
				attribs: { ...attribs, loading: "lazy" },
			}),
		},
	});
}

async function listDocuments(
	storage: StorageAdapter,
	index: string,
	prefix: string,
): Promise<ContentDraft[]> {
	const ids = await storageGetList(storage, index);
	const documents = await Promise.all(
		ids.map((id) => storageGetJSON<ContentDraft>(storage, `${prefix}${id}`)),
	);
	return documents
		.filter(isStoredContentDocument)
		.sort((a, b) => b.updatedAt - a.updatedAt);
}

function isStoredContentDocument(value: unknown): value is ContentDraft {
	if (!value || typeof value !== "object") return false;
	const document = value as Partial<ContentDraft>;
	return (
		typeof document.id === "string" &&
		typeof document.kind === "string" &&
		isKind(document.kind) &&
		typeof document.title === "string" &&
		typeof document.slug === "string" &&
		normalizePostSlug(document.slug) === document.slug &&
		typeof document.description === "string" &&
		typeof document.category === "string" &&
		typeof document.notebook === "string" &&
		Array.isArray(document.tags) &&
		document.tags.every((tag) => typeof tag === "string") &&
		typeof document.published === "string" &&
		typeof document.draft === "boolean" &&
		typeof document.cover === "string" &&
		Array.isArray(document.images) &&
		document.images.every((image) => typeof image === "string") &&
		typeof document.location === "string" &&
		typeof document.device === "string" &&
		typeof document.author === "string" &&
		typeof document.body === "string" &&
		typeof document.updatedAt === "number"
	);
}

function publicSummary(document: ContentDraft): PublishedContentSummary {
	return {
		kind: document.kind,
		title: document.title,
		slug: document.slug,
		description: document.description,
		category: document.category,
		notebook: document.notebook,
		tags: [...document.tags],
		published: document.published,
		cover: document.cover,
		images: [...document.images],
		location: document.location,
		device: document.device,
		author: document.author,
		updatedAt: document.updatedAt,
		url: getPublishedContentUrl(document.kind, document.slug),
	};
}

function isPublishedSummary(value: unknown): value is PublishedContentSummary {
	if (!value || typeof value !== "object") return false;
	const item = value as Partial<PublishedContentSummary>;
	return (
		typeof item.kind === "string" &&
		isKind(item.kind) &&
		typeof item.title === "string" &&
		typeof item.slug === "string" &&
		normalizePostSlug(item.slug) === item.slug &&
		typeof item.description === "string" &&
		typeof item.category === "string" &&
		typeof item.notebook === "string" &&
		Array.isArray(item.tags) &&
		item.tags.every((tag) => typeof tag === "string") &&
		typeof item.published === "string" &&
		typeof item.cover === "string" &&
		Array.isArray(item.images) &&
		item.images.every((image) => typeof image === "string") &&
		typeof item.location === "string" &&
		typeof item.device === "string" &&
		typeof item.author === "string" &&
		typeof item.updatedAt === "number" &&
		typeof item.url === "string" &&
		item.url === getPublishedContentUrl(item.kind, item.slug)
	);
}

async function readPublishedSummaryIndex(
	storage: StorageAdapter,
	kind: ContentKind,
): Promise<PublishedContentSummary[] | null> {
	const value = await storageGetJSON<unknown>(
		storage,
		`${PUBLISHED_SUMMARY_PREFIX}${kind}`,
	);
	return Array.isArray(value) && value.every(isPublishedSummary) ? value : null;
}

function sortPublishedSummaries(
	items: PublishedContentSummary[],
): PublishedContentSummary[] {
	return items.sort((a, b) => {
		const publishedDifference =
			Date.parse(b.published) - Date.parse(a.published);
		return Number.isFinite(publishedDifference) && publishedDifference !== 0
			? publishedDifference
			: b.updatedAt - a.updatedAt;
	});
}

async function loadPublishedSummaries(
	storage: StorageAdapter,
	kinds: readonly ContentKind[],
): Promise<PublishedContentSummary[]> {
	const indexed = await Promise.all(
		kinds.map((kind) => readPublishedSummaryIndex(storage, kind)),
	);
	if (indexed.every((items) => items !== null)) {
		return sortPublishedSummaries(indexed.flatMap((items) => items || []));
	}

	return withStorageMutationLock(PUBLISHED_INDEX, async () => {
		const refreshed = await Promise.all(
			kinds.map((kind) => readPublishedSummaryIndex(storage, kind)),
		);
		if (refreshed.every((items) => items !== null)) {
			return sortPublishedSummaries(refreshed.flatMap((items) => items || []));
		}

		const documents = await listDocuments(
			storage,
			PUBLISHED_INDEX,
			PUBLISHED_PREFIX,
		);
		const grouped = new Map<ContentKind, PublishedContentSummary[]>(
			CONTENT_KINDS.map((kind) => [kind, []]),
		);
		for (const document of documents) {
			if (document.draft === false) {
				grouped.get(document.kind)?.push(publicSummary(document));
			}
		}
		await Promise.all(
			CONTENT_KINDS.map((kind) =>
				storageSetJSON(
					storage,
					`${PUBLISHED_SUMMARY_PREFIX}${kind}`,
					sortPublishedSummaries(grouped.get(kind) || []),
				),
			),
		);
		return sortPublishedSummaries(
			kinds.flatMap((kind) => grouped.get(kind) || []),
		);
	});
}

function decodePathSegment(value: string | undefined): string | null {
	if (!value) return null;
	try {
		return decodeURIComponent(value);
	} catch {
		return null;
	}
}

async function getPublishedContent(
	storage: StorageAdapter,
	url: URL,
	segments: string[],
): Promise<Response> {
	const allowedQueryKeys = new Set(["kind", "limit"]);
	if ([...url.searchParams.keys()].some((key) => !allowedQueryKeys.has(key))) {
		return jsonResponse({ error: "Unsupported query parameter" }, 400);
	}
	const pathKind = decodePathSegment(segments[1]);
	const queryKind = url.searchParams.get("kind");
	if (pathKind && queryKind) {
		return jsonResponse({ error: "Content kind must be specified once" }, 400);
	}
	const requestedKind = pathKind || queryKind || "";
	if (requestedKind && !isKind(requestedKind)) {
		return jsonResponse({ error: "Invalid content kind" }, 400);
	}

	const rawSlug = segments[2];
	if (rawSlug) {
		if (url.searchParams.size > 0) {
			return jsonResponse({ error: "Detail queries are not supported" }, 400);
		}
		if (!pathKind || !isKind(pathKind) || segments.length !== 3) {
			return jsonResponse({ error: "Not Found" }, 404);
		}
		const decodedSlug = decodePathSegment(rawSlug);
		const slug = decodedSlug ? normalizePostSlug(decodedSlug) : "";
		if (!decodedSlug || !slug || slug !== decodedSlug) {
			return jsonResponse({ error: "Invalid content slug" }, 400);
		}
		const document = await storageGetJSON<ContentDraft>(
			storage,
			`${PUBLISHED_PREFIX}${pathKind}:${slug}`,
		);
		if (
			!isStoredContentDocument(document) ||
			document.draft !== false ||
			document.kind !== pathKind ||
			document.slug !== slug
		) {
			return jsonResponse({ error: "Published content not found" }, 404);
		}
		return jsonResponse(
			{
				content: {
					...publicSummary(document),
					html: await renderPreview(document),
				},
			},
			200,
			PUBLIC_CACHE_HEADERS,
		);
	}

	const rawLimit = url.searchParams.get("limit");
	const limitValue = rawLimit === null ? 12 : Number(rawLimit);
	if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 50) {
		return jsonResponse(
			{ error: "Limit must be an integer from 1 to 50" },
			400,
		);
	}
	const allDocuments = await loadPublishedSummaries(
		storage,
		requestedKind && isKind(requestedKind) ? [requestedKind] : CONTENT_KINDS,
	);
	return jsonResponse(
		{
			items: allDocuments.slice(0, limitValue),
			total: allDocuments.length,
		},
		200,
		PUBLIC_CACHE_HEADERS,
	);
}

async function saveDraft(
	storage: StorageAdapter,
	body: Record<string, unknown>,
	id?: string,
): Promise<Response> {
	const document = normalizeContentDocument({ ...body, draft: true });
	const key = id || draftId(document.kind);
	const saved: ContentDraft = {
		...document,
		id: key,
		draft: true,
		updatedAt: Date.now(),
	};
	await withStorageMutationLock(DRAFT_INDEX, async () => {
		await storageSetJSON(storage, `${DRAFT_PREFIX}${key}`, saved);
		const ids = (await storageGetList(storage, DRAFT_INDEX)).filter(
			(item) => item !== key,
		);
		ids.unshift(key);
		await storageSetList(storage, DRAFT_INDEX, ids);
	});
	return jsonResponse({ draft: saved }, id ? 200 : 201);
}

async function publish(
	storage: StorageAdapter,
	body: Record<string, unknown>,
): Promise<Response> {
	const document = normalizeContentDocument({ ...body, draft: false });
	const issues = validateContentDocument(document);
	if (issues.length)
		return jsonResponse({ error: "Validation failed", issues }, 422);
	const id = `${document.kind}:${document.slug}`;
	const published: ContentDraft = { ...document, id, updatedAt: Date.now() };
	await withStorageMutationLock(PUBLISHED_INDEX, async () => {
		await storageSetJSON(storage, `${PUBLISHED_PREFIX}${id}`, published);
		const ids = (await storageGetList(storage, PUBLISHED_INDEX)).filter(
			(item) => item !== id,
		);
		ids.unshift(id);
		await storageSetList(storage, PUBLISHED_INDEX, ids);
		const indexedSummaries = await readPublishedSummaryIndex(
			storage,
			document.kind,
		);
		const summaries =
			indexedSummaries ||
			(await listDocuments(storage, PUBLISHED_INDEX, PUBLISHED_PREFIX))
				.filter((item) => item.draft === false && item.kind === document.kind)
				.map(publicSummary);
		await storageSetJSON(
			storage,
			`${PUBLISHED_SUMMARY_PREFIX}${document.kind}`,
			sortPublishedSummaries([
				publicSummary(published),
				...summaries.filter((item) => item.slug !== document.slug),
			]),
		);
	});
	return jsonResponse(
		{
			published,
			source: serializeContentDocument(document),
			url: getPublishedContentUrl(document.kind, document.slug),
		},
		201,
	);
}

async function unpublish(
	storage: StorageAdapter,
	segments: string[],
): Promise<Response> {
	if (segments.length !== 3) return jsonResponse({ error: "Not Found" }, 404);
	const decodedKind = decodePathSegment(segments[1]);
	const decodedSlug = decodePathSegment(segments[2]);
	if (!decodedKind || !isKind(decodedKind)) {
		return jsonResponse({ error: "Invalid content kind" }, 400);
	}
	const slug = decodedSlug ? normalizePostSlug(decodedSlug) : "";
	if (!decodedSlug || !slug || slug !== decodedSlug) {
		return jsonResponse({ error: "Invalid content slug" }, 400);
	}
	const id = `${decodedKind}:${slug}`;
	const key = `${PUBLISHED_PREFIX}${id}`;
	const existing = await storageGetJSON<ContentDraft>(storage, key);
	if (!isStoredContentDocument(existing) || existing.draft !== false) {
		return jsonResponse({ error: "Published content not found" }, 404);
	}

	await withStorageMutationLock(PUBLISHED_INDEX, async () => {
		await storage.delete(key);
		await storageSetList(
			storage,
			PUBLISHED_INDEX,
			(await storageGetList(storage, PUBLISHED_INDEX)).filter(
				(item) => item !== id,
			),
		);
		const indexedSummaries = await readPublishedSummaryIndex(
			storage,
			decodedKind,
		);
		const summaries =
			indexedSummaries ||
			(await listDocuments(storage, PUBLISHED_INDEX, PUBLISHED_PREFIX))
				.filter((item) => item.draft === false && item.kind === decodedKind)
				.map(publicSummary);
		await storageSetJSON(
			storage,
			`${PUBLISHED_SUMMARY_PREFIX}${decodedKind}`,
			summaries.filter((item) => item.slug !== slug),
		);
	});
	return jsonResponse({ success: true, kind: decodedKind, slug });
}

export async function handleContentRequest(
	storage: StorageAdapter,
	request: Request,
	url: URL,
	env: StorageEnvironment,
	localAssetWriter?: LocalContentAssetWriter,
): Promise<Response> {
	const segments = url.pathname.split("/").filter(Boolean).slice(2);
	const action = segments[0] || "";
	if (action === "published" && request.method === "GET") {
		return getPublishedContent(storage, url, segments);
	}

	const denied = await requireAdmin(request, env);
	if (denied) return denied;
	if (action === "published" && request.method === "DELETE") {
		return unpublish(storage, segments);
	}
	if (action === "import" && request.method === "POST") {
		const body = await readJsonObject(request);
		const kind =
			typeof body.kind === "string" && isKind(body.kind) ? body.kind : "post";
		const source = typeof body.source === "string" ? body.source : "";
		if (!source || source.length > 600_000)
			return jsonResponse({ error: "Markdown source is required" }, 400);
		const document = parseContentMarkdown(source, kind);
		return jsonResponse({
			document,
			issues: validateContentDocument(document),
		});
	}
	if (action === "preview" && request.method === "POST") {
		const document = normalizeContentDocument(await readJsonObject(request));
		const issues = validateContentDocument(document);
		return jsonResponse({
			valid: issues.length === 0,
			issues,
			document,
			source: serializeContentDocument(document),
			html: await renderPreview(document),
		});
	}
	if (action === "publish" && request.method === "POST")
		return publish(storage, await readJsonObject(request));
	if (action === "assets" && request.method === "POST") {
		const form = await request.formData().catch(() => null);
		const file = form?.get("file");
		if (!(file instanceof File))
			return jsonResponse({ error: "file is required" }, 400);
		try {
			return jsonResponse(
				{ asset: await storeContentImage(file, env, localAssetWriter) },
				201,
			);
		} catch (error) {
			return jsonResponse(
				{
					error: error instanceof Error ? error.message : "Asset upload failed",
				},
				error instanceof ContentAssetStorageUnavailableError ? 503 : 400,
			);
		}
	}
	if (action !== "drafts") return jsonResponse({ error: "Not Found" }, 404);
	const encodedId = segments[1];
	const id = decodePathSegment(encodedId);
	if (encodedId && (!id || !DRAFT_ID_PATTERN.test(id))) {
		return jsonResponse({ error: "Invalid draft id" }, 400);
	}
	if (request.method === "GET" && !id) {
		const kind = url.searchParams.get("kind");
		const drafts = await listDocuments(storage, DRAFT_INDEX, DRAFT_PREFIX);
		return jsonResponse({
			drafts: isKind(kind || "")
				? drafts.filter((draft) => draft.kind === kind)
				: drafts,
		});
	}
	if (request.method === "GET" && id) {
		const draft = await storageGetJSON<ContentDraft>(
			storage,
			`${DRAFT_PREFIX}${id}`,
		);
		return draft
			? jsonResponse({ draft })
			: jsonResponse({ error: "Draft not found" }, 404);
	}
	if (request.method === "POST" && !id)
		return saveDraft(storage, await readJsonObject(request));
	if (request.method === "PUT" && id) {
		if (!(await storageGetJSON<ContentDraft>(storage, `${DRAFT_PREFIX}${id}`)))
			return jsonResponse({ error: "Draft not found" }, 404);
		return saveDraft(storage, await readJsonObject(request), id);
	}
	if (request.method === "DELETE" && id) {
		await withStorageMutationLock(DRAFT_INDEX, async () => {
			await storage.delete(`${DRAFT_PREFIX}${id}`);
			await storageSetList(
				storage,
				DRAFT_INDEX,
				(await storageGetList(storage, DRAFT_INDEX)).filter(
					(item) => item !== id,
				),
			);
		});
		return jsonResponse({ success: true, id });
	}
	return jsonResponse({ error: "Method Not Allowed" }, 405);
}
