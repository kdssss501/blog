/**
 * Markdown → Canvas 样式化段落
 * 将 Markdown 文本解析为带样式信息的段落数组，供 Canvas 绘制。
 */

import { marked, type Token, type Tokens } from "marked";

// ===== 类型 =====

export interface StyledSegment {
	text: string;
	fontSize: number;
	fontWeight: "normal" | "bold";
	color: string;
	decoration: "none" | "underline" | "line-through";
	/** 链接地址，非链接则为 null */
	href: string | null;
}

export interface StyledParagraph {
	segments: StyledSegment[];
	/** 段落类型 */
	type: "heading" | "paragraph" | "list-item" | "hr";
	/** 段落级间距倍率 */
	spacingAfter: number;
}

// ===== 默认颜色（亮色） =====

const COLORS = {
	text: "rgba(0, 0, 0, 0.87)",
	textDark: "rgba(255, 255, 255, 0.87)",
	heading: "rgba(0, 0, 0, 0.92)",
	headingDark: "rgba(255, 255, 255, 0.95)",
	link: "#4a9eff",
	linkDark: "#6ab0ff",
	divider: "rgba(0, 0, 0, 0.15)",
	dividerDark: "rgba(255, 255, 255, 0.15)",
};

// ===== 解析入口 =====

export function parseMarkdownToParagraphs(
	markdown: string,
	baseFontSize: number,
): StyledParagraph[] {
	const tokens = marked.lexer(markdown);
	const result: StyledParagraph[] = [];

	for (const token of tokens) {
		switch (token.type) {
			case "heading": {
				const fontSize =
					token.depth === 1 ? baseFontSize * 1.6 : baseFontSize * 1.3;
				result.push({
					type: "heading",
					segments: [
						{
							text: token.text,
							fontSize,
							fontWeight: "bold",
							color: COLORS.heading,
							decoration: "none",
							href: null,
						},
					],
					spacingAfter: 1.8,
				});
				break;
			}

			case "paragraph": {
				const segments = extractInlineSegments(
					token.tokens ?? [],
					baseFontSize,
				);
				result.push({ type: "paragraph", segments, spacingAfter: 1.4 });
				break;
			}

			case "list": {
				for (const item of token.items ?? []) {
					const segments = extractInlineSegments(
						item.tokens ?? [],
						baseFontSize,
					);
					// 列表项前加 "• " 前缀
					segments.unshift({
						text: "• ",
						fontSize: baseFontSize,
						fontWeight: "normal",
						color: COLORS.text,
						decoration: "none",
						href: null,
					});
					result.push({ type: "list-item", segments, spacingAfter: 0.8 });
				}
				break;
			}

			case "hr": {
				result.push({ type: "hr", segments: [], spacingAfter: 1.6 });
				break;
			}
		}
	}

	return result;
}

// ===== 内联 token 提取 =====

function extractInlineSegments(
	tokens: Token[],
	baseFontSize: number,
): StyledSegment[] {
	const result: StyledSegment[] = [];

	for (const token of tokens) {
		switch (token.type) {
			case "text": {
				// marked 的 text token 可能包含子 tokens（嵌套情况）
				if ("tokens" in token && token.tokens && token.tokens.length > 0) {
					result.push(...extractInlineSegments(token.tokens, baseFontSize));
				} else {
					result.push({
						text: token.text,
						fontSize: baseFontSize,
						fontWeight: "normal",
						color: COLORS.text,
						decoration: "none",
						href: null,
					});
				}
				break;
			}

			case "strong": {
				const inner =
					"tokens" in token
						? extractInlineSegments(token.tokens ?? [], baseFontSize)
						: [];
				for (const seg of inner) seg.fontWeight = "bold";
				result.push(...inner);
				break;
			}

			case "em": {
				// 斜体在 Canvas 中无直接支持，用默认字体渲染
				const inner =
					"tokens" in token
						? extractInlineSegments(token.tokens ?? [], baseFontSize)
						: [];
				result.push(...inner);
				break;
			}

			case "del": {
				const inner =
					"tokens" in token
						? extractInlineSegments(token.tokens ?? [], baseFontSize)
						: [];
				for (const seg of inner) seg.decoration = "line-through";
				result.push(...inner);
				break;
			}

			case "link": {
				const linkToken = token as Tokens.Link;
				result.push({
					text: linkToken.text,
					fontSize: baseFontSize,
					fontWeight: "normal",
					color: COLORS.link,
					decoration: "underline",
					href: linkToken.href,
				});
				break;
			}

			case "codespan": {
				result.push({
					text: token.text,
					fontSize: baseFontSize * 0.9,
					fontWeight: "normal",
					color: COLORS.text,
					decoration: "none",
					href: null,
				});
				break;
			}

			default: {
				if ("text" in token && typeof token.text === "string") {
					result.push({
						text: token.text,
						fontSize: baseFontSize,
						fontWeight: "normal",
						color: COLORS.text,
						decoration: "none",
						href: null,
					});
				}
				break;
			}
		}
	}

	return result;
}

// ===== 链接命中检测 =====

export interface LinkHitArea {
	x: number;
	y: number;
	width: number;
	height: number;
	href: string;
}

/**
 * 从渲染记录中查找点击位置命中的链接。
 */
export function hitTestLink(
	hitAreas: LinkHitArea[],
	mx: number,
	my: number,
): string | null {
	for (const area of hitAreas) {
		if (
			mx >= area.x &&
			mx <= area.x + area.width &&
			my >= area.y &&
			my <= area.y + area.height
		) {
			return area.href;
		}
	}
	return null;
}
