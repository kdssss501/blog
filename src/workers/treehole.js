import {
	checkRateLimit,
	VOTE_RATE_LIMIT_MAX,
	VOTE_RATE_LIMIT_WINDOW,
} from "./utils/rate-limit.js";

/**
 * 树洞 Worker 后端
 *
 * 路由设计（挂在 /api/treehole 下）：
 *   GET    /                          公开列表（仅 approved）
 *   POST   /                          创建树洞（匿名，status=pending）
 *   GET    /{id}                      单条详情（仅 approved 可见）
 *   POST   /{id}/resonance            点赞共鸣（按 IP 防重复）
 *   POST   /{id}/reply                匿名回复（status=pending）
 *   GET    /admin/pending             待审核列表（需 token）
 *   POST   /admin/{id}/review         审核操作（需 token）
 *
 * 审核通过时自动从 pending 列表移除并加入 list；
 * 审核拒绝时从 pending 移除，消息标记 rejected 不公开展示。
 */

const TH_HEADERS = {
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
	"Content-Type": "application/json",
};

/** 树洞内容更宽松一些（倾诉性质），但仍过滤危险标签 */
const BLOCKED_KEYWORDS = [
	"javascript:",
	"vbscript:",
	"onclick",
	"onload",
	"onerror",
	"onmouseover",
	"onfocus",
	"onblur",
	"onkeydown",
	"onkeyup",
	"eval(",
	"document.cookie",
	"document.write",
	"location.href",
	"<script",
	"</script",
	"<iframe",
	"</iframe",
	"<object",
	"</object",
	"<embed",
	"</embed",
	"<applet",
	"<svg",
	"<form",
	"<input",
	"<button",
	"alert(",
	"confirm(",
	"prompt(",
];

/** 树洞内容长度：5~1000 字（倾诉需要更多空间） */
const CONTENT_MIN = 5;
const CONTENT_MAX = 1000;

