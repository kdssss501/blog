import type { GuestbookMessage } from "@/features/guestbook";
import {
	type StorageAdapter,
	storageGetJSON,
	storageGetList,
	storageSetJSON,
	storageSetList,
	withStorageMutationLock,
} from "../../storage/index.ts";
import { jsonResponse } from "../http.ts";

type VoteType = keyof GuestbookMessage["votes"];

const MESSAGE_PREFIX = "guestbook:msg:";
const MESSAGE_INDEX_KEY = "guestbook:list";
const MESSAGE_INDEX_LOCK = "guestbook:index";
const MAX_REQUEST_BYTES = 4_096;
const MAX_OFFSET = 100_000;
const MAX_AUTHOR_LENGTH = 30;
const MIN_AUTHOR_LENGTH = 2;
const MAX_CONTENT_LENGTH = 300;
const MIN_CONTENT_LENGTH = 5;
const CREATE_RATE_LIMIT = 5;
const VOTE_RATE_LIMIT = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

interface GuestbookCreatePayload {
	author: string;
	content: string;
}

interface RateLimitRecord {
	count: number;
	windowStartedAt: number;
}

interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	retryAfter: number;
}

function isVoteType(value: unknown): value is VoteType {
	return value === "agree" || value === "disagree" || value === "neutral";
}

async function getMessage(
	storage: StorageAdapter,
	id: string,
): Promise<GuestbookMessage | null> {
	return storageGetJSON<GuestbookMessage>(storage, `${MESSAGE_PREFIX}${id}`);
}

async function setMessage(
	storage: StorageAdapter,
	message: GuestbookMessage,
): Promise<void> {
	await storageSetJSON(storage, `${MESSAGE_PREFIX}${message.id}`, message);
}

function createMessageId(now: number): string {
	const random = globalThis.crypto
		.randomUUID()
		.replaceAll("-", "")
		.slice(0, 20);
	return `msg_${now.toString(36)}_${random}`;
}

function isValidMessageId(id: string): boolean {
	return id.length > 0 && id.length <= 128 && /^[A-Za-z0-9_-]+$/.test(id);
}

function characterCount(value: string): number {
	return [...value].length;
}

function containsInvalidControlCharacter(value: string): boolean {
	for (const character of value) {
		const codePoint = character.codePointAt(0) ?? 0;
		if (
			codePoint <= 8 ||
			(codePoint >= 11 && codePoint <= 12) ||
			(codePoint >= 14 && codePoint <= 31) ||
			codePoint === 127
		) {
			return true;
		}
	}
	return false;
}

function validationError(error: string, status = 400): Response {
	return jsonResponse({ error }, status);
}

async function readCreatePayload(
	request: Request,
): Promise<GuestbookCreatePayload | Response> {
	const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
	if (!contentType.startsWith("application/json")) {
		return validationError("Content-Type must be application/json", 415);
	}

	const declaredLength = request.headers.get("content-length");
	if (declaredLength !== null) {
		const bytes = Number(declaredLength);
		if (!Number.isFinite(bytes) || bytes < 0) {
			return validationError("Invalid Content-Length header");
		}
		if (bytes > MAX_REQUEST_BYTES) {
			return validationError("Request body is too large", 413);
		}
	}

	const rawBody = await request.text();
	if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
		return validationError("Request body is too large", 413);
	}

	let body: unknown;
	try {
		body = JSON.parse(rawBody);
	} catch {
		return validationError("Request body must be valid JSON");
	}
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		return validationError("Request body must be a JSON object");
	}

	const { author: rawAuthor, content: rawContent } = body as Record<
		string,
		unknown
	>;
	if (typeof rawAuthor !== "string" || typeof rawContent !== "string") {
		return validationError("author and content must be strings");
	}

	const author = rawAuthor.trim().normalize("NFC");
	const content = rawContent.trim().normalize("NFC");
	const authorLength = characterCount(author);
	const contentLength = characterCount(content);
	if (authorLength < MIN_AUTHOR_LENGTH || authorLength > MAX_AUTHOR_LENGTH) {
		return validationError(
			`author must be ${MIN_AUTHOR_LENGTH}-${MAX_AUTHOR_LENGTH} characters`,
		);
	}
	if (
		contentLength < MIN_CONTENT_LENGTH ||
		contentLength > MAX_CONTENT_LENGTH
	) {
		return validationError(
			`content must be ${MIN_CONTENT_LENGTH}-${MAX_CONTENT_LENGTH} characters`,
		);
	}
	if (
		containsInvalidControlCharacter(author) ||
		containsInvalidControlCharacter(content)
	) {
		return validationError(
			"author or content contains invalid control characters",
		);
	}

	return { author, content };
}

