import { getCollection } from "astro:content";
import type { NotebookEntry } from "./model/types";

function bodyTitle(body: string, fallback: string) {
	return body.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback;
}

export async function getObsidianNotebookEntries(): Promise<NotebookEntry[]> {
	const entries = await getCollection("notebooks", ({ data }) => !data.draft);
	return entries
		.map((entry) => {
			const date = entry.data.date ?? entry.data.updated ?? new Date(0);
			const updated = entry.data.updated ?? date;
			const content = entry.body ?? "";
			return {
				id: `obsidian:${entry.id}`,
				notebook: entry.data.notebook || entry.data.name || "随手笔记",
				title:
					entry.data.title ||
					bodyTitle(content, entry.data.summary || entry.id),
				date: date.toISOString().slice(0, 10),
				content,
				cover: entry.data.cover,
				createdAt: date.getTime(),
				updatedAt: updated.getTime(),
			} satisfies NotebookEntry;
		})
		.sort((left, right) => right.updatedAt - left.updatedAt);
}
