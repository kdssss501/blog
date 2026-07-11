import {
	getStorage,
	storageGetJSON,
	storageSetJSON,
	storageGetList,
	storageSetList,
	type StorageAdapter,
} from "./_storage";
import {
	buildGptImageUrl,
	createActivitySlug,
	normalizeActivity,
	type ActivityImage,
	type ActivityRecord,
} from "../src/utils/activity-content";

export interface Env {
	DB?: any;
	VISITOR_KV?: KVNamespace;
}

interface TreeholeMessage {
	id: string;
	content: string;
	createdAt: number;
	status: "approved" | "pending" | "rejected";
	resonance: number;
	replies: Array<{
		id: string;
		content: string;
		createdAt: number;
		status: "approved" | "pending" | "rejected";
		resonance: number;
	}>;
}

interface GuestbookMessage {
	id: string;
	author: string;
	content: string;
	time: string;
	createdAt: number;
	votes: { agree: number; disagree: number; neutral: number };
}

interface NotebookEntry {
	id: string;
	notebook: string;
	title: string;
	date: string;
	content: string;
	cover: string;
	createdAt: number;
	updatedAt: number;
}

type Activity = ActivityRecord;

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

// ============ 存储辅助函数 ============

async function getTreeholeList(s: StorageAdapter): Promise<string[]> {
	return storageGetList(s, "treehole:list");
}
async function setTreeholeList(s: StorageAdapter, ids: string[]): Promise<void> {
	await storageSetList(s, "treehole:list", ids);
}
async function getTreeholeMessage(s: StorageAdapter, id: string): Promise<TreeholeMessage | null> {
	return storageGetJSON<TreeholeMessage>(s, `treehole:msg:${id}`);
}
async function setTreeholeMessage(s: StorageAdapter, id: string, msg: TreeholeMessage): Promise<void> {
	await storageSetJSON(s, `treehole:msg:${id}`, msg);
}
async function getTreeholeNextId(s: StorageAdapter): Promise<string> {
	const counter = Number((await s.get("treehole:counter")) || "0") + 1;
	await s.set("treehole:counter", String(counter));
	return `th_${String(counter).padStart(3, "0")}`;
}

async function getGuestbookList(s: StorageAdapter): Promise<string[]> {
	return storageGetList(s, "guestbook:list");
}
async function setGuestbookList(s: StorageAdapter, ids: string[]): Promise<void> {
	await storageSetList(s, "guestbook:list", ids);
}
async function getGuestbookMessage(s: StorageAdapter, id: string): Promise<GuestbookMessage | null> {
	return storageGetJSON<GuestbookMessage>(s, `guestbook:msg:${id}`);
}
async function setGuestbookMessage(s: StorageAdapter, id: string, msg: GuestbookMessage): Promise<void> {
	await storageSetJSON(s, `guestbook:msg:${id}`, msg);
}
async function getGuestbookNextId(s: StorageAdapter): Promise<string> {
	const counter = Number((await s.get("guestbook:counter")) || "0") + 1;
	await s.set("guestbook:counter", String(counter));
	return `msg_${String(counter).padStart(3, "0")}`;
}

async function getNotebookList(s: StorageAdapter): Promise<string[]> {
	return storageGetList(s, "notebook:list");
}
async function setNotebookList(s: StorageAdapter, ids: string[]): Promise<void> {
	await storageSetList(s, "notebook:list", ids);
}
async function getNotebookEntry(s: StorageAdapter, id: string): Promise<NotebookEntry | null> {
	return storageGetJSON<NotebookEntry>(s, `notebook:entry:${id}`);
}
async function setNotebookEntry(s: StorageAdapter, id: string, entry: NotebookEntry): Promise<void> {
	await storageSetJSON(s, `notebook:entry:${id}`, entry);
}
async function getNotebookNextId(s: StorageAdapter): Promise<string> {
	const counter = Number((await s.get("notebook:counter")) || "0") + 1;
	await s.set("notebook:counter", String(counter));
	return `nb_${String(counter).padStart(3, "0")}`;
}