function getClientIdentity(request: Request): string {
	const forwarded = request.headers
		.get("x-forwarded-for")
		?.split(",")[0]
		?.trim();
	const address =
		request.headers.get("cf-connecting-ip")?.trim() ||
		request.headers.get("x-real-ip")?.trim() ||
		forwarded ||
		`unknown:${request.headers.get("user-agent")?.slice(0, 160) || "client"}`;
	return address.slice(0, 256);
}

async function hashIdentity(identity: string): Promise<string> {
	const digest = await globalThis.crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(identity),
	);
	return Array.from(new Uint8Array(digest).slice(0, 12), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

function parseRateLimitRecord(raw: string | null): RateLimitRecord | null {
	if (!raw) return null;
	try {
		const value = JSON.parse(raw) as Partial<RateLimitRecord>;
		if (
			Number.isFinite(value.count) &&
			Number.isFinite(value.windowStartedAt) &&
			Number(value.count) >= 0 &&
			Number(value.windowStartedAt) >= 0
		) {
			return {
				count: Math.floor(Number(value.count)),
				windowStartedAt: Math.floor(Number(value.windowStartedAt)),
			};
		}
	} catch {
		// 损坏的限流记录按新窗口处理。
	}
	return null;
}

async function consumeRateLimit(
	storage: StorageAdapter,
	request: Request,
	scope: "create" | "vote",
	limit: number,
): Promise<RateLimitResult> {
	const identityHash = await hashIdentity(getClientIdentity(request));
	const storageKey = `guestbook:rate-limit:${scope}:${identityHash}`;
	return withStorageMutationLock(`rate-limit:${storageKey}`, async () => {
		const now = Date.now();
		const existing = parseRateLimitRecord(await storage.get(storageKey));
		const active =
			existing &&
			now >= existing.windowStartedAt &&
			now - existing.windowStartedAt < RATE_LIMIT_WINDOW_MS
				? existing
				: { count: 0, windowStartedAt: now };
		const retryAfter = Math.max(
			1,
			Math.ceil((active.windowStartedAt + RATE_LIMIT_WINDOW_MS - now) / 1_000),
		);
		if (active.count >= limit) {
			return { allowed: false, remaining: 0, retryAfter };
		}
		active.count += 1;
		await storage.set(storageKey, JSON.stringify(active));
		return {
			allowed: true,
			remaining: Math.max(0, limit - active.count),
			retryAfter,
		};
	});
}

async function prependMessageId(
	storage: StorageAdapter,
	id: string,
): Promise<void> {
	await withStorageMutationLock(MESSAGE_INDEX_LOCK, async () => {
		const ids = (await storageGetList(storage, MESSAGE_INDEX_KEY)).filter(
			(existingId): existingId is string =>
				typeof existingId === "string" && existingId !== id,
		);
		ids.unshift(id);
		await storageSetList(storage, MESSAGE_INDEX_KEY, ids);
	});
}

function parsePagination(
	url: URL,
): { offset: number; limit: number } | Response {
	const offsetValue = url.searchParams.get("offset");
	const limitValue = url.searchParams.get("limit");
	if (offsetValue !== null && !/^\d+$/.test(offsetValue)) {
		return validationError("offset must be a non-negative integer");
	}
	if (limitValue !== null && !/^\d+$/.test(limitValue)) {
		return validationError("limit must be an integer between 1 and 20");
	}
	const offset = offsetValue === null ? 0 : Number(offsetValue);
	const limit = limitValue === null ? 5 : Number(limitValue);
	if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
		return validationError(`offset must be between 0 and ${MAX_OFFSET}`);
	}
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) {
		return validationError("limit must be an integer between 1 and 20");
	}
	return { offset, limit };
}

async function handleList(
	storage: StorageAdapter,
	url: URL,
): Promise<Response> {
	const pagination = parsePagination(url);
	if (pagination instanceof Response) return pagination;
	const { offset, limit } = pagination;
	const ids = [
		...new Set(
			(await storageGetList(storage, MESSAGE_INDEX_KEY)).filter(
				(id): id is string => typeof id === "string" && isValidMessageId(id),
			),
		),
	];
	const messages = (
		await Promise.all(
			ids.slice(offset, offset + limit).map((id) => getMessage(storage, id)),
		)
	).filter((message): message is GuestbookMessage => message !== null);
	return jsonResponse({ messages, total: ids.length });
}

