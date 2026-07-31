export type QueryValue = string | number | boolean | null | undefined;

export function createApiUrl(basePath: string, ...segments: string[]): string {
	const baseSegments = basePath.split("/").filter(Boolean);
	const encodedSegments = segments.map((segment) =>
		encodeURIComponent(segment),
	);
	return `/${[...baseSegments, ...encodedSegments].join("/")}/`;
}

export function withQuery(
	path: string,
	query: Record<string, QueryValue>,
): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== null && value !== undefined) {
			params.set(key, String(value));
		}
	}
	const search = params.toString();
	return search ? `${path}?${search}` : path;
}