async function getActivityList(s: StorageAdapter): Promise<string[]> {
	return storageGetList(s, "activity:list");
}
async function setActivityList(s: StorageAdapter, ids: string[]): Promise<void> {
	await storageSetList(s, "activity:list", ids);
}
async function getActivity(s: StorageAdapter, slug: string): Promise<Activity | null> {
	return storageGetJSON<Activity>(s, `activity:item:${slug}`);
}
async function setActivity(s: StorageAdapter, slug: string, activity: Activity): Promise<void> {
	await storageSetJSON(s, `activity:item:${slug}`, activity);
}

function getDefaultActivities(): Activity[] {
	return [
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
					prompt: "realistic cozy desk with notebook, fountain pen and warm coffee near window, soft daylight, lifestyle photography, clean composition",
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
					prompt: "realistic morning running track in city park, sunrise glow, fresh air, athletic lifestyle photography, detailed, natural colors",
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
					prompt: "dynamic indoor volleyball match, dramatic lighting, energetic sports anime inspired but realistic illustration, team spirit, motion blur",
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
					prompt: "clean white cafe table with coffee cup, soft afternoon light, minimalist lifestyle photography, calm atmosphere",
					source: "gpt",
				},
			],
		},
	];
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;
		const method = request.method;
		const storage = getStorage(env);

		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		};

		if (method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		try {
			if (pathname.startsWith("/api/treehole")) {
				return await handleTreehole(storage, request, url, pathname, method);
			}

			if (pathname.startsWith("/api/guestbook")) {
				return await handleGuestbook(storage, request, url, pathname, method);
			}

			if (pathname.startsWith("/api/notebook")) {
				return await handleNotebook(storage, request, url, pathname, method);
			}

			if (pathname.startsWith("/api/activity")) {
				return await handleActivity(storage, request, url, pathname, method);
			}

			return new Response("Not Found", { status: 404 });
		} catch (err) {
			console.error("[API Error]", err);
			return new Response(JSON.stringify({ error: String(err) }), {
				status: 500,
				headers: { "Content-Type": "application/json", ...corsHeaders },
			});
		}
	},
};

async function handleTreehole(
	storage: StorageAdapter,
	request: Request,
	url: URL,
	pathname: string,
	method: string
): Promise<Response> {
	const parts = pathname.split("/").filter(Boolean);

	if (method === "GET") {
		if (parts.length === 2) {
			const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
			const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit")) || 10));
			const ids = await getTreeholeList(storage);
			const pageIds = ids.slice(offset, offset + limit);
			const messages: TreeholeMessage[] = [];
			for (const id of pageIds) {
				const msg = await getTreeholeMessage(storage, id);
				if (msg) messages.push(msg);
			}
			const visible = messages
				.filter((m) => m.status === "approved")
				.map((m) => ({
					...m,
					replies: (m.replies || []).filter((r) => r.status === "approved"),
				}));
			return new Response(JSON.stringify({ messages: visible, total: ids.length }), {
				headers: { "Content-Type": "application/json" },
			});
		}

		if (parts.length === 3) {
			const id = parts[2];
			const msg = await getTreeholeMessage(storage, id);
			if (!msg || msg.status !== "approved") {
				return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
			}
			return new Response(JSON.stringify(msg), {
				headers: { "Content-Type": "application/json" },
			});
		}
	}

	if (method === "POST") {
		if (parts.length === 2) {
			const body = await request.json().catch(() => ({}));
			const content = escapeHtml((body.content || "").trim());
			if (!content) {
				return new Response(JSON.stringify({ error: "content is required" }), { status: 400 });
			}

			const id = await getTreeholeNextId(storage);
			const msg: TreeholeMessage = {
				id,
				content,
				createdAt: Date.now(),
				status: "approved",
				resonance: 0,
				replies: [],
			};

			await setTreeholeMessage(storage, id, msg);
			const ids = await getTreeholeList(storage);
			ids.unshift(id);
			await setTreeholeList(storage, ids);

			return new Response(JSON.stringify(msg), {
				status: 201,
				headers: { "Content-Type": "application/json" },
			});
		}

		if (parts.length === 4 && parts[3] === "resonance") {
			const id = parts[2];
			const msg = await getTreeholeMessage(storage, id);
			if (!msg || msg.status !== "approved") {
				return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
			}

			msg.resonance = (msg.resonance || 0) + 1;
			await setTreeholeMessage(storage, id, msg);

			return new Response(JSON.stringify({ id, resonance: msg.resonance }), {
				headers: { "Content-Type": "application/json" },
			});
		}

		if (parts.length === 4 && parts[3] === "reply") {
			const id = parts[2];
			const msg = await getTreeholeMessage(storage, id);
			if (!msg || msg.status !== "approved") {
				return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
			}

			const body = await request.json().catch(() => ({}));
			const content = escapeHtml((body.content || "").trim());
			if (!content) {
				return new Response(JSON.stringify({ error: "content is required" }), { status: 400 });
			}

			const replyId = `r_${Date.now()}`;
			msg.replies = msg.replies || [];
			msg.replies.push({
				id: replyId,
				content,
				createdAt: Date.now(),
				status: "approved",
				resonance: 0,
			});
			await setTreeholeMessage(storage, id, msg);

			return new Response(JSON.stringify({ id, content, hint: "回复成功" }), {
				headers: { "Content-Type": "application/json" },
			});
		}
	}

	return new Response("Not Found", { status: 404 });
}

