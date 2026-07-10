import {
	checkRateLimit,
	VOTE_RATE_LIMIT_MAX,
	VOTE_RATE_LIMIT_WINDOW,
} from "./utils/rate-limit.js";

const GB_HEADERS = {
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
	"Content-Type": "application/json",
};

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

function escapeHtml(str) {
	if (!str) return str;
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function validateInput(author, content) {
	if (!author || !content) {
		return { valid: false, error: "author and content are required" };
	}

	if (author.length < 2 || author.length > 30) {
		return { valid: false, error: "author must be 2-30 characters" };
	}

	if (content.length < 5 || content.length > 500) {
		return { valid: false, error: "content must be 5-500 characters" };
	}

	const fullText = (author + content).toLowerCase();
	for (const keyword of BLOCKED_KEYWORDS) {
		if (fullText.includes(keyword.toLowerCase())) {
			return { valid: false, error: "content contains prohibited content" };
		}
	}

	if (content.length > 0 && content.length < 5) {
		return { valid: false, error: "content is too short" };
	}

	return { valid: true };
}

async function handleListMessages(env, url) {
	const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
	const limit = Math.min(
		20,
		Math.max(1, Number(url.searchParams.get("limit")) || 5),
	);

	const listJson = await env.VISITOR_KV.get("guestbook:list");
	const ids = listJson ? JSON.parse(listJson) : [];
	const pageIds = ids.slice(offset, offset + limit);

	const messages = await Promise.all(
		pageIds.map(async (id) => {
			const raw = await env.VISITOR_KV.get(`guestbook:msg:${id}`);
			return raw ? JSON.parse(raw) : null;
		}),
	);

	return Response.json(
		{ messages: messages.filter(Boolean), total: ids.length },
		{ headers: GB_HEADERS },
	);
}

async function handleGetMessage(env, id) {
	const raw = await env.VISITOR_KV.get(`guestbook:msg:${id}`);
	if (!raw) {
		return Response.json(
			{ error: "Not found" },
			{ status: 404, headers: GB_HEADERS },
		);
	}
	return Response.json(JSON.parse(raw), { headers: GB_HEADERS });
}

async function handleCreateMessage(env, request) {
	const ip =
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("X-Forwarded-For") ||
		"unknown";

	const rateLimit = await checkRateLimit(env, ip);
	if (!rateLimit.allowed) {
		return Response.json(
			{ error: "Too many requests, please try again later" },
			{
				status: 429,
				headers: { ...GB_HEADERS, "Retry-After": String(rateLimit.retryAfter) },
			},
		);
	}

	const body = await request.json().catch(() => ({}));
	const rawAuthor = (body.author || "").trim().slice(0, 30);
	const rawContent = (body.content || "").trim().slice(0, 500);

	const validation = validateInput(rawAuthor, rawContent);
	if (!validation.valid) {
		return Response.json(
			{ error: validation.error },
			{ status: 400, headers: GB_HEADERS },
		);
	}

	const author = escapeHtml(rawAuthor);
	const content = escapeHtml(rawContent);

	const counterRaw = await env.VISITOR_KV.get("guestbook:counter");
	const counter = counterRaw ? Number(counterRaw) + 1 : 1;
	await env.VISITOR_KV.put("guestbook:counter", String(counter));

	const id = `msg_${String(counter).padStart(3, "0")}`;
	const now = Date.now();
	const message = {
		id,
		author,
		content,
		time: "刚刚",
		createdAt: now,
		votes: { agree: 0, disagree: 0, neutral: 0 },
	};

	await env.VISITOR_KV.put(`guestbook:msg:${id}`, JSON.stringify(message));

	const listRaw = await env.VISITOR_KV.get("guestbook:list");
	const ids = listRaw ? JSON.parse(listRaw) : [];
	ids.unshift(id);
	await env.VISITOR_KV.put("guestbook:list", JSON.stringify(ids));

	return Response.json(message, { status: 201, headers: GB_HEADERS });
}

async function handleVote(env, id, request) {
	const ip =
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("X-Forwarded-For") ||
		"unknown";
	const rateLimit = await checkRateLimit(
		env,
		ip,
		"guestbook:vote",
		VOTE_RATE_LIMIT_MAX,
		VOTE_RATE_LIMIT_WINDOW,
	);
	if (!rateLimit.allowed) {
		return Response.json(
			{ error: "Too many requests, please try again later" },
			{
				status: 429,
				headers: { ...GB_HEADERS, "Retry-After": String(rateLimit.retryAfter) },
			},
		);
	}

	const body = await request.json().catch(() => ({}));
	const type = body.type;

	if (!["agree", "disagree", "neutral"].includes(type)) {
		return Response.json(
			{ error: "Invalid vote type" },
			{ status: 400, headers: GB_HEADERS },
		);
	}

	const raw = await env.VISITOR_KV.get(`guestbook:msg:${id}`);
	if (!raw) {
		return Response.json(
			{ error: "Not found" },
			{ status: 404, headers: GB_HEADERS },
		);
	}

	const message = JSON.parse(raw);
	message.votes[type] = (message.votes[type] || 0) + 1;
	await env.VISITOR_KV.put(`guestbook:msg:${id}`, JSON.stringify(message));

	return Response.json(message, { headers: GB_HEADERS });
}

export async function handleGuestbook(request, env, url) {
	if (request.method === "OPTIONS") {
		return new Response(null, { headers: GB_HEADERS });
	}

	const pathParts = url.pathname.split("/").filter(Boolean);
	const segments = pathParts.slice(2);

	try {
		if (
			segments.length === 2 &&
			segments[1] === "vote" &&
			request.method === "POST"
		) {
			return await handleVote(env, segments[0], request);
		}

		if (segments.length === 1 && request.method === "GET") {
			return await handleGetMessage(env, segments[0]);
		}

		if (segments.length === 0 && request.method === "POST") {
			return await handleCreateMessage(env, request);
		}

		if (segments.length === 0 && request.method === "GET") {
			return await handleListMessages(env, url);
		}

		return new Response("Not Found", { status: 404, headers: GB_HEADERS });
	} catch (err) {
		return Response.json(
			{ error: err.message },
			{ status: 500, headers: GB_HEADERS },
		);
	}
}
