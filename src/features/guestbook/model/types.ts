export interface GuestbookMessage {
	id: string;
	author: string;
	content: string;
	time: string;
	createdAt: number;
	device?: string;
	role?: "owner" | "visitor";
	avatarUrl?: string;
	replyTo?: string;
	votes: {
		agree: number;
		disagree: number;
		neutral: number;
	};
}
