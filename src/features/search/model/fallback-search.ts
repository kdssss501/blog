import type { SearchResult } from "@/global";

export interface FallbackSearchPost {
	id: string;
	title: string;
	description?: string;
	category?: string;
	password?: boolean;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

export function filterFallbackPosts(
	posts: FallbackSearchPost[],
	query: string,
	limit = 20,
): SearchResult[] {
	const keyword = query.trim().toLocaleLowerCase();
	if (!keyword) return [];

	return posts
		.filter((post) => {
			const haystack = [post.title, post.description, post.category]
				.filter(Boolean)
				.join(" ")
				.toLocaleLowerCase();
			return haystack.includes(keyword);
		})
		.slice(0, limit)
		.map((post) => ({
			url: `/posts/${post.id
				.split("/")
				.map((segment) => encodeURIComponent(segment))
				.join("/")}/`,
			meta: { title: escapeHtml(post.title) },
			excerpt: escapeHtml(
				post.description?.trim() ||
					(post.password ? "这是一篇受密码保护的文章。" : "暂无文章简介。"),
			),
		}));
}
