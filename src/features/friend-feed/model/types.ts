export interface FriendFeedSource {
	id: string;
	name: string;
	siteUrl: string;
	feedUrl: string;
	avatar: string;
}

export interface FriendFeedEntry {
	id: string;
	sourceId: string;
	sourceName: string;
	sourceUrl: string;
	sourceAvatar: string;
	title: string;
	url: string;
	publishedAt: string;
	excerpt: string;
}

export interface FriendFeedResponse {
	entries: FriendFeedEntry[];
	sources: FriendFeedSource[];
	failures: string[];
	updatedAt: string;
	stale?: boolean;
}
