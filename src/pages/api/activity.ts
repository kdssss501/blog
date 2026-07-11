import type { APIRoute } from "astro";

interface Activity {
	id: string;
	slug: string;
	content: string;
	createdAt: number;
	updatedAt: number;
}

let activities: Activity[] = [
	{
		id: "1",
		slug: "first-post",
		content: "今天开始使用这个博客记录生活啦！希望能坚持下去，记录每一天的点点滴滴。",
		createdAt: Date.now() - 86400000 * 5,
		updatedAt: Date.now() - 86400000 * 5,
	},
	{
		id: "2",
		slug: "morning-run",
		content: "早起跑步的感觉真好！虽然一开始很痛苦，但跑完步后整个人都精神了。坚持就是胜利！",
		createdAt: Date.now() - 86400000 * 4,
		updatedAt: Date.now() - 86400000 * 4,
	},
	{
		id: "3",
		slug: "coding-night",
		content: "今晚写了一个新功能，虽然遇到了很多坑，但最终还是搞定了。编程的乐趣就在于解决问题的过程！",
		createdAt: Date.now() - 86400000 * 3,
		updatedAt: Date.now() - 86400000 * 3,
	},
	{
		id: "4",
		slug: "anime-watching",
		content: "今天看了《排球少年》第四季，真的太燃了！乌野的每一个人都在努力，没有主角光环只有汗水和坚持。",
		createdAt: Date.now() - 86400000 * 2,
		updatedAt: Date.now() - 86400000 * 2,
	},
	{
		id: "5",
		slug: "reading-time",
		content: "周末终于有空看书了，《人类简史》真的很有意思，让我对人类的发展有了新的认识。",
		createdAt: Date.now() - 86400000,
		updatedAt: Date.now() - 86400000,
	},
	{
		id: "6",
		slug: "coffee-break",
		content: "午后咖啡时光，享受片刻的宁静。生活需要偶尔放慢脚步，好好感受当下。",
		createdAt: Date.now() - 3600000 * 6,
		updatedAt: Date.now() - 3600000 * 6,
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
		return new Response(JSON.stringify(activity), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}

	const sorted = [...activities].sort((a, b) => b.createdAt - a.createdAt);
	return new Response(JSON.stringify({ items: sorted }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};

export const POST: APIRoute = async ({ request }) => {
	try {
		const body = await request.json();
		const { content } = body;

		if (!content || typeof content !== "string" || content.trim() === "") {
			return new Response(JSON.stringify({ error: "Content is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const id = Date.now().toString();
		const slug = "activity-" + id;
		const now = Date.now();

		const newActivity: Activity = {
			id,
			slug,
			content: content.trim(),
			createdAt: now,
			updatedAt: now,
		};

		activities.unshift(newActivity);

		return new Response(JSON.stringify(newActivity), {
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