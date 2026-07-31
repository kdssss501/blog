export type AdminAccessResult =
	| { granted: true }
	| { granted: false; status: 401 | 503; error: string };

export const ADMIN_SESSION_COOKIE = "blog_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 2 * 60 * 60;

interface AdminSessionPayload {
	v: 1;
	iat: number;
	exp: number;
}

function encodeBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
	const binary = atob(padded);
	const bytes = new Uint8Array(new ArrayBuffer(binary.length));
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

async function importSigningKey(token: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(token),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

function readCookie(request: Request, name: string): string {
	const cookie = request.headers.get("cookie") || "";
	for (const part of cookie.split(";")) {
		const [key, ...value] = part.trim().split("=");
		if (key === name) return value.join("=");
	}
	return "";
}

function configuredToken(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

export async function createAdminSession(
	token: string,
	now = Date.now(),
): Promise<string> {
	const payload: AdminSessionPayload = {
		v: 1,
		iat: now,
		exp: now + ADMIN_SESSION_TTL_SECONDS * 1000,
	};
	const encodedPayload = encodeBase64Url(
		new TextEncoder().encode(JSON.stringify(payload)),
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		await importSigningKey(token),
		new TextEncoder().encode(encodedPayload),
	);
	return `${encodedPayload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAdminSession(
	session: string,
	token: string,
	now = Date.now(),
): Promise<boolean> {
	try {
		const [encodedPayload, encodedSignature, extra] = session.split(".");
		if (!encodedPayload || !encodedSignature || extra) return false;
		const valid = await crypto.subtle.verify(
			"HMAC",
			await importSigningKey(token),
			decodeBase64Url(encodedSignature),
			new TextEncoder().encode(encodedPayload),
		);
		if (!valid) return false;
		const payload = JSON.parse(
			new TextDecoder().decode(decodeBase64Url(encodedPayload)),
		) as Partial<AdminSessionPayload>;
		return (
			payload.v === 1 &&
			typeof payload.iat === "number" &&
			typeof payload.exp === "number" &&
			payload.iat <= now + 60_000 &&
			payload.exp > now &&
			payload.exp - payload.iat === ADMIN_SESSION_TTL_SECONDS * 1000
		);
	} catch {
		return false;
	}
}

export function createAdminSessionCookie(session: string): string {
	return `${ADMIN_SESSION_COOKIE}=${session}; Path=/; Max-Age=${ADMIN_SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAdminSessionCookie(): string {
	return `${ADMIN_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export function isAdminWriteMethod(method: string): boolean {
	return method === "POST" || method === "PUT" || method === "DELETE";
}

export function getAdminAccess(
	request: Request,
	token: unknown,
	resourceName: string,
): AdminAccessResult {
	if (typeof token !== "string" || token.length === 0) {
		return {
			granted: false,
			status: 503,
			error: `${resourceName} administration is not configured`,
		};
	}
	if (request.headers.get("Authorization") !== `Bearer ${token}`) {
		return { granted: false, status: 401, error: "Unauthorized" };
	}
	return { granted: true };
}

export async function getUnifiedAdminAccess(
	request: Request,
	blogToken: unknown,
	legacyToken?: unknown,
	resourceName = "Blog",
): Promise<AdminAccessResult> {
	const primary = configuredToken(blogToken);
	const legacy = configuredToken(legacyToken);
	if (!primary && !legacy) {
		return {
			granted: false,
			status: 503,
			error: `${resourceName} administration is not configured`,
		};
	}

	if (primary) {
		const session = readCookie(request, ADMIN_SESSION_COOKIE);
		if (session && (await verifyAdminSession(session, primary))) {
			return { granted: true };
		}
	}

	const authorization = request.headers.get("Authorization");
	if (
		(primary && authorization === `Bearer ${primary}`) ||
		(legacy && authorization === `Bearer ${legacy}`)
	) {
		return { granted: true };
	}
	return { granted: false, status: 401, error: "Unauthorized" };
}
