export const ACTIVITY_CACHE_TTL = 180000;
export const ACTIVITY_LIST_CACHE_VERSION = "cards-v6";
export const ACTIVITY_DETAIL_CACHE_VERSION = "detail-v6";

export function getActivityCacheKey(version: string, key: string): string {
	return `activity_${version}_${key}`;
}

export function formatActivityDate(timestamp: number): string {
	const d = new Date(timestamp);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	const h = String(d.getHours()).padStart(2, "0");
	const min = String(d.getMinutes()).padStart(2, "0");
	return `${y}-${m}-${day} ${h}:${min}`;
}

export function stripActivityHtml(html: string): string {
	if (typeof document === "undefined") {
		return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
	}

	const div = document.createElement("div");
	div.innerHTML = html || "";
	return (div.textContent || "").replace(/\s+/g, " ").trim();
}
