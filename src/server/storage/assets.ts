import type { R2BucketLike, StorageEnvironment } from "./index";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const EXTERNAL_UPLOAD_TIMEOUT_MS = 15_000;
const IMAGE_EXTENSIONS: Record<string, string> = {
	"image/avif": "avif",
	"image/gif": "gif",
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

export interface StoredContentAsset {
	key: string;
	url: string;
	contentType: string;
	size: number;
}

export type LocalContentAssetWriter = (
	key: string,
	bytes: Uint8Array,
) => Promise<string>;

export class ContentAssetStorageUnavailableError extends Error {
	constructor() {
		super("Persistent content asset storage is not configured");
		this.name = "ContentAssetStorageUnavailableError";
	}
}

function configured(value: unknown): string {
	return typeof value === "string" ? value.trim().replace(/\/$/, "") : "";
}

function safeName(value: string): string {
	return value
		.toLowerCase()
		.replace(/\.[^.]+$/, "")
		.replace(/[^a-z0-9-_]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}

function createAssetKey(file: File): string {
	const date = new Date().toISOString().slice(0, 7);
	const extension = IMAGE_EXTENSIONS[file.type];
	const base = safeName(file.name) || "image";
	return `content/${date}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${base}.${extension}`;
}

function validateImage(file: File): string | null {
	if (!IMAGE_EXTENSIONS[file.type])
		return "Only AVIF, GIF, JPEG, PNG, and WebP images are supported";
	if (file.size === 0) return "Image is empty";
	if (file.size > MAX_IMAGE_BYTES) return "Image exceeds the 15 MB limit";
	return null;
}

function matchesImageSignature(
	bytes: Uint8Array,
	contentType: string,
): boolean {
	const ascii = (start: number, length: number) =>
		String.fromCharCode(...bytes.slice(start, start + length));
	switch (contentType) {
		case "image/jpeg":
			return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
		case "image/png":
			return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
				(value, index) => bytes[index] === value,
			);
		case "image/gif":
			return ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a";
		case "image/webp":
			return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
		case "image/avif":
			return (
				ascii(4, 4) === "ftyp" &&
				["avif", "avis"].some((brand) => ascii(8, 24).includes(brand))
			);
		default:
			return false;
	}
}

function isPrivateHostname(hostname: string): boolean {
	const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
	const isIpv6 = normalized.includes(":");
	if (
		normalized === "localhost" ||
		normalized.endsWith(".localhost") ||
		normalized.endsWith(".local") ||
		normalized.endsWith(".internal") ||
		normalized === "::" ||
		normalized === "::1" ||
		(isIpv6 && normalized.startsWith("fc")) ||
		(isIpv6 && normalized.startsWith("fd")) ||
		(isIpv6 && /^fe[89ab]/.test(normalized)) ||
		normalized.startsWith("::ffff:")
	) {
		return true;
	}
	const parts = normalized.split(".");
	if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
		return false;
	}
	const octets = parts.map(Number);
	if (octets.some((part) => part > 255)) return true;
	const [first, second] = octets;
	return (
		first === 0 ||
		first === 10 ||
		first === 127 ||
		(first === 100 && second >= 64 && second <= 127) ||
		(first === 169 && second === 254) ||
		(first === 172 && second >= 16 && second <= 31) ||
		(first === 192 && second === 168) ||
		(first === 198 && (second === 18 || second === 19)) ||
		first >= 224
	);
}

function parseExternalEndpoint(value: string): URL {
	let endpoint: URL;
	try {
		endpoint = new URL(value);
	} catch {
		throw new Error("External asset upload URL is invalid");
	}
	if (
		endpoint.protocol !== "https:" ||
		endpoint.username ||
		endpoint.password ||
		isPrivateHostname(endpoint.hostname)
	) {
		throw new Error(
			"External asset upload URL must be a public HTTPS endpoint without embedded credentials",
		);
	}
	return endpoint;
}

function parsePublicAssetUrl(value: string, label: string): URL {
	if (
		[...value].some((character) => {
			const code = character.charCodeAt(0);
			return code <= 31 || code === 127;
		})
	) {
		throw new Error(`${label} contains control characters`);
	}
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`${label} is invalid`);
	}
	if (
		url.protocol !== "https:" ||
		url.username ||
		url.password ||
		isPrivateHostname(url.hostname)
	) {
		throw new Error(`${label} must be a public HTTPS URL without credentials`);
	}
	return url;
}

function isHostedRuntime(env: StorageEnvironment): boolean {
	return (
		env.NODE_ENV === "production" ||
		env.VERCEL === "1" ||
		env.CF_PAGES === "1" ||
		env.CF_PAGES === true
	);
}

async function uploadToExternalEndpoint(
	file: File,
	key: string,
	endpoint: URL,
	token: string,
): Promise<StoredContentAsset> {
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": file.type,
			"X-Content-Asset-Key": key,
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: file,
		redirect: "error",
		signal: AbortSignal.timeout(EXTERNAL_UPLOAD_TIMEOUT_MS),
	});
	const payload = (await response.json().catch(() => ({}))) as {
		url?: unknown;
		error?: unknown;
	};
	if (!response.ok || typeof payload.url !== "string") {
		throw new Error(
			typeof payload.error === "string"
				? payload.error
				: `External asset upload failed (${response.status})`,
		);
	}
	const assetUrl = parsePublicAssetUrl(
		payload.url,
		"External asset response URL",
	);
	return {
		key,
		url: assetUrl.href,
		contentType: file.type,
		size: file.size,
	};
}

export async function storeContentImage(
	file: File,
	env: StorageEnvironment,
	localWriter?: LocalContentAssetWriter,
): Promise<StoredContentAsset> {
	const error = validateImage(file);
	if (error) throw new Error(error);
	const bytes = new Uint8Array(await file.arrayBuffer());
	if (!matchesImageSignature(bytes, file.type)) {
		throw new Error("Image content does not match its declared MIME type");
	}
	const key = createAssetKey(file);
	const externalEndpoint = configured(env.CONTENT_ASSET_EXTERNAL_UPLOAD_URL);
	if (externalEndpoint) {
		return uploadToExternalEndpoint(
			file,
			key,
			parseExternalEndpoint(externalEndpoint),
			configured(env.CONTENT_ASSET_EXTERNAL_TOKEN),
		);
	}

	const bucket = env.CONTENT_ASSETS as R2BucketLike | undefined;
	if (bucket) {
		const publicBase = configured(env.CONTENT_ASSET_PUBLIC_BASE_URL);
		if (!publicBase) {
			throw new Error(
				"CONTENT_ASSET_PUBLIC_BASE_URL is required when CONTENT_ASSETS is configured",
			);
		}
		const baseUrl = parsePublicAssetUrl(publicBase, "R2 public base URL");
		baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, "")}/`;
		baseUrl.search = "";
		baseUrl.hash = "";
		await bucket.put(key, bytes, { httpMetadata: { contentType: file.type } });
		return {
			key,
			url: new URL(key, baseUrl).href,
			contentType: file.type,
			size: file.size,
		};
	}
	if (!isHostedRuntime(env) && localWriter) {
		return {
			key,
			url: await localWriter(key, bytes),
			contentType: file.type,
			size: file.size,
		};
	}
	throw new ContentAssetStorageUnavailableError();
}
