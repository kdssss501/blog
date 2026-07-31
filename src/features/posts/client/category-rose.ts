import { PieChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

type CategoryDatum = {
	name: string;
	value: number;
	url: string;
};

type CategoryClickEvent = {
	name?: string;
};

echarts.use([PieChart, TooltipComponent, CanvasRenderer]);

function escapeHtml(value: unknown): string {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

class CategoryRoseElement extends HTMLElement {
	private chart: echarts.ECharts | null = null;
	private data: CategoryDatum[] = [];
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
			"[data-category-rose-chart]",
		);
		if (!chartElement) return;

		try {
			this.data = JSON.parse(this.dataset.chartData || "[]") as CategoryDatum[];
		} catch {
			this.data = [];
		}
		if (this.data.length === 0) return;

		this.chart = echarts.init(chartElement);
		this.chart.on("finished", () => {
			this.dataset.chartReady = "true";
		});
		this.chart.setOption(this.getOptions());
		this.chart.on("click", (event: CategoryClickEvent) => {
			const item = this.data.find((entry) => entry.name === event.name);
			if (!item?.url) return;
			if (window.navigateToPage) window.navigateToPage(item.url);
			else window.location.assign(item.url);
		});

		this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
		this.resizeObserver.observe(chartElement);
		this.themeObserver = new MutationObserver(() => {
			this.chart?.setOption(this.getOptions());
		});
		this.themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
	}

	private getOptions(): echarts.EChartsCoreOption {
		const dark = document.documentElement.classList.contains("dark");
		const text = dark ? "rgba(255,255,255,0.86)" : "rgba(24,24,27,0.9)";
		const muted = dark ? "rgba(255,255,255,0.5)" : "rgba(63,63,70,0.58)";
		return {
			tooltip: {
				trigger: "item",
				formatter: (params: {
					name?: string;
					value?: number;
					percent?: number;
				}) =>
					`<strong>${escapeHtml(params.name)}</strong><br>文章数量：${params.value ?? 0} 篇<br>占比：${params.percent ?? 0}%`,
				backgroundColor: dark
					? "rgba(24,24,27,0.96)"
					: "rgba(255,255,255,0.96)",
				borderColor: dark ? "rgba(255,255,255,0.15)" : "rgba(24,24,27,0.12)",
				textStyle: { color: text },
			},
			series: [
				{
					type: "pie",
					radius: ["22%", "74%"],
					center: ["50%", "50%"],
					roseType: "area",
					itemStyle: {
						borderRadius: 6,
						borderColor: "transparent",
						borderWidth: 2,
					},
					label: {
						color: text,
						fontSize: 13,
						fontWeight: 600,
						formatter: "{b}\n{c} 篇",
					},
					labelLine: { lineStyle: { color: muted } },
					animationType: "scale",
					animationDuration: 700,
					data: this.data,
					color: [
						"#e76f61",
						"#2f8f83",
						"#d6a13d",
						"#5d7bd9",
						"#b264b4",
						"#2b9db6",
						"#c75c8a",
						"#6f8f36",
					],
				},
			],
		};
	}
}

if (!customElements.get("category-rose")) {
	customElements.define("category-rose", CategoryRoseElement);
}
