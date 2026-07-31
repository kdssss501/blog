import { getDefaultActivities } from "@/features/activity";
import type { NotebookEntry } from "@/features/notebook";
import type { StorageAdapter } from "../storage";

export const DUMPLING_MIGRATION_ID = "dumpling-theme-73b9759";

const MARKER_KEY = `migration:${DUMPLING_MIGRATION_ID}`;
const BACKUP_KEY = `migration:backup:${DUMPLING_MIGRATION_ID}`;

const referenceNotebook: NotebookEntry = {
	id: "nb_dumpling_sample",
	notebook: "示例日记本",
	title: "示例日记本",
	date: "2026-05-30",
	content: "这是一个示例日记本。你可以在笔记本管理页中继续创建更多日记本。",
	cover: "",
	createdAt: new Date("2026-05-30T12:00:00+08:00").getTime(),
	updatedAt: new Date("2026-05-30T12:00:00+08:00").getTime(),
};

export interface DumplingMigrationReport {
	id: string;
	alreadyApplied: boolean;
	removedActivities: number;
	removedNotebooks: number;
	importedActivities: number;
	importedNotebooks: number;
	backupKey: string;
}

async function collectKeys(storage: StorageAdapter, prefix: string) {
	return storage.list(prefix);
}

export async function previewDumplingMigration(
	storage: StorageAdapter,
): Promise<DumplingMigrationReport> {
	const [activityEntries, notebookEntries, marker] = await Promise.all([
		collectKeys(storage, "activity:"),
		collectKeys(storage, "notebook:"),
		storage.get(MARKER_KEY),
	]);
	return {
		id: DUMPLING_MIGRATION_ID,
		alreadyApplied: marker !== null,
		removedActivities: activityEntries.filter((entry) =>
			entry.key.startsWith("activity:item:"),
		).length,
		removedNotebooks: notebookEntries.filter((entry) =>
			entry.key.startsWith("notebook:entry:"),
		).length,
		importedActivities: getDefaultActivities().length,
		importedNotebooks: 1,
		backupKey: BACKUP_KEY,
	};
}

export async function applyDumplingMigration(
	storage: StorageAdapter,
): Promise<DumplingMigrationReport> {
	const report = await previewDumplingMigration(storage);
	if (report.alreadyApplied) return report;

	const [activityEntries, notebookEntries] = await Promise.all([
		collectKeys(storage, "activity:"),
		collectKeys(storage, "notebook:"),
	]);
	await storage.set(
		BACKUP_KEY,
		JSON.stringify({
			createdAt: Date.now(),
			activity: activityEntries,
			notebook: notebookEntries,
		}),
	);

	for (const entry of [...activityEntries, ...notebookEntries]) {
		await storage.delete(entry.key);
	}

	const activities = getDefaultActivities();
	for (const activity of activities) {
		await storage.set(
			`activity:item:${activity.slug}`,
			JSON.stringify(activity),
		);
	}
	await storage.set(
		"activity:list",
		JSON.stringify(activities.map((activity) => activity.slug)),
	);

	await storage.set(
		`notebook:entry:${referenceNotebook.id}`,
		JSON.stringify(referenceNotebook),
	);
	await storage.set("notebook:list", JSON.stringify([referenceNotebook.id]));
	await storage.set("notebook:counter", "1");
	await storage.set(
		MARKER_KEY,
		JSON.stringify({ appliedAt: Date.now(), backupKey: BACKUP_KEY }),
	);
	return { ...report, alreadyApplied: false };
}
