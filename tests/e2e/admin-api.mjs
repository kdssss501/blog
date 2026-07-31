import assert from "node:assert/strict";

const baseUrl = (process.env.TEST_BASE_URL || "http://127.0.0.1:4321").replace(
	/\/$/,
	"",
);
const token = process.env.TEST_BLOG_ADMIN_TOKEN || "codex-test-admin-token";
const legacyTokens = {
	notebook:
		process.env.TEST_NOTEBOOK_ADMIN_TOKEN || "codex-test-notebook-token",
	activity:
		process.env.TEST_ACTIVITY_ADMIN_TOKEN || "codex-test-activity-token",
};

async function request(path, options = {}) {
	const response = await fetch(`${baseUrl}${path}`, options);
	const body = await response.json().catch(() => ({}));
	return { response, body };
}

const publicConfig = await request("/api/site-config/");
assert.equal(publicConfig.response.status, 200);
assert.ok(publicConfig.body.config?.title);

const wrongLogin = await request("/api/admin/session/", {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({ token: "wrong" }),
});
assert.equal(wrongLogin.response.status, 401);

const login = await request("/api/admin/session/", {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({ token }),
});
assert.equal(login.response.status, 200);
const setCookie = login.response.headers.get("set-cookie") || "";
assert.match(setCookie, /HttpOnly/);
assert.match(setCookie, /SameSite=Strict/);
const cookie = setCookie.split(";")[0];

const unauthorizedMigration = await request(
	"/api/admin/migrations/dumpling-theme/",
	{
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ mode: "preview" }),
	},
);
assert.equal(unauthorizedMigration.response.status, 401);

const migrationPreview = await request(
	"/api/admin/migrations/dumpling-theme/",
	{
		method: "POST",
		headers: { "Content-Type": "application/json", Cookie: cookie },
		body: JSON.stringify({ mode: "preview" }),
	},
);
assert.equal(migrationPreview.response.status, 200);
assert.equal(migrationPreview.body.id, "dumpling-theme-73b9759");
assert.equal(migrationPreview.body.importedActivities, 3);
assert.equal(migrationPreview.body.importedNotebooks, 1);

const imported = await request("/api/posts/import/", {
	method: "POST",
	headers: { "Content-Type": "application/json", Cookie: cookie },
	body: JSON.stringify({
		source:
			'---\ntitle: "导入文章"\nslug: imported-post\ndescription: "导入验证"\ncategory: tests\ntags: [Astro]\npublished: 2026-07-23\ndraft: true\n---\n\n# 导入正文',
	}),
});
assert.equal(imported.response.status, 200);
assert.equal(imported.body.document.title, "导入文章");
assert.equal(imported.body.document.body.trim(), "# 导入正文");
assert.deepEqual(imported.body.issues, []);

for (const [resource, legacyToken] of Object.entries(legacyTokens)) {
	const legacyAccess = await request(`/api/${resource}/admin-check/`, {
		headers: { Authorization: `Bearer ${legacyToken}` },
	});
	assert.equal(legacyAccess.response.status, 200);
}

const refreshedFeed = await request("/api/friend-feed/", {
	method: "POST",
	headers: { Cookie: cookie },
});
assert.equal(refreshedFeed.response.status, 200);
assert.ok(Array.isArray(refreshedFeed.body.entries));

const document = {
	title: "API 回归文章",
	slug: "api-regression-post",
	description: "用于验证管理 API。",
	category: "tests",
	tags: ["Astro"],
	published: "2026-07-23",
	draft: true,
	body: "# 正文\n\n<script>alert(1)</script>\n\n内容。",
};

const unauthorized = await request("/api/posts/preview/", {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify(document),
});
assert.equal(unauthorized.response.status, 401);

const preview = await request("/api/posts/preview/", {
	method: "POST",
	headers: { "Content-Type": "application/json", Cookie: cookie },
	body: JSON.stringify(document),
});
assert.equal(preview.response.status, 200);
assert.equal(preview.body.valid, true);
assert.doesNotMatch(preview.body.html, /<script/i);

const draft = await request("/api/posts/drafts/", {
	method: "POST",
	headers: { "Content-Type": "application/json", Cookie: cookie },
	body: JSON.stringify(document),
});
assert.equal(draft.response.status, 201);
assert.match(draft.body.draft.id, /^draft_/);
const draftId = draft.body.draft.id;

try {
	const drafts = await request("/api/posts/drafts/", {
		headers: { Cookie: cookie },
	});
	assert.equal(drafts.response.status, 200);
	assert.ok(drafts.body.drafts.some((item) => item.id === draftId));

	const publish = await request("/api/posts/publish/", {
		method: "POST",
		headers: { "Content-Type": "application/json", Cookie: cookie },
		body: JSON.stringify(document),
	});
	assert.equal(publish.response.status, 503);

	const savedConfig = await request("/api/site-config/", {
		method: "PUT",
		headers: { "Content-Type": "application/json", Cookie: cookie },
		body: JSON.stringify({
			...publicConfig.body.config,
			title: "API 回归站点",
			BLOG_ADMIN_TOKEN: "must-not-leak",
		}),
	});
	assert.equal(savedConfig.response.status, 200);
	assert.equal(savedConfig.body.config.title, "API 回归站点");
	assert.equal("BLOG_ADMIN_TOKEN" in savedConfig.body.config, false);
} finally {
	await request(`/api/posts/drafts/${encodeURIComponent(draftId)}/`, {
		method: "DELETE",
		headers: { Cookie: cookie },
	});
	await request("/api/site-config/", {
		method: "DELETE",
		headers: { Cookie: cookie },
	});
}

console.log("Admin API checks passed.");
