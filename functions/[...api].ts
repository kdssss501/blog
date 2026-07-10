export interface Env {
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
	createdAt: number;
	updatedAt: number;
}

const MEMORY_STORAGE = new Map<string, string>();

function getTreeholeList(): string[] {
	const raw = MEMORY_STORAGE.get("treehole:list");
	return raw ? JSON.parse(raw) : [];
}

function setTreeholeList(ids: string[]) {
	MEMORY_STORAGE.set("treehole:list", JSON.stringify(ids));
}

function getTreeholeMessage(id: string): TreeholeMessage | null {
	const raw = MEMORY_STORAGE.get(`treehole:msg:${id}`);
	return raw ? JSON.parse(raw) : null;
}

function setTreeholeMessage(id: string, msg: TreeholeMessage) {
	MEMORY_STORAGE.set(`treehole:msg:${id}`, JSON.stringify(msg));
}

function getTreeholeNextId(): string {
	const counter = Number(MEMORY_STORAGE.get("treehole:counter") || "0") + 1;
	MEMORY_STORAGE.set("treehole:counter", String(counter));
	return `th_${String(counter).padStart(3, "0")}`;
}

function getGuestbookList(): string[] {
	const raw = MEMORY_STORAGE.get("guestbook:list");
	return raw ? JSON.parse(raw) : [];
}

function setGuestbookList(ids: string[]) {
	MEMORY_STORAGE.set("guestbook:list", JSON.stringify(ids));
}

function getGuestbookMessage(id: string): GuestbookMessage | null {
	const raw = MEMORY_STORAGE.get(`guestbook:msg:${id}`);
	return raw ? JSON.parse(raw) : null;
}

function setGuestbookMessage(id: string, msg: GuestbookMessage) {
	MEMORY_STORAGE.set(`guestbook:msg:${id}`, JSON.stringify(msg));
}

function getGuestbookNextId(): string {
	const counter = Number(MEMORY_STORAGE.get("guestbook:counter") || "0") + 1;
	MEMORY_STORAGE.set("guestbook:counter", String(counter));
	return `msg_${String(counter).padStart(3, "0")}`;
}

function getNotebookList(): string[] {
	const raw = MEMORY_STORAGE.get("notebook:list");
	return raw ? JSON.parse(raw) : [];
}

function setNotebookList(ids: string[]) {
	MEMORY_STORAGE.set("notebook:list", JSON.stringify(ids));
}

function getNotebookEntry(id: string): NotebookEntry | null {
	const raw = MEMORY_STORAGE.get(`notebook:entry:${id}`);
	return raw ? JSON.parse(raw) : null;
}

function setNotebookEntry(id: string, entry: NotebookEntry) {
	MEMORY_STORAGE.set(`notebook:entry:${id}`, JSON.stringify(entry));
}

function getNotebookNextId(): string {
	const counter = Number(MEMORY_STORAGE.get("notebook:counter") || "0") + 1;
	MEMORY_STORAGE.set("notebook:counter", String(counter));
	return `nb_${String(counter).padStart(3, "0")}`;
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;
		const method = request.method;

		if (pathname.startsWith("/api/treehole")) {
			return handleTreehole(request, url, pathname, method);
		}

		if (pathname.startsWith("/api/guestbook")) {
			return handleGuestbook(request, url, pathname, method);
		}

		if (pathname.startsWith("/api/notebook")) {
			return handleNotebook(request, url, pathname, method);
		}

		return new Response("Not Found", { status: 404 });
	},
};

async function handleTreehole(request: Request, url: URL, pathname: string, method: string): Promise<Response> {
	const parts = pathname.split("/").filter(Boolean);

	if (method === "OPTIONS") {
		return new Response(null, {
			headers: {
				"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
			},
		});
	}

	if (method === "GET") {
		if (parts.length === 2) {
			const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
			const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit")) || 10));
			const ids = getTreeholeList();
			const pageIds = ids.slice(offset, offset + limit);
			const messages = pageIds.map(getTreeholeMessage).filter(Boolean) as TreeholeMessage[];
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
			const msg = getTreeholeMessage(id);
			if (!msg || msg.status !== "approved") {
				return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
			}
			return new Response(JSON.stringify(msg), { headers: { "Content-Type": "application/json" } });
		}
	}

	if (method === "POST") {
		if (parts.length === 2) {
			const body = await request.json().catch(() => ({}));
			const content = escapeHtml((body.content || "").trim());
			if (!content) {
				return new Response(JSON.stringify({ error: "content is required" }), { status: 400 });
			}

			const id = getTreeholeNextId();
			const msg: TreeholeMessage = {
				id,
				content,
				createdAt: Date.now(),
				status: "approved",
				resonance: 0,
				replies: [],
			};

			setTreeholeMessage(id, msg);
			const ids = getTreeholeList();
			ids.unshift(id);
			setTreeholeList(ids);

			return new Response(JSON.stringify(msg), {
				status: 201,
				headers: { "Content-Type": "application/json" },
			});
		}

		if (parts.length === 4 && parts[3] === "resonance") {
			const id = parts[2];
			const msg = getTreeholeMessage(id);
			if (!msg || msg.status !== "approved") {
				return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
			}

			msg.resonance = (msg.resonance || 0) + 1;
			setTreeholeMessage(id, msg);

			return new Response(JSON.stringify({ id, resonance: msg.resonance }), {
				headers: { "Content-Type": "application/json" },
			});
		}

		if (parts.length === 4 && parts[3] === "reply") {
			const id = parts[2];
			const msg = getTreeholeMessage(id);
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
			setTreeholeMessage(id, msg);

			return new Response(JSON.stringify({ id, content, hint: "回复成功" }), {
				headers: { "Content-Type": "application/json" },
			});
		}
	}

	return new Response("Not Found", { status: 404 });
}

