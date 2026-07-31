import assert from "node:assert/strict";
import { aiSearchConfig } from "../../src/config/aiSearchConfig.ts";
import {
	getAIChatMode,
	getChatModelForMode,
	getPersonaForMode,
	handleAIChat,
	parseVampireResponse,
	sanitizeVampireSpeech,
	useThirdPartyChat,
} from "../../src/workers/ai-chat.js";
import { readThirdPartyStream } from "../../src/workers/utils/streaming.js";

assert.equal(getAIChatMode("vampire"), "vampire");
assert.equal(getAIChatMode("default"), undefined);
assert.equal(getAIChatMode({ mode: "vampire" }), undefined);

assert.equal(getChatModelForMode("vampire"), aiSearchConfig.vampireChatModel);
assert.equal(getChatModelForMode("vampire"), "deepseek-v4-flash");
assert.equal(getChatModelForMode(undefined), aiSearchConfig.modelName);
assert.equal(aiSearchConfig.apiUrl, "https://api.deepseek.com");
assert.equal(useThirdPartyChat({ AI_API_KEY: "test-key" }, "vampire"), true);
assert.equal(useThirdPartyChat({}, "vampire"), false);

const vampirePersona = getPersonaForMode("vampire");
assert.match(vampirePersona, /明确虚构/);
assert.match(vampirePersona, /不冒充/);
assert.match(vampirePersona, /不声称看见/);
assert.match(getPersonaForMode(undefined), /小爱助手/);

assert.equal(
	sanitizeVampireSpeech("お帰りなさい。\n会えて嬉しいです。"),
	"お帰りなさい。会えて嬉しいです。",
);
assert.equal(sanitizeVampireSpeech("这不是日语"), null);
assert.equal(sanitizeVampireSpeech("Rustの所有権は安全です。"), null);
assert.equal(
	sanitizeVampireSpeech(
		"所有権システムがデータ競合を防ぐ理由は、一つの値に一つの所有者しか許さず、借用規則で同時に複数の可変参照を禁止するからです。コンパイラが実行前に危険な共有を検査します。",
	),
	"所有権システムがデータ競合を防ぐ理由は、一つの値に一つの所有者しか許さず、借用規則で同時に複数の可変参照を禁止するからです。",
);
const parsedVoice = parseVampireResponse(
	JSON.stringify({
		display: "「お帰りなさい。」\n\n译：欢迎回来。",
		speechJa: "お帰りなさい。会えて嬉しいです。",
		emotion: "happy",
	}),
);
assert.equal(parsedVoice.voice?.emotion, "happy");
assert.equal(parsedVoice.voice?.speechJa, "お帰りなさい。会えて嬉しいです。");
assert.match(parsedVoice.display, /欢迎回来/);

const recoveredVoice = parseVampireResponse(
	'{"display":"自由问题也能正常回答。","speechJa":"どんな質問にも答えられます。","emotion":"curious"',
);
assert.equal(recoveredVoice.structured, true);
assert.equal(recoveredVoice.display, "自由问题也能正常回答。");
assert.equal(recoveredVoice.voice?.emotion, "curious");
assert.doesNotMatch(parseVampireResponse("").display, /解析失败/);

{
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(
				new TextEncoder().encode(
					'data:{"choices":[{"delta":{"content":"尾包也不能丢"}}]}',
				),
			);
			controller.close();
		},
	});
	let content = "";
	for await (const chunk of readThirdPartyStream(stream)) content += chunk;
	assert.equal(content, "尾包也不能丢");
}

const originalFetch = globalThis.fetch;

function createChatStream(text) {
	return new ReadableStream({
		start(controller) {
			controller.enqueue(
				new TextEncoder().encode(
					`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`,
				),
			);
			controller.close();
		},
	});
}

