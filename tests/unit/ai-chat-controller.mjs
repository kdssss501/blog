import assert from "node:assert/strict";
import {
	AIChatSSEDecoder,
	createAIChatController,
} from "../../src/features/search/model/ai-chat-controller.ts";

class MemoryStorage {
	data = new Map();

	getItem(key) {
		return this.data.get(key) ?? null;
	}

	setItem(key, value) {
		this.data.set(key, String(value));
	}

	removeItem(key) {
		this.data.delete(key);
	}
}

function createIdOptions(overrides = {}) {
	let random = 0;
	return {
		now: () => 1_722_000_000_000,
		random: () => (random += 0.01),
		isOnline: () => true,
		...overrides,
	};
}

function streamResponse(chunks, status = 200) {
	const encoder = new TextEncoder();
	return new Response(
		new ReadableStream({
			start(controller) {
				for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
				controller.close();
			},
		}),
		{
			status,
			headers: { "Content-Type": "text/event-stream" },
		},
	);
}

{
	const decoder = new AIChatSSEDecoder();
	const events = [
		...decoder.push('data: {"type":"refs","articles":[{"title":"参'),
		...decoder.push(
			'考文章","path":"/posts/ref/","excerpt":"摘要"}]}\r\n\r\ndata: {"type":"chunk",',
		),
		...decoder.push(
			'"text":"你好"}\n\ndata: {"type":"voice","speechJa":"こんばんは。","emotion":"happy"}\n\ndata: {"type":"done"}',
		),
		...decoder.finish(),
	];
	assert.deepEqual(events, [
		{
			type: "refs",
			articles: [
				{
					title: "参考文章",
					path: "/posts/ref/",
					excerpt: "摘要",
				},
			],
		},
		{ type: "chunk", text: "你好" },
		{ type: "voice", speechJa: "こんばんは。", emotion: "happy" },
		{ type: "done" },
	]);
}

{
	const storage = new MemoryStorage();
	storage.setItem(
		"ai-chat:sessions",
		JSON.stringify([
			{ id: "older", title: "旧会话", updatedAt: 10 },
			{ id: "latest", title: "新会话", updatedAt: 20 },
		]),
	);
	storage.setItem(
		"ai-chat:session:latest",
		JSON.stringify([{ role: "user", content: "恢复这段对话" }]),
	);
	const controller = createAIChatController(createIdOptions({ storage }));
	controller.restore();
	assert.equal(controller.snapshot.sessionId, "latest");
	assert.equal(controller.snapshot.messages[0].content, "恢复这段对话");
	assert.equal(controller.snapshot.messages[0].streaming, false);
	assert.match(controller.snapshot.messages[0].id, /^msg_/);
	assert.deepEqual(
		controller.snapshot.sessions.map(({ id }) => id),
		["latest", "older"],
	);
}

{
	const storage = new MemoryStorage();
	const observedStatuses = [];
	let requestBody;
	const controller = createAIChatController(
		createIdOptions({
			storage,
			fetcher: async (_input, init) => {
				requestBody = JSON.parse(init.body);
				return streamResponse([
					'data: {"type":"refs","articles":[{"title":"参考","path":"/posts/a/","excerpt":"摘',
					'要"}]}\n\ndata: {"type":"chunk","text":"第一段"}\n',
					'\ndata: {"type":"chunk","text":"第二段"}\n\ndata: {"type":"voice","speechJa":"お帰りなさい。","emotion":"affectionate"}\n\ndata: {"type":"done"}\n\n',
				]);
			},
		}),
	);
	const unsubscribe = controller.subscribe(({ status }) => {
		observedStatuses.push(status);
	});
	const outcome = await controller.send("测试问题");
	unsubscribe();

	assert.equal(outcome, "done");
	assert.equal(controller.snapshot.status, "idle");
	assert.equal(controller.snapshot.isLoading, false);
	assert.equal(controller.snapshot.messages[1].content, "第一段第二段");
	assert.equal(controller.snapshot.messages[1].streaming, false);
	assert.equal(controller.snapshot.messages[1].refs[0].title, "参考");
	assert.deepEqual(controller.snapshot.messages[1].voice, {
		speechJa: "お帰りなさい。",
		emotion: "affectionate",
	});
	assert.deepEqual(requestBody.history, []);
	assert.equal(requestBody.question, "测试问题");
	assert.equal(requestBody.assistant, undefined);
	assert.equal(requestBody.mode, undefined);
	assert.ok(observedStatuses.includes("thinking"));
	assert.ok(observedStatuses.includes("streaming"));
	assert.ok(storage.getItem("ai-chat:sessions"));
	assert.ok(
		storage.getItem(`ai-chat:session:${controller.snapshot.sessionId}`),
	);

	await controller.send("继续问一个自由问题");
	assert.deepEqual(requestBody.history.at(-1).voice, {
		speechJa: "お帰りなさい。",
		emotion: "affectionate",
	});

	controller.setListening(true);
	assert.equal(controller.snapshot.status, "listening");
	controller.setListening(false);
	controller.setSpeaking(true);
	assert.equal(controller.snapshot.status, "speaking");
	controller.setSpeaking(false);
	assert.equal(controller.snapshot.status, "idle");
	controller.setOnline(false);
	assert.equal(controller.snapshot.status, "offline");
	assert.equal(controller.snapshot.lastError.code, "offline");
	controller.setOnline(true);
	assert.equal(controller.snapshot.status, "idle");
}

