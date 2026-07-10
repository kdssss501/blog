export async function* readThirdPartyStream(stream) {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop();
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed?.startsWith("data: ")) continue;
			if (trimmed === "data: [DONE]") continue;
			try {
				const content = JSON.parse(trimmed.slice(6))?.choices?.[0]?.delta
					?.content;
				if (content) yield content;
			} catch {}
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
