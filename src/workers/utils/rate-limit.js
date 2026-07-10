export const RATE_LIMIT_WINDOW = 60;
export const RATE_LIMIT_MAX = 5;
export const AI_RATE_LIMIT_WINDOW = 60;
export const AI_RATE_LIMIT_MAX = 10;
export const VOTE_RATE_LIMIT_WINDOW = 60;
export const VOTE_RATE_LIMIT_MAX = 30;

export async function checkRateLimit(
	env,
	ip,
	scope = "guestbook",
	max = RATE_LIMIT_MAX,
	windowSeconds = RATE_LIMIT_WINDOW,
) {
	const key = `${scope}:ratelimit:${ip}`;
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