{
	let fetchCalls = 0;
	const controller = createAIChatController(
		createIdOptions({
			storage: new MemoryStorage(),
			isOnline: () => false,
			fetcher: async () => {
				fetchCalls += 1;
				return streamResponse(['data: {"type":"done"}\n\n']);
			},
		}),
	);
	assert.equal(controller.snapshot.online, false);
	assert.equal(await controller.send("即使浏览器误报离线也尝试发送"), "done");
	assert.equal(fetchCalls, 1);
	assert.equal(controller.snapshot.online, true);
}

{
	const controller = createAIChatController(
		createIdOptions({
			storage: new MemoryStorage(),
			fetcher: async () =>
				streamResponse(['data: {"type":"error","error":"上游连接失败"}\n\n']),
		}),
	);
	assert.equal(await controller.send("触发流错误"), "error");
	assert.equal(controller.snapshot.status, "error");
	assert.equal(controller.snapshot.lastError.code, "stream");
	assert.match(controller.snapshot.messages[1].content, /上游连接失败/);
	controller.clearError();
	assert.equal(controller.snapshot.status, "idle");
}

{
	let requestStarted;
	const started = new Promise((resolve) => {
		requestStarted = resolve;
	});
	const controller = createAIChatController(
		createIdOptions({
			storage: new MemoryStorage(),
			fetcher: async (_input, init) => {
				requestStarted();
				return await new Promise((_resolve, reject) => {
					init.signal.addEventListener(
						"abort",
						() => {
							const error = new Error("aborted");
							error.name = "AbortError";
							reject(error);
						},
						{ once: true },
					);
				});
			},
		}),
	);
	const pending = controller.send("停止这次回答");
	await started;
	controller.stop();
	assert.equal(await pending, "aborted");
	assert.equal(controller.snapshot.status, "idle");
	assert.equal(controller.snapshot.isLoading, false);
	assert.match(controller.snapshot.messages[1].content, /已停止生成/);
}

{
	let fetchCalls = 0;
	const controller = createAIChatController(
		createIdOptions({
			storage: new MemoryStorage(),
			fetcher: async () => {
				fetchCalls += 1;
				return streamResponse(['data: {"type":"done"}\n\n']);
			},
		}),
	);
	assert.equal(await controller.send("长".repeat(1001)), "invalid");
	assert.equal(fetchCalls, 0);
	assert.equal(controller.snapshot.status, "error");
	assert.equal(controller.snapshot.lastError.code, "validation");
	assert.match(controller.snapshot.messages[0].content, /1000 个字符/);
}

{
	const storage = new MemoryStorage();
	let requestBody;
	const controller = createAIChatController(
		createIdOptions({
			storage,
			assistant: "vampire",
			mode: "vampire",
			storageNamespace: "ai-chat:vampire",
			fetcher: async (_input, init) => {
				requestBody = JSON.parse(init.body);
				return streamResponse(['data: {"type":"done"}\n\n']);
			},
		}),
	);

	assert.equal(await controller.send("夜访测试"), "done");
	assert.equal(requestBody.assistant, "vampire");
	assert.equal(requestBody.mode, "vampire");
	assert.ok(storage.getItem("ai-chat:vampire:sessions"));
	assert.ok(
		storage.getItem(`ai-chat:vampire:session:${controller.snapshot.sessionId}`),
	);
	assert.equal(storage.getItem("ai-chat:sessions"), null);
}

console.log("AI chat controller checks passed.");
