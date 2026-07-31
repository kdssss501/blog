import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import devApiPlugin from "../../scripts/dev-api-plugin.js";
import { handleLocalTtsRequest } from "../../src/server/api/routes/local-tts.ts";
import { createTtsGatewayHandler } from "../../src/server/tts/gateway.ts";
import {
	createLocalGptSovitsRuntime,
	GPT_SOVITS_BASE_URL,
	GPT_SOVITS_REFERENCE_PROFILES,
	V2_PRO_PLUS_LOW_LATENCY_PARAMETERS,
} from "../../src/server/tts/node-runtime.ts";
import {
	createRemoteTtsRuntime,
	createRemoteTtsRuntimeFromEnv,
} from "../../src/server/tts/remote-runtime.ts";
import {
	LOCAL_TTS_EMOTIONS,
	LocalTtsRuntimeError,
	normalizeLocalTtsInput,
	resolveLocalTtsEmotion,
} from "../../src/shared/local-tts/contract.ts";

const wavBytes = Uint8Array.from([
	0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x01,
	0x02,
]);

assert.deepEqual(LOCAL_TTS_EMOTIONS, ["neutral", "happy", "sad", "angry"]);
assert.deepEqual(
	Object.keys(GPT_SOVITS_REFERENCE_PROFILES),
	LOCAL_TTS_EMOTIONS,
);
assert.deepEqual(
	Object.fromEntries(
		Object.entries(GPT_SOVITS_REFERENCE_PROFILES).map(([emotion, profile]) => [
			emotion,
			profile.segments,
		]),
	),
	{
		neutral: ["欣慰", "はいそうですねルディ身長大きくなりましたね.wav"],
		happy: ["害羞", "えっと、ルーデオスさん、その、ありがとうございました.wav"],
		sad: ["委屈", "だって仕方ないじゃないですか好きなんですよ.wav"],
		angry: [
			"责备",
			"もし妊娠でもしてしまったらどうする気なのですかまったく.wav",
		],
	},
);

for (const [source, expected] of [
	["neutral", "neutral"],
	["happy", "neutral"],
	["curious", "neutral"],
	["affectionate", "happy"],
	["shy", "happy"],
	["concerned", "sad"],
	["tired", "sad"],
	["anxiety", "sad"],
	["anger", "angry"],
	["mad", "angry"],
]) {
	assert.equal(resolveLocalTtsEmotion(source), expected);
}
assert.equal(resolveLocalTtsEmotion("unknown"), null);

for (const text of [
	"おかえりなさい。",
	"おかえりなさい。今日はどうでしたか？",
	"大丈夫ですか？無理しないで。ここにいますよ。",
]) {
	const parsed = normalizeLocalTtsInput({ text, emotion: "happy" });
	assert.equal(parsed.ok, true, text);
}

for (const [value, code] of [
	[{ text: "你好。", emotion: "neutral" }, "TTS_JAPANESE_ONLY"],
	[{ text: "hello。", emotion: "neutral" }, "TTS_JAPANESE_ONLY"],
	[
		{ text: "一行目です。\n二行目です。", emotion: "neutral" },
		"TTS_JAPANESE_ONLY",
	],
	[
		{ text: "はい。いいえ。そうです。わかりました。", emotion: "neutral" },
		"TTS_SENTENCE_LIMIT",
	],
	[{ text: "あ".repeat(181), emotion: "neutral" }, "TTS_INVALID_TEXT"],
	[{ text: "おかえり。", emotion: "unknown" }, "TTS_INVALID_EMOTION"],
	[
		{
			text: "おかえり。",
			emotion: "neutral",
			ref_audio_path: "C:\\secret\\voice.wav",
		},
		"TTS_UNSUPPORTED_FIELDS",
	],
]) {
	const parsed = normalizeLocalTtsInput(value);
	assert.equal(parsed.ok, false);
	assert.equal(parsed.code, code);
}

assert.deepEqual(V2_PRO_PLUS_LOW_LATENCY_PARAMETERS, {
	text_lang: "all_ja",
	prompt_lang: "all_ja",
	top_k: 10,
	top_p: 0.9,
	temperature: 0.8,
	text_split_method: "cut0",
	batch_size: 1,
	batch_threshold: 0.75,
	split_bucket: false,
	speed_factor: 1.05,
	fragment_interval: 0.1,
	seed: -1,
	media_type: "wav",
	streaming_mode: 3,
	parallel_infer: false,
	repetition_penalty: 1.35,
	sample_steps: 32,
	super_sampling: false,
	overlap_length: 2,
	min_chunk_length: 16,
});

