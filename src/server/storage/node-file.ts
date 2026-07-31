import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { LocalContentAssetWriter } from "./assets";
import type { StorageAdapter } from "./index";

export class NodeFileStorage implements StorageAdapter {
	private readonly cache = new Map<string, string>();
	private readonly storeFile: string;
	private loaded = false;
	private saveTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(storeFile = resolve(process.cwd(), "data", "store.json")) {
		this.storeFile = storeFile;
	}

	private load() {
		if (this.loaded) return;
		this.loaded = true;
		try {
			if (!existsSync(this.storeFile)) return;
			const value: unknown = JSON.parse(readFileSync(this.storeFile, "utf8"));
			if (!value || typeof value !== "object" || Array.isArray(value)) return;
			for (const [key, entry] of Object.entries(value)) {
				this.cache.set(key, String(entry));
			}
		} catch (error) {
			console.warn("[NodeFileStorage] Unable to read local store", error);
		}
	}

	private scheduleSave() {
		if (this.saveTimer) clearTimeout(this.saveTimer);
		this.saveTimer = setTimeout(() => this.flush(), 200);
	}

	flush() {
		try {
			mkdirSync(dirname(this.storeFile), { recursive: true });
			writeFileSync(
				this.storeFile,
				JSON.stringify(Object.fromEntries(this.cache), null, 2),
				"utf8",
			);
		} catch (error) {
			console.error("[NodeFileStorage] Unable to save local store", error);
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
		return [...this.cache]
			.filter(([key]) => key.startsWith(prefix))
			.map(([key, value]) => ({ key, value }));
	}
}

let localStorage: NodeFileStorage | undefined;

export function getLocalFileStorage(): NodeFileStorage {
	localStorage ??= new NodeFileStorage();
	return localStorage;
}

export const writeLocalContentAsset: LocalContentAssetWriter = async (
	key,
	bytes,
) => {
	const publicPath = `/uploads/${key}`;
	const output = resolve(process.cwd(), "public", publicPath.slice(1));
	mkdirSync(dirname(output), { recursive: true });
	writeFileSync(output, bytes);
	return publicPath;
};
