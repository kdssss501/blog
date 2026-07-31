import type { NormalizedActivity } from "../model/activity-content";

export type ActivityListResponse = {
	items: NormalizedActivity[];
	total: number;
};

function isNormalizedActivity(value: unknown): value is NormalizedActivity {
	if (!value || typeof value !== "object") return false;
	const item = value as Partial<NormalizedActivity>;
	return (
		typeof item.slug === "string" &&
		item.slug.length > 0 &&
		typeof item.title === "string" &&
		item.title.length > 0
	);
}

function delay(ms: number, signal?: AbortSignal) {
	return new Promise<void>((resolve, reject) => {
		const timer = window.setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				window.clearTimeout(timer);
				reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
			},
			{ once: true },
		);
	});
}

async function fetchWithTimeout(signal?: AbortSignal, timeoutMs = 10_000) {
	const controller = new AbortController();
	const abort = () => controller.abort(signal?.reason);
	if (signal?.aborted) abort();
	else signal?.addEventListener("abort", abort, { once: true });
	const timer = window.setTimeout(() => controller.abort("timeout"), timeoutMs);
	try {
		return await fetch("/api/activity/", {
			method: "GET",
			signal: controller.signal,
		});
	} finally {
		window.clearTimeout(timer);
		signal?.removeEventListener("abort", abort);
	}
}

export async function fetchActivities(
	signal?: AbortSignal,
	retries = 2,
): Promise<ActivityListResponse> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= retries; attempt += 1) {
		try {
			const response = await fetchWithTimeout(signal);
			if (!response.ok)
				throw new Error(`Activity API returned ${response.status}`);
			const payload = (await response.json()) as Partial<ActivityListResponse>;
			const items = Array.isArray(payload.items)
				? payload.items.filter(isNormalizedActivity)
				: [];
			return {
				items,
				total: typeof payload.total === "number" ? payload.total : items.length,
			};
		} catch (error) {
			if (signal?.aborted) throw error;
			lastError = error;
			if (attempt < retries) await delay(400 * 2 ** attempt, signal);
		}
	}
	throw lastError instanceof Error
		? lastError
		: new Error("Activity API request failed");
}
