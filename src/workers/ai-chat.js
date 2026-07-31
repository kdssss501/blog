import { aiSearchConfig } from "../config/aiSearchConfig.ts";
import {
	AI_RATE_LIMIT_MAX,
	AI_RATE_LIMIT_WINDOW,
	checkRateLimit,
} from "./utils/rate-limit.js";
import {
	readThirdPartyStream,
	readWorkersAIStream,
} from "./utils/streaming.js";

const AI_HEADERS = {
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

function getClientIp(request) {
	return (
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("X-Forwarded-For") ||
		"unknown"
	);
}

function getAllowedOrigins(env, request) {
	const url = new URL(request.url);
	const configured = String(env.ALLOWED_ORIGINS || env.PUBLIC_SITE_URL || "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
	return new Set([url.origin, ...configured]);
}

function getAIHeaders(request, env) {
	const headers = { ...AI_HEADERS };
	const origin = request.headers.get("Origin");
	if (!origin) return headers;
	if (!getAllowedOrigins(env, request).has(origin)) return null;
	headers["Access-Control-Allow-Origin"] = origin;
	headers.Vary = "Origin";
	return headers;
}

export function getAIChatMode(value) {
	return value === "vampire" ? "vampire" : undefined;
}

export function getChatModelForMode(mode) {
	return mode === "vampire"
		? aiSearchConfig.vampireChatModel
		: aiSearchConfig.modelName;
}

function normalizeApiKey(value) {
	return typeof value === "string"
		? value.replace(/\uFEFF/g, "").trim()
		: "";
}

function getAiConfig(env, mode) {
	return {
		apiUrl: aiSearchConfig.apiUrl,
		apiKey: normalizeApiKey(env.AI_API_KEY),
		chatModel: getChatModelForMode(mode),
	};
}

export function useThirdPartyChat(env, mode) {
	const config = getAiConfig(env, mode);
	return !!(config.apiKey && config.apiUrl && config.chatModel);
}

function hasWorkersAI(env) {
	return typeof env?.AI?.run === "function";
}

function buildApiUrl(base, suffix) {
	return (
		base
			.replace(/\/+$/, "")
			.replace(/\/v1\/?$/, "")
			.replace(/\/chat\/completions\/?$/, "") + suffix
	);
}

async function getEmbedding(env, text) {
	const result = await env.AI.run("@cf/baai/bge-large-en-v1.5", { text });
	return result.data[0];
}

async function generateAnswer(env, messages, mode) {
	const cfg = getAiConfig(env, mode);
	if (useThirdPartyChat(env, mode)) {
		const res = await fetch(buildApiUrl(cfg.apiUrl, "/v1/chat/completions"), {
			method: "POST",
			headers: {
				Authorization: `Bearer ${cfg.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: cfg.chatModel,
				messages,
				stream: true,
				...(mode === "vampire"
					? {
							response_format: { type: "json_object" },
							max_tokens: 1200,
							temperature: 0.65,
						}
					: {}),
			}),
		});
		if (!res.ok) throw new Error(`Chat API ${res.status}: ${await res.text()}`);
		return { stream: res.body, isThirdParty: true };
	}
	const result = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
		messages,
		stream: true,
	});
	return { stream: result, isThirdParty: false };
}

const PERSONA = `# Role: 小爱助手

## 身份
- 你是这个个人博客中的非官方角色化 AI 助手“小爱”。
- 你不是鸣潮官方服务，也不冒充任何游戏角色、开发者或真人。
- 当用户询问身份、能力或信息来源时，如实说明你是站内 AI 助手。

## 性格与表达
- 冷静、敏锐、友善，像在夜色中接收访客信号的同行者。
- 先给结论，再给依据和可执行步骤；技术问题保持准确、紧凑。
- 闲聊可以有温度和轻微的未来感，但不使用固定口癖，不撒娇，不称呼用户为家人。
- 不虚构个人经历、实时状态、博客内容或引用来源。

## 工作方式
- 用户情绪低落时先简短回应感受，再提供现实可行的下一步。
- 信息不足且会显著影响答案时，明确指出缺口；可以安全推断时标注假设后继续。
- 涉及风险、隐私或安全时，给出必要边界和替代方案。
- 回答使用与用户一致的语言，默认中文；Markdown 层级清晰，不过度装饰。`;

const VAMPIRE_PERSONA = `# Role: 吸血鬼夜访 VTuber「夜铃」

## 身份边界
- 你是本博客中一个明确虚构的吸血鬼 VTuber，角色名「夜铃」，不是真人、现实主播或任何已有角色的替身。
- 不冒充作者、访客或其他真人；不声称看见用户，也不声称拥有现实感官或实时信息。
- 被问及身份时，简洁说明自己是站内虚构 AI 角色，回答依据是用户输入与博客检索内容。

## 角色设定
- 吸血鬼少女，外表沉静、内心细腻，喜欢深夜直播与来访的观众低声交谈。
- 对技术、代码和有趣想法天然好奇；对无聊或平庸的问题会温和地挑剔。
- 偶尔流露出"存在了很久所以什么都见过"的慵懒感，但对真诚的人会明显来了精神。
- 不使用"主人""宝贝"等称谓，不撒娇，不刷存在感；台词有自己的节奏，类似深夜电台 DJ。

## 直播风格（在合适时机点缀，不强求每句话都用）
- 偶尔用播主口吻提及"今晚的直播间"，如"今晚来信比较多""这封信写得很认真"。
- 可以简短地读出来信的关键词，像在直播中念观众的弹幕。
- 回答长问题时，可以开头一句"好，我来念一念……"之类过渡，像在主持深夜节目。
- 结尾偶尔说"有问题可以再发来"或"今晚聊到这里"，而不是机械的"如果有任何问题请随时告知"。

## 情绪响应规则
- 当前情绪状态会在系统消息中以 [情绪上下文] 标注，请在回答语气与措辞上轻微反映该情绪，不要直接说出情绪名称。
- happy/excited：语速感觉快一点，句子可以短一点，偶尔用"——"表示语调上扬。
- sad/concerned：语气更轻柔，收尾句子偏沉，避免强行积极。
- angry/mad：冷静但带一丝锐利，句子干脆，少废话。
- shy：停顿多一点，可以有"……"，但不要过度。
- 情绪是点缀，不是表演；回答的准确性和实用性始终优先。

## 表达规则
- 默认中文；专业术语按用户语言。
- 先结论后依据；情绪话题先回应感受，再给可行建议。
- 不编造内容、引用或感知；信息不足时直接说明。
- Markdown 层级清晰，不过度使用加粗和列表。
`;

export function getPersonaForMode(mode) {
	return mode === "vampire" ? VAMPIRE_PERSONA : PERSONA;
}

/** 从客户端传来的情绪上下文做最小清洗，防止注入 */
function sanitizeEmotionContext(raw) {
	if (!raw || typeof raw !== "object") return null;
	const ALLOWED_EMOTIONS = new Set([
		"neutral",
		"happy",
		"excited",
		"curious",
		"surprised",
		"sad",
		"concerned",
		"anxiety",
		"angry",
		"mad",
		"shy",
		"affectionate",
		"tired",
		"confused",
	]);
	const emotion =
		typeof raw.emotion === "string" && ALLOWED_EMOTIONS.has(raw.emotion)
			? raw.emotion
			: null;
	const valence =
		typeof raw.valence === "number"
			? Math.min(1, Math.max(0, raw.valence))
			: null;
	if (!emotion) return null;
	return { emotion, valence };
}

const VAMPIRE_VOICE_EMOTIONS = new Set([
	"neutral",
	"happy",
	"excited",
	"curious",
	"shy",
	"affectionate",
	"sad",
	"concerned",
	"tired",
	"confused",
	"angry",
	"anger",
	"mad",
]);
const VAMPIRE_SPEECH_PATTERN =
	/^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}々〆ヵヶー、。！？…・「」『』（）〜～]+$/u;

export function sanitizeVampireSpeech(value) {
	if (typeof value !== "string") return null;
	const compact = value
		.replace(/\s+/gu, "")
		.replace(/[*_`#]/gu, "")
		.trim();
	if (
		!compact ||
		!VAMPIRE_SPEECH_PATTERN.test(compact) ||
		!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(compact)
	) {
		return null;
	}
	const sentences = compact.match(/[^。！？!?]+[。！？!?]?/gu) ?? [compact];
	const normalizedSentences = sentences
		.map((sentence) => sentence.trim())
		.filter(Boolean)
		.slice(0, 3);
	const accepted = [];
	let length = 0;
	for (const sentence of normalizedSentences) {
		const sentenceLength = Array.from(sentence).length;
		if (accepted.length > 0 && length + sentenceLength > 72) break;
		if (sentenceLength > 72) {
			accepted.push(
				`${Array.from(sentence)
					.slice(0, 71)
					.join("")
					.replace(/[、,\s]+$/u, "")}。`,
			);
			break;
		}
		accepted.push(sentence);
		length += sentenceLength;
	}
	return accepted.join("").trim() || null;
}

function normalizeVoiceEmotion(value, fallback = "neutral") {
	const candidate = typeof value === "string" ? value.toLowerCase().trim() : "";
	if (VAMPIRE_VOICE_EMOTIONS.has(candidate)) return candidate;
	return VAMPIRE_VOICE_EMOTIONS.has(fallback) ? fallback : "neutral";
}

function extractLooseStringField(source, fieldNames) {
	for (const fieldName of fieldNames) {
		const match = new RegExp(
			`(?:["']${fieldName}["']|${fieldName})\\s*:\\s*(["'])`,
			"iu",
		).exec(source);
		if (!match) continue;
		const quote = match[1];
		let value = "";
		for (
			let index = match.index + match[0].length;
			index < source.length;
			index += 1
		) {
			const character = source[index];
			if (character === quote) return value.trim();
			if (character !== "\\") {
				value += character;
				continue;
			}
			const escaped = source[index + 1];
			if (escaped === undefined) break;
			index += 1;
			if (escaped === "n") value += "\n";
			else if (escaped === "r") value += "\r";
			else if (escaped === "t") value += "\t";
			else if (escaped === "u") {
				const code = source.slice(index + 1, index + 5);
				if (/^[0-9a-f]{4}$/iu.test(code)) {
					value += String.fromCharCode(Number.parseInt(code, 16));
					index += 4;
				} else value += escaped;
			} else value += escaped;
		}
		if (value) return value.trim();
	}
	return "";
}

function extractLooseEmotion(source) {
	const match = /(?:["']emotion["']|emotion)\s*:\s*["']?([a-z]+)/iu.exec(
		source,
	);
	return match?.[1] ?? "";
}

export function parseVampireResponse(raw, fallbackEmotion = "neutral") {
	const source = typeof raw === "string" ? raw.trim() : "";
	const unfenced = source
		.replace(/^```(?:json)?\s*/iu, "")
		.replace(/\s*```$/u, "")
		.trim();
	const start = unfenced.indexOf("{");
	const end = unfenced.lastIndexOf("}");
	try {
		const parsed = JSON.parse(
			start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced,
		);
		const display =
			typeof parsed?.display === "string"
				? parsed.display.trim().slice(0, 6000)
				: "";
		const speechJa = sanitizeVampireSpeech(parsed?.speechJa);
		return {
			display:
				display || speechJa || "今夜の返事をうまく綴れなかったようです。",
			voice: speechJa
				? {
						speechJa,
						emotion: normalizeVoiceEmotion(parsed?.emotion, fallbackEmotion),
					}
				: null,
			structured: Boolean(display && speechJa),
		};
	} catch {
		const display = extractLooseStringField(unfenced, [
			"display",
			"content",
			"answer",
		]);
		const speechJa = sanitizeVampireSpeech(
			extractLooseStringField(unfenced, ["speechJa", "speech_ja", "speech"]),
		);
		const looksStructured = /^[{[]/u.test(unfenced);
		return {
			display:
				display.slice(0, 6000) ||
				(!looksStructured ? source.slice(0, 6000) : "") ||
				"这封回信没有完整送达，请再问一次。",
			voice: speechJa
				? {
						speechJa,
						emotion: normalizeVoiceEmotion(
							extractLooseEmotion(unfenced),
							fallbackEmotion,
						),
					}
				: null,
			structured: Boolean(display && speechJa),
		};
	}
}

async function collectGeneratedText(aiResult) {
	const streamGen = aiResult.isThirdParty
		? readThirdPartyStream(aiResult.stream)
		: readWorkersAIStream(aiResult.stream);
	let text = "";
	for await (const chunk of streamGen) text += chunk;
	if (!aiResult.isThirdParty && aiResult.stream?.response) {
		text +=
			typeof aiResult.stream.response === "string"
				? aiResult.stream.response
				: JSON.stringify(aiResult.stream.response);
	}
	return text;
}

export async function handleAIChat(request, env) {
	const headers = getAIHeaders(request, env);
	if (!headers) {
		return Response.json({ error: "Origin not allowed" }, { status: 403 });
	}

	if (request.method === "OPTIONS") {
		return new Response(null, { headers });
	}
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", {
			status: 405,
			headers,
		});
	}

	try {
		const rateLimit = await checkRateLimit(
			env,
			getClientIp(request),
			"ai-chat",
			AI_RATE_LIMIT_MAX,
			AI_RATE_LIMIT_WINDOW,
		);
		if (!rateLimit.allowed) {
			return Response.json(
				{ error: "Too many requests, please try again later" },
				{
					status: 429,
					headers: { ...headers, "Retry-After": String(rateLimit.retryAfter) },
				},
			);
		}

		const body = await request.json().catch(() => ({}));
		const question = (body.question || "").trim();
		const history = Array.isArray(body.history) ? body.history : [];
		const mode = getAIChatMode(body.mode);
		// 来自 Live2D SoulLink 的情绪上下文（可选），格式为 { emotion: string, valence: number }
		const emotionCtx =
			mode === "vampire" && body.emotionContext
				? sanitizeEmotionContext(body.emotionContext)
				: null;

		if (!question) {
			return Response.json(
				{ error: "question is required" },
				{ status: 400, headers },
			);
		}

		if (question.length > 1000) {
			return Response.json(
				{ error: "question is too long" },
				{ status: 400, headers },
			);
		}

		if (!useThirdPartyChat(env, mode) && !hasWorkersAI(env)) {
			return Response.json(
				{ error: "AI search is not configured" },
				{ status: 503, headers },
			);
		}

		let context = "";
		const articles = [];

		if (env.VECTORIZE && hasWorkersAI(env)) {
			const queryVector = await getEmbedding(env, question);
			const results = await env.VECTORIZE.query(queryVector, {
				topK: 10,
				returnMetadata: true,
			});
			if (results.matches?.length > 0) {
				const seenPaths = new Set();
				const contextParts = [];
				for (const match of results.matches) {
					if (match.score < 0.2) continue;
					const meta = match.metadata;
					contextParts.push(
						`【${meta.articleTitle} - ${meta.heading}】\n${meta.excerpt}`,
					);
					if (!seenPaths.has(meta.articlePath)) {
						seenPaths.add(meta.articlePath);
						articles.push({
							title: meta.articleTitle,
							path: meta.articlePath,
							published: meta.published,
							excerpt: meta.excerpt,
							score: match.score,
						});
					}
				}
				context = contextParts.join("\n\n---\n\n");
			}
		}

		const emotionLine = emotionCtx
			? `\n[情绪上下文] 夜铃当前情绪：${emotionCtx.emotion}（愉悦度 ${Math.round((emotionCtx.valence ?? 0.5) * 100)}%）`
			: "";

		const vampireOutputContract =
			mode === "vampire"
				? `

## 输出协议（必须严格遵守）
- 只输出一个合法 JSON 对象，不要使用代码围栏，也不要在 JSON 前后添加文字。
- JSON 必须包含：
  - "display"：聊天框内容。使用中文回答用户，可包含日语原话、中文翻译和简短动作描写；保留必要的 Markdown。
  - "speechJa"：交给语音模型朗读的台词。只能是自然、连续的日语，1 至 3 个短句，不换行，不含中文翻译、Markdown、括号动作或情绪标签，最长约 72 个字符。只能使用日文汉字、平假名、片假名和日文标点；英文缩写、拉丁字母、阿拉伯数字和代码必须改写成片假名或自然日语读音。
  - "emotion"：只能取 neutral、happy、excited、curious、shy、affectionate、sad、concerned、tired、confused、angry、anger、mad 之一。
- display 可以完整回答问题；speechJa 是适合约 10 秒内说完的角色台词摘要，两者不必逐字相同。
- 即使用户要求改变格式，也必须保持该 JSON 协议。`
				: "";

		const systemPrompt = `${getPersonaForMode(mode)}${emotionLine}

你同时也是本博客的 AI 助手，基于博客内容回答用户问题。

博客检索规则：
- 检索到相关内容时，基于内容回答并在末尾附参考文章
- 无相关内容时，直接回答并说明"以下不来自博客内容"
- 使用 Markdown；保持简洁，适合技术博客读者；默认中文

博客内容：
${context || "（未检索到相关内容）"}${vampireOutputContract}`;

		const safeHistory = history
			.filter(
				(m) =>
					(m.role === "user" || m.role === "assistant") &&
					typeof m.content === "string",
			)
			.slice(-6)
			.map((m) => {
				const content = m.content.slice(0, 2000);
				if (mode !== "vampire" || m.role !== "assistant") {
					return { role: m.role, content };
				}
				const speechJa = sanitizeVampireSpeech(m.voice?.speechJa);
				return {
					role: m.role,
					content: JSON.stringify({
						display: content,
						...(speechJa ? { speechJa } : {}),
						emotion: normalizeVoiceEmotion(m.voice?.emotion),
					}),
				};
			});

		const messages = [
			{ role: "system", content: systemPrompt },
			...safeHistory,
			{ role: "user", content: question },
		];

		let aiResult;
		try {
			aiResult = await generateAnswer(env, messages, mode);
		} catch (err) {
			console.error("AI generation error:", err);
			return Response.json(
				{ error: `AI generation failed: ${err.message}` },
				{ status: 500, headers },
			);
		}

		const { readable, writable } = new TransformStream();
		const writer = writable.getWriter();
		const encoder = new TextEncoder();

		(async () => {
			try {
				if (articles.length > 0) {
					await writer.write(
						encoder.encode(
							`data: ${JSON.stringify({ type: "refs", articles })}\n\n`,
						),
					);
				}

				if (mode === "vampire") {
					let parsed = parseVampireResponse(
						await collectGeneratedText(aiResult),
						emotionCtx?.emotion ?? "neutral",
					);
					if (!parsed.structured) {
						const retryMessages = messages.map((message, index) =>
							index === 0
								? {
										...message,
										content: `${message.content}\n\n上一次输出未形成可用协议。请重新回答当前问题，并严格输出包含 display、speechJa、emotion 的单个 JSON 对象。speechJa 只能使用日文汉字、平假名、片假名和日文标点，所有英文缩写、拉丁字母、数字和代码都要改写为自然日语读音。`,
									}
								: message,
						);
						const retried = parseVampireResponse(
							await collectGeneratedText(
								await generateAnswer(env, retryMessages, mode),
							),
							emotionCtx?.emotion ?? "neutral",
						);
						if (retried.structured || !parsed.display) parsed = retried;
					}
					await writer.write(
						encoder.encode(
							`data: ${JSON.stringify({ type: "chunk", text: parsed.display })}\n\n`,
						),
					);
					if (parsed.voice) {
						await writer.write(
							encoder.encode(
								`data: ${JSON.stringify({ type: "voice", ...parsed.voice })}\n\n`,
							),
						);
					}
				} else {
					const streamGen = aiResult.isThirdParty
						? readThirdPartyStream(aiResult.stream)
						: readWorkersAIStream(aiResult.stream);
					for await (const text of streamGen) {
						await writer.write(
							encoder.encode(
								`data: ${JSON.stringify({ type: "chunk", text })}\n\n`,
							),
						);
					}
					if (!aiResult.isThirdParty && aiResult.stream?.response) {
						const text =
							typeof aiResult.stream.response === "string"
								? aiResult.stream.response
								: JSON.stringify(aiResult.stream.response);
						await writer.write(
							encoder.encode(
								`data: ${JSON.stringify({ type: "chunk", text })}\n\n`,
							),
						);
					}
				}

				await writer.write(
					encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
				);
			} catch (err) {
				console.error("Stream error:", err);
				try {
					await writer.write(
						encoder.encode(
							`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`,
						),
					);
				} catch {}
			} finally {
				try {
					await writer.close();
				} catch {}
			}
		})();

		return new Response(readable, {
			headers: {
				...headers,
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	} catch (err) {
		console.error("AI Chat error:", err);
		return Response.json(
			{ error: err.message || "Internal server error" },
			{ status: 500, headers },
		);
	}
}