let upstreamRequest;
const runtime = createLocalGptSovitsRuntime({
	projectRoot: "C:/project",
	fileExists: async () => true,
	fetcher: async (input, init) => {
		upstreamRequest = { input: String(input), init };
		return new Response(wavBytes, {
			status: 200,
			headers: { "Content-Type": "audio/wav" },
		});
	},
});
const audio = await runtime.synthesize({
	text: "おかえりなさい。",
	emotion: "sad",
});
assert.equal(upstreamRequest.input, `${GPT_SOVITS_BASE_URL}/tts`);
assert.equal(upstreamRequest.init.method, "POST");
const upstreamBody = JSON.parse(upstreamRequest.init.body);
assert.equal(upstreamBody.text, "おかえりなさい。");
assert.equal(
	upstreamBody.prompt_text,
	GPT_SOVITS_REFERENCE_PROFILES.sad.promptText,
);
assert.match(
	upstreamBody.ref_audio_path.replaceAll("\\", "/"),
	/\/参考音频实例\/委屈\/だって仕方ないじゃないですか好きなんですよ\.wav$/u,
);
for (const [key, value] of Object.entries(V2_PRO_PLUS_LOW_LATENCY_PARAMETERS)) {
	assert.deepEqual(upstreamBody[key], value, key);
}
assert.deepEqual(new Uint8Array(audio.bytes), wavBytes);
assert.equal(audio.contentType, "audio/wav");
assert.equal(audio.emotion, "sad");

await assert.rejects(
	createLocalGptSovitsRuntime({
		fileExists: async () => true,
		fetcher: async () => {
			throw new Error("connection refused");
		},
	}).synthesize({ text: "こんばんは。", emotion: "neutral" }),
	(error) =>
		error instanceof LocalTtsRuntimeError &&
		error.code === "TTS_UPSTREAM_UNAVAILABLE" &&
		error.status === 503,
);

await assert.rejects(
	createLocalGptSovitsRuntime({
		fileExists: async () => true,
		fetcher: async () =>
			new Response(JSON.stringify({ message: "internal path disclosure" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			}),
	}).synthesize({ text: "こんばんは。", emotion: "neutral" }),
	(error) =>
		error instanceof LocalTtsRuntimeError &&
		error.code === "TTS_UPSTREAM_REJECTED" &&
		!error.message.includes("internal path disclosure"),
);

let synthesizeCalls = 0;
const fakeRuntime = {
	async health() {
		return {
			available: true,
			model: "v2ProPlus",
			referencesReady: true,
			upstreamReady: true,
		};
	},
	async synthesize(input) {
		synthesizeCalls += 1;
		return {
			bytes: wavBytes.buffer.slice(0),
			contentType: "audio/wav",
			emotion: input.emotion,
		};
	},
};

const routeResponse = await handleLocalTtsRequest(
	new Request("http://localhost/api/xiao/tts", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ text: "おかえりなさい。", emotion: "shy" }),
	}),
	fakeRuntime,
);
assert.equal(routeResponse.status, 200);
assert.equal(routeResponse.headers.get("content-type"), "audio/wav");
assert.equal(routeResponse.headers.get("x-local-tts-emotion"), "happy");
assert.deepEqual(new Uint8Array(await routeResponse.arrayBuffer()), wavBytes);
assert.equal(synthesizeCalls, 1);

let activeSynthesis = 0;
let maxConcurrentSynthesis = 0;
const serializedRuntime = {
	async health() {
		return fakeRuntime.health();
	},
	async synthesize(input) {
		activeSynthesis += 1;
		maxConcurrentSynthesis = Math.max(maxConcurrentSynthesis, activeSynthesis);
		await new Promise((resolve) => setTimeout(resolve, 12));
		activeSynthesis -= 1;
		return {
			bytes: wavBytes.buffer.slice(0),
			contentType: "audio/wav",
			emotion: input.emotion,
		};
	},
};
await Promise.all(
	["こんばんは。", "おかえりなさい。"].map((text) =>
		handleLocalTtsRequest(
			new Request("http://localhost/api/xiao/tts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text, emotion: "neutral" }),
			}),
			serializedRuntime,
		),
	),
);
assert.equal(maxConcurrentSynthesis, 1, "GPU inference must be serialized");

