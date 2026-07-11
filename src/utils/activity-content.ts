import { pickLocalActivityGalleryUrl } from "@/utils/activity-gallery";

export interface ActivityImage {
	url: string;
	alt?: string;
	prompt?: string;
	source?: "gpt" | "manual" | "legacy";
}

export interface ActivityOverview {
	readingMinutes?: number;
	sectionCount?: number;
	imageCount?: number;
	updatedLabel?: string;
}

export interface ActivityRecord {
	id: string;
	slug: string;
	title?: string;
	excerpt?: string;
	content?: string;
	body?: string;
	presentationVersion?: string;
	overview?: ActivityOverview;
	createdAt: number;
	updatedAt: number;
	image?: string;
	images?: ActivityImage[];
}

export interface NormalizedActivity {
	id: string;
	slug: string;
	title: string;
	excerpt: string;
	body: string;
	html: string;
	presentationVersion?: string;
	overview: Required<ActivityOverview>;
	createdAt: number;
	updatedAt: number;
	coverImage: string;
	images: ActivityImage[];
}

const GPT_IMAGE_ENDPOINT =
	"https://coresg-normal.trae.ai/api/ide/v1/text_to_image";

const SAFE_LINK_PATTERN = /^(https?:\/\/|\/)/i;

export function buildGptImageUrl(
	prompt: string,
	imageSize:
		| "square_hd"
		| "square"
		| "portrait_4_3"
		| "portrait_16_9"
		| "landscape_4_3"
		| "landscape_16_9" = "landscape_4_3",
): string {
	return `${GPT_IMAGE_ENDPOINT}?prompt=${encodeURIComponent(prompt)}&image_size=${imageSize}`;
}

