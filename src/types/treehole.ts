/**
 * 树洞（Treehole）数据模型
 *
 * 树洞是匿名倾诉空间，与留言板（guestbook）的区别：
 * - 完全匿名：不记录作者身份
 * - 审核可见：提交后需博主审核才公开展示
 * - 共鸣机制：访客可点赞产生"共鸣数"，无反对选项
 * - 可回复：允许匿名回复，形成轻量互动
 *
 * KV 存储结构（VISITOR_KV 命名空间）：
 *   treehole:msg:{id}     -> TreeholeMessage (JSON)
 *   treehole:list         -> id[]（已审核通过，按 createdAt 倒序）
 *   treehole:pending      -> id[]（待审核，按 createdAt 倒序）
 *   treehole:counter      -> number（自增计数器）
 *   treehole:resonated:{ip} -> id[]（该 IP 已共鸣的树洞 id，防重复）
 */

/** 审核状态 */
export type TreeholeStatus = "pending" | "approved" | "rejected";

/** 树洞回复 */
export interface TreeholeReply {
	id: string;
	content: string;
	createdAt: number;
	status: TreeholeStatus;
	resonance: number;
}

/** 树洞留言 */
export interface TreeholeMessage {
	id: string;
	content: string;
	createdAt: number;
	status: TreeholeStatus;
	/** 共鸣数（点赞） */
	resonance: number;
	replies: TreeholeReply[];
}

/** 列表查询响应 */
export interface TreeholeListResponse {
	messages: TreeholeMessage[];
	total: number;
}

/** 待审核列表响应 */
export interface TreeholePendingResponse {
	messages: TreeholeMessage[];
	total: number;
}

/** 创建树洞的请求体 */
export interface CreateTreeholePayload {
	content: string;
}

/** 回复树洞的请求体 */
export interface ReplyTreeholePayload {
	content: string;
}

/** 审核操作请求体 */
export interface ReviewTreeholePayload {
	status: "approved" | "rejected";
}
