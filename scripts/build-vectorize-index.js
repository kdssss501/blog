#!/usr/bin/env node
/**
 * 构建 Vectorize 向量索引（增量更新）
 * 读取所有博客文章 → 按 heading 切段 → 生成 embedding → 上传到 Cloudflare Vectorize
 *
 * 用法：node scripts/build-vectorize-index.js [--force]
 *   --force  强制全量重建（忽略 manifest）
 *
 * 环境变量（在 .env 中配置）：
 *   必填：CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 *   可选（第三方 embedding API）：AI_API_KEY
 *
 * 非敏感配置统一从 src/config/aiSearchConfig.ts 读取
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { glob } from "glob";

// ── 加载配置文件 ──────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(__dirname, "../src/config/aiSearchConfig.ts");

let aiConfig;
try {
	const configContent = fs.readFileSync(configPath, "utf-8");
	// 简单解析导出对象（避免引入 TS 编译器）
	const match = configContent.match(/export\s+const\s+aiSearchConfig\s*=\s*(\{[\s\S]*?\n\});/);
	if (!match) throw new Error("无法解析 aiSearchConfig");
	// 使用 Function 构造器安全解析对象字面量
	aiConfig = new Function(`return ${match[1]}`)();
} catch (err) {
	console.error("❌ 读取配置文件失败:", err.message);
	process.exit(1);
}

// ── 加载环境变量（敏感信息）─────────────────────────────
function loadEnv() {
	const envPath = path.resolve(process.cwd(), ".env");
	if (!fs.existsSync(envPath)) return;
	const content = fs.readFileSync(envPath, "utf-8");
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eqIdx = trimmed.indexOf("=");
		if (eqIdx === -1) continue;
		const key = trimmed.slice(0, eqIdx).trim();
		let val = trimmed.slice(eqIdx + 1).trim();
		const commentIdx = val.indexOf(" #");
		if (commentIdx !== -1) val = val.slice(0, commentIdx).trim();
		if (!process.env[key]) process.env[key] = val;
	}
}

loadEnv();

// ── 配置 ──────────────────────────────────────────────
const INDEX_NAME = aiConfig.indexName;
const VECTORIZE_DIM = aiConfig.vectorizeDim;
const BATCH_SIZE = aiConfig.batchSize;
const EMBED_BATCH_SIZE = aiConfig.embedBatchSize;
const MANIFEST_PATH = path.resolve(process.cwd(), ".vectorize-manifest.json");

// 判断是否使用第三方 embedding API（API_KEY 为敏感信息，从环境变量读取）
const useThirdParty = !!(aiConfig.apiUrl && process.env.AI_API_KEY && aiConfig.embeddingModel);

// Cloudflare 配置（上传向量始终需要）
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!API_TOKEN || !ACCOUNT_ID) {
	console.error("❌ 缺少 CLOUDFLARE_API_TOKEN 或 CLOUDFLARE_ACCOUNT_ID，请在 .env 中配置");
	process.exit(1);
}

const API_BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`;

// 配置信息已在启动时确认，此处不再重复输出

// ── Manifest 管理 ─────────────────────────────────────

function loadManifest() {
	if (!fs.existsSync(MANIFEST_PATH)) return {};
	return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
}

function saveManifest(manifest) {
	fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function contentHash(text) {
	return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

// ── 读取并切段 ────────────────────────────────────────

async function loadPosts() {
	const files = await glob("src/content/posts/**/*.{md,mdx}", { cwd: process.cwd() });
	const posts = [];

	for (const file of files) {
		const fullPath = path.resolve(process.cwd(), file);
		const raw = fs.readFileSync(fullPath, "utf-8");
		const { data: frontmatter, content } = matter(raw);

		if (frontmatter.draft) continue;

		const normalized = path.normalize(file).replace(/\\/g, "/");
		const slug = normalized
			.replace(/^\.\//, "")
			.replace(/^src\/content\/posts\//, "")
			.replace(/\.(md|mdx)$/i, "");

		posts.push({
			title: frontmatter.title || "无标题",
			category: frontmatter.category || "",
			tags: frontmatter.tags || [],
			published: frontmatter.published || "",
			slug,
			content,
			hash: contentHash(raw),
		});
	}

	return posts;
}

function splitByHeadings(content, articleTitle) {
	const lines = content.split("\n");
	const chunks = [];
	let currentHeadingPath = [];
	let currentContent = [];

	function flush() {
		const text = currentContent.join("\n").trim();
		if (text.length < 50) return;
		chunks.push({ heading: currentHeadingPath.join(" > ") || articleTitle, text });
	}

	for (const line of lines) {
		const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
		if (headingMatch) {
			flush();
			currentContent = [];
			const level = headingMatch[1].length;
			const title = headingMatch[2].trim();
			currentHeadingPath = currentHeadingPath.slice(0, level - 1);
			currentHeadingPath[level - 1] = title;
		} else {
			currentContent.push(line);
		}
	}
	flush();
	return chunks;
}

function buildChunksForPost(post) {
	const sections = splitByHeadings(post.content, post.title);
	return sections.map((section) => {
		const chunkText = [
			`文章：${post.title}`,
			post.published ? `日期：${post.published}` : "",
			post.category ? `分类：${post.category}` : "",
			post.tags.length ? `标签：${post.tags.join(", ")}` : "",
			`章节：${section.heading}`,
			"",
			section.text,
		].filter(Boolean).join("\n");

		return {
			id: crypto.createHash("sha256").update(`${post.slug}::${section.heading}`).digest("hex").slice(0, 16),
			slug: post.slug,
			text: chunkText,
			metadata: {
				articleTitle: post.title,
				articlePath: `/posts/${post.slug.toLowerCase()}/`,
				published: post.published,
				category: post.category,
				tags: post.tags.join(", "),
				heading: section.heading,
				excerpt: section.text.slice(0, 500),
			},
		};
	});
}

// ── Embedding ────────────────────────────────────────

async function generateEmbeddings(texts) {
	if (useThirdParty) {
		const baseUrl = aiConfig.apiUrl.replace(/\/+$/, "").replace(/\/chat\/completions$/, "").replace(/\/v1$/, "");
		const body = JSON.stringify({
			model: aiConfig.embeddingModel,
			input: texts,
			dimensions: VECTORIZE_DIM,
			encoding_format: "float",
		});
		const res = await fetch(`${baseUrl}/v1/embeddings`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${process.env.AI_API_KEY}`,
				"Content-Type": "application/json; charset=utf-8",
			},
			body: Buffer.from(body, "utf-8"),
		});
		if (!res.ok) throw new Error(`Embedding API ${res.status}: ${await res.text()}`);
		const data = await res.json();
		return data.data.map((d) => d.embedding);
	}

	// Cloudflare Workers AI
	const res = await fetch(`${API_BASE}/ai/run/@cf/baai/bge-large-en-v1.5`, {
		method: "POST",
		headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
		body: JSON.stringify({ text: texts }),
	});
	if (!res.ok) throw new Error(`Cloudflare AI ${res.status}: ${await res.text()}`);
	return (await res.json()).result.data;
}

// ── Vectorize 操作 ────────────────────────────────────

async function insertVectors(vectors) {
	const res = await fetch(`${API_BASE}/vectorize/v2/indexes/${INDEX_NAME}/insert`, {
		method: "POST",
		headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
		body: JSON.stringify({ vectors }),
	});
	if (!res.ok) throw new Error(`Vectorize insert ${res.status}: ${await res.text()}`);
	return res.json();
}

async function deleteVectorsByIds(ids) {
	for (let i = 0; i < ids.length; i += 1000) {
		const batch = ids.slice(i, i + 1000);
		const res = await fetch(`${API_BASE}/vectorize/v2/indexes/${INDEX_NAME}/delete-by-ids`, {
			method: "POST",
			headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
			body: JSON.stringify({ ids: batch }),
		});
		if (!res.ok) {
			if (res.status === 404) {
				console.warn(`⚠️ Vectorize 索引不存在或已删除，跳过删除操作`);
				return;
			}
			throw new Error(`Vectorize delete ${res.status}: ${await res.text()}`);
		}
	}
}

async function deleteIndex() {
	const res = await fetch(`${API_BASE}/vectorize/v2/indexes/${INDEX_NAME}`, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${API_TOKEN}` },
	});
	return res.ok;
}