export function escapeHtml(input: string): string {
	return input
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

export function createActivitySlug(input: string): string {
	const base = input
		.toLowerCase()
		.trim()
		.replace(/[^\p{L}\p{N}\s-]/gu, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
	return base || `activity-${Date.now()}`;
}

export function normalizeActivity(record: ActivityRecord): NormalizedActivity {
	const body = (record.body || record.content || "").trim();
	let images = normalizeImages(record, body);
	const plainText = stripMarkdown(body);
	const title = (record.title || "").trim() || createTitle(plainText);
	const excerpt = (record.excerpt || "").trim() || createExcerpt(plainText);
	if (images.length === 0) {
		const fallbackImage = createFallbackCoverImage(title, excerpt);
		if (fallbackImage) {
			images = [fallbackImage];
		}
	}

	const html = renderRichContent(body);
	const overview = createOverview(record, body, html, images);

	return {
		id: record.id,
		slug: record.slug,
		title,
		excerpt,
		body,
		html,
		presentationVersion: record.presentationVersion,
		overview,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		coverImage: images[0]?.url || "",
		images,
	};
}

function normalizeImages(record: ActivityRecord, body: string): ActivityImage[] {
	const result: ActivityImage[] = [];
	const seen = new Set<string>();
	const sourceImages = Array.isArray(record.images) ? record.images : [];

	for (const item of sourceImages) {
		if (!item?.url || seen.has(item.url)) continue;
		seen.add(item.url);
		result.push({
			url: item.url,
			alt: item.alt || "",
			prompt: item.prompt || "",
			source: item.source || "manual",
		});
	}

	if (record.image && !seen.has(record.image)) {
		seen.add(record.image);
		result.push({
			url: record.image,
			alt: record.title || "动态配图",
			source: "legacy",
		});
	}

	const inlineImages = extractInlineImages(body);
	for (const item of inlineImages) {
		if (seen.has(item.url)) continue;
		seen.add(item.url);
		result.push(item);
	}

	return result;
}

function createFallbackCoverImage(
	title: string,
	excerpt: string,
): ActivityImage | null {
	const prompt = [title, excerpt]
		.map((item) => item.trim())
		.filter(Boolean)
		.join("，");
	if (!prompt) return null;
	return {
		url: pickLocalActivityGalleryUrl(prompt),
		alt: title || "动态封面",
		prompt: "",
		source: "manual",
	};
}

function extractInlineImages(body: string): ActivityImage[] {
	const matches = body.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g);
	const images: ActivityImage[] = [];

	for (const match of matches) {
		const url = (match[2] || "").trim();
		if (!SAFE_LINK_PATTERN.test(url)) continue;
		images.push({
			url,
			alt: (match[1] || "").trim(),
			source: url.includes("text_to_image") ? "gpt" : "manual",
		});
	}

	return images;
}

function createTitle(text: string): string {
	const line = text
		.split("\n")
		.map((item) => item.trim())
		.find(Boolean);
	if (!line) return "未命名动态";
	return line.length > 26 ? `${line.slice(0, 26)}...` : line;
}

function createExcerpt(text: string): string {
	if (!text) return "暂无内容摘要。";
	return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

function countReadingMinutes(text: string): number {
	const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
	const englishWords = (text.match(/[a-zA-Z0-9_]+/g) || []).length;
	const total = chineseChars + englishWords;
	return Math.max(1, Math.ceil(total / 320));
}

function countSectionsFromHtml(html: string): number {
	const matches = html.match(/<h[1-4]\b/gi);
	return Math.max(1, matches ? matches.length : 0);
}

function formatActivityDate(timestamp: number): string {
	const d = new Date(timestamp);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	const h = String(d.getHours()).padStart(2, "0");
	const min = String(d.getMinutes()).padStart(2, "0");
	return `${y}-${m}-${day} ${h}:${min}`;
}

function createOverview(
	record: ActivityRecord,
	body: string,
	html: string,
	images: ActivityImage[],
): Required<ActivityOverview> {
	const plainText = stripMarkdown(body);
	return {
		readingMinutes: record.overview?.readingMinutes || countReadingMinutes(plainText),
		sectionCount: record.overview?.sectionCount || countSectionsFromHtml(html),
		imageCount: record.overview?.imageCount || images.length,
		updatedLabel: record.overview?.updatedLabel || formatActivityDate(record.updatedAt),
	};
}

function stripMarkdown(input: string): string {
	return input
		.replace(/<!--[\s\S]*?-->/g, " ")
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, " $1 ")
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
		.replace(/^\s*[-*+]\s+/gm, " ")
		.replace(/^\s*\d+\.\s+/gm, " ")
		.replace(/[#>*_`~-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function renderInline(input: string): string {
	if (!input) return "";
	let text = escapeHtml(input);
	const codes: string[] = [];

	text = text.replace(/`([^`]+)`/g, (_, value: string) => {
		const token = `__CODE_${codes.length}__`;
		codes.push(`<code>${escapeHtml(value)}</code>`);
		return token;
	});

	text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>");
	text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
	text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
	text = text.replace(
		/\[([^\]]+)\]\(([^)\s]+)\)/g,
		(_, label: string, url: string) => {
			if (!SAFE_LINK_PATTERN.test(url)) {
				return escapeHtml(label);
			}
			const safeUrl = escapeHtml(url);
			return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
		},
	);

	return text.replace(/__CODE_(\d+)__/g, (_, index: string) => codes[Number(index)] || "");
}

function createHeadingId(text: string, usedIds: Set<string>): string {
	const base = stripMarkdown(text)
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s-]/gu, "")
		.trim()
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "") || "section";
	let nextId = base;
	let count = 2;
	while (usedIds.has(nextId)) {
		nextId = `${base}-${count}`;
		count += 1;
	}
	usedIds.add(nextId);
	return nextId;
}

function renderCodeBlock(lang: string, lines: string[]): string {
	const codeLang = (lang || "text").toLowerCase();
	return `<pre class="activity-code-block activity-fade-section" data-lang="${escapeHtml(codeLang)}"><div class="activity-code-block__top"><span class="activity-code-block__label">${escapeHtml(codeLang)}</span></div><code class="language-${escapeHtml(codeLang)}">${escapeHtml(lines.join("\n"))}</code></pre>`;
}

function renderFigure(url: string, altText: string, captionText: string): string {
	const alt = escapeHtml(altText || "动态图片");
	const caption = escapeHtml(captionText || altText || "");
	return `<figure class="activity-rich-image activity-fade-section"><img src="${escapeHtml(url)}" alt="${alt}" loading="lazy" decoding="async" />${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
}

export function renderRichContent(markdown: string): string {
	const source = (markdown || "").replace(/\r\n/g, "\n").trim();
	if (!source) return "<p>暂无内容。</p>";

	const lines = source.split("\n");
	const blocks: string[] = [];
	const usedHeadingIds = new Set<string>();
	let paragraph: string[] = [];
	let listItems: string[] = [];
	let orderedItems: string[] = [];
	let quoteItems: string[] = [];
	let codeBlock:
		| {
				lang: string;
				lines: string[];
		  }
		| null = null;

	const flushParagraph = () => {
		if (paragraph.length === 0) return;
		blocks.push(
			`<p class="activity-content-block activity-content-block--paragraph">${renderInline(paragraph.join("<br />"))}</p>`,
		);
		paragraph = [];
	};

	const flushList = () => {
		if (listItems.length === 0) return;
		blocks.push(
			`<ul class="activity-content-list">${listItems
				.map(
					(item) =>
						`<li class="activity-content-block activity-content-block--list-item">${renderInline(item)}</li>`,
				)
				.join("")}</ul>`,
		);
		listItems = [];
	};

	const flushOrdered = () => {
		if (orderedItems.length === 0) return;
		blocks.push(
			`<ol class="activity-content-list activity-content-list--ordered">${orderedItems
				.map(
					(item) =>
						`<li class="activity-content-block activity-content-block--list-item">${renderInline(item)}</li>`,
				)
				.join("")}</ol>`,
		);
		orderedItems = [];
	};

	const flushQuote = () => {
		if (quoteItems.length === 0) return;
		blocks.push(
			`<blockquote class="activity-content-block activity-content-block--quote">${quoteItems
				.map(
					(item) =>
						`<p class="activity-content-block activity-content-block--quote-line">${renderInline(item)}</p>`,
				)
				.join("")}</blockquote>`,
		);
		quoteItems = [];
	};

	const flushAll = () => {
		flushParagraph();
		flushList();
		flushOrdered();
		flushQuote();
	};

	for (const rawLine of lines) {
		const line = rawLine.trimEnd();

		if (line.startsWith("```")) {
			const fence = line.match(/^```([\w-]+)?/);
			if (codeBlock) {
				blocks.push(renderCodeBlock(codeBlock.lang, codeBlock.lines));
				codeBlock = null;
			} else {
				flushAll();
				codeBlock = {
					lang: (fence?.[1] || "text").toLowerCase(),
					lines: [],
				};
			}
			continue;
		}

		if (codeBlock) {
			codeBlock.lines.push(rawLine);
			continue;
		}

		if (!line.trim()) {
			flushAll();
			continue;
		}

		if (/^<!--[\s\S]*-->$/.test(line.trim())) {
			flushAll();
			continue;
		}

		const heading = line.match(/^(#{1,4})\s+(.+)$/);
		if (heading) {
			flushAll();
			const level = Math.min(heading[1].length, 4);
			const headingText = heading[2].trim();
			const headingId = createHeadingId(headingText, usedHeadingIds);
			blocks.push(
				`<h${level} id="${headingId}" class="activity-rich-heading activity-rich-heading--h${level}"><a class="activity-rich-heading__anchor" href="#${headingId}" aria-label="定位到 ${escapeHtml(stripMarkdown(headingText))}">#</a><span>${renderInline(headingText)}</span></h${level}>`,
			);
			continue;
		}

		if (/^---+$/.test(line.trim())) {
			flushAll();
			blocks.push(`<hr class="activity-rich-divider" />`);
			continue;
		}

		const image = line.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/);
		if (image && SAFE_LINK_PATTERN.test(image[2])) {
			flushAll();
			blocks.push(renderFigure(image[2], image[1] || "动态图片", image[3] || image[1] || ""));
			continue;
		}

		const ordered = line.match(/^\d+\.\s+(.+)$/);
		if (ordered) {
			flushParagraph();
			flushList();
			flushQuote();
			orderedItems.push(ordered[1].trim());
			continue;
		}

		const bullet = line.match(/^[-*]\s+(.+)$/);
		if (bullet) {
			flushParagraph();
			flushOrdered();
			flushQuote();
			listItems.push(bullet[1].trim());
			continue;
		}

		const quote = line.match(/^>\s?(.+)$/);
		if (quote) {
			flushParagraph();
			flushList();
			flushOrdered();
			quoteItems.push(quote[1].trim());
			continue;
		}

		flushList();
		flushOrdered();
		flushQuote();
		paragraph.push(line.trim());
	}

	if (codeBlock) {
		blocks.push(renderCodeBlock(codeBlock.lang, codeBlock.lines));
	}

	flushAll();
	return blocks.join("");
}
