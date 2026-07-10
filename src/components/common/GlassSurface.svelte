<script lang="ts">
import { onMount, tick } from "svelte";

interface Props {
	width?: number | string;
	height?: number | string;
	borderRadius?: number;
	borderWidth?: number;
	brightness?: number;
	opacity?: number;
	blur?: number;
	displace?: number;
	backgroundOpacity?: number;
	saturation?: number;
	distortionScale?: number;
	redOffset?: number;
	greenOffset?: number;
	blueOffset?: number;
	xChannel?: "R" | "G" | "B";
	yChannel?: "R" | "G" | "B";
	mixBlendMode?: string;
	className?: string;
	style?: Record<string, string | number>;
	children?: import("svelte").Snippet;
}

let {
	width = 200,
	height = 80,
	borderRadius = 20,
	borderWidth = 0.07,
	brightness = 50,
	opacity = 0.93,
	blur = 11,
	displace = 0,
	backgroundOpacity = 0,
	saturation = 1,
	distortionScale = -180,
	redOffset = 0,
	greenOffset = 10,
	blueOffset = 20,
	xChannel = "R",
	yChannel = "G",
	mixBlendMode = "difference",
	className = "",
	style = {},
	children,
}: Props = $props();

const id = Math.random().toString(36).substring(2, 9);
const filterId = `glass-filter-${id}`;
const redGradId = `red-grad-${id}`;
const blueGradId = `blue-grad-${id}`;

let svgSupported = $state(false);
let containerRef: HTMLDivElement | undefined = $state(undefined);
let feImageRef: SVGFEImageElement | undefined = $state(undefined);
let redChannelRef: SVGFEDisplacementMapElement | undefined = $state(undefined);
let greenChannelRef: SVGFEDisplacementMapElement | undefined =
	$state(undefined);
let blueChannelRef: SVGFEDisplacementMapElement | undefined = $state(undefined);
let gaussianBlurRef: SVGFEGaussianBlurElement | undefined = $state(undefined);

function supportsSVGFilters(): boolean {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return false;
	}

	const div = document.createElement("div");
	div.style.backdropFilter = `url(#${filterId})`;

	return div.style.backdropFilter !== "";
}

function generateDisplacementMap(): string {
	const rect = containerRef?.getBoundingClientRect();
	const actualWidth = rect?.width || 400;
	const actualHeight = rect?.height || 200;
	const edgeSize = Math.min(actualWidth, actualHeight) * (borderWidth * 0.5);

	const svgContent = `
      <svg viewBox="0 0 ${actualWidth} ${actualHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="red"/>
          </linearGradient>
          <linearGradient id="${blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" fill="black"></rect>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${redGradId})" />
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${blueGradId})" style="mix-blend-mode: ${mixBlendMode}" />
        <rect x="${edgeSize}" y="${edgeSize}" width="${actualWidth - edgeSize * 2}" height="${actualHeight - edgeSize * 2}" rx="${borderRadius}" fill="hsl(0 0% ${brightness}% / ${opacity})" style="filter:blur(${blur}px)" />
      </svg>
    `;

	return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
}

let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

function updateDisplacementMap() {
	if (feImageRef) {
		feImageRef.setAttribute("href", generateDisplacementMap());
	}
}

function debouncedUpdateDisplacementMap() {
	if (resizeTimeout) {
		clearTimeout(resizeTimeout);
	}
	resizeTimeout = setTimeout(() => {
		updateDisplacementMap();
	}, 400); // 增加延迟至 400ms，避开导航栏收缩过渡时间(400ms)，避免过渡期间重新生成 SVG 滤镜导致掉帧
}

function updateFilters() {
	updateDisplacementMap();

	const channels = [
		{ ref: redChannelRef, offset: redOffset },
		{ ref: greenChannelRef, offset: greenOffset },
		{ ref: blueChannelRef, offset: blueOffset },
	];

	for (const { ref, offset } of channels) {
		if (ref) {
			ref.setAttribute("scale", (distortionScale + offset).toString());
			ref.setAttribute("xChannelSelector", xChannel);
			ref.setAttribute("yChannelSelector", yChannel);
		}
	}

	if (gaussianBlurRef) {
		gaussianBlurRef.setAttribute("stdDeviation", displace.toString());
	}
}

onMount(() => {
	svgSupported = supportsSVGFilters();
	tick().then(() => {
		updateFilters();

		if (!containerRef) return;
		const resizeObserver = new ResizeObserver(() => {
			debouncedUpdateDisplacementMap();
		});
		resizeObserver.observe(containerRef);

		return () => {
			resizeObserver.disconnect();
			if (resizeTimeout) {
				clearTimeout(resizeTimeout);
			}
		};
	});
});

$effect(() => {
	if (!containerRef) return;
	updateFilters();
});
</script>

<div
	bind:this={containerRef}
	class="glass-surface {svgSupported ? 'glass-surface--svg' : 'glass-surface--fallback'} {className}"
	style:width={typeof width === "number" ? `${width}px` : width}
	style:height={typeof height === "number" ? `${height}px` : height}
	style:border-radius="{borderRadius}px"
	style:--glass-frost={backgroundOpacity}
	style:--glass-saturation={saturation}
	style:--filter-id={`url(#${filterId})`}
	style={Object.entries(style)
		.map(([k, v]) => `${k}: ${v}`)
		.join(";")}
