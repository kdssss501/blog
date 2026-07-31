/**
 * Edge-safe storage ports and adapters.
 *
 * Node filesystem implementations live in `node-file.ts`; keep this module
 * free of Node built-ins because Cloudflare Functions import it directly.
 */

export interface StorageAdapter {
	get(key: string): Promise<string | null>;
	set(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
	list(prefix: string): Promise<{ key: string; value: string }[]>;
}

export interface D1Result<Row = Record<string, unknown>> {
	results?: Row[];
	success?: boolean;
	error?: string;
	meta?: unknown;
}

export interface D1PreparedStatementLike {
	bind(...values: unknown[]): D1PreparedStatementLike;
	first<Row = Record<string, unknown>>(): Promise<Row | null>;
	run(): Promise<D1Result>;
	all<Row = Record<string, unknown>>(): Promise<D1Result<Row>>;
}

export interface D1DatabaseLike {
	prepare(query: string): D1PreparedStatementLike;
}

export interface VercelKVClient {
	get<Value = unknown>(key: string): Promise<Value | null>;
	set(key: string, value: unknown): Promise<unknown>;
	del(...keys: string[]): Promise<unknown>;
	keys(options: { prefix: string }): Promise<{ keys?: string[] }>;
}

export interface StorageEnvironment {
	DB?: D1DatabaseLike;
	CONTENT_ASSETS?: R2BucketLike;
	CONTENT_ASSET_PUBLIC_BASE_URL?: string;
	CONTENT_ASSET_EXTERNAL_UPLOAD_URL?: string;
	CONTENT_ASSET_EXTERNAL_TOKEN?: string;
	KV_REST_API_URL?: string;
	KV_REST_API_TOKEN?: string;
	NOTEBOOK_ADMIN_TOKEN?: string;
	ACTIVITY_ADMIN_TOKEN?: string;
	BLOG_ADMIN_TOKEN?: string;
	GITHUB_CONTENT_TOKEN?: string;
	GITHUB_REPOSITORY?: string;
	GITHUB_BRANCH?: string;
	VISITOR_KV?: unknown;
	[key: string]: unknown;
}

/** Cloudflare R2 binding surface used by the content asset adapter. */
export interface R2BucketLike {
	put(
		key: string,
		value: ArrayBuffer | Uint8Array,
		options?: { httpMetadata?: { contentType?: string } },
	): Promise<unknown>;
}

export class StorageUnavailableError extends Error {
	constructor(message = "Persistent application storage is not configured") {
		super(message);
		this.name = "StorageUnavailableError";
	}
}

class D1Storage implements StorageAdapter {
	private readonly db: D1DatabaseLike;

	constructor(db: D1DatabaseLike) {
		this.db = db;
	}

	async get(key: string): Promise<string | null> {
		const result = await this.db
			.prepare("SELECT value FROM kv_store WHERE key = ?")
			.bind(key)
			.first<{ value: string }>();
		return result?.value ?? null;
	}

	async set(key: string, value: string): Promise<void> {
		const now = Date.now();
		await this.db
			.prepare(
				"INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?) " +
					"ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?",
			)
			.bind(key, value, now, value, now)
			.run();
	}

	async delete(key: string): Promise<void> {
		await this.db.prepare("DELETE FROM kv_store WHERE key = ?").bind(key).run();
	}

	async list(prefix: string): Promise<{ key: string; value: string }[]> {
		const result = await this.db
			.prepare("SELECT key, value FROM kv_store WHERE key LIKE ?")
			.bind(`${prefix}%`)
			.all<{ key: string; value: string }>();
		return (result.results ?? []).map((row) => ({
			key: row.key,
			value: row.value,
		}));
	}
}

class VercelKVStorage implements StorageAdapter {
	private readonly kv: VercelKVClient;

	constructor(kv: VercelKVClient) {
		this.kv = kv;
	}

	async get(key: string): Promise<string | null> {
		return (await this.kv.get<string>(key)) ?? null;
	}

	async set(key: string, value: string): Promise<void> {
		await this.kv.set(key, value);
	}

	async delete(key: string): Promise<void> {
		await this.kv.del(key);
	}

	async list(prefix: string): Promise<{ key: string; value: string }[]> {
		const keys = await this.kv.keys({ prefix });
		const result: { key: string; value: string }[] = [];
		for (const key of keys.keys ?? []) {
			const value = await this.kv.get<string>(key);
			if (value !== null) result.push({ key, value });
		}
		return result;
	}
}

export function createD1Storage(db: D1DatabaseLike): StorageAdapter {
	return new D1Storage(db);
}

export function createVercelKVStorage(kv: VercelKVClient): StorageAdapter {
	return new VercelKVStorage(kv);
}

export interface StorageResolutionOptions {
	fallback?: StorageAdapter;
	vercelKV?: VercelKVClient;
}

/**
 * Resolve hosted storage without importing a platform SDK. Node callers inject
 * the Vercel client or local file fallback from the Node-only adapter.
 */
export async function getStorage(
	env: StorageEnvironment = {},
	options: StorageResolutionOptions = {},
): Promise<StorageAdapter> {
	if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
		if (!options.vercelKV) {
			throw new StorageUnavailableError(
				"Vercel KV credentials are set but the Vercel KV adapter was not injected",
			);
		}
		return createVercelKVStorage(options.vercelKV);
	}

	if (env.DB) return createD1Storage(env.DB);
	if (options.fallback) return options.fallback;

	throw new StorageUnavailableError();
}

export const D1_INIT_SQL = `
CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kv_store_key ON kv_store(key);
`;

const storageMutationQueues = new Map<string, Promise<void>>();

/** Serialize read-modify-write operations sharing the same logical key. */
export async function withStorageMutationLock<T>(
	key: string,
	operation: () => Promise<T>,
): Promise<T> {
	const previous = storageMutationQueues.get(key) ?? Promise.resolve();
	let release: () => void = () => {};
	const gate = new Promise<void>((resolveGate) => {
		release = resolveGate;
	});
	const tail = previous.catch(() => undefined).then(() => gate);
	storageMutationQueues.set(key, tail);

	await previous.catch(() => undefined);
	try {
		return await operation();
	} finally {
		release();
		if (storageMutationQueues.get(key) === tail) {
			storageMutationQueues.delete(key);
		}
	}
}

export async function storageGetJSON<T>(
	storage: StorageAdapter,
	key: string,
): Promise<T | null> {
	const raw = await storage.get(key);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

export async function storageSetJSON(
	storage: StorageAdapter,
	key: string,
	value: unknown,
): Promise<void> {
	await storage.set(key, JSON.stringify(value));
}

export async function storageGetList(
	storage: StorageAdapter,
	indexKey: string,
): Promise<string[]> {
	const raw = await storage.get(indexKey);
	if (!raw) return [];
	try {
		const value: unknown = JSON.parse(raw);
		return Array.isArray(value)
			? value.filter((item): item is string => typeof item === "string")
			: [];
	} catch {
		return [];
	}
}

export async function storageSetList(
	storage: StorageAdapter,
	indexKey: string,
	list: string[],
): Promise<void> {
	await storage.set(indexKey, JSON.stringify(list));
}

export async function storageGetAll<T>(
	storage: StorageAdapter,
	prefix: string,
	indexKey: string,
): Promise<T[]> {
	const ids = await storageGetList(storage, indexKey);
	const items: T[] = [];
	for (const id of ids) {
		const item = await storageGetJSON<T>(storage, prefix + id);
		if (item) items.push(item);
	}
	return items;
}
