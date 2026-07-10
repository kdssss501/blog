import type { GuestbookMessage } from "@/types/guestbook";

export interface GuestbookCacheState {
	messages: GuestbookMessage[];
	total: number;
	hasMore: boolean;
	isInitialized: boolean;
}

export function createGuestbookCacheState(): GuestbookCacheState {
	return {
		messages: [],
		total: 0,
		hasMore: true,
		isInitialized: false,
	};
}

export function getNextGuestbookOffset(state: GuestbookCacheState): number {
	return state.messages.length;
}

function getMessageNumber(message: GuestbookMessage): number {
	const match = message.id.match(/(\d+)$/);
	return match ? Number(match[1]) : 0;
}

function sortGuestbookMessages(
	messages: GuestbookMessage[],
): GuestbookMessage[] {
	return [...messages].sort((a, b) => {
		const numberDiff = getMessageNumber(b) - getMessageNumber(a);
		if (numberDiff !== 0) return numberDiff;
		return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
	});
}

export function applyGuestbookPage(
	state: GuestbookCacheState,
	messages: GuestbookMessage[],
	total: number,
): void {
	const existingIds = new Set(state.messages.map((message) => message.id));
	const newMessages = messages.filter(
		(message) => !existingIds.has(message.id),
	);

	state.messages = sortGuestbookMessages([...state.messages, ...newMessages]);
	state.total = total;
	state.hasMore = state.messages.length < total;
	state.isInitialized = true;
}

export function upsertGuestbookMessage(
	state: GuestbookCacheState,
	message: GuestbookMessage,
): void {
	const index = state.messages.findIndex((item) => item.id === message.id);
	if (index === -1) {
		state.messages = sortGuestbookMessages([...state.messages, message]);
		state.total += 1;
	} else {
		state.messages = sortGuestbookMessages(
			state.messages.map((item, itemIndex) =>
				itemIndex === index ? message : item,
			),
		);
	}
	state.hasMore = state.messages.length < state.total;
}

export function prependGuestbookMessage(
	state: GuestbookCacheState,
	message: GuestbookMessage,
): void {
	const existingIndex = state.messages.findIndex(
		(item) => item.id === message.id,
	);
	if (existingIndex !== -1) {
		state.messages = sortGuestbookMessages(
			state.messages.map((item) => (item.id === message.id ? message : item)),
		);
		return;
	}

	state.messages = sortGuestbookMessages([message, ...state.messages]);
	state.total += 1;
	state.hasMore = state.messages.length < state.total;
}
