import type { GuestbookMessage } from "@/types/guestbook";

const BASE = "/api/guestbook/";

interface ListResponse {
	messages: GuestbookMessage[];
	total: number;
}

export async function fetchGuestbookMessages(
	offset = 0,
	limit = 5,
): Promise<ListResponse> {
	const res = await fetch(`${BASE}?offset=${offset}&limit=${limit}`);
	if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
	return res.json();
}

export async function fetchGuestbookMessage(
	id: string,
): Promise<GuestbookMessage> {
	const res = await fetch(`${BASE}/${id}`);
	if (!res.ok) throw new Error(`Failed to fetch message: ${res.status}`);
	return res.json();
}

export async function postGuestbookMessage(
	author: string,
	content: string,
): Promise<GuestbookMessage> {
	const res = await fetch(BASE, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ author, content }),
	});
	if (!res.ok) {
		const text = await res.text();
		let errorMessage = `Failed to post message: ${res.status}`;
		try {
			const json = JSON.parse(text);
			if (json.error) errorMessage = json.error;
		} catch {
			// 非 JSON 响应，使用默认错误信息
		}
		const error = new Error(errorMessage) as Error & { status: number };
		error.status = res.status;
		throw error;
	}
	return res.json();
}

export async function voteGuestbookMessage(
	id: string,
	type: "agree" | "disagree" | "neutral",
): Promise<GuestbookMessage> {
	const res = await fetch(`${BASE}/${id}/vote`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ type }),
	});
	if (!res.ok) throw new Error(`Failed to vote: ${res.status}`);
	return res.json();
}
