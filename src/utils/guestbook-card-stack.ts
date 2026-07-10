export interface GuestbookDealState {
	visibleCount: number;
	dealtOffset: number;
	providerCount: number;
	isDealing: boolean;
}

export function shouldDealGuestbookBatch(state: GuestbookDealState): boolean {
	return (
		!state.isDealing &&
		state.visibleCount === 0 &&
		state.dealtOffset < state.providerCount
	);
}