async function createIndex() {
	const res = await fetch(`${API_BASE}/vectorize/v2/indexes`, {
		method: "POST",
		headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
		body: JSON.stringify({ name: INDEX_NAME, config: { dimensions: VECTORIZE_DIM, metric: "cosine" } }),
	});
	if (!res.ok) {
		const text = await res.text();
		if (text.includes("already exists")) return;
		throw new Error(`Create index ${res.status}: ${text}`);
	}
}

// ── 同步 chunks ──────────────────────────────────────

async function syncChunks(chunks) {
	const total = chunks.length;
	let uploaded = 0;
	const buffer = [];

	for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
		const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
		const embedStart = i + 1;
		const embedEnd = Math.min(i + EMBED_BATCH_SIZE, total);

		try {
			console.log(`📝 生成嵌入 [${embedStart}-${embedEnd}/${total}]...`);
			const embeddings = await generateEmbeddings(batch.map((c) => c.text));

			for (let k = 0; k < batch.length; k++) {
				buffer.push({
					id: batch[k].id,
					values: embeddings[k],
					metadata: batch[k].metadata,
				});
			}

			if (buffer.length >= BATCH_SIZE || i + EMBED_BATCH_SIZE >= chunks.length) {
				for (let j = 0; j < buffer.length; j += BATCH_SIZE) {
					const subBatch = buffer.slice(j, j + BATCH_SIZE);
					const upStart = uploaded + 1;
					const upEnd = uploaded + subBatch.length;
					console.log(`📤 上传向量 [${upStart}-${upEnd}/${total}]...`);
					await insertVectors(subBatch);
					uploaded += subBatch.length;
					console.log(`✅ 累计 ${uploaded}/${total}`);
				}
				buffer.length = 0;
			}

			if (i + EMBED_BATCH_SIZE < chunks.length) {
				await new Promise((r) => setTimeout(r, 500));
			}
		} catch (err) {
			console.error(`❌ 嵌入 [${embedStart}-${embedEnd}] 失败:`, err.message);
		}
	}
	return uploaded;
}

