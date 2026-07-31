import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { ARTWORK_PERMISSIONS, ARTWORK_THEMES } from "./shared/content/artwork";

const postsCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
	schema: z
		.object({
			title: z.string(),
			published: z.date(),
			updated: z.date().optional(),
			draft: z.boolean().optional().default(false),
			description: z.string().optional().default(""),
			image: z.string().optional().default(""),
			imageAttribution: z
				.object({
					artist: z.string().min(1),
					sourceUrl: z.url(),
					license: z.string().min(1),
					permission: z.enum(ARTWORK_PERMISSIONS),
					theme: z.enum(ARTWORK_THEMES),
				})
				.optional(),
			tags: z.array(z.string()).optional().default([]),
			category: z.string().optional().nullable().default(""),
			lang: z.string().optional().default(""),
			pinned: z.boolean().optional().default(false),
			author: z.string().optional().default(""),
			sourceLink: z.string().optional().default(""),
			licenseName: z.string().optional().default(""),
			licenseUrl: z.string().optional().default(""),
			comment: z.boolean().optional().default(true),
			password: z.string().optional().default(""),
			passwordHint: z.string().optional().default(""),

			/* For internal use */
			prevTitle: z.string().default(""),
			prevSlug: z.string().default(""),
			nextTitle: z.string().default(""),
			nextSlug: z.string().default(""),
		})
		.superRefine((post, context) => {
			if (/(?:pixiv\.net|pximg\.net)/i.test(post.image)) {
				context.addIssue({
					code: "custom",
					path: ["image"],
					message:
						"禁止直接热链 Pixiv 图片；请使用获得授权的本地副本，并在 imageAttribution 中声明来源。",
				});
			}
			if (
				/(?:^|[\\/])illustrations[\\/]/i.test(post.image) &&
				!post.imageAttribution
			) {
				context.addIssue({
					code: "custom",
					path: ["imageAttribution"],
					message: "插图目录中的图片必须声明画师、来源、许可状态和主题。",
				});
			}
		}),
});

const specCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/spec" }),
	schema: z.object({}),
});

const bangumiCollection = defineCollection({
	loader: glob({
		pattern: "**/*.{md,mdx,yaml,yml}",
		base: "./src/content/bangumi",
	}),
	schema: z
		.object({
			title: z.string().min(1),
			name_cn: z.string().optional().default(""),
			category: z
				.enum([
					"book",
					"anime",
					"movie",
					"tv",
					"documentary",
					"game",
					"music",
					"real",
				])
				.default("anime"),
			subcategory: z.enum(["movie", "tv", "anime", "documentary"]).optional(),
			status: z.number().int().min(1).max(5).default(1),
			image: z.string().optional().default(""),
			link: z.string().optional().default(""),
			score: z.number().min(0).max(10).optional(),
			comment: z.string().optional().default(""),
			tags: z.array(z.string()).optional().default([]),
			published: z.coerce.date().optional(),
			artist: z.string().optional().default(""),
			audioUrl: z.string().optional().default(""),
			lrcUrl: z.string().optional().default(""),
			metingServer: z.string().optional().default(""),
			metingId: z.string().optional().default(""),
		})
		.superRefine((entry, context) => {
			if (/(?:pixiv\.net|pximg\.net)/i.test(entry.image)) {
				context.addIssue({
					code: "custom",
					path: ["image"],
					message: "记录封面不得直接热链 Pixiv 图片，请改用已授权本地文件。",
				});
			}
		}),
});

const changelogCollection = defineCollection({
	loader: glob({
		pattern: "**/*.{md,mdx}",
		base: "./src/content/changelog",
	}),
	schema: z.object({
		version: z.string().min(1),
		date: z.coerce.date(),
		time: z.string().optional().default(""),
		type: z.enum(["feature", "improvement", "fix", "removal"]),
		description: z.string().min(1),
	}),
});

const routinesCollection = defineCollection({
	loader: glob({
		pattern: "**/*.{md,mdx}",
		base: "./src/content/life/routines",
	}),
	schema: z.object({
		name: z.string().min(1),
		time: z.string().optional().default(""),
		description: z.string().optional().default(""),
		icon: z
			.string()
			.optional()
			.default("material-symbols:event-note-outline-rounded"),
		color: z.string().optional().default(""),
		updatedAt: z.coerce.date().optional(),
	}),
});