async function handleGuestbook(
	storage: StorageAdapter,
	request: Request,
	url: URL,
	pathname: string,
	method: string
): Promise<Response> {
	const parts = pathname.split("/").filter(Boolean);

	if (method === "GET") {
		if (parts.length === 2) {
			const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
			const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit")) || 5));
			const ids = await getGuestbookList(storage);
			const pageIds = ids.slice(offset, offset + limit);
			const messages: GuestbookMessage[] = [];
			for (const id of pageIds) {
				const msg = await getGuestbookMessage(storage, id);
				if (msg) messages.push(msg);
			}
			return new Response(JSON.stringify({ messages, total: ids.length }), {
				headers: { "Content-Type": "application/json" },
			});
		}

		if (parts.length === 3) {
			const msg = await getGuestbookMessage(storage, parts[2]);
			if (!msg) {
				return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
			}
			return new Response(JSON.stringify(msg), {
				headers: { "Content-Type": "application/json" },
			});
		}
	}

	if (method === "POST") {
		if (parts.length === 2) {
			const body = await request.json().catch(() => ({}));
			const rawAuthor = (body.author || "").trim();
			const rawContent = (body.content || "").trim();

			if (!rawAuthor || !rawContent) {
				return new Response(
					JSON.stringify({ error: "author and content are required" }),
					{ status: 400 }
				);
			}

			const author = escapeHtml(rawAuthor);
			const content = escapeHtml(rawContent);
			const id = await getGuestbookNextId(storage);
			const now = Date.now();
			const message: GuestbookMessage = {
				id,
				author,
				content,
				time: "刚刚",
				createdAt: now,
				votes: { agree: 0, disagree: 0, neutral: 0 },
			};

			await setGuestbookMessage(storage, id, message);
			const ids = await getGuestbookList(storage);
			ids.unshift(id);
			await setGuestbookList(storage, ids);

			return new Response(JSON.stringify(message), {
				status: 201,
				headers: { "Content-Type": "application/json" },
			});
		}

		if (parts.length === 4 && parts[3] === "vote") {
			const id = parts[2];
			const msg = await getGuestbookMessage(storage, id);
			if (!msg) {
				return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
			}

			const body = await request.json().catch(() => ({}));
			const type = body.type;
			if (!["agree", "disagree", "neutral"].includes(type)) {
				return new Response(JSON.stringify({ error: "Invalid vote type" }), { status: 400 });
			}

			msg.votes[type] = (msg.votes[type] || 0) + 1;
			await setGuestbookMessage(storage, id, msg);

			return new Response(JSON.stringify(msg), {
				headers: { "Content-Type": "application/json" },
			});
		}
	}

	return new Response("Not Found", { status: 404 });
}