const chatRequests = [];
let malformedResponsesRemaining = 1;
globalThis.fetch = async (url, init) => {
	const body = JSON.parse(init.body);
	chatRequests.push({
		url: String(url),
		body,
		authorization: new Headers(init.headers).get("Authorization"),
	});
	const currentQuestion = body.messages.at(-1)?.content;
	if (currentQuestion === "触发格式重试" && malformedResponsesRemaining > 0) {
		malformedResponsesRemaining -= 1;
		return new Response(createChatStream("这是一段没有 JSON 包装的回答"), {
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
		});
	}
	return new Response(
		createChatStream(
			JSON.stringify({
				display: "「お帰りなさい。」\n\n译：欢迎回来。",
				speechJa: "お帰りなさい。会えて嬉しいです。",
				emotion: "happy",
			}),
		),
		{
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
		},
	);
};

try {
	const response = await handleAIChat(
		new Request("http://local.test/api/ai-chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ question: "hello", mode: "vampire" }),
		}),
		{ AI_API_KEY: "test-key" },
	);
	const streamText = await response.text();
	assert.equal(response.status, 200);
	assert.match(response.headers.get("content-type"), /text\/event-stream/);
	assert.match(streamText, /欢迎回来/);
	assert.match(streamText, /"type":"voice"/);
	assert.match(streamText, /会えて嬉しいです/);
	assert.equal(chatRequests.length, 1);
	assert.equal(
		chatRequests[0].url,
		"https://api.deepseek.com/v1/chat/completions",
	);
	assert.equal(chatRequests[0].body.model, "deepseek-v4-flash");
	assert.deepEqual(chatRequests[0].body.response_format, {
		type: "json_object",
	});
	assert.equal(chatRequests[0].body.max_tokens, 1200);
	assert.equal(chatRequests[0].body.temperature, 0.65);
	assert.equal(chatRequests[0].authorization, "Bearer test-key");

	const bomKeyResponse = await handleAIChat(
		new Request("http://local.test/api/ai-chat", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Forwarded-For": "unit-bom-key",
			},
			body: JSON.stringify({ question: "bom key", mode: "vampire" }),
		}),
		{ AI_API_KEY: "\uFEFF test-key \n" },
	);
	assert.equal(bomKeyResponse.status, 200);
	await bomKeyResponse.text();
	assert.equal(chatRequests.at(-1).authorization, "Bearer test-key");

	const retryResponse = await handleAIChat(
		new Request("http://local.test/api/ai-chat", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Forwarded-For": "unit-format-retry",
			},
			body: JSON.stringify({
				question: "触发格式重试",
				mode: "vampire",
				history: [
					{ role: "user", content: "上一问" },
					{
						role: "assistant",
						content: "上一答",
						voice: { speechJa: "前の返事です。", emotion: "neutral" },
					},
				],
			}),
		}),
		{ AI_API_KEY: "test-key" },
	);
	const retryText = await retryResponse.text();
	assert.match(retryText, /欢迎回来/);
	assert.doesNotMatch(retryText, /没有 JSON 包装/);
	assert.equal(malformedResponsesRemaining, 0);
	const retryRequests = chatRequests.filter(
		(request) => request.body.messages.at(-1)?.content === "触发格式重试",
	);
	assert.equal(retryRequests.length, 2);
	assert.deepEqual(JSON.parse(retryRequests[0].body.messages.at(-2).content), {
		display: "上一答",
		speechJa: "前の返事です。",
		emotion: "neutral",
	});

	let embeddingCalls = 0;
	let vectorQueries = 0;
	const responseWithSearch = await handleAIChat(
		new Request("http://local.test/api/ai-chat", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Forwarded-For": "unit-vector-search",
			},
			body: JSON.stringify({ question: "search", mode: "vampire" }),
		}),
		{
			AI_API_KEY: "test-key",
			AI: {
				async run(model) {
					embeddingCalls += 1;
					assert.equal(model, "@cf/baai/bge-large-en-v1.5");
					return { data: [[0.1, 0.2]] };
				},
			},
			VECTORIZE: {
				async query(vector) {
					vectorQueries += 1;
					assert.deepEqual(vector, [0.1, 0.2]);
					return { matches: [] };
				},
			},
		},
	);
	await responseWithSearch.text();
	assert.equal(responseWithSearch.status, 200);
	assert.equal(embeddingCalls, 1);
	assert.equal(vectorQueries, 1);
} finally {
	globalThis.fetch = originalFetch;
}

console.log("AI chat worker checks passed.");