async function handleGuestbook(request: Request, url: URL, pathname: string, method: string): Promise<Response> {
	const parts = pathname.split("/").filter(Boolean);

	if (method === "OPTIONS") {
		return new Response(null, {
			headers: {
				"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type",
			},
		});
	}

	if (method === "GET") {
		if (parts.length === 2) {
			const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
			const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit")) || 5));
			const ids = getGuestbookList();
			const pageIds = ids.slice(offset, offset + limit);
			const messages = pageIds.map(getGuestbookMessage).filter(Boolean) as GuestbookMessage[];
			return new Response(JSON.stringify({ messages, total: ids.length }), {
				headers: { "Content-Type": "application/json" },
			});
		}

		if (parts.length === 3) {
			const msg = getGuestbookMessage(parts[2]);
			if (!msg) {
				return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
			}
			return new Response(JSON.stringify(msg), { headers: { "Content-Type": "application/json" } });
		}
	}

	if (method === "POST") {
		if (parts.length === 2) {
			const body = await request.json().catch(() => ({}));
			const rawAuthor = (body.author || "").trim();
			const rawContent = (body.content || "").trim();

			if (!rawAuthor || !rawContent) {
				return new Response(JSON.stringify({ error: "author and content are required" }), { status: 400 });
			}

			const author = escapeHtml(rawAuthor);
			const content = escapeHtml(rawContent);
			const id = getGuestbookNextId();
			const now = Date.now();
			const message: GuestbookMessage = {
				id,
				author,
				content,
				time: "刚刚",
				createdAt: now,
				votes: { agree: 0, disagree: 0, neutral: 0 },
			};

			setGuestbookMessage(id, message);

			const ids = getGuestbookList();
			ids.unshift(id);
			setGuestbookList(ids);

			return new Response(JSON.stringify(message), {
				status: 201,
				headers: { "Content-Type": "application/json" },
			});
		}

		if (parts.length === 4 && parts[3] === "vote") {
			const id = parts[2];
			const msg = getGuestbookMessage(id);
			if (!msg) {
				return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
			}

			const body = await request.json().catch(() => ({}));
			const type = body.type;
			if (!["agree", "disagree", "neutral"].includes(type)) {
				return new Response(JSON.stringify({ error: "Invalid vote type" }), { status: 400 });
			}

			msg.votes[type] = (msg.votes[type] || 0) + 1;
			setGuestbookMessage(id, msg);

			return new Response(JSON.stringify(msg), { headers: { "Content-Type": "application/json" } });
		}
	}

	return new Response("Not Found", { status: 404 });
}

async function handleNotebook(request: Request, url: URL, pathname: string, method: string): Promise<Response> {
	const parts = pathname.split("/").filter(Boolean);

	if (method === "OPTIONS") {
		return new Response(null, {
			headers: {
				"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
			},
		});
	}

	// GET /api/notebook/ - list all entries (optionally filtered by ?notebook=)
	if (method === "GET" && parts.length === 2) {
		const notebookFilter = url.searchParams.get("notebook");
		const ids = getNotebookList();
		let entries = ids.map(getNotebookEntry).filter(Boolean) as NotebookEntry[];
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
		const entry = getNotebookEntry(parts[2]);
		if (!entry) {
			return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
		}
		return new Response(JSON.stringify(entry), { headers: { "Content-Type": "application/json" } });
	}

	// POST /api/notebook/ - create new entry
	if (method === "POST" && parts.length === 2) {
		const body = await request.json().catch(() => ({}));
		const notebook = escapeHtml((body.notebook || "").trim());
		const title = escapeHtml((body.title || "").trim());
		const content = (body.content || "").trim();
		const date = body.date || new Date().toISOString().slice(0, 10);

		if (!notebook || !title || !content) {
			return new Response(JSON.stringify({ error: "notebook, title, content are required" }), { status: 400 });
		}

		const id = getNotebookNextId();
		const now = Date.now();
		const entry: NotebookEntry = {
			id,
			notebook,
			title,
			date,
			content,
			createdAt: now,
			updatedAt: now,
		};

		setNotebookEntry(id, entry);
		const ids = getNotebookList();
		ids.unshift(id);
		setNotebookList(ids);

		return new Response(JSON.stringify(entry), {
			status: 201,
			headers: { "Content-Type": "application/json" },
		});
	}

	// PUT /api/notebook/{id}/ - update entry
	if (method === "PUT" && parts.length === 3) {
		const entry = getNotebookEntry(parts[2]);
		if (!entry) {
			return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
		}

		const body = await request.json().catch(() => ({}));
		if (body.notebook !== undefined) entry.notebook = escapeHtml(body.notebook.trim());
		if (body.title !== undefined) entry.title = escapeHtml(body.title.trim());
		if (body.content !== undefined) entry.content = body.content;
		if (body.date !== undefined) entry.date = body.date;
		entry.updatedAt = Date.now();

		setNotebookEntry(entry.id, entry);
		return new Response(JSON.stringify(entry), { headers: { "Content-Type": "application/json" } });
	}

	// DELETE /api/notebook/{id}/ - delete entry
	if (method === "DELETE" && parts.length === 3) {
		const id = parts[2];
		const entry = getNotebookEntry(id);
		if (!entry) {
			return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
		}

		MEMORY_STORAGE.delete(`notebook:entry:${id}`);
		const ids = getNotebookList().filter((existingId) => existingId !== id);
		setNotebookList(ids);

		return new Response(JSON.stringify({ success: true, id }), { headers: { "Content-Type": "application/json" } });
	}

	return new Response("Not Found", { status: 404 });
}