import assert from "node:assert/strict";
import { handleGuestbookRequest } from "../../src/server/api/routes/guestbook.ts";

class MemoryStorage {
	values = new Map();

	async pause() {
		await Promise.resolve();
	}

	async get(key) {
		await this.pause();
		return this.values.get(key) ?? null;
	}

	async set(key, value) {
		await this.pause();
		this.values.set(key, value);
	}

	async delete(key) {
		await this.pause();
		this.values.delete(key);
	}

	async list(prefix) {
		await this.pause();
		return [...this.values.entries()]
			.filter(([key]) => key.startsWith(prefix))
			.map(([key, value]) => ({ key, value }));
	}
}

let requestSequence = 0;

function apiRequest(
	storage,
	{
		path = "/api/guestbook/",
		method = "GET",
		body,
		rawBody,
		ip = `198.51.100.${++requestSequence}`,
		contentType = "application/json",
	} = {},
) {
	const headers = new Headers({ "X-Forwarded-For": ip });
	if (contentType !== null) headers.set("Content-Type", contentType);
	const serializedBody =
		rawBody !== undefined
			? rawBody
			: body === undefined
				? undefined
				: JSON.stringify(body);
	const request = new Request(`https://example.test${path}`, {
		method,
		headers,
		body: serializedBody,
	});
	return handleGuestbookRequest(storage, request, new URL(request.url));
}

async function expectError(responsePromise, status, pattern) {
	const response = await responsePromise;
	assert.equal(response.status, status);
	const body = await response.json();
	assert.match(body.error, pattern);
}

const validationStorage = new MemoryStorage();
await expectError(
	apiRequest(validationStorage, {
		method: "POST",
		body: { author: "测试", content: "足够长的留言" },
		contentType: "text/plain",
	}),
	415,
	/Content-Type/,
);
await expectError(
	apiRequest(validationStorage, { method: "POST", rawBody: "{" }),
	400,
	/valid JSON/,
);
await expectError(
	apiRequest(validationStorage, { method: "POST", body: [] }),
	400,
	/JSON object/,
);
await expectError(
	apiRequest(validationStorage, {
		method: "POST",
		body: { author: 42, content: "足够长的留言" },
	}),
	400,
	/must be strings/,
);
await expectError(
	apiRequest(validationStorage, {
		method: "POST",
		body: { author: "单", content: "足够长的留言" },
	}),
	400,
	/author must be 2-30/,
);
await expectError(
	apiRequest(validationStorage, {
		method: "POST",
		body: { author: "昵".repeat(31), content: "足够长的留言" },
	}),
	400,
	/author must be 2-30/,
);
await expectError(
	apiRequest(validationStorage, {
		method: "POST",
		body: { author: "测试", content: "四个字" },
	}),
	400,
	/content must be 5-300/,
);
await expectError(
	apiRequest(validationStorage, {
		method: "POST",
		body: { author: "测试", content: "长".repeat(301) },
	}),
	400,
	/content must be 5-300/,
);
await expectError(
	apiRequest(validationStorage, {
		method: "POST",
		body: { author: "测试", content: "合法内容\u0000非法" },
	}),
	400,
	/control characters/,
);
await expectError(
	apiRequest(validationStorage, {
		method: "POST",
		rawBody: JSON.stringify({ author: "测试", content: "长".repeat(4_100) }),
	}),
	413,
	/too large/,
);
await expectError(
	apiRequest(validationStorage, { path: "/api/guestbook/?offset=-1" }),
	400,
	/offset/,
);
await expectError(
	apiRequest(validationStorage, { path: "/api/guestbook/?limit=21" }),
	400,
	/limit/,
);

const rawTextStorage = new MemoryStorage();
const rawTextResponse = await apiRequest(rawTextStorage, {
	method: "POST",
	body: {
		author: "A&B",
		content: '<hello> & "world"',
	},
});
assert.equal(rawTextResponse.status, 201);
const rawTextMessage = await rawTextResponse.json();
assert.equal(rawTextMessage.author, "A&B");
assert.equal(rawTextMessage.content, '<hello> & "world"');
assert.match(rawTextMessage.id, /^msg_[A-Za-z0-9_-]+$/);
const storedRawText = JSON.parse(
	rawTextStorage.values.get(`guestbook:msg:${rawTextMessage.id}`),
);
assert.equal(storedRawText.author, "A&B");
assert.equal(storedRawText.content, '<hello> & "world"');

const limitedStorage = new MemoryStorage();
for (let index = 0; index < 5; index += 1) {
	const response = await apiRequest(limitedStorage, {
		method: "POST",
		ip: "203.0.113.10",
		body: { author: "限流访客", content: `这是第 ${index + 1} 条留言内容` },
	});
	assert.equal(response.status, 201);
}
const limitedResponse = await apiRequest(limitedStorage, {
	method: "POST",
	ip: "203.0.113.10",
	body: { author: "限流访客", content: "这是第六条留言内容" },
});
assert.equal(limitedResponse.status, 429);
assert.ok(Number(limitedResponse.headers.get("Retry-After")) >= 1);
assert.equal(JSON.parse(limitedStorage.values.get("guestbook:list")).length, 5);

const concurrentStorage = new MemoryStorage();
const concurrentResponses = await Promise.all(
	Array.from({ length: 20 }, (_, index) =>
		apiRequest(concurrentStorage, {
			method: "POST",
			ip: `192.0.2.${index + 1}`,
			body: {
				author: `访客${index + 1}`,
				content: `并发提交的第 ${index + 1} 条留言内容`,
			},
		}),
	),
);
assert.deepEqual(
	concurrentResponses.map((response) => response.status),
	Array(20).fill(201),
);
const concurrentIds = JSON.parse(
	concurrentStorage.values.get("guestbook:list"),
);
assert.equal(concurrentIds.length, 20);
assert.equal(new Set(concurrentIds).size, 20);

const firstPageResponse = await apiRequest(concurrentStorage, {
	path: "/api/guestbook/?offset=0&limit=5",
});
assert.equal(firstPageResponse.status, 200);
const firstPage = await firstPageResponse.json();
assert.equal(firstPage.total, 20);
assert.equal(firstPage.messages.length, 5);
const secondPageResponse = await apiRequest(concurrentStorage, {
	path: "/api/guestbook/?offset=5&limit=5",
});
const secondPage = await secondPageResponse.json();
assert.equal(secondPage.messages.length, 5);
assert.equal(
	firstPage.messages.some((message) =>
		secondPage.messages.some((other) => other.id === message.id),
	),
	false,
);

const voteTarget = firstPage.messages[0];
const voteResponses = await Promise.all(
	["198.18.0.1", "198.18.0.2"].map((ip) =>
		apiRequest(concurrentStorage, {
			path: `/api/guestbook/${voteTarget.id}/vote/`,
			method: "POST",
			ip,
			body: { type: "agree" },
		}),
	),
);
assert.deepEqual(
	voteResponses.map((response) => response.status),
	[200, 200],
);
const votedResponse = await apiRequest(concurrentStorage, {
	path: `/api/guestbook/${voteTarget.id}/`,
});
const votedMessage = await votedResponse.json();
assert.equal(votedMessage.votes.agree, 2);

console.log("guestbook API tests passed");