const pathInjectionResponse = await handleLocalTtsRequest(
	new Request("http://localhost/api/xiao/tts", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			text: "こんばんは。",
			emotion: "neutral",
			refAudioPath: "D:\\private\\reference.wav",
		}),
	}),
	fakeRuntime,
);
assert.equal(pathInjectionResponse.status, 400);
assert.equal(
	(await pathInjectionResponse.json()).code,
	"TTS_UNSUPPORTED_FIELDS",
);
assert.equal(synthesizeCalls, 1, "path injection must stop before synthesis");

const cloudResponse = await handleLocalTtsRequest(
	new Request("https://example.com/api/xiao/tts", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ text: "こんばんは。", emotion: "neutral" }),
	}),
	undefined,
);
assert.equal(cloudResponse.status, 503);
assert.equal((await cloudResponse.json()).code, "LOCAL_TTS_UNAVAILABLE");

const crossSiteResponse = await handleLocalTtsRequest(
	new Request("http://localhost/api/xiao/tts", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Sec-Fetch-Site": "cross-site",
		},
		body: JSON.stringify({ text: "こんばんは。", emotion: "neutral" }),
	}),
	fakeRuntime,
);
assert.equal(crossSiteResponse.status, 403);
assert.equal((await crossSiteResponse.json()).code, "LOCAL_TTS_FORBIDDEN");
assert.equal(
	synthesizeCalls,
	1,
	"cross-site requests must not reach synthesis",
);

const hostedSameOriginResponse = await handleLocalTtsRequest(
	new Request("https://blog.example/api/xiao/tts", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Origin: "https://blog.example",
			"Sec-Fetch-Site": "same-origin",
		},
		body: JSON.stringify({ text: "こんばんは。", emotion: "neutral" }),
	}),
	fakeRuntime,
);
assert.equal(hostedSameOriginResponse.status, 200);
assert.equal(synthesizeCalls, 2, "hosted same-origin request must reach TTS");

const healthResponse = await handleLocalTtsRequest(
	new Request("http://localhost/api/xiao/tts/health"),
	fakeRuntime,
	true,
);
assert.equal(healthResponse.status, 200);
assert.deepEqual(await healthResponse.json(), {
	available: true,
	model: "v2ProPlus",
	referencesReady: true,
	upstreamReady: true,
});

const gatewayToken = "g".repeat(48);
const gateway = createTtsGatewayHandler({
	runtime: fakeRuntime,
	token: gatewayToken,
});
const unauthorizedGatewayResponse = await gateway(
	new Request("http://127.0.0.1:8788/health"),
);
assert.equal(unauthorizedGatewayResponse.status, 401);
assert.equal(
	(await unauthorizedGatewayResponse.json()).code,
	"TTS_GATEWAY_UNAUTHORIZED",
);

const gatewayHealthResponse = await gateway(
	new Request("http://127.0.0.1:8788/health", {
		headers: { Authorization: `Bearer ${gatewayToken}` },
	}),
);
assert.equal(gatewayHealthResponse.status, 200);
assert.equal((await gatewayHealthResponse.json()).available, true);

const gatewayAudioResponse = await gateway(
	new Request("http://127.0.0.1:8788/v1/tts", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${gatewayToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ text: "おかえりなさい。", emotion: "sad" }),
	}),
);
assert.equal(gatewayAudioResponse.status, 200);
assert.deepEqual(
	new Uint8Array(await gatewayAudioResponse.arrayBuffer()),
	wavBytes,
);

let releaseGatewaySynthesis;
let markGatewaySynthesisStarted;
const gatewaySynthesisStarted = new Promise((resolve) => {
	markGatewaySynthesisStarted = resolve;
});
const queuedGateway = createTtsGatewayHandler({
	token: gatewayToken,
	maxPending: 1,
	runtime: {
		health: fakeRuntime.health,
		async synthesize(input) {
			markGatewaySynthesisStarted();
			await new Promise((resolve) => {
				releaseGatewaySynthesis = resolve;
			});
			return {
				bytes: wavBytes.buffer.slice(0),
				contentType: "audio/wav",
				emotion: input.emotion,
			};
		},
	},
});
const createGatewayRequest = (text) =>
	new Request("http://127.0.0.1:8788/v1/tts", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${gatewayToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ text, emotion: "neutral" }),
	});
