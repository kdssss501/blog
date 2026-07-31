export type FriendLink = {
	title: string;
	imgurl: string;
	desc: string;
	siteurl: string;
	feedUrl?: string;
	tags?: string[];
	weight: number;
	enabled: boolean;
};

export type FriendSiteInfo = {
	name: string;
	desc: string;
	url: string;
	avatar: string;
	email: string;
};

export type FriendNote = {
	title: string;
	content: string;
};

export type FriendsPageConfig = {
	title?: string;
	description?: string;
	showComment?: boolean;
	randomizeSort?: boolean;
	applyLink?: string;
	siteInfo?: FriendSiteInfo;
	notes?: FriendNote[];
};
