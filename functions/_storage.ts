/**
 * 持久化存储层
 * - dev 模式：文件存储 (data/store.json)
 * - 生产模式：Cloudflare D1 数据库
 *
 * 统一接口：get / set / delete / list
 */

export interface StorageAdapter {
	get(key: string): Promise<string | null>;
	set(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
	list(prefix: string): Promise<{ key: string; value: string }[]>;
}

// ============ 文件存储（dev 模式） ============

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

const STORE_FILE = resolve(process.cwd(), "data", "store.json");

class FileStorage implements StorageAdapter {
	private cache: Map<string, string> = new Map();
	private loaded = false;
	private saveTimer: ReturnType<typeof setTimeout> | null = null;

	private load() {
		if (this.loaded) return;
		this.loaded = true;
		try {
			if (existsSync(STORE_FILE)) {
				const raw = readFileSync(STORE_FILE, "utf-8");
				const data = JSON.parse(raw);
				for (const [k, v] of Object.entries(data)) {
					this.cache.set(k, String(v));
				}
			}
		} catch {
			// 文件不存在或解析失败，忽略
		}
	}

	private scheduleSave() {
		if (this.saveTimer) clearTimeout(this.saveTimer);
		this.saveTimer = setTimeout(() => this.flush(), 200);
	}

	flush() {
		try {
			const dir = dirname(STORE_FILE);
			if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
			const obj: Record<string, string> = {};
			for (const [k, v] of this.cache) obj[k] = v;
			writeFileSync(STORE_FILE, JSON.stringify(obj, null, 2), "utf-8");
		} catch (e) {
			console.error("[FileStorage] Save failed:", e);
		}
	}

	async get(key: string): Promise<string | null> {
		this.load();
		return this.cache.get(key) ?? null;
	}

	async set(key: string, value: string): Promise<void> {
		this.load();
		this.cache.set(key, value);
		this.scheduleSave();
	}

	async delete(key: string): Promise<void> {
		this.load();
		this.cache.delete(key);
		this.scheduleSave();
	}

	async list(prefix: string): Promise<{ key: string; value: string }[]> {
		this.load();
		const result: { key: string; value: string }[] = [];
		for (const [k, v] of this.cache) {
			if (k.startsWith(prefix)) result.push({ key: k, value: v });
		}
		return result;
	}
}

// ============ D1 存储（生产模式） ============

class D1Storage implements StorageAdapter {
	private db: any;

	constructor(db: any) {
		this.db = db;
	}

	async get(key: string): Promise<string | null> {
		const result = await this.db
			.prepare("SELECT value FROM kv_store WHERE key = ?")
			.bind(key)
			.first();
		return result?.value ?? null;
	}

	async set(key: string, value: string): Promise<void> {
		await this.db
			.prepare(
				"INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?) " +
					"ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?"
			)
			.bind(key, value, Date.now(), value, Date.now())
			.run();
	}

	async delete(key: string): Promise<void> {
		await this.db.prepare("DELETE FROM kv_store WHERE key = ?").bind(key).run();
	}

	async list(prefix: string): Promise<{ key: string; value: string }[]> {
		const result = await this.db
			.prepare("SELECT key, value FROM kv_store WHERE key LIKE ?")
			.bind(prefix + "%")
			.all();
		return (result.results || []).map((r: any) => ({ key: r.key, value: r.value }));
	}
}

// ============ 存储工厂 ============

let fileStorageInstance: FileStorage | null = null;

export function getStorage(env?: any): StorageAdapter {
	// 生产环境：使用 D1
	if (env?.DB) {
		return new D1Storage(env.DB);
	}

	// dev 环境：使用文件存储
	if (!fileStorageInstance) {
		fileStorageInstance = new FileStorage();
	}
	return fileStorageInstance;
}

// ============ D1 初始化 SQL ============

export const D1_INIT_SQL = `
CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kv_store_key ON kv_store(key);
`;

// ============ 高级存储操作 ============

export async function storageGetJSON<T>(storage: StorageAdapter, key: string): Promise<T | null> {
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
	value: any
): Promise<void> {
	await storage.set(key, JSON.stringify(value));
}

export async function storageGetList(storage: StorageAdapter, indexKey: string): Promise<string[]> {
	const raw = await storage.get(indexKey);
	if (!raw) return [];
	try {
		return JSON.parse(raw) as string[];
	} catch {
		return [];
	}
}

export async function storageSetList(
	storage: StorageAdapter,
	indexKey: string,
	list: string[]
): Promise<void> {
	await storage.set(indexKey, JSON.stringify(list));
}

export async function storageGetAll<T>(
	storage: StorageAdapter,
	prefix: string,
	indexKey: string
): Promise<T[]> {
	const ids = await storageGetList(storage, indexKey);
	const items: T[] = [];
	for (const id of ids) {
		const item = await storageGetJSON<T>(storage, prefix + id);
		if (item) items.push(item);
	}
	return items;
}
