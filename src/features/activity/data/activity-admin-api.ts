import type { ActivityImage, ActivityRecord } from "../model/activity-content";

export type ActivityAdminInput = {
	title: string;
	excerpt: string;
	content: string;
	images: ActivityImage[];
};

export class ActivityAdminApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "ActivityAdminApiError";
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
		throw new ActivityAdminApiError(
			payload.error || `Activity API returned ${response.status}`,
			response.status,
		);
	}
	return payload;
}

export async function verifyActivityAdminToken(token: string) {
	await adminRequest<{ authenticated: true }>(
		"/api/activity/admin-check/",
		token,
	);
}

export async function fetchAdminActivities(token: string) {
	const payload = await adminRequest<{
		items?: ActivityRecord[];
		total?: number;
	}>("/api/activity/", token);
	return Array.isArray(payload.items) ? payload.items : [];
}

export async function saveAdminActivity(
	token: string,
	input: ActivityAdminInput,
	slug?: string,
) {
	const url = slug
		? `/api/activity/?slug=${encodeURIComponent(slug)}`
		: "/api/activity/";
	return adminRequest<ActivityRecord>(url, token, {
		method: slug ? "PUT" : "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
}

export async function deleteAdminActivity(token: string, slug: string) {
	await adminRequest<{ success: true }>(
		`/api/activity/?slug=${encodeURIComponent(slug)}`,
		token,
		{ method: "DELETE" },
	);
}
