import type { NotebookEntry, NotebookListResponse } from "../model/types";

export type FetchNotebookEntriesOptions = {
	notebook?: string;
	signal?: AbortSignal;
	timeoutMs?: number;
	retries?: number;
};

function isNotebookEntry(value: unknown): value is NotebookEntry {
	if (!value || typeof value !== "object") return false;
	const entry = value as Partial<NotebookEntry>;
	return (
		typeof entry.id === "string" &&
		typeof entry.notebook === "string" &&
		typeof entry.title === "string" &&
		typeof entry.date === "string" &&
		typeof entry.content === "string" &&
		typeof entry.cover === "string" &&
		typeof entry.createdAt === "number" &&
		typeof entry.updatedAt === "number"
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

async function fetchWithTimeout(
	url: string,
	{
		signal,
		timeoutMs = 10_000,
	}: Pick<FetchNotebookEntriesOptions, "signal" | "timeoutMs">,
) {
	const controller = new AbortController();
	const abort = () => controller.abort(signal?.reason);
	if (signal?.aborted) abort();
	else signal?.addEventListener("abort", abort, { once: true });
	const timer = window.setTimeout(() => controller.abort("timeout"), timeoutMs);

	try {
		return await fetch(url, { method: "GET", signal: controller.signal });
	} finally {
		window.clearTimeout(timer);
		signal?.removeEventListener("abort", abort);
	}
}

export async function fetchNotebookEntries({
	notebook,
	signal,
	timeoutMs = 10_000,
	retries = 2,
}: FetchNotebookEntriesOptions = {}): Promise<NotebookListResponse> {
	const query = notebook ? `?notebook=${encodeURIComponent(notebook)}` : "";
	let lastError: unknown;

	for (let attempt = 0; attempt <= retries; attempt += 1) {
		try {
			const response = await fetchWithTimeout(`/api/notebook/${query}`, {
				signal,
				timeoutMs,
			});
			if (!response.ok) {
				throw new Error(`Notebook API returned ${response.status}`);
			}
			const payload = (await response.json()) as Partial<NotebookListResponse>;
			const entries = Array.isArray(payload.entries)
				? payload.entries.filter(isNotebookEntry)
				: [];
			return {
				entries,
				total:
					typeof payload.total === "number" ? payload.total : entries.length,
			};
		} catch (error) {
			if (signal?.aborted) throw error;
			lastError = error;
			if (attempt < retries) await delay(400 * 2 ** attempt, signal);
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error("Notebook API request failed");
}
