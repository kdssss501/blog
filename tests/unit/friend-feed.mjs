import assert from "node:assert/strict";
import {
	createFriendFeedSources,
	handleFriendFeedRequest,
	parseFriendFeedXml,
} from "../../src/server/api/routes/friend-feed.ts";

const source = {
	id: "friend-test",
	name: "测试站点",
	siteUrl: "https://example.com/",
	feedUrl: "https://example.com/rss.xml",
	avatar: "https://example.com/avatar.png",
};

const rss = `<?xml version="1.0"?><rss><channel><item><title>第一篇</title><link>https://example.com/posts/1</link><guid>post-1</guid><pubDate>Wed, 22 Jul 2026 08:00:00 GMT</pubDate><description><![CDATA[<p>带有 <strong>HTML</strong> 的摘要</p>]]></description></item></channel></rss>`;
const rssEntries = parseFriendFeedXml(rss, source);
assert.equal(rssEntries.length, 1);
assert.equal(rssEntries[0].title, "第一篇");
assert.equal(rssEntries[0].excerpt, "带有 HTML 的摘要");
assert.equal(rssEntries[0].url, "https://example.com/posts/1");

const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom 文章</title><id>tag:example.com,2026:2</id><link rel="alternate" href="/posts/2"/><updated>2026-07-22T10:00:00Z</updated><summary>摘要</summary></entry></feed>`;
const atomEntries = parseFriendFeedXml(atom, source);
assert.equal(atomEntries.length, 1);
assert.equal(atomEntries[0].url, "https://example.com/posts/2");
assert.equal(atomEntries[0].sourceId, source.id);

const unsafeLink = `<?xml version="1.0"?><rss><channel><item><title>不安全链接</title><link>javascript:alert(1)</link></item></channel></rss>`;
assert.deepEqual(parseFriendFeedXml(unsafeLink, source), []);

const baseFriend = {
	title: "站点",
	imgurl: "https://example.com/avatar.png",
	desc: "",
	siteurl: "https://example.com/",
	weight: 1,
	enabled: true,
};
const sources = createFriendFeedSources([
	{ ...baseFriend, feedUrl: "https://example.com/rss.xml" },
	{ ...baseFriend, title: "未声明" },
	{ ...baseFriend, title: "不安全", feedUrl: "http://example.com/rss.xml" },
	{
		...baseFriend,
		title: "禁用",
		feedUrl: "https://disabled.example/rss.xml",
		enabled: false,
	},
]);
assert.equal(sources.length, 1);
assert.equal(sources[0].feedUrl, "https://example.com/rss.xml");

class MemoryStorage {
	values = new Map();
	async get(key) {
		return this.values.get(key) ?? null;
	}
	async set(key, value) {
		this.values.set(key, value);
	}
	async delete(key) {
		this.values.delete(key);
	}
	async list(prefix) {
		return [...this.values]
			.filter(([key]) => key.startsWith(prefix))
			.map(([key, value]) => ({ key, value }));
	}
}

const storage = new MemoryStorage();
const response = await handleFriendFeedRequest(
	storage,
	new Request("https://blog.example/api/friend-feed"),
	new URL("https://blog.example/api/friend-feed"),
	{},
);
assert.equal(response.status, 200);
assert.deepEqual((await response.json()).entries, []);

const unconfiguredAdmin = await handleFriendFeedRequest(
	storage,
	new Request("https://blog.example/api/friend-feed", { method: "POST" }),
	new URL("https://blog.example/api/friend-feed"),
	{},
);
assert.equal(unconfiguredAdmin.status, 503);

console.log("Friend feed checks passed.");
