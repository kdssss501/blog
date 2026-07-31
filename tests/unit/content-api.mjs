import assert from "node:assert/strict";
import { handleContentRequest } from "../../src/server/api/routes/content.ts";

class MemoryStorage {
	values = new Map();
	async get(key) {
		return this.values.get(key) ?? null;
	}
	async set(key, value) {
		this.values.set(key, value);
	}
	async delete(key) {
		this.values.delete(key);
	}
	async list(prefix) {
		return [...this.values]
			.filter(([key]) => key.startsWith(prefix))
			.map(([key, value]) => ({ key, value }));
	}
}

const storage = new MemoryStorage();
const env = { BLOG_ADMIN_TOKEN: "content-test-token" };
const authHeaders = {
	Authorization: "Bearer content-test-token",
	"Content-Type": "application/json",
};

function call(path, options = {}, authenticated = false) {
	const headers = new Headers(options.headers);
	if (authenticated) {
		for (const [key, value] of Object.entries(authHeaders))
			headers.set(key, value);
	}
	const request = new Request(`https://example.test${path}`, {
		...options,
		headers,
	});
	return handleContentRequest(storage, request, new URL(request.url), env);
}

const document = {
	id: "list",
	kind: "moment",
	title: "统一内容 API",
	slug: "unified-content-api",
	published: "2026-07-24",
	tags: ["测试"],
	body: `# 安全正文

一条 Markdown 动态。

<script>alert("xss")</script>

<img src="/uploads/content/example.webp" onerror="alert(1)">

[危险链接](javascript:alert(1))`,
};

const emptyPublicList = await call(
	"/api/content/published/?kind=moment&limit=6",
);
assert.equal(emptyPublicList.status, 200);
assert.deepEqual((await emptyPublicList.json()).items, []);

const unauthorizedDrafts = await call("/api/content/drafts/");
assert.equal(unauthorizedDrafts.status, 401);

const created = await call(
	"/api/content/drafts/",
	{ method: "POST", body: JSON.stringify(document) },
	true,
);
assert.equal(created.status, 201);
const draft = (await created.json()).draft;
assert.equal(draft.kind, "moment");
assert.match(draft.id, /^moment_\d{10,16}_[a-f0-9]{8}$/);
assert.notEqual(draft.id, "list");
assert.deepEqual(JSON.parse(storage.values.get("content:draft:list")), [
	draft.id,
]);

const encodedDraftId = draft.id.replace("_", "%5F");
const updated = await call(
	`/api/content/drafts/${encodedDraftId}/`,
	{
		method: "PUT",
		body: JSON.stringify({ ...document, title: "更新后的标题" }),
	},
	true,
);
assert.equal(updated.status, 200);
assert.equal((await updated.json()).draft.id, draft.id);

const reservedDraftId = await call(
	"/api/content/drafts/list/",
	{ method: "PUT", body: JSON.stringify(document) },
	true,
);
assert.equal(reservedDraftId.status, 400);

const preview = await call(
	"/api/content/preview/",
	{ method: "POST", body: JSON.stringify(document) },
	true,
);
assert.equal(preview.status, 200);
const previewBody = await preview.json();
assert.equal(previewBody.valid, true);
assert.doesNotMatch(previewBody.html, /<script|onerror|javascript:/i);

const stillPrivate = await call("/api/content/published/?kind=moment");
assert.equal((await stillPrivate.json()).total, 0);

const published = await call(
	"/api/content/publish/",
	{ method: "POST", body: JSON.stringify(document) },
	true,
);
assert.equal(published.status, 201);
const publishedBody = await published.json();
assert.equal(
	publishedBody.url,
	"/content/view/?kind=moment&slug=unified-content-api",
);

const publicList = await call("/api/content/published/?kind=moment&limit=6");
assert.equal(publicList.status, 200);
const publicListBody = await publicList.json();
assert.equal(publicListBody.total, 1);
assert.equal(publicListBody.items[0].title, document.title);
for (const privateField of ["body", "source", "html", "draft", "id"]) {
	assert.equal(privateField in publicListBody.items[0], false);
}

const unsupportedQuery = await call(
	"/api/content/published/?kind=moment&cache-bust=random",
);
assert.equal(unsupportedQuery.status, 400);

const publicDetail = await call(
	"/api/content/published/moment/unified-content-api/",
);
assert.equal(publicDetail.status, 200);
const publicContent = (await publicDetail.json()).content;
assert.match(publicContent.html, /安全正文/);
assert.doesNotMatch(publicContent.html, /<script|onerror|javascript:/i);
for (const privateField of ["body", "source", "draft", "id"]) {
	assert.equal(privateField in publicContent, false);
}

const unauthorizedDelete = await call(
	"/api/content/published/moment/unified-content-api/",
	{ method: "DELETE" },
);
assert.equal(unauthorizedDelete.status, 401);

const unpublished = await call(
	"/api/content/published/moment/unified-content-api/",
	{ method: "DELETE" },
	true,
);
assert.equal(unpublished.status, 200);

const removedDetail = await call(
	"/api/content/published/moment/unified-content-api/",
);
assert.equal(removedDetail.status, 404);

storage.values.set("invalid:list", JSON.stringify({ poisoned: true }));
const { storageGetList } = await import("../../src/server/storage/index.ts");
assert.deepEqual(await storageGetList(storage, "invalid:list"), []);

console.log("Content API checks passed.");
