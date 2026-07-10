import { h } from "hastscript";
import { visit } from "unist-util-visit";
import mermaidRenderScript from "./mermaid-render-script.js?raw";

/** 已注入客户端脚本的 tree 集合，避免同一 tree 多次注入 */
const scriptInjectedTrees = new WeakSet();

/**
 * 递归提取 HAST 节点树中的所有文本内容
 */
function extractText(node) {
	if (node.type === "text") return node.value || "";
	if (node.children) return node.children.map(extractText).join("");
	return "";
}

export function rehypeMermaid() {
	return (tree) => {
		let hasMermaid = false;

		visit(tree, "element", (node) => {
			if (
				node.tagName === "div" &&
				node.properties &&
				node.properties.className &&
				node.properties.className.includes("mermaid-container")
			) {
				hasMermaid = true;

				// 优先使用 data-mermaid-code 属性，为空时从子节点文本提取（MDX 兼容）
				let mermaidCode = node.properties["data-mermaid-code"] || "";
				if (!mermaidCode) {
					mermaidCode = extractText(node).trim();
				}
				const mermaidId = `mermaid-${Math.random().toString(36).slice(-6)}`;

				// 创建 Mermaid 容器
				const mermaidContainer = h(
					"div",
					{
						class: "mermaid-wrapper",
						id: mermaidId,
					},
					[
						h(
							"div",
							{
								class: "mermaid",
								"data-mermaid-code": mermaidCode,
							},
							mermaidCode,
						),
					],
				);

				// 替换原始节点
				node.tagName = "div";
				node.properties = { class: "mermaid-diagram-container" };
				node.children = [mermaidContainer];
			}
		});

		// 仅在存在 mermaid 图表且尚未注入脚本时，注入一次渲染脚本
		if (hasMermaid && !scriptInjectedTrees.has(tree)) {
			scriptInjectedTrees.add(tree);
			const renderScript = h(
				"script",
				{
					type: "text/javascript",
				},
				mermaidRenderScript,
			);
			tree.children.push(renderScript);
		}
	};
}
