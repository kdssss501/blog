export interface GuestbookMessage {
	id: string;
	author: string;
	content: string;
	time: string;
	createdAt: number;
	votes: {
		agree: number;
		disagree: number;
		neutral: number;
	};
}

// KV 数据结构设计（预留）
// key:   guestbook:msg:{id}
// value: GuestbookMessage (JSON)
// index: guestbook:list -> id[] (按 createdAt 倒序)

export const mockGuestbookMessages: GuestbookMessage[] = [
	{
		id: "msg_001",
		author: "访客_A7B2",
		content:
			"博客设计得非常精美，暗色主题配合渐变效果很有科技感。特别喜欢文章页面的排版，阅读体验很棒！",
		time: "2 小时前",
		createdAt: Date.now() - 2 * 60 * 60 * 1000,
		votes: { agree: 87, disagree: 3, neutral: 12 },
	},
	{
		id: "msg_002",
		author: "CODE_WALKER",
		content:
			"技术文章质量很高，Astro + Svelte 的组合确实很适合构建静态博客。希望能多分享一些性能优化的经验。",
		time: "5 小时前",
		createdAt: Date.now() - 5 * 60 * 60 * 1000,
		votes: { agree: 64, disagree: 5, neutral: 21 },
	},
	{
		id: "msg_003",
		author: "匿名用户",
		content:
			"第一次来访就被首页的动画效果吸引了。请问这些特效是用的什么库实现的？看起来很流畅。",
		time: "1 天前",
		createdAt: Date.now() - 24 * 60 * 60 * 1000,
		votes: { agree: 42, disagree: 2, neutral: 18 },
	},
	{
		id: "msg_004",
		author: "DESIGN_LOVER",
		content:
			"整体风格统一，配色舒适。建议可以增加一个文章系列功能，方便追踪连载内容。",
		time: "2 天前",
		createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
		votes: { agree: 55, disagree: 8, neutral: 31 },
	},
	{
		id: "msg_005",
		author: "夜猫子程序员",
		content:
			"深夜刷到你的博客，内容很有深度。关于那篇 WebGL 的文章帮我解决了一个大问题，感谢分享！",
		time: "3 天前",
		createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
		votes: { agree: 103, disagree: 1, neutral: 9 },
	},
	{
		id: "msg_006",
		author: "STARDUST",
		content:
			"留言板的交互方式很新颖，这种卡片拖拽的设计让人忍不住想多留几条言。期待更多更新！",
		time: "4 天前",
		createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
		votes: { agree: 76, disagree: 4, neutral: 15 },
	},
	{
		id: "msg_007",
		author: "前端小白",
		content:
			"作为一个刚入门的前端开发者，你的博客给了我很多启发。希望能坚持更新，我会一直关注的。",
		time: "5 天前",
		createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
		votes: { agree: 38, disagree: 0, neutral: 22 },
	},
	{
		id: "msg_008",
		author: "BUG_HUNTER",
		content:
			"发现了一个小问题：在移动端 Safari 上，代码块的横向滚动有点卡顿。其他都很完美！",
		time: "1 周前",
		createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
		votes: { agree: 29, disagree: 6, neutral: 44 },
	},
];