function escapeHtml(str) {
	if (!str) return str;
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function validateContent(content) {
	if (!content) {
		return { valid: false, error: "content is required" };
	}
	if (content.length < CONTENT_MIN || content.length > CONTENT_MAX) {
		return {
			valid: false,
			error: `content must be ${CONTENT_MIN}-${CONTENT_MAX} characters`,
		};
	}
	const lower = content.toLowerCase();
	for (const keyword of BLOCKED_KEYWORDS) {
		if (lower.includes(keyword.toLowerCase())) {
			return { valid: false, error: "content contains prohibited content" };
		}
	}
	return { valid: true };
}

function getIp(request) {
	return (
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("X-Forwarded-For") ||
		"unknown"
	);
}

/** 校验管理员 token */
function isAdmin(request, env) {
	const token = env.TREEHOLE_ADMIN_TOKEN;
	if (!token) return false;
	const auth = request.headers.get("Authorization") || "";
	return auth === `Bearer ${token}`;
}

/** 生成递增 id */
async function nextId(env, prefix) {
	const counterRaw = await env.VISITOR_KV.get("treehole:counter");
	const counter = counterRaw ? Number(counterRaw) + 1 : 1;
	await env.VISITOR_KV.put("treehole:counter", String(counter));
	return `${prefix}_${String(counter).padStart(3, "0")}`;
}

// === 公开接口 ===

async function handleList(env, url) {
	const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
	const limit = Math.min(
		20,
		Math.max(1, Number(url.searchParams.get("limit")) || 10),
	);

	const listJson = await env.VISITOR_KV.get("treehole:list");
	const ids = listJson ? JSON.parse(listJson) : [];
	const pageIds = ids.slice(offset, offset + limit);

	const messages = await Promise.all(
		pageIds.map(async (id) => {
			const raw = await env.VISITOR_KV.get(`treehole:msg:${id}`);
			return raw ? JSON.parse(raw) : null;
		}),
	);

	// 过滤掉已删除/未审核的，并隐藏 pending 的回复
	const visible = messages
		.filter(Boolean)
		.filter((m) => m.status === "approved")
		.map((m) => ({
			...m,
			replies: (m.replies || []).filter((r) => r.status === "approved"),
		}));

	return Response.json(
		{ messages: visible, total: ids.length },
		{ headers: TH_HEADERS },
	);
}

async function handleGetMessage(env, id) {
	const raw = await env.VISITOR_KV.get(`treehole:msg:${id}`);
	if (!raw) {
		return Response.json(
			{ error: "Not found" },
			{ status: 404, headers: TH_HEADERS },
		);
	}
	const message = JSON.parse(raw);
	if (message.status !== "approved") {
		return Response.json(
			{ error: "Not found" },
			{ status: 404, headers: TH_HEADERS },
		);
	}
	// 隐藏未审核回复
	message.replies = (message.replies || []).filter(
		(r) => r.status === "approved",
	);
	return Response.json(message, { headers: TH_HEADERS });
}

async function handleCreate(env, request) {
	const ip = getIp(request);
	const rateLimit = await checkRateLimit(env, ip, "treehole");
	if (!rateLimit.allowed) {
		return Response.json(
			{ error: "Too many requests, please try again later" },
			{
				status: 429,
				headers: { ...TH_HEADERS, "Retry-After": String(rateLimit.retryAfter) },
			},
		);
	}

	const body = await request.json().catch(() => ({}));
	const rawContent = (body.content || "").trim().slice(0, CONTENT_MAX);

	const validation = validateContent(rawContent);
	if (!validation.valid) {
		return Response.json(
			{ error: validation.error },
			{ status: 400, headers: TH_HEADERS },
		);
	}

	const content = escapeHtml(rawContent);
	const id = await nextId(env, "th");
	const now = Date.now();
	const message = {
		id,
		content,
		createdAt: now,
		status: "pending",
		resonance: 0,
		replies: [],
	};

	await env.VISITOR_KV.put(`treehole:msg:${id}`, JSON.stringify(message));

	// 加入待审核列表
	const pendingRaw = await env.VISITOR_KV.get("treehole:pending");
	const pendingIds = pendingRaw ? JSON.parse(pendingRaw) : [];
	pendingIds.unshift(id);
	await env.VISITOR_KV.put("treehole:pending", JSON.stringify(pendingIds));

	return Response.json(
		{ ...message, hint: "Submitted for review" },
		{ status: 201, headers: TH_HEADERS },
	);
}

async function handleResonance(env, id, request) {
	const ip = getIp(request);
	const rateLimit = await checkRateLimit(
		env,
		ip,
		"treehole:resonance",
		VOTE_RATE_LIMIT_MAX,
		VOTE_RATE_LIMIT_WINDOW,
	);
	if (!rateLimit.allowed) {
		return Response.json(
			{ error: "Too many requests, please try again later" },
			{
				status: 429,
				headers: { ...TH_HEADERS, "Retry-After": String(rateLimit.retryAfter) },
			},
		);
	}

	const raw = await env.VISITOR_KV.get(`treehole:msg:${id}`);
	if (!raw) {
		return Response.json(
			{ error: "Not found" },
			{ status: 404, headers: TH_HEADERS },
		);
	}
	const message = JSON.parse(raw);
	if (message.status !== "approved") {
		return Response.json(
			{ error: "Not found" },
			{ status: 404, headers: TH_HEADERS },
		);
	}

	// 按 IP 防重复共鸣
	const resonatedRaw = await env.VISITOR_KV.get(`treehole:resonated:${ip}`);
	const resonated = resonatedRaw ? JSON.parse(resonatedRaw) : [];
	if (resonated.includes(id)) {
		return Response.json(
			{ error: "Already resonated", resonance: message.resonance },
			{ status: 409, headers: TH_HEADERS },
		);
	}
	resonated.push(id);
	// 只保留最近 100 条记录，避免无限增长
	const trimmed = resonated.slice(-100);
	await env.VISITOR_KV.put(`treehole:resonated:${ip}`, JSON.stringify(trimmed));

	message.resonance = (message.resonance || 0) + 1;
	await env.VISITOR_KV.put(`treehole:msg:${id}`, JSON.stringify(message));

	return Response.json(
		{ id, resonance: message.resonance },
		{ headers: TH_HEADERS },
	);
}

async function handleReply(env, id, request) {
	const ip = getIp(request);
	const rateLimit = await checkRateLimit(env, ip, "treehole:reply");
	if (!rateLimit.allowed) {
		return Response.json(
			{ error: "Too many requests, please try again later" },
			{
				status: 429,
				headers: { ...TH_HEADERS, "Retry-After": String(rateLimit.retryAfter) },
			},
		);
	}

	const raw = await env.VISITOR_KV.get(`treehole:msg:${id}`);
	if (!raw) {
		return Response.json(
			{ error: "Not found" },
			{ status: 404, headers: TH_HEADERS },
		);
	}
	const message = JSON.parse(raw);
	if (message.status !== "approved") {
		return Response.json(
			{ error: "Not found" },
			{ status: 404, headers: TH_HEADERS },
		);
	}

	const body = await request.json().catch(() => ({}));
	const rawContent = (body.content || "").trim().slice(0, CONTENT_MAX);
	const validation = validateContent(rawContent);
	if (!validation.valid) {
		return Response.json(
			{ error: validation.error },
			{ status: 400, headers: TH_HEADERS },
		);
	}

	const content = escapeHtml(rawContent);
	const replyId = `${id}_r${message.replies.length + 1}`;
	const reply = {
		id: replyId,
		content,
		createdAt: Date.now(),
		status: "pending",
		resonance: 0,
	};

	message.replies = message.replies || [];
	message.replies.push(reply);
	await env.VISITOR_KV.put(`treehole:msg:${id}`, JSON.stringify(message));

	return Response.json(
		{ ...reply, hint: "Submitted for review" },
		{ status: 201, headers: TH_HEADERS },
	);
}

// === 管理员接口 ===

async function handleAdminPending(env) {
	const pendingRaw = await env.VISITOR_KV.get("treehole:pending");
	const ids = pendingRaw ? JSON.parse(pendingRaw) : [];

	const messages = await Promise.all(
		ids.map(async (id) => {
			const raw = await env.VISITOR_KV.get(`treehole:msg:${id}`);
			return raw ? JSON.parse(raw) : null;
		}),
	);

	return Response.json(
		{ messages: messages.filter(Boolean), total: ids.length },
		{ headers: TH_HEADERS },
	);
}

async function handleAdminReview(env, id, request) {
	const body = await request.json().catch(() => ({}));
	const status = body.status;
	if (!["approved", "rejected"].includes(status)) {
		return Response.json(
			{ error: "Invalid status, must be 'approved' or 'rejected'" },
			{ status: 400, headers: TH_HEADERS },
		);
	}

	const raw = await env.VISITOR_KV.get(`treehole:msg:${id}`);
	if (!raw) {
		return Response.json(
			{ error: "Not found" },
			{ status: 404, headers: TH_HEADERS },
		);
	}
	const message = JSON.parse(raw);

	// 从 pending 列表移除
	const pendingRaw = await env.VISITOR_KV.get("treehole:pending");
	const pendingIds = pendingRaw ? JSON.parse(pendingRaw) : [];
	const filteredPending = pendingIds.filter((x) => x !== id);
	await env.VISITOR_KV.put(
		"treehole:pending",
		JSON.stringify(filteredPending),
	);

	if (status === "approved") {
		message.status = "approved";
		// 审核通过时，同时审核通过所有 pending 回复
		if (message.replies) {
			message.replies = message.replies.map((r) =>
				r.status === "pending" ? { ...r, status: "approved" } : r,
			);
		}
		// 加入公开列表（头部）
		const listRaw = await env.VISITOR_KV.get("treehole:list");
		const listIds = listRaw ? JSON.parse(listRaw) : [];
		if (!listIds.includes(id)) {
			listIds.unshift(id);
			await env.VISITOR_KV.put("treehole:list", JSON.stringify(listIds));
		}
	} else {
		message.status = "rejected";
	}

	await env.VISITOR_KV.put(`treehole:msg:${id}`, JSON.stringify(message));

	return Response.json(
		{ id, status: message.status },
		{ headers: TH_HEADERS },
	);
}

/** 审核单条回复 */
async function handleAdminReviewReply(env, msgId, replyId, request) {
	const body = await request.json().catch(() => ({}));
	const status = body.status;
	if (!["approved", "rejected"].includes(status)) {
		return Response.json(
			{ error: "Invalid status" },
			{ status: 400, headers: TH_HEADERS },
		);
	}

	const raw = await env.VISITOR_KV.get(`treehole:msg:${msgId}`);
	if (!raw) {
		return Response.json(
			{ error: "Not found" },
			{ status: 404, headers: TH_HEADERS },
		);
	}
	const message = JSON.parse(raw);
	const reply = (message.replies || []).find((r) => r.id === replyId);
	if (!reply) {
		return Response.json(
			{ error: "Reply not found" },
			{ status: 404, headers: TH_HEADERS },
		);
	}
	reply.status = status;
	await env.VISITOR_KV.put(`treehole:msg:${msgId}`, JSON.stringify(message));

	return Response.json({ msgId, replyId, status }, { headers: TH_HEADERS });
}

// === 路由分发 ===

export async function handleTreehole(request, env, url) {
	if (request.method === "OPTIONS") {
		return new Response(null, { headers: TH_HEADERS });
	}

	const pathParts = url.pathname.split("/").filter(Boolean);
	// /api/treehole -> ["api", "treehole", ...]
	const segments = pathParts.slice(2);

	try {
		// 管理员路由：/admin/pending, /admin/{id}/review, /admin/{id}/{replyId}/review
		if (segments[0] === "admin") {
			if (!isAdmin(request, env)) {
				return Response.json(
					{ error: "Unauthorized" },
					{ status: 401, headers: TH_HEADERS },
				);
			}
			// GET /admin/pending
			if (
				segments.length === 2 &&
				segments[1] === "pending" &&
				request.method === "GET"
			) {
				return await handleAdminPending(env);
			}
			// POST /admin/{id}/review
			if (
				segments.length === 3 &&
				segments[2] === "review" &&
				request.method === "POST"
			) {
				return await handleAdminReview(env, segments[1], request);
			}
			// POST /admin/{msgId}/{replyId}/review
			if (
				segments.length === 4 &&
				segments[3] === "review" &&
				request.method === "POST"
			) {
				return await handleAdminReviewReply(
					env,
					segments[1],
					segments[2],
					request,
				);
			}
			return new Response("Not Found", { status: 404, headers: TH_HEADERS });
		}

		// 公开路由
		// POST /{id}/resonance
		if (
			segments.length === 2 &&
			segments[1] === "resonance" &&
			request.method === "POST"
		) {
			return await handleResonance(env, segments[0], request);
		}

		// POST /{id}/reply
		if (
			segments.length === 2 &&
			segments[1] === "reply" &&
			request.method === "POST"
		) {
			return await handleReply(env, segments[0], request);
		}

		// GET /{id}
		if (segments.length === 1 && request.method === "GET") {
			return await handleGetMessage(env, segments[0]);
		}

		// POST /
		if (segments.length === 0 && request.method === "POST") {
			return await handleCreate(env, request);
		}

		// GET /
		if (segments.length === 0 && request.method === "GET") {
			return await handleList(env, url);
		}

		return new Response("Not Found", { status: 404, headers: TH_HEADERS });
	} catch (err) {
		return Response.json(
			{ error: err.message },
			{ status: 500, headers: TH_HEADERS },
		);
	}
}
