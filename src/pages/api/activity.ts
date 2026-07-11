import type { APIRoute } from "astro";
import {
	createActivitySlug,
	normalizeActivity,
	type ActivityImage,
	type ActivityRecord,
} from "@/utils/activity-content";
import { getDefaultActivities } from "@/utils/activity-presets";

type Activity = ActivityRecord;

let activities: Activity[] = getDefaultActivities();

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
