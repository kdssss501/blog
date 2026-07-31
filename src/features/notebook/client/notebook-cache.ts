const CACHE_TTL = 5 * 60 * 1000;

type CacheEnvelope<T> = {
	data: T;
	timestamp: number;
};

export function readNotebookCache<T>(key: string): T | null {
	try {
		const raw = window.sessionStorage.getItem(key);
		if (!raw) return null;
		const cached = JSON.parse(raw) as CacheEnvelope<T>;
		if (
			typeof cached.timestamp === "number" &&
			Date.now() - cached.timestamp < CACHE_TTL
		) {
			return cached.data;
		}
		window.sessionStorage.removeItem(key);
	} catch {
		// 禁用存储或缓存损坏时直接回源。
	}
	return null;
}

export function writeNotebookCache<T>(key: string, data: T) {
	try {
		window.sessionStorage.setItem(
			key,
			JSON.stringify({
				data,
				timestamp: Date.now(),
			} satisfies CacheEnvelope<T>),
		);
	} catch {
		// 缓存是可选优化，不影响主流程。
	}
}
