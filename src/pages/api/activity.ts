import type { APIRoute } from "astro";
import {
	buildGptImageUrl,
	createActivitySlug,
	normalizeActivity,
	type ActivityImage,
	type ActivityRecord,
} from "@/utils/activity-content";

type Activity = ActivityRecord;

let activities: Activity[] = [
	{
		id: "1",
		slug: "first-post",
		title: "博客生活正式开张",
		excerpt: "第一条生活动态，给自己的小角落按下开始键。",
		content: "今天开始使用这个博客记录生活啦！希望能坚持下去，记录每一天的点点滴滴。",
		body: "# 今天开始认真记录生活\n\n这个博客终于被我认真用起来了。\n\n以后想把生活里值得记住的时刻、想到的点子，还有偶尔的小感悟都放在这里。\n\n![桌面上的笔记本和咖啡](" + buildGptImageUrl("realistic cozy desk with notebook, fountain pen and warm coffee near window, soft daylight, lifestyle photography, clean composition", "landscape_4_3") + ")\n\n希望很多年以后回头看，这里会是我很喜欢的一段成长轨迹。",
		createdAt: Date.now() - 86400000 * 5,
		updatedAt: Date.now() - 86400000 * 5,
		images: [
			{
				url: buildGptImageUrl("realistic cozy desk with notebook, fountain pen and warm coffee near window, soft daylight, lifestyle photography, clean composition", "landscape_4_3"),
				alt: "桌面上的笔记本和咖啡",
				source: "gpt",
			},
		],
	},
	{
		id: "2",
		slug: "morning-run",
		title: "早起跑步的回归感",
		excerpt: "跑完之后那种通透感，真的会让人想继续坚持。",
		content: "早起跑步的感觉真好！虽然一开始很痛苦，但跑完步后整个人都精神了。坚持就是胜利！",
		body: "## 早起跑步的感觉真好\n\n虽然起床的时候脑子里全是放弃，但真正出门后，空气和光线会让人一下子清醒。\n\n1. 前 10 分钟最难熬\n2. 跑开之后节奏就顺了\n3. 跑完的心情值会明显上升\n\n![晨光里的城市跑道](" + buildGptImageUrl("realistic morning running track in city park, sunrise glow, fresh air, athletic lifestyle photography, detailed, natural colors", "landscape_16_9") + ")\n\n今天给自己的结论还是老样子：先出门，剩下的交给身体。",
		createdAt: Date.now() - 86400000 * 4,
		updatedAt: Date.now() - 86400000 * 4,
		images: [
			{
				url: buildGptImageUrl("realistic morning running track in city park, sunrise glow, fresh air, athletic lifestyle photography, detailed, natural colors", "landscape_16_9"),
				alt: "晨光里的城市跑道",
				source: "gpt",
			},
		],
	},
	{
		id: "3",
		slug: "coding-night",
		title: "深夜把新功能磨出来了",
		excerpt: "改到最后一刻的成就感，总是比白天来得更直接。",
		content: "今晚写了一个新功能，虽然遇到了很多坑，但最终还是搞定了。编程的乐趣就在于解决问题的过程！",
		body: "## 深夜把新功能磨出来了\n\n今晚真的踩了不少坑，但最后还是把功能闭环跑通了。\n\n> 编程最让人上头的地方，可能就是把一团混乱慢慢理顺的过程。\n\n有几个点记下来，明天回看应该会有帮助：\n\n- 状态流要尽量单向\n- 异步失败路径要先补齐\n- UI 细节不要留到最后才修",
		createdAt: Date.now() - 86400000 * 3,
		updatedAt: Date.now() - 86400000 * 3,
	},
	{
		id: "4",
		slug: "anime-watching",
		title: "排球少年还是一如既往地燃",
		excerpt: "看完以后只会想认真做事，热血番的力量真的很直接。",
		content: "今天看了《排球少年》第四季，真的太燃了！乌野的每一个人都在努力，没有主角光环只有汗水和坚持。",
		body: "## 被《排球少年》再次点燃\n\n第四季还是那个味道：不是靠主角光环，而是靠每个人都在一点点变强。\n\n![热血排球赛场氛围图](" + buildGptImageUrl("dynamic indoor volleyball match, dramatic lighting, energetic sports anime inspired but realistic illustration, team spirit, motion blur", "landscape_16_9") + ")\n\n最喜欢这种会让人看完就想认真生活、认真训练、认真工作的作品。",
		createdAt: Date.now() - 86400000 * 2,
		updatedAt: Date.now() - 86400000 * 2,
		images: [
			{
				url: buildGptImageUrl("dynamic indoor volleyball match, dramatic lighting, energetic sports anime inspired but realistic illustration, team spirit, motion blur", "landscape_16_9"),
				alt: "热血排球赛场氛围图",
				source: "gpt",
			},
		],
	},
	{
		id: "5",
		slug: "reading-time",
		title: "周末读书时间",
		excerpt: "安静看书的几个小时，会把整个人的节奏重新拉慢。",
		content: "周末终于有空看书了，《人类简史》真的很有意思，让我对人类的发展有了新的认识。",
		body: "## 周末读书时间\n\n今天把《人类简史》又往后读了一些，越看越觉得视角很大，很多问题会被重新打开。\n\n- 人类为什么能形成大规模协作\n- 神话、制度和共同想象是怎么运作的\n- 个体在历史里的位置其实很微妙\n\n这种书很适合慢慢读。",
		createdAt: Date.now() - 86400000,
		updatedAt: Date.now() - 86400000,
	},
	{
		id: "6",
		slug: "coffee-break",
		title: "午后留给自己的一小段空白",
		excerpt: "咖啡和一点慢时间，足够把状态重新捡回来。",
		content: "午后咖啡时光，享受片刻的宁静。生活需要偶尔放慢脚步，好好感受当下。",
		body: "## 午后咖啡时光\n\n最近越来越能感受到，节奏放慢一点并不是浪费时间。\n\n![午后咖啡和白色桌面](" + buildGptImageUrl("clean white cafe table with coffee cup, soft afternoon light, minimalist lifestyle photography, calm atmosphere", "landscape_4_3") + ")\n\n有时候一杯咖啡、十几分钟发呆，就足够把状态重新找回来。",
		createdAt: Date.now() - 3600000 * 6,
		updatedAt: Date.now() - 3600000 * 6,
		images: [
			{
				url: buildGptImageUrl("clean white cafe table with coffee cup, soft afternoon light, minimalist lifestyle photography, calm atmosphere", "landscape_4_3"),
				alt: "午后咖啡和白色桌面",
				source: "gpt",
			},
		],
	},
];