const pendingGatewayResponse = queuedGateway(
	createGatewayRequest("おかえりなさい。"),
);
await gatewaySynthesisStarted;
const busyGatewayResponse = await queuedGateway(
	createGatewayRequest("こんばんは。"),
);
assert.equal(busyGatewayResponse.status, 429);
assert.equal((await busyGatewayResponse.json()).code, "TTS_GATEWAY_BUSY");
releaseGatewaySynthesis();
assert.equal((await pendingGatewayResponse).status, 200);

const remoteRequests = [];
const remoteRuntime = createRemoteTtsRuntime({
	baseUrl: "http://127.0.0.1:8788/",
	token: gatewayToken,
	fetcher: async (input, init) => {
		remoteRequests.push({ input: String(input), init });
		if (String(input).endsWith("/health")) {
			return Response.json(await fakeRuntime.health());
		}
		return new Response(wavBytes, {
			headers: {
				"Content-Type": "audio/wav",
				"X-Local-TTS-Emotion": "angry",
			},
		});
	},
});
assert.equal((await remoteRuntime.health()).available, true);
const remoteAudio = await remoteRuntime.synthesize({
	text: "こんばんは。",
	emotion: "neutral",
});
assert.equal(remoteAudio.emotion, "angry");
assert.equal(remoteRequests[0].input, "http://127.0.0.1:8788/health");
assert.equal(remoteRequests[1].input, "http://127.0.0.1:8788/v1/tts");
assert.equal(
	remoteRequests[1].init.headers.Authorization,
	`Bearer ${gatewayToken}`,
);
assert.deepEqual(JSON.parse(remoteRequests[1].init.body), {
	text: "こんばんは。",
	emotion: "neutral",
});
assert.equal(createRemoteTtsRuntimeFromEnv({}), undefined);
assert.equal(
	createRemoteTtsRuntimeFromEnv({
		TTS_UPSTREAM_URL: "http://public.example",
		TTS_SERVICE_TOKEN: gatewayToken,
	}),
	undefined,
);
assert.throws(
	() =>
		createRemoteTtsRuntime({
			baseUrl: "http://public.example",
			token: gatewayToken,
		}),
	/必须使用 HTTPS/u,
);

const routerSource = readFileSync("src/server/api/router.ts", "utf8");
assert.match(routerSource, /path === "\/api\/xiao\/tts"/u);
assert.match(routerSource, /path === "\/api\/xiao\/tts\/health"/u);
assert.match(
	routerSource,
	/handleLocalTtsRequest\(request, dependencies\.localTts/u,
);
const nodeRuntimeSource = readFileSync(
	"src/server/api/node-runtime.ts",
	"utf8",
);
assert.match(nodeRuntimeSource, /createRemoteTtsRuntimeFromEnv\(env\)/u);
assert.match(nodeRuntimeSource, /localTts\s*=\s*hosted/u);
assert.match(nodeRuntimeSource, /localTts\s*\?\s*\{\s*localTts\s*\}/u);

let middleware;
const plugin = devApiPlugin();
plugin.configureServer({
	config: { server: { port: 4321 } },
	middlewares: {
		use(handler) {
			middleware = handler;
		},
	},
	async ssrLoadModule() {
		return {
			default: {
				async fetch() {
					return new Response(wavBytes, {
						headers: { "Content-Type": "audio/wav" },
					});
				},
			},
		};
	},
});
let middlewareBody;
const middlewareChunks = [];
const middlewareHeaders = new Map();
await middleware(
	{ url: "/api/xiao/tts", method: "GET", headers: { host: "localhost:4321" } },
	{
		statusCode: 0,
		destroyed: false,
		setHeader(key, value) {
			middlewareHeaders.set(key.toLowerCase(), value);
		},
		write(value) {
			middlewareChunks.push(Buffer.from(value));
			return true;
		},
		end(value) {
			if (value) middlewareChunks.push(Buffer.from(value));
			middlewareBody = Buffer.concat(middlewareChunks);
		},
	},
	() => assert.fail("API middleware must not call next"),
);
assert.equal(middlewareHeaders.get("content-type"), "audio/wav");
assert.equal(Buffer.isBuffer(middlewareBody), true);
assert.deepEqual(new Uint8Array(middlewareBody), wavBytes);

console.log("Local GPT-SoVITS proxy checks passed.");
