export default {
	name: "kdssss的博客",
	logo: "/favicon/favicon.svg",
	locale: "zh-CN",
	collections: [
		{
			name: "posts",
			label: "文章",
			path: "src/content/posts",
			format: "mdx",
			fields: [
				{
					name: "title",
					label: "标题",
					type: "string",
					required: true,
				},
				{
					name: "published",
					label: "发布日期",
					type: "date",
					required: true,
				},
				{
					name: "description",
					label: "描述",
					type: "text",
				},
				{
					name: "category",
					label: "分类",
					type: "string",
				},
				{
					name: "tags",
					label: "标签",
					type: "array",
					items: { type: "string" },
				},
				{
					name: "image",
					label: "封面图片",
					type: "image",
				},
				{
					name: "pinned",
					label: "置顶",
					type: "boolean",
					default: false,
				},
				{
					name: "password",
					label: "加密密码（留空不加密）",
					type: "string",
				},
			],
		},
		{
			name: "friends",
			label: "友链",
			path: "src/content/friends",
			format: "mdx",
			fields: [
				{
					name: "title",
					label: "站点名称",
					type: "string",
					required: true,
				},
				{
					name: "url",
					label: "站点地址",
					type: "string",
					required: true,
				},
				{
					name: "avatar",
					label: "头像",
					type: "image",
				},
				{
					name: "description",
					label: "描述",
					type: "text",
				},
				{
					name: "tags",
					label: "标签",
					type: "array",
					items: { type: "string" },
				},
			],
		},
		{
			name: "gallery",
			label: "相册",
			path: "src/content/gallery",
			format: "mdx",
			fields: [
				{
					name: "title",
					label: "相册名称",
					type: "string",
					required: true,
				},
				{
					name: "date",
					label: "日期",
					type: "date",
					required: true,
				},
				{
					name: "images",
					label: "图片列表",
					type: "array",
					items: { type: "image" },
				},
				{
					name: "description",
					label: "描述",
					type: "text",
				},
			],
		},
	],
};