export const GET: APIRoute = async ({ url }) => {
	const slug = url.searchParams.get("slug");

	if (slug) {
		const activity = activities.find((a) => a.slug === slug);
		if (!activity) {
			return new Response(JSON.stringify({ error: "Activity not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}
		return new Response(JSON.stringify(normalizeActivity(activity)), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}

	const sorted = [...activities]
		.sort((a, b) => b.createdAt - a.createdAt)
		.map((item) => normalizeActivity(item));
	return new Response(JSON.stringify({ items: sorted }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};

export const POST: APIRoute = async ({ request }) => {
	try {
		const body = await request.json();
		const title = (body.title || "").trim();
		const content = (body.content || "").trim();
		const excerpt = (body.excerpt || "").trim();
		const images = Array.isArray(body.images)
			? body.images.filter((item: ActivityImage) => item?.url)
			: [];

		if (!title || !content) {
			return new Response(JSON.stringify({ error: "Title and content are required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const id = Date.now().toString();
		const baseSlug = createActivitySlug(body.slug || title);
		let slug = baseSlug;
		let suffix = 1;
		while (activities.some((item) => item.slug === slug)) {
			slug = `${baseSlug}-${suffix}`;
			suffix += 1;
		}
		const now = Date.now();

		const newActivity: Activity = {
			id,
			slug,
			title,
			excerpt,
			content: content.trim(),
			body: content.trim(),
			images,
			createdAt: now,
			updatedAt: now,
		};

		activities.unshift(newActivity);

		return new Response(JSON.stringify(normalizeActivity(newActivity)), {
			status: 201,
			headers: { "Content-Type": "application/json" },
		});
	} catch {
		return new Response(JSON.stringify({ error: "Invalid request" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}
};

export const PUT: APIRoute = async ({ request, url }) => {
	try {
		const slug = url.searchParams.get("slug");
		if (!slug) {
			return new Response(JSON.stringify({ error: "Slug is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const target = activities.find((item) => item.slug === slug);
		if (!target) {
			return new Response(JSON.stringify({ error: "Activity not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		const body = await request.json();
		const title = (body.title || target.title || "").trim();
		const content = (body.content || target.body || target.content || "").trim();

		if (!title || !content) {
			return new Response(JSON.stringify({ error: "Title and content are required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		target.title = title;
		target.excerpt = (body.excerpt || target.excerpt || "").trim();
		target.content = content;
		target.body = content;
		target.images = Array.isArray(body.images)
			? body.images.filter((item: ActivityImage) => item?.url)
			: target.images || [];
		target.updatedAt = Date.now();

		return new Response(JSON.stringify(normalizeActivity(target)), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch {
		return new Response(JSON.stringify({ error: "Invalid request" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}
};

export const DELETE: APIRoute = async ({ url }) => {
	const slug = url.searchParams.get("slug");
	if (!slug) {
		return new Response(JSON.stringify({ error: "Slug is required" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const index = activities.findIndex((a) => a.slug === slug);
	if (index === -1) {
		return new Response(JSON.stringify({ error: "Activity not found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	activities.splice(index, 1);

	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};
