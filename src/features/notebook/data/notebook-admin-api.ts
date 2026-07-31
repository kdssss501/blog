import type { NotebookEntry, NotebookListResponse } from "../model/types";

export type NotebookAdminInput = Pick<
	NotebookEntry,
	"title" | "date" | "notebook" | "content" | "cover"
>;

export class NotebookAdminApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "NotebookAdminApiError";
	}
}

async function adminRequest<T>(
	url: string,
	token: string,
	options: RequestInit = {},
): Promise<T> {
	const response = await fetch(url, {
		...options,
		headers: {
			...options.headers,
			Authorization: `Bearer ${token}`,
		},
	});
	const payload = (await response.json().catch(() => ({}))) as T & {
		error?: string;
	};
	if (!response.ok) {
		throw new NotebookAdminApiError(
			payload.error || `Notebook API returned ${response.status}`,
			response.status,
		);
	}
	return payload;
}

export async function verifyNotebookAdminToken(token: string) {
	await adminRequest<{ authenticated: true }>(
		"/api/notebook/admin-check/",
		token,
	);
}

export async function fetchAdminNotebookEntries(
	token: string,
	notebook?: string,
) {
	const query = notebook ? `?notebook=${encodeURIComponent(notebook)}` : "";
	const payload = await adminRequest<NotebookListResponse>(
		`/api/notebook/${query}`,
		token,
	);
	return Array.isArray(payload.entries) ? payload.entries : [];
}

export async function saveAdminNotebookEntry(
	token: string,
	input: NotebookAdminInput,
	id?: string,
) {
	return adminRequest<NotebookEntry>(
		id ? `/api/notebook/${encodeURIComponent(id)}/` : "/api/notebook/",
		token,
		{
			method: id ? "PUT" : "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(input),
		},
	);
}

export async function deleteAdminNotebookEntry(token: string, id: string) {
	await adminRequest<{ success: true }>(
		`/api/notebook/${encodeURIComponent(id)}/`,
		token,
		{ method: "DELETE" },
	);
}