// ── 主流程 ────────────────────────────────────────────

async function main() {
	const forceRebuild = process.argv.includes("--force");

	const posts = await loadPosts();
	if (posts.length === 0) return;

	const manifest = loadManifest();

	if (forceRebuild) {
		await deleteIndex();
		await createIndex();

		const allChunks = posts.flatMap((p) => buildChunksForPost(p));
		const processed = await syncChunks(allChunks);

		const newManifest = {};
		for (const post of posts) {
			newManifest[post.slug] = { hash: post.hash, chunkIds: buildChunksForPost(post).map((c) => c.id) };
		}
		saveManifest(newManifest);
		console.log(`全量重建完成，共上传 ${processed} 个向量`);
		return;
	}

	// 增量更新
	const currentSlugs = new Set(posts.map((p) => p.slug));
	const manifestSlugs = new Set(Object.keys(manifest));

	const added = posts.filter((p) => !manifestSlugs.has(p.slug));
	const changed = posts.filter((p) => manifestSlugs.has(p.slug) && manifest[p.slug].hash !== p.hash);
	const deleted = [...manifestSlugs].filter((s) => !currentSlugs.has(s));

	if (added.length === 0 && changed.length === 0 && deleted.length === 0) {
		console.log("没有变化，跳过更新");
		return;
	}

	if (deleted.length > 0) {
		const ids = deleted.flatMap((slug) => manifest[slug].chunkIds || []);
		await deleteVectorsByIds(ids);
		for (const slug of deleted) delete manifest[slug];
	}

	if (changed.length > 0) {
		const ids = changed.flatMap((p) => manifest[p.slug].chunkIds || []);
		await deleteVectorsByIds(ids);
	}

	const toProcess = [...added, ...changed];
	if (toProcess.length > 0) {
		const chunkMap = new Map(toProcess.map((p) => [p.slug, buildChunksForPost(p)]));
		const newChunks = [...chunkMap.values()].flat();
		const processed = await syncChunks(newChunks);

		for (const post of toProcess) {
			manifest[post.slug] = { hash: post.hash, chunkIds: chunkMap.get(post.slug).map((c) => c.id) };
		}
		console.log(`增量更新完成，新增/更新 ${processed} 个向量`);
	}

	saveManifest(manifest);
}

main().catch((err) => { console.error("❌ 构建失败:", err); process.exit(1); });
