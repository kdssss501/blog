import type { PostEntry } from "./types";

/**
 * 文章排序规则集中在这里，确保首页、归档、侧栏和 RSS 使用同一顺序。
 * 置顶优先，其次按发布日期倒序，最后用 id 保证同一时间的结果稳定。
 */
export function sortPostEntries(posts: PostEntry[]): PostEntry[] {
	return [...posts].sort((left, right) => {
		if (left.data.pinned !== right.data.pinned) {
			return left.data.pinned ? -1 : 1;
		}
		const dateOrder =
			new Date(right.data.published).getTime() -
			new Date(left.data.published).getTime();
		return dateOrder || left.id.localeCompare(right.id);
	});
}
