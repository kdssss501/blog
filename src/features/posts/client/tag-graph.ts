import { GraphChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type { TagGraphData, TagGraphNode } from "../model/tag-graph";

echarts.use([GraphChart, TooltipComponent, CanvasRenderer]);

function escapeHtml(value: unknown): string {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

class TagGraphElement extends HTMLElement {
	private chart: echarts.ECharts | null = null;
	private graph: TagGraphData | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private themeObserver: MutationObserver | null = null;
	private animationFrame = 0;

	connectedCallback() {
		this.animationFrame = requestAnimationFrame(() => this.initialize());
	}

	disconnectedCallback() {
		cancelAnimationFrame(this.animationFrame);
		this.resizeObserver?.disconnect();
		this.themeObserver?.disconnect();
		this.chart?.dispose();
		this.chart = null;
	}

	private initialize() {
		if (!this.isConnected || this.chart) return;
		const chartElement = this.querySelector<HTMLElement>(
			"[data-tag-graph-chart]",
		);
		if (!chartElement) return;

		try {
			this.graph = JSON.parse(
				this.dataset.graph || "null",
			) as TagGraphData | null;
		} catch {
			this.graph = null;
		}
		if (!this.graph?.nodes.length) return;

		this.chart = echarts.init(chartElement);
		this.chart.on("finished", () => {
			this.dataset.chartReady = "true";
		});
		this.chart.setOption(this.getOptions());
		this.chart.on("click", (event) => {
			if (
				event.dataType !== "node" ||
				typeof event.data !== "object" ||
				event.data === null ||
				!("url" in event.data)
			)
				return;
			const targetUrl = (event.data as { url?: unknown }).url;
			if (typeof targetUrl !== "string" || !targetUrl) return;
			if (window.navigateToPage) window.navigateToPage(targetUrl);
			else window.location.assign(targetUrl);
		});

		this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
		this.resizeObserver.observe(chartElement);
		this.themeObserver = new MutationObserver(() => {
			this.chart?.setOption(this.getOptions(), true);
		});
		this.themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
	}

	private getOptions(): echarts.EChartsCoreOption {
		const graph = this.graph;
		if (!graph) return {};
		const dark = document.documentElement.classList.contains("dark");
		const text = dark ? "rgba(255,255,255,0.9)" : "rgba(24,24,27,0.92)";
		const line = dark ? "rgba(255,132,112,0.35)" : "rgba(189,78,62,0.3)";
		const palette = [
			"#e76f61",
			"#2f8f83",
			"#d6a13d",
			"#5d7bd9",
			"#b264b4",
			"#2b9db6",
			"#c75c8a",
			"#6f8f36",
		];
		const values = graph.nodes.map((node) => node.value);
		const minimum = Math.min(...values);
		const maximum = Math.max(...values);
		const maximumLink = Math.max(1, ...graph.links.map((link) => link.value));
		const symbolSize = (node: TagGraphNode) =>
			minimum === maximum
				? 44
				: 24 + ((node.value - minimum) / (maximum - minimum)) * 54;

		return {
			tooltip: {
				trigger: "item",
				formatter: (params: {
					dataType?: string;
					name?: string;
					value?: number;
					data?: { value?: number };
				}) =>
					params.dataType === "edge"
						? `共同出现：${params.data?.value ?? 0} 篇`
						: `<strong>${escapeHtml(params.name)}</strong><br>文章数量：${params.value ?? 0} 篇`,
				backgroundColor: "rgba(24,24,27,0.96)",
				borderColor: "rgba(255,255,255,0.18)",
				textStyle: { color: "rgba(255,255,255,0.94)" },
			},
			series: [
				{
					type: "graph",
					layout: "force",
					roam: true,
					draggable: true,
					data: graph.nodes.map((node, index) => ({
						...node,
						symbolSize: symbolSize(node),
						itemStyle: {
							color: palette[index % palette.length],
							borderColor: dark ? "rgba(255,255,255,0.52)" : "white",
							borderWidth: 2,
						},
						label: {
							show: true,
							position: "right",
							color: text,
							fontSize: 12,
							fontWeight: 700,
						},
					})),
					links: graph.links.map((linkItem) => ({
						...linkItem,
						lineStyle: {
							width: 1 + Math.min(4, (linkItem.value / maximumLink) * 4),
							opacity:
								0.22 + Math.min(0.48, (linkItem.value / maximumLink) * 0.48),
							color: line,
							curveness: 0.08,
						},
					})),
					force: {
						edgeLength: [44, 150],
						repulsion: 150,
						gravity: 0.08,
						friction: 0.35,
					},
					emphasis: { focus: "adjacency" },
				},
			],
		};
	}
}

if (!customElements.get("tag-graph")) {
	customElements.define("tag-graph", TagGraphElement);
}