const placesCollection = defineCollection({
	loader: glob({
		pattern: "**/*.{md,mdx}",
		base: "./src/content/life/places",
	}),
	schema: z.object({
		title: z.string().min(1),
		province: z.string().optional().default(""),
		city: z.string().optional().default(""),
		experience: z.string().optional().default(""),
		visitCount: z.number().int().positive().optional().default(1),
		date: z.coerce.date().optional(),
		lat: z.number().optional(),
		lng: z.number().optional(),
	}),
});

const albumCollection = defineCollection({
	loader: glob({
		pattern: "**/*.{md,mdx,json}",
		base: "./src/content/album",
	}),
	schema: z.object({
		title: z.string().min(1),
		subtitle: z.string().optional().default(""),
		cover: z.string().optional().default(""),
		date: z.coerce.date(),
		location: z.string().optional().default(""),
		photos: z
			.array(
				z.union([
					z.string(),
					z.object({
						src: z.string(),
						alt: z.string().optional().default(""),
						caption: z.string().optional().default(""),
						artworkId: z.string().optional().default(""),
						artist: z.string().optional().default(""),
						sourceUrl: z.url().optional(),
						sensitive: z.boolean().optional().default(false),
					}),
				]),
			)
			.optional()
			.default([]),
		tags: z.array(z.string()).optional().default([]),
		contentRating: z
			.enum(["all-ages", "mixed", "adult"])
			.optional()
			.default("all-ages"),
		draft: z.boolean().optional().default(false),
	}),
});

const momentsCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/moments" }),
	schema: z.object({
		title: z.string().optional().default(""),
		slug: z.string().optional().default(""),
		author: z.string().optional().default(""),
		avatar: z.string().optional().default(""),
		published: z.coerce.date(),
		updated: z.coerce.date().optional(),
		draft: z.boolean().optional().default(false),
		images: z
			.union([z.array(z.string()), z.string()])
			.optional()
			.default([]),
		tags: z.array(z.string()).optional().default([]),
		location: z.string().optional().default(""),
		device: z.string().optional().default(""),
	}),
});

const notebooksCollection = defineCollection({
	loader: glob({
		pattern: "**/*.{md,mdx,json}",
		base: "./src/content/life/notebooks",
	}),
	schema: z.object({
		title: z.string().optional().default(""),
		notebook: z.string().optional().default(""),
		name: z.string().optional().default(""),
		cover: z.string().optional().default(""),
		summary: z.string().optional().default(""),
		date: z.coerce.date().optional(),
		updated: z.coerce.date().optional(),
		tags: z.array(z.string()).optional().default([]),
		draft: z.boolean().optional().default(false),
	}),
});

const danmuCollection = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/danmu" }),
	schema: z.object({
		nickname: z.string(),
		avatar: z.string().optional().default(""),
		time: z.string().optional().default(""),
	}),
});

const navigationCollection = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/daohang" }),
	schema: z.object({
		name: z.string(),
		url: z.string(),
		icon: z.string().optional().default(""),
		description: z.string().optional().default(""),
		category: z.string().optional().default("未分类"),
		tags: z.array(z.string()).optional().default([]),
		color: z.string().optional().default(""),
		image: z.string().optional().default(""),
		featured: z.boolean().optional().default(false),
		order: z.number().optional().default(0),
	}),
});

const resourcesCollection = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/ziyuan" }),
	schema: z.looseObject({}),
});

const friendsCollection = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/friends" }),
	schema: z.object({
		title: z.string(),
		imgurl: z.string(),
		desc: z.string(),
		siteurl: z.string(),
		tags: z.array(z.string()).optional().default([]),
		weight: z.number().optional().default(0),
		enabled: z.boolean().optional().default(true),
	}),
});

export const collections = {
	album: albumCollection,
	bangumi: bangumiCollection,
	changelog: changelogCollection,
	danmu: danmuCollection,
	friends: friendsCollection,
	moments: momentsCollection,
	navigation: navigationCollection,
	notebooks: notebooksCollection,
	places: placesCollection,
	posts: postsCollection,
	resources: resourcesCollection,
	routines: routinesCollection,
	spec: specCollection,
};
