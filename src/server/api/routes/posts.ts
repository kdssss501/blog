import matter from "gray-matter";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import {
	normalizePostDocument,
	type PostDocumentInput,
	type PostDraft,
	validatePostDocument,
} from "@/features/writing";
import {
	type StorageAdapter,
	type StorageEnvironment,
	storageGetJSON,
	storageGetList,
	storageSetJSON,
	storageSetList,
} from "../../storage";
import { getUnifiedAdminAccess } from "../admin-auth";
import { jsonResponse, readJsonObject } from "../http";

const DRAFT_INDEX_KEY = "post:draft:list";
const DRAFT_PREFIX = "post:draft:";

async function requireAdmin(
	request: Request,
	env: StorageEnvironment,
): Promise<Response | null> {
	const access = await getUnifiedAdminAccess(
		request,
		env.BLOG_ADMIN_TOKEN,
		undefined,
		"Blog",
	);
	return access.granted
		? null
		: jsonResponse({ error: access.error }, access.status);
}

function createDraftId(): string {
	return `draft_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

function serializePost(document: PostDocumentInput): string {
	return matter.stringify(document.body.trimEnd(), {
		title: document.title,
		published: document.published,
		description: document.description,
		tags: document.tags,
		category: document.category,
		draft: document.draft,
	});
}

async function renderPreview(document: PostDocumentInput): Promise<string> {
	const rendered = await marked.parse(document.body, {
		async: true,
		gfm: true,
		breaks: false,
	});
	return sanitizeHtml(rendered, {
		allowedTags: sanitizeHtml.defaults.allowedTags.concat([
			"img",
			"h1",
			"h2",
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
	});
}

async function getDraft(
	storage: StorageAdapter,
	id: string,
): Promise<PostDraft | null> {
	return storageGetJSON<PostDraft>(storage, `${DRAFT_PREFIX}${id}`);
}

async function listDrafts(storage: StorageAdapter): Promise<PostDraft[]> {
	const ids = await storageGetList(storage, DRAFT_INDEX_KEY);
	const drafts = await Promise.all(ids.map((id) => getDraft(storage, id)));
	return drafts
		.filter((draft): draft is PostDraft => draft !== null)
		.sort((left, right) => right.updatedAt - left.updatedAt);
}

async function saveDraft(
	storage: StorageAdapter,
	value: Record<string, unknown>,
	existingId?: string,
): Promise<Response> {
	const document = normalizePostDocument(value);
	const id = existingId || document.id || createDraftId();
	const draft: PostDraft = { ...document, id, updatedAt: Date.now() };
	await storageSetJSON(storage, `${DRAFT_PREFIX}${id}`, draft);
	const ids = (await storageGetList(storage, DRAFT_INDEX_KEY)).filter(
		(item) => item !== id,
	);
	ids.unshift(id);
	await storageSetList(storage, DRAFT_INDEX_KEY, ids);
	return jsonResponse({ draft }, existingId ? 200 : 201);
}

function githubConfig(env: StorageEnvironment) {
	const token = String(env.GITHUB_CONTENT_TOKEN || "").trim();
	const repository = String(env.GITHUB_REPOSITORY || "").trim();
	const branch = String(env.GITHUB_BRANCH || "main").trim();
	return { token, repository, branch };
}

function encodeContent(content: string): string {
	const bytes = new TextEncoder().encode(content);
	let binary = "";
	for (let index = 0; index < bytes.length; index += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
	}
	return btoa(binary);
}

async function publishToGitHub(
	document: PostDocumentInput,
	env: StorageEnvironment,
): Promise<Response> {
	const config = githubConfig(env);
	if (!config.token || !config.repository) {
		return jsonResponse({ error: "GitHub publishing is not configured" }, 503);
	}
	if (!/^[\w.-]+\/[\w.-]+$/.test(config.repository)) {
		return jsonResponse({ error: "GITHUB_REPOSITORY is invalid" }, 503);
	}
	const path = `src/content/posts/${document.category}/${document.slug}.md`;
	const encodedPath = path.split("/").map(encodeURIComponent).join("/");
	const endpoint = `https://api.github.com/repos/${config.repository}/contents/${encodedPath}`;
	const headers = {
		Accept: "application/vnd.github+json",
		Authorization: `Bearer ${config.token}`,
		"Content-Type": "application/json",
		"X-GitHub-Api-Version": "2022-11-28",
	};

	try {
		let sha: string | undefined;
		const current = await fetch(
			`${endpoint}?ref=${encodeURIComponent(config.branch)}`,
			{ headers },
		);
		if (current.ok) {
			const value = (await current.json()) as { sha?: string };
			sha = value.sha;
		} else if (current.status !== 404) {
			return jsonResponse(
				{ error: `GitHub lookup failed (${current.status})` },
				502,
			);
		}

		const published = await fetch(endpoint, {
			method: "PUT",
			headers,
			body: JSON.stringify({
				message: `content: publish ${document.slug}`,
				content: encodeContent(serializePost({ ...document, draft: false })),
				branch: config.branch,
				...(sha ? { sha } : {}),
			}),
		});
		const result = (await published.json().catch(() => ({}))) as {
			message?: string;
			commit?: { html_url?: string };
		};
		if (!published.ok) {
			return jsonResponse(
				{
					error:
						result.message || `GitHub publish failed (${published.status})`,
				},
				502,
			);
		}
		return jsonResponse({
			success: true,
			path,
			commitUrl: result.commit?.html_url || "",
		});
	} catch (error) {
		return jsonResponse(
			{
				error:
					error instanceof Error
						? `GitHub publish failed: ${error.message}`
						: "GitHub publish failed",
			},
			502,
		);
	}
}

