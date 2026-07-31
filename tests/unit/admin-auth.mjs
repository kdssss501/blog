import assert from "node:assert/strict";
import {
	ADMIN_SESSION_COOKIE,
	ADMIN_SESSION_TTL_SECONDS,
	createAdminSession,
	createAdminSessionCookie,
	getAdminAccess,
	getUnifiedAdminAccess,
	isAdminWriteMethod,
	verifyAdminSession,
} from "../../src/server/api/admin-auth.ts";

assert.equal(isAdminWriteMethod("GET"), false);
assert.equal(isAdminWriteMethod("OPTIONS"), false);
assert.equal(isAdminWriteMethod("POST"), true);
assert.equal(isAdminWriteMethod("PUT"), true);
assert.equal(isAdminWriteMethod("DELETE"), true);

const publicRequest = new Request("https://example.com/api/notebook/");
assert.deepEqual(getAdminAccess(publicRequest, undefined, "Notebook"), {
	granted: false,
	status: 503,
	error: "Notebook administration is not configured",
});

const wrongTokenRequest = new Request("https://example.com/api/activity/", {
	headers: { Authorization: "Bearer wrong" },
});
assert.deepEqual(getAdminAccess(wrongTokenRequest, "secret", "Activity"), {
	granted: false,
	status: 401,
	error: "Unauthorized",
});

const authorizedRequest = new Request("https://example.com/api/activity/", {
	headers: { Authorization: "Bearer secret" },
});
assert.deepEqual(getAdminAccess(authorizedRequest, "secret", "Activity"), {
	granted: true,
});

const now = Date.now();
const session = await createAdminSession("blog-secret", now);
assert.equal(await verifyAdminSession(session, "blog-secret", now), true);
assert.equal(await verifyAdminSession(session, "wrong-secret", now), false);
assert.equal(
	await verifyAdminSession(
		session,
		"blog-secret",
		now + ADMIN_SESSION_TTL_SECONDS * 1000,
	),
	false,
);
assert.match(createAdminSessionCookie(session), /HttpOnly/);
assert.match(createAdminSessionCookie(session), /Secure/);
assert.match(createAdminSessionCookie(session), /SameSite=Strict/);

const sessionRequest = new Request("https://example.com/api/posts/preview", {
	headers: { Cookie: `${ADMIN_SESSION_COOKIE}=${session}` },
});
assert.deepEqual(
	await getUnifiedAdminAccess(sessionRequest, "blog-secret", undefined, "Blog"),
	{ granted: true },
);
assert.deepEqual(
	await getUnifiedAdminAccess(
		new Request("https://example.com/api/activity", {
			headers: { Authorization: "Bearer legacy-secret" },
		}),
		"blog-secret",
		"legacy-secret",
		"Activity",
	),
	{ granted: true },
);

console.log("admin auth tests passed");