async function handleNotebook(
	storage: StorageAdapter,
	request: Request,
	url: URL,
	pathname: string,
	method: string
): Promise<Response> {
	const parts = pathname.split("/").filter(Boolean);

	// GET /api/notebook/ - list all entries (optionally filtered by ?notebook=)
	if (method === "GET" && parts.length === 2) {
		const notebookFilter = url.searchParams.get("notebook");
		const ids = await getNotebookList(storage);
		let entries: NotebookEntry[] = [];
		for (const id of ids) {
			const entry = await getNotebookEntry(storage, id);
			if (entry) entries.push(entry);
		}
		if (notebookFilter) {
			entries = entries.filter((e) => e.notebook === notebookFilter);
		}
		entries.sort((a, b) => b.createdAt - a.createdAt);
		return new Response(JSON.stringify({ entries, total: entries.length }), {
			headers: { "Content-Type": "application/json" },
		});
	}

	// GET /api/notebook/{id}/ - get single entry
	if (method === "GET" && parts.length === 3) {
		const entry = await getNotebookEntry(storage, parts[2]);
		if (!entry) {
			return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
		}
		return new Response(JSON.stringify(entry), {
			headers: { "Content-Type": "application/json" },
		});
	}

	// POST /api/notebook/ - create new entry
	if (method === "POST" && parts.length === 2) {
		const body = await request.json().catch(() => ({}));
		const notebook = escapeHtml((body.notebook || "").trim());
		const title = escapeHtml((body.title || "").trim());
		const content = (body.content || "").trim();
		const date = body.date || new Date().toISOString().slice(0, 10);
		const cover = (body.cover || "").trim(); // base64 or URL or default image key

		if (!notebook || !title || !content) {
			return new Response(
				JSON.stringify({ error: "notebook, title, content are required" }),
				{ status: 400 }
			);
		}

		const id = await getNotebookNextId(storage);
		const now = Date.now();
		const entry: NotebookEntry = {
			id,
			notebook,
			title,
			date,
			content,
			cover,
			createdAt: now,
			updatedAt: now,
		};

		await setNotebookEntry(storage, id, entry);
		const ids = await getNotebookList(storage);
		ids.unshift(id);
		await setNotebookList(storage, ids);

		return new Response(JSON.stringify(entry), {
			status: 201,
			headers: { "Content-Type": "application/json" },
		});
	}

	// PUT /api/notebook/{id}/ - update entry
	if (method === "PUT" && parts.length === 3) {
		const entry = await getNotebookEntry(storage, parts[2]);
		if (!entry) {
			return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
		}

		const body = await request.json().catch(() => ({}));
		if (body.notebook !== undefined) entry.notebook = escapeHtml(body.notebook.trim());
		if (body.title !== undefined) entry.title = escapeHtml(body.title.trim());
		if (body.content !== undefined) entry.content = body.content;
		if (body.date !== undefined) entry.date = body.date;
		if (body.cover !== undefined) entry.cover = body.cover;
		entry.updatedAt = Date.now();

		await setNotebookEntry(storage, entry.id, entry);
		return new Response(JSON.stringify(entry), {
			headers: { "Content-Type": "application/json" },
		});
	}

	// DELETE /api/notebook/{id}/ - delete entry
	if (method === "DELETE" && parts.length === 3) {
		const id = parts[2];
		const entry = await getNotebookEntry(storage, id);
		if (!entry) {
			return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
		}

		await storage.delete(`notebook:entry:${id}`);
		const ids = (await getNotebookList(storage)).filter(
			(existingId) => existingId !== id
		);
		await setNotebookList(storage, ids);

		return new Response(JSON.stringify({ success: true, id }), {
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response("Not Found", { status: 404 });
}

async function handleActivity(
	storage: StorageAdapter,
	request: Request,
	url: URL,
	pathname: string,
	method: string
): Promise<Response> {
	const parts = pathname.split("/").filter(Boolean);

	if (method === "GET") {
		if (parts.length === 2) {
			const slug = url.searchParams.get("slug");
			if (slug) {
				const activity = await getActivity(storage, slug);
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

			const ids = await getActivityList(storage);
			let items: Activity[] = [];
			for (const id of ids) {
				const item = await getActivity(storage, id);
				if (item) items.push(item);
			}

			if (items.length === 0) {
				const defaultActivities = getDefaultActivities();

				const newIds: string[] = [];
				for (const activity of defaultActivities) {
					await setActivity(storage, activity.slug, activity);
					newIds.push(activity.slug);
				}
				await setActivityList(storage, newIds);
				items = defaultActivities;
			}

			items.sort((a, b) => b.createdAt - a.createdAt);
			return new Response(
				JSON.stringify({
					items: items.map((item) => normalizeActivity(item)),
					total: items.length,
				}),
				{
				headers: { "Content-Type": "application/json" },
				},
			);
		}
	}

	if (method === "POST") {
		if (parts.length === 2) {
			const body = await request.json().catch(() => ({}));
			const title = escapeHtml((body.title || "").trim());
			const content = (body.content || "").trim();
			const excerpt = escapeHtml((body.excerpt || "").trim());
			const imageList = Array.isArray(body.images)
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
			while (await getActivity(storage, slug)) {
				slug = `${baseSlug}-${suffix}`;
				suffix += 1;
			}
			const now = Date.now();

			const activity: Activity = {
				id,
				slug,
				title,
				excerpt,
				content,
				body: content,
				images: imageList,
				createdAt: now,
				updatedAt: now,
			};

			await setActivity(storage, slug, activity);
			const ids = await getActivityList(storage);
			ids.unshift(slug);
			await setActivityList(storage, ids);

			return new Response(JSON.stringify(normalizeActivity(activity)), {
				status: 201,
				headers: { "Content-Type": "application/json" },
			});
		}
	}

	if (method === "PUT" && parts.length === 2) {
		const targetSlug = url.searchParams.get("slug");
		if (!targetSlug) {
			return new Response(JSON.stringify({ error: "Slug is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const activity = await getActivity(storage, targetSlug);
		if (!activity) {
			return new Response(JSON.stringify({ error: "Activity not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		const body = await request.json().catch(() => ({}));
		const nextTitle = escapeHtml((body.title || activity.title || "").trim());
		const nextContent = (body.content || activity.body || activity.content || "").trim();

		if (!nextTitle || !nextContent) {
			return new Response(JSON.stringify({ error: "Title and content are required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		activity.title = nextTitle;
		activity.excerpt = escapeHtml((body.excerpt || activity.excerpt || "").trim());
		activity.content = nextContent;
		activity.body = nextContent;
		activity.images = Array.isArray(body.images)
			? body.images.filter((item: ActivityImage) => item?.url)
			: activity.images || [];
		activity.updatedAt = Date.now();

		await setActivity(storage, targetSlug, activity);
		return new Response(JSON.stringify(normalizeActivity(activity)), {
			headers: { "Content-Type": "application/json" },
		});
	}

	if (method === "DELETE") {
		if (parts.length === 2) {
			const slug = url.searchParams.get("slug");
			if (!slug) {
				return new Response(JSON.stringify({ error: "Slug is required" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			const activity = await getActivity(storage, slug);
			if (!activity) {
				return new Response(JSON.stringify({ error: "Activity not found" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				});
			}

			await storage.delete(`activity:item:${slug}`);
			const ids = (await getActivityList(storage)).filter(
				(existingId) => existingId !== slug
			);
			await setActivityList(storage, ids);

			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
	}

	return new Response("Not Found", { status: 404 });
}
