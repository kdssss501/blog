export interface NotebookEntry {
	id: string;
	notebook: string;
	title: string;
	date: string;
	content: string;
	cover: string;
	createdAt: number;
	updatedAt: number;
}

export type NotebookEntryLike = Pick<
	NotebookEntry,
	"id" | "notebook" | "title" | "date" | "content"
> &
	Partial<Pick<NotebookEntry, "cover" | "createdAt" | "updatedAt">>;

export interface NotebookListResponse {
	entries: NotebookEntry[];
	total: number;
}
