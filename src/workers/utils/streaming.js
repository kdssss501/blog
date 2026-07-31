function getThirdPartyContent(payload) {
	const choice = payload?.choices?.[0];
	const content =
		choice?.delta?.content ??
		choice?.message?.content ??
		payload?.output_text ??
		payload?.text;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.map((part) =>
			typeof part === "string"
				? part
				: typeof part?.text === "string"
					? part.text
					: "",
		)
		.join("");
}

function parseThirdPartyPayload(raw) {
	const text = raw.trim();
	if (!text || text === "[DONE]") return { content: "", done: true };
	try {
		const payload = JSON.parse(text);
		if (payload?.error) {
			const message =
				typeof payload.error === "string"
					? payload.error
					: payload.error.message;
			throw new Error(message || "Chat API stream error");
		}
		return { content: getThirdPartyContent(payload), done: false };
	} catch (error) {
		if (error instanceof SyntaxError) return { content: "", done: false };
		throw error;
	}
}

export async function* readThirdPartyStream(stream) {
	if (!stream) return;
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { done, value } = await reader.read();
		buffer += decoder.decode(value, { stream: !done });
		const lines = buffer.split(/\r?\n/u);
		buffer = done ? "" : (lines.pop() ?? "");
		for (const line of lines) {
			const trimmed = line.trimStart();
			if (!trimmed.startsWith("data:")) continue;
			const event = parseThirdPartyPayload(trimmed.slice(5).trimStart());
			if (event.content) yield event.content;
		}
		if (done) {
			const tail = buffer.trim();
			if (tail) {
				const raw = tail.startsWith("data:") ? tail.slice(5).trimStart() : tail;
				const event = parseThirdPartyPayload(raw);
				if (event.content) yield event.content;
			}
			break;
		}
	}
}

export async function* readWorkersAIStream(stream) {
	const reader = stream.getReader();
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value)
			yield typeof value === "string" ? value : new TextDecoder().decode(value);
	}
}
