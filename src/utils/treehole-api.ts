import type {
	TreeholeMessage,
	TreeholeListResponse,
	TreeholePendingResponse,
	TreeholeStatus,
} from "@/types/treehole";

const BASE = "/api/treehole/";

/** 获取管理员 token（从 localStorage 读取） */
function getAdminToken(): string | null {
	if (typeof localStorage === "undefined") return null;
	return localStorage.getItem("treehole_admin_token");
}

/** 带错误状态码的 fetch 封装 */
async function request<T>(
	url: string,
	options: RequestInit = {},
): Promise<T> {
	const res = await fetch(url, options);
	if (!res.ok) {
		const text = await res.text();
		let errorMessage = `Request failed: ${res.status}`;
		try {
			const json = JSON.parse(text);
			if (json.error) errorMessage = json.error;
		} catch {
			// 非 JSON 响应
		}
		const error = new Error(errorMessage) as Error & { status: number };
		error.status = res.status;
		throw error;
	}
	return res.json();
}

// === 公开接口 ===

/** 获取已审核通过的树洞列表 */
export async function fetchTreeholes(
	offset = 0,
	limit = 10,
): Promise<TreeholeListResponse> {
	return request<TreeholeListResponse>(
		`${BASE}?offset=${offset}&limit=${limit}`,
	);
}

/** 获取单条树洞详情 */
export async function fetchTreehole(id: string): Promise<TreeholeMessage> {
	return request<TreeholeMessage>(`${BASE}/${id}`);
}

/** 创建树洞（匿名） */
export async function createTreehole(content: string): Promise<TreeholeMessage> {
	return request<TreeholeMessage>(BASE, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ content }),
	});
}

/** 点赞共鸣 */
export async function resonateTreehole(
	id: string,
): Promise<{ id: string; resonance: number }> {
	return request(`${BASE}/${id}/resonance`, { method: "POST" });
}

/** 匿名回复 */
export async function replyTreehole(
	id: string,
	content: string,
): Promise<{ id: string; content: string; hint?: string }> {
	return request(`${BASE}/${id}/reply`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ content }),
	});
}

// === 管理员接口 ===

/** 获取待审核列表 */
export async function fetchPending(): Promise<TreeholePendingResponse> {
	const token = getAdminToken();
	if (!token) throw new Error("未设置管理员 token");
	return request<TreeholePendingResponse>(
		`${BASE}/admin/pending`,
		{ headers: { Authorization: `Bearer ${token}` } },
	);
}

/** 审核树洞 */
export async function reviewTreehole(
	id: string,
	status: "approved" | "rejected",
): Promise<{ id: string; status: TreeholeStatus }> {
	const token = getAdminToken();
	if (!token) throw new Error("未设置管理员 token");
	return request(`${BASE}/admin/${id}/review`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ status }),
	});
}

/** 审核回复 */
export async function reviewTreeholeReply(
	msgId: string,
	replyId: string,
	status: "approved" | "rejected",
): Promise<{ msgId: string; replyId: string; status: TreeholeStatus }> {
	const token = getAdminToken();
	if (!token) throw new Error("未设置管理员 token");
	return request(`${BASE}/admin/${msgId}/${replyId}/review`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ status }),
	});
}
