export interface PostDocumentInput {
	id?: string;
	title: string;
	slug: string;
	description: string;
	category: string;
	tags: string[];
	published: string;
	draft: boolean;
	body: string;
}

export interface PostDraft extends PostDocumentInput {
	id: string;
	updatedAt: number;
}

export interface PostValidationIssue {
	field: keyof PostDocumentInput;
	message: string;
}

function stringValue(value: unknown, maxLength: number): string {
	return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function stringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim().slice(0, 32))
		.filter(Boolean)
		.slice(0, 12);
}

export function normalizePostSlug(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\p{L}\p{N}\s-]/gu, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 96);
}

export function normalizePostDocument(
	value: Record<string, unknown>,
): PostDocumentInput {
	const title = stringValue(value.title, 120);
	const slug = normalizePostSlug(stringValue(value.slug, 120) || title);
	const category = normalizePostSlug(stringValue(value.category, 48));
	return {
		...(typeof value.id === "string" && value.id
			? { id: value.id.slice(0, 80) }
			: {}),
		title,
		slug,
		description: stringValue(value.description, 300),
		category,
		tags: stringArray(value.tags),
		published: stringValue(value.published, 32),
		draft: value.draft !== false,
		body: typeof value.body === "string" ? value.body.slice(0, 500_000) : "",
	};
}

export function validatePostDocument(
	document: PostDocumentInput,
): PostValidationIssue[] {
	const issues: PostValidationIssue[] = [];
	if (!document.title) issues.push({ field: "title", message: "标题不能为空" });
	if (!document.slug) issues.push({ field: "slug", message: "Slug 不能为空" });
	if (!document.description) {
		issues.push({ field: "description", message: "摘要不能为空" });
	}
	if (!document.category) {
		issues.push({ field: "category", message: "分类不能为空" });
	}
	if (!document.published || Number.isNaN(Date.parse(document.published))) {
		issues.push({ field: "published", message: "发布日期无效" });
	}
	if (!document.body.trim()) {
		issues.push({ field: "body", message: "正文不能为空" });
	}
	return issues;
}