export async function handlePostsRequest(
	storage: StorageAdapter,
	request: Request,
	url: URL,
	env: StorageEnvironment,
): Promise<Response> {
	const denied = await requireAdmin(request, env);
	if (denied) return denied;
	const segments = url.pathname.split("/").filter(Boolean).slice(2);
	const action = segments[0] || "";
	if (action === "import" && request.method === "POST") {
		const body = await readJsonObject(request);
		const source = typeof body.source === "string" ? body.source : "";
		if (!source || source.length > 600_000) {
			return jsonResponse({ error: "Markdown source is required" }, 400);
		}
		const parsed = matter(source);
		const published = parsed.data.published;
		const document = normalizePostDocument({
			...parsed.data,
			published:
				published instanceof Date
					? published.toISOString().slice(0, 10)
					: published,
			body: parsed.content,
		});
		return jsonResponse({
			document,
			issues: validatePostDocument(document),
		});
	}

	if (action === "preview" && request.method === "POST") {
		const document = normalizePostDocument(await readJsonObject(request));
		const issues = validatePostDocument(document);
		return jsonResponse({
			valid: issues.length === 0,
			issues,
			document,
			source: serializePost(document),
			html: await renderPreview(document),
		});
	}

	if (action === "publish" && request.method === "POST") {
		const document = normalizePostDocument(await readJsonObject(request));
		const issues = validatePostDocument(document);
		if (issues.length > 0)
			return jsonResponse({ error: "Validation failed", issues }, 422);
		return publishToGitHub(document, env);
	}

	if (action !== "drafts") {
		return jsonResponse({ error: "Not Found" }, 404);
	}
	const id = segments[1];
	if (request.method === "GET" && !id) {
		return jsonResponse({ drafts: await listDrafts(storage) });
	}
	if (request.method === "GET" && id) {
		const draft = await getDraft(storage, id);
		return draft
			? jsonResponse({ draft })
			: jsonResponse({ error: "Draft not found" }, 404);
	}
	if (request.method === "POST" && !id) {
		return saveDraft(storage, await readJsonObject(request));
	}
	if (request.method === "PUT" && id) {
		if (!(await getDraft(storage, id))) {
			return jsonResponse({ error: "Draft not found" }, 404);
		}
		return saveDraft(storage, await readJsonObject(request), id);
	}
	if (request.method === "DELETE" && id) {
		await storage.delete(`${DRAFT_PREFIX}${id}`);
		await storageSetList(
			storage,
			DRAFT_INDEX_KEY,
			(await storageGetList(storage, DRAFT_INDEX_KEY)).filter(
				(item) => item !== id,
			),
		);
		return jsonResponse({ success: true, id });
	}
	return jsonResponse({ error: "Method Not Allowed" }, 405);
}
