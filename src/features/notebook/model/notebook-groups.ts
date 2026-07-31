import type { NotebookEntry } from "./types";

export function mergeNotebookEntries(
	primaryEntries: readonly NotebookEntry[],
	secondaryEntries: readonly NotebookEntry[],
): NotebookEntry[] {
	const entries = new Map<string, NotebookEntry>();
	for (const entry of [...primaryEntries, ...secondaryEntries]) {
		const identity = [entry.notebook, entry.title, entry.date].join("\u0000");
		entries.set(identity, entry);
	}
	return sortNotebookEntries([...entries.values()]);
}

export type NotebookGroup = {
	name: string;
	count: number;
	lastUpdated: number;
	cover: string;
	description: string;
};

export function sortNotebookEntries(entries: readonly NotebookEntry[]) {
	return [...entries].sort((left, right) => {
		if (left.date !== right.date) return right.date.localeCompare(left.date);
		if (left.updatedAt !== right.updatedAt)
			return right.updatedAt - left.updatedAt;
		return left.id.localeCompare(right.id);
	});
}

export function summarizeNotebookContent(content: string, maxLength = 72) {
	const summary = content
		.replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
		.replace(/\[[^\]]+\]\([^)]+\)/g, " ")
		.replace(/[#*`>_-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return summary.length > maxLength ? summary.slice(0, maxLength) : summary;
}

export function groupNotebookEntries(
	entries: readonly NotebookEntry[],
): NotebookGroup[] {
	const grouped = new Map<string, NotebookEntry[]>();
	for (const entry of entries) {
		const group = grouped.get(entry.notebook) ?? [];
		group.push(entry);
		grouped.set(entry.notebook, group);
	}

	return [...grouped.entries()]
		.map(([name, groupEntries]) => {
			const sorted = sortNotebookEntries(groupEntries);
			const latest = sorted[0];
			return {
				name,
				count: groupEntries.length,
				lastUpdated: latest?.updatedAt ?? 0,
				cover: latest?.cover ?? "",
				description:
					summarizeNotebookContent(latest?.content ?? "") || "暂无描述",
			};
		})
		.sort((left, right) => {
			if (left.lastUpdated !== right.lastUpdated) {
				return right.lastUpdated - left.lastUpdated;
			}
			return left.name.localeCompare(right.name, "zh-CN");
		});
}
