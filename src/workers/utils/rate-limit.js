export const RATE_LIMIT_WINDOW = 60;
export const RATE_LIMIT_MAX = 5;
export const AI_RATE_LIMIT_WINDOW = 60;
export const AI_RATE_LIMIT_MAX = 10;
export const VOTE_RATE_LIMIT_WINDOW = 60;
export const VOTE_RATE_LIMIT_MAX = 30;

const memoryRateLimits = new Map();
const MAX_MEMORY_RATE_LIMITS = 10_000;

function checkMemoryRateLimit(key, max, windowSeconds) {
	const now = Date.now();
	const record = memoryRateLimits.get(key);
	if (!record || now - record.timestamp >= windowSeconds * 1000) {
		memoryRateLimits.set(key, { count: 1, timestamp: now });
		return { allowed: true, remaining: max - 1 };
	}

	if (record.count >= max) {
		return {
			allowed: false,
			remaining: 0,
			retryAfter: Math.ceil(windowSeconds - (now - record.timestamp) / 1000),
		};
	}

	record.count += 1;
	return { allowed: true, remaining: max - record.count };
}

function pruneMemoryRateLimits(windowSeconds) {
	if (memoryRateLimits.size <= MAX_MEMORY_RATE_LIMITS) return;
	const expiresBefore = Date.now() - windowSeconds * 1000;
	for (const [key, record] of memoryRateLimits) {
		if (record.timestamp < expiresBefore) memoryRateLimits.delete(key);
	}
}

export async function checkRateLimit(
	env,
	ip,
	scope = "guestbook",
	max = RATE_LIMIT_MAX,
	windowSeconds = RATE_LIMIT_WINDOW,
) {
	const key = `${scope}:ratelimit:${ip}`;
	if (
		typeof env?.VISITOR_KV?.get !== "function" ||
		typeof env?.VISITOR_KV?.put !== "function"
	) {
		pruneMemoryRateLimits(windowSeconds);
		return checkMemoryRateLimit(key, max, windowSeconds);
	}
	const record = await env.VISITOR_KV.get(key);

	if (record) {
		const data = JSON.parse(record);
		const now = Date.now();
		const elapsed = (now - data.timestamp) / 1000;

		if (elapsed < windowSeconds) {
			if (data.count >= max) {
				return {
					allowed: false,
					remaining: 0,
					retryAfter: Math.ceil(windowSeconds - elapsed),
				};
			}
			data.count++;
			await env.VISITOR_KV.put(key, JSON.stringify(data), {
				expirationTtl: windowSeconds,
			});
			return { allowed: true, remaining: max - data.count };
		}
	}

	await env.VISITOR_KV.put(
		key,
		JSON.stringify({ count: 1, timestamp: Date.now() }),
		{ expirationTtl: windowSeconds },
	);
	return { allowed: true, remaining: max - 1 };
}
