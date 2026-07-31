import { createApiUrl } from "@/shared/http";

export interface AdminSessionState {
	authenticated: boolean;
	expiresIn?: number;
	error?: string;
}

async function readSessionResponse(
	response: Response,
): Promise<AdminSessionState> {
	const value = (await response.json().catch(() => ({}))) as AdminSessionState;
	return {
		authenticated: response.ok && value.authenticated === true,
		...(typeof value.expiresIn === "number"
			? { expiresIn: value.expiresIn }
			: {}),
		...(typeof value.error === "string" ? { error: value.error } : {}),
	};
}

export async function checkAdminSession(): Promise<AdminSessionState> {
	return readSessionResponse(
		await fetch(createApiUrl("api", "admin", "session"), {
			credentials: "same-origin",
		}),
	);
}

export async function loginAdminSession(
	token: string,
): Promise<AdminSessionState> {
	return readSessionResponse(
		await fetch(createApiUrl("api", "admin", "session"), {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token }),
		}),
	);
}

export async function logoutAdminSession(): Promise<void> {
	await fetch(createApiUrl("api", "admin", "session"), {
		method: "DELETE",
		credentials: "same-origin",
	});
}