async function handleCreate(
	storage: StorageAdapter,
	request: Request,
): Promise<Response> {
	const rateLimit = await consumeRateLimit(
		storage,
		request,
		"create",
		CREATE_RATE_LIMIT,
	);
	if (!rateLimit.allowed) {
		return jsonResponse(
			{ error: "Too many requests, please try again later" },
			429,
			{ "Retry-After": String(rateLimit.retryAfter) },
		);
	}
	const payload = await readCreatePayload(request);
	if (payload instanceof Response) return payload;
	const now = Date.now();
	const message: GuestbookMessage = {
		id: createMessageId(now),
		author: payload.author,
		content: payload.content,
		time: "刚刚",
		createdAt: now,
		device: getDeviceLabel(request.headers.get("user-agent")),
		role: "visitor",
		votes: { agree: 0, disagree: 0, neutral: 0 },
	};
	await setMessage(storage, message);
	try {
		await prependMessageId(storage, message.id);
	} catch (error) {
		await storage
			.delete(`${MESSAGE_PREFIX}${message.id}`)
			.catch(() => undefined);
		throw error;
	}
	return jsonResponse(message, 201, {
		"X-RateLimit-Limit": String(CREATE_RATE_LIMIT),
		"X-RateLimit-Remaining": String(rateLimit.remaining),
	});
}

function getDeviceLabel(userAgent: string | null): string {
	if (!userAgent) return "Web";
	const browser = userAgent.includes("Firefox/")
		? "Firefox"
		: userAgent.includes("Edg/")
			? "Edge"
			: userAgent.includes("Chrome/")
				? "Chrome"
				: userAgent.includes("Safari/")
					? "Safari"
					: "Web";
	const system = /Android|iPhone|iPad/i.test(userAgent)
		? "Mobile"
		: userAgent.includes("Windows")
			? "Windows"
			: userAgent.includes("Mac OS")
				? "macOS"
				: userAgent.includes("Linux")
					? "Linux"
					: "";
	return system ? `${browser} · ${system}` : browser;
}

async function handleVote(
	storage: StorageAdapter,
	id: string,
	request: Request,
): Promise<Response> {
	const rateLimit = await consumeRateLimit(
		storage,
		request,
		"vote",
		VOTE_RATE_LIMIT,
	);
	if (!rateLimit.allowed) {
		return jsonResponse(
			{ error: "Too many requests, please try again later" },
			429,
			{ "Retry-After": String(rateLimit.retryAfter) },
		);
	}
	const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
	if (!contentType.startsWith("application/json")) {
		return validationError("Content-Type must be application/json", 415);
	}
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return validationError("Request body must be valid JSON");
	}
	const type =
		body && typeof body === "object" && !Array.isArray(body)
			? (body as Record<string, unknown>).type
			: undefined;
	if (!isVoteType(type)) return validationError("Invalid vote type");

	const response = await withStorageMutationLock(
		`guestbook:vote:${id}`,
		async () => {
			const message = await getMessage(storage, id);
			if (!message) return jsonResponse({ error: "Not found" }, 404);
			message.votes ??= { agree: 0, disagree: 0, neutral: 0 };
			message.votes[type] = Number(message.votes[type] || 0) + 1;
			await setMessage(storage, message);
			return jsonResponse(message, 200, {
				"X-RateLimit-Limit": String(VOTE_RATE_LIMIT),
				"X-RateLimit-Remaining": String(rateLimit.remaining),
			});
		},
	);
	return response;
}

export async function handleGuestbookRequest(
	storage: StorageAdapter,
	request: Request,
	url: URL,
): Promise<Response> {
	const segments = url.pathname.split("/").filter(Boolean).slice(2);
	if (request.method === "GET" && segments.length === 0) {
		return handleList(storage, url);
	}
	if (request.method === "GET" && segments.length === 1) {
		if (!isValidMessageId(segments[0])) {
			return validationError("Invalid message id");
		}
		const message = await getMessage(storage, segments[0]);
		return message
			? jsonResponse(message)
			: jsonResponse({ error: "Not found" }, 404);
	}
	if (request.method === "POST" && segments.length === 0) {
		return handleCreate(storage, request);
	}
	if (
		request.method === "POST" &&
		segments.length === 2 &&
		segments[1] === "vote"
	) {
		if (!isValidMessageId(segments[0])) {
			return validationError("Invalid message id");
		}
		return handleVote(storage, segments[0], request);
	}
	return new Response("Not Found", { status: 404 });
}