>
	<svg class="glass-surface__filter" xmlns="http://www.w3.org/2000/svg">
		<defs>
			<filter
				id={filterId}
				color-interpolation-filters="sRGB"
				x="0%"
				y="0%"
				width="100%"
				height="100%"
			>
				<feImage
					bind:this={feImageRef}
					x="0"
					y="0"
					width="100%"
					height="100%"
					preserveAspectRatio="none"
					result="map"
				/>

				<feDisplacementMap
					bind:this={redChannelRef}
					in="SourceGraphic"
					in2="map"
					id="redchannel"
					result="dispRed"
				/>
				<feColorMatrix
					in="dispRed"
					type="matrix"
					values="1 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
					result="red"
				/>

				<feDisplacementMap
					bind:this={greenChannelRef}
					in="SourceGraphic"
					in2="map"
					id="greenchannel"
					result="dispGreen"
				/>
				<feColorMatrix
					in="dispGreen"
					type="matrix"
					values="0 0 0 0 0
                      0 1 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
					result="green"
				/>

				<feDisplacementMap
					bind:this={blueChannelRef}
					in="SourceGraphic"
					in2="map"
					id="bluechannel"
					result="dispBlue"
				/>
				<feColorMatrix
					in="dispBlue"
					type="matrix"
					values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 1 0 0
                      0 0 0 1 0"
					result="blue"
				/>

				<feBlend in="red" in2="green" mode="screen" result="rg" />
				<feBlend in="rg" in2="blue" mode="screen" result="output" />
				<feGaussianBlur
					bind:this={gaussianBlurRef}
					in="output"
					stdDeviation="0.7"
				/>
			</filter>
		</defs>
	</svg>

	{#if children}
		<div class="glass-surface__content">
			{@render children?.()}
		</div>
	{/if}
</div>

<style>
	@reference "../../styles/main.css";

	.glass-surface {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		transition: opacity 0.26s ease-out;
	}

	.glass-surface__filter {
		width: 100%;
		height: 100%;
		pointer-events: none;
		position: absolute;
		inset: 0;
		opacity: 0;
		z-index: -1;
	}

	.glass-surface__content {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		border-radius: inherit;
		position: relative;
		z-index: 1;
	}

	.glass-surface--svg {
		background: hsl(0 0% 100% / var(--glass-frost, 0));
		backdrop-filter: var(--filter-id, url(#glass-filter))
			saturate(var(--glass-saturation, 1));
		box-shadow:
			0 0 2px 1px color-mix(in oklch, black, transparent 85%) inset,
			0 0 10px 4px color-mix(in oklch, black, transparent 90%) inset,
			0px 4px 16px rgba(17, 17, 26, 0.05),
			0px 8px 24px rgba(17, 17, 26, 0.05),
			0px 16px 56px rgba(17, 17, 26, 0.05),
			0px 4px 16px rgba(17, 17, 26, 0.05) inset,
			0px 8px 24px rgba(17, 17, 26, 0.05) inset,
			0px 16px 56px rgba(17, 17, 26, 0.05) inset;
	}

	:global(:root.dark) .glass-surface--svg {
		background: hsl(0 0% 0% / var(--glass-frost, 0));
		box-shadow:
			0 0 2px 1px color-mix(in oklch, white, transparent 65%) inset,
			0 0 10px 4px color-mix(in oklch, white, transparent 85%) inset,
			0px 4px 16px rgba(17, 17, 26, 0.05),
			0px 8px 24px rgba(17, 17, 26, 0.05),
			0px 16px 56px rgba(17, 17, 26, 0.05),
			0px 4px 16px rgba(17, 17, 26, 0.05) inset,
			0px 8px 24px rgba(17, 17, 26, 0.05) inset,
			0px 16px 56px rgba(17, 17, 26, 0.05) inset;
	}

	.glass-surface--fallback {
		background: rgba(255, 255, 255, 0.25);
		backdrop-filter: blur(12px) saturate(1.8) brightness(1.1);
		-webkit-backdrop-filter: blur(12px) saturate(1.8) brightness(1.1);
		border: 1px solid rgba(255, 255, 255, 0.3);
		box-shadow:
			0 8px 32px 0 rgba(31, 38, 135, 0.2),
			0 2px 16px 0 rgba(31, 38, 135, 0.1),
			inset 0 1px 0 0 rgba(255, 255, 255, 0.4),
			inset 0 -1px 0 0 rgba(255, 255, 255, 0.2);
	}

	:global(:root.dark) .glass-surface--fallback {
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(12px) saturate(1.8) brightness(1.2);
		-webkit-backdrop-filter: blur(12px) saturate(1.8) brightness(1.2);
		border: 1px solid rgba(255, 255, 255, 0.2);
		box-shadow:
			inset 0 1px 0 0 rgba(255, 255, 255, 0.2),
			inset 0 -1px 0 0 rgba(255, 255, 255, 0.1);
	}

	@supports not (backdrop-filter: blur(10px)) {
		.glass-surface--fallback {
			background: rgba(255, 255, 255, 0.4);
			box-shadow:
				inset 0 1px 0 0 rgba(255, 255, 255, 0.5),
				inset 0 -1px 0 0 rgba(255, 255, 255, 0.3);
		}

		.glass-surface--fallback::before {
			content: "";
			position: absolute;
			inset: 0;
			background: rgba(255, 255, 255, 0.15);
			border-radius: inherit;
			z-index: -1;
		}
	}

	@supports not (backdrop-filter: blur(10px)) {
		:global(:root.dark) .glass-surface--fallback {
			background: rgba(0, 0, 0, 0.4);
		}

		:global(:root.dark) .glass-surface--fallback::before {
			background: rgba(255, 255, 255, 0.05);
		}
	}

	.glass-surface:focus-visible {
		outline: 2px solid #007aff;
		outline-offset: 2px;
	}

	:global(:root.dark) .glass-surface:focus-visible {
		outline-color: #0a84ff;
	}
</style>
