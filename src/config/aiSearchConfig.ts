/**
 * AI 搜索统一配置中心
 *
 * 所有 AI 相关配置集中在此，供前端组件、构建脚本、Worker 共享。
 * Worker 的 wrangler.toml 需与此保持同步（非敏感配置）。
 */

export const aiSearchConfig = {
	/** 第三方 AI API 地址 */
	apiUrl: "https://api-inference.modelscope.cn/v1",

	/** 对话模型（显示在 AI 搜索弹窗标题） */
	modelName: "deepseek-ai/DeepSeek-V4-Flash",

	/** Embedding 模型（文本 → 向量，检索用） */
	embeddingModel: "Qwen/Qwen3-Embedding-8B",

	/** 向量维度，需与 Vectorize 索引一致 */
	vectorizeDim: 1024,

	/** 构建脚本：向量上传批大小 */
	batchSize: 500,

	/** 构建脚本：Embedding 请求批大小 */
	embedBatchSize: 50,

	/** Vectorize 索引名称 */
	indexName: "blog-ai-search",
};
