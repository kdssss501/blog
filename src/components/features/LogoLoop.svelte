<script lang="ts">
import { onDestroy, onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import {
	getClampedTooltipAnchor,
	getLoopCopyCount,
	resolveTargetVelocity,
	wrapLoopOffset,
} from "@/utils/logo-loop.js";

type LoopItem = {
	name: string;
	icon?: string;
	href?: string;
	group?: string;
	ariaLabel?: string;
};

type Direction = "left" | "right" | "up" | "down";

interface Props {
	items: LoopItem[];
	speed?: number;
	direction?: Direction;
	logoHeight?: number;
	gap?: number;
	hoverSpeed?: number;
	fadeOut?: boolean;
	fadeOutColor?: string;
	ariaLabel?: string;
	class?: string;
	clickable?: boolean;
	showLabel?: boolean;
}

let {
	items,
	speed = 90,
	direction = "left",
	logoHeight = 36,
	gap = 20,
	hoverSpeed = 0,
	fadeOut = true,
	fadeOutColor,
	ariaLabel = "Logo loop",
	class: className = "",
	clickable = false,
	showLabel = true,
}: Props = $props();

let containerEl: HTMLDivElement;
let trackEl: HTMLDivElement;
let sequenceEl: HTMLUListElement;
let copyCount = $state(2);
let isHovered = $state(false);
let seqWidth = 0;
let seqHeight = 0;
let rafId = 0;
let lastTimestamp: number | null = null;
let offset = 0;
let velocity = 0;
let resizeObserver: ResizeObserver | null = null;
let tooltip = $state({ visible: false, name: "", x: 0, y: 0 });
let isMobileDevice = $state(false);

const isVertical = $derived(direction === "up" || direction === "down");
const cssVars = $derived(
	`--logo-loop-gap:${gap}px;--logo-loop-logo-height:${logoHeight}px;${fadeOutColor ? `--logo-loop-fade-color:${fadeOutColor};` : ""}`,
);

function measure() {
	if (!containerEl || !sequenceEl) return;
	// Mobile: render only one copy, no loop needed
	if (isMobileDevice) {
		copyCount = 1;
		return;
	}
	const rect = sequenceEl.getBoundingClientRect();
	seqWidth = Math.ceil(rect.width);
	seqHeight = Math.ceil(rect.height);
	const viewportSize = isVertical
		? containerEl.clientHeight ||
			containerEl.parentElement?.clientHeight ||
			seqHeight
		: containerEl.clientWidth;
	const sequenceSize = isVertical ? seqHeight : seqWidth;
	copyCount = getLoopCopyCount({ viewportSize, sequenceSize });
}

function applyTransform() {
	if (!trackEl) return;
	trackEl.style.transform = isVertical
		? `translate3d(0, ${-offset}px, 0)`
		: `translate3d(${-offset}px, 0, 0)`;
}

function tick(timestamp: number) {
	if (lastTimestamp === null) lastTimestamp = timestamp;
	const delta = Math.max(0, timestamp - lastTimestamp) / 1000;
	lastTimestamp = timestamp;
	const targetVelocity = isHovered
		? hoverSpeed
		: resolveTargetVelocity({ speed, direction });
	const easing = 1 - Math.exp(-delta / 0.25);
	velocity += (targetVelocity - velocity) * easing;
	const sequenceSize = isVertical ? seqHeight : seqWidth;
	offset = wrapLoopOffset(offset + velocity * delta, sequenceSize);
	applyTransform();
	rafId = requestAnimationFrame(tick);
}

function start() {
	if (
		isMobileDevice ||
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	) {
		offset = 0;
		applyTransform();
		return;
	}
	stop();
	rafId = requestAnimationFrame(tick);
}

function stop() {
	if (rafId) {
		cancelAnimationFrame(rafId);
		rafId = 0;
	}
	lastTimestamp = null;
}

function getItemAriaLabel(item: LoopItem) {
	return item.ariaLabel || item.name;
}

function pauseLoop() {
	isHovered = true;
	velocity = hoverSpeed;
}

function resumeLoop() {
	isHovered = false;
	hideTooltip();
}

function getTooltipAnchor(event: PointerEvent | MouseEvent) {
	const tooltipMargin = 56;
	const viewportWidth =
		window.innerWidth || document.documentElement.clientWidth;
	const viewportHeight =
		window.innerHeight || document.documentElement.clientHeight;
	return {
		...getClampedTooltipAnchor({
			clientX: event.clientX,
			clientY: event.clientY,
			viewportWidth,
			viewportHeight,
			margin: tooltipMargin,
		}),
	};
}

function showTooltip(item: LoopItem, event: PointerEvent | MouseEvent) {
	const anchor = getTooltipAnchor(event);
	tooltip = {
		visible: true,
		name: item.name,
		x: anchor.x,
		y: anchor.y,
	};
}

function showTooltipByName(name: string, event: MouseEvent) {
	const anchor = getTooltipAnchor(event);
	tooltip = {
		visible: true,
		name,
		x: anchor.x,
		y: anchor.y,
	};
}

function moveTooltip(event: PointerEvent | MouseEvent) {
	if (!tooltip.visible) return;
	const anchor = getTooltipAnchor(event);
	tooltip = {
		...tooltip,
		x: anchor.x,
		y: anchor.y,
	};
}

function hideTooltip() {
	tooltip = { visible: false, name: "", x: 0, y: 0 };
}

function handleLoopMouseMove(event: MouseEvent) {
	const target = event.target as Element | null;
	const pill = target?.closest?.(
		".logo-loop__pill--static",
	) as HTMLElement | null;
	const name = pill?.dataset.logoLoopName;
	if (!name) {
		hideTooltip();
		return;
	}
	showTooltipByName(name, event);
}

function portal(node: HTMLElement) {
	document.body.appendChild(node);
	return {
		destroy() {
			node.remove();
		},
	};
}

onMount(() => {
	isMobileDevice = window.matchMedia("(max-width: 768px)").matches;
	measure();
	if (!isMobileDevice) {
		resizeObserver = new ResizeObserver(measure);
		if (containerEl) resizeObserver.observe(containerEl);
		if (sequenceEl) resizeObserver.observe(sequenceEl);
		start();
	}

	return () => {
		stop();
		resizeObserver?.disconnect();
		resizeObserver = null;
	};
});

onDestroy(stop);
</script>

<div
	bind:this={containerEl}
	class="logo-loop {className}"
	class:logo-loop--vertical={isVertical}
	class:logo-loop--fade={fadeOut}
	style={cssVars}
	role="region"
	aria-label={ariaLabel}
	onpointerenter={pauseLoop}
	onpointerleave={resumeLoop}
	onmouseover={handleLoopMouseMove}
	onmousemove={handleLoopMouseMove}
>
	<div class="logo-loop__viewport">
		<div
			bind:this={trackEl}
			class="logo-loop__track"
			class:logo-loop__track--vertical={isVertical}
		>
			{#each Array.from({ length: copyCount }) as _, copyIndex}
				{#if copyIndex === 0}
					<ul
						bind:this={sequenceEl}
						class="logo-loop__sequence"
						class:logo-loop__sequence--vertical={isVertical}
					>
						{#each items as item, itemIndex (`${copyIndex}-${item.name}-${itemIndex}`)}
							<li class="logo-loop__item">
								{#if clickable && item.href}
									<a
										class="logo-loop__pill"
										href={item.href}
										target={item.href.startsWith("http") ? "_blank" : undefined}
										rel={item.href.startsWith("http") ? "noreferrer noopener" : undefined}
										aria-label={getItemAriaLabel(item)}
									>
										{#if item.icon}
											<Icon icon={item.icon} class="logo-loop__icon" />
										{:else}
											<span class="logo-loop__fallback" aria-hidden="true">{item.name.slice(0, 1)}</span>
										{/if}
										{#if showLabel}
											<span class="logo-loop__label">{item.name}</span>
										{/if}
									</a>
								{:else}
									<span
										class="logo-loop__pill logo-loop__pill--static"
										aria-label={getItemAriaLabel(item)}
										data-logo-loop-name={item.name}
										onpointerenter={(event) => showTooltip(item, event)}
										onpointermove={moveTooltip}
										onpointerleave={hideTooltip}
										onmouseenter={(event) => showTooltip(item, event)}
										onmousemove={moveTooltip}
										onmouseleave={hideTooltip}
									>
										{#if item.icon}
											<Icon icon={item.icon} class="logo-loop__icon" />
										{:else}
											<span class="logo-loop__fallback" aria-hidden="true">{item.name.slice(0, 1)}</span>
										{/if}
										{#if showLabel}
											<span class="logo-loop__label">{item.name}</span>
										{/if}
										<span class="logo-loop__tooltip" role="tooltip">{item.name}</span>
									</span>
								{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<ul
						class="logo-loop__sequence"
						class:logo-loop__sequence--vertical={isVertical}
						aria-hidden="true"
					>
						{#each items as item, itemIndex (`${copyIndex}-${item.name}-${itemIndex}`)}
							<li class="logo-loop__item">
								{#if clickable && item.href}
									<a
										class="logo-loop__pill"
										href={item.href}
										tabindex="-1"
										target={item.href.startsWith("http") ? "_blank" : undefined}
										rel={item.href.startsWith("http") ? "noreferrer noopener" : undefined}
									>
										{#if item.icon}
											<Icon icon={item.icon} class="logo-loop__icon" />
										{:else}
											<span class="logo-loop__fallback" aria-hidden="true">{item.name.slice(0, 1)}</span>
										{/if}
										{#if showLabel}
											<span class="logo-loop__label">{item.name}</span>
										{/if}
									</a>
								{:else}
									<span
										class="logo-loop__pill logo-loop__pill--static"
										data-logo-loop-name={item.name}
										onpointerenter={(event) => showTooltip(item, event)}
										onpointermove={moveTooltip}
										onpointerleave={hideTooltip}
										onmouseenter={(event) => showTooltip(item, event)}
										onmousemove={moveTooltip}
										onmouseleave={hideTooltip}
									>
										{#if item.icon}
											<Icon icon={item.icon} class="logo-loop__icon" />
										{:else}
											<span class="logo-loop__fallback" aria-hidden="true">{item.name.slice(0, 1)}</span>
										{/if}
										{#if showLabel}
											<span class="logo-loop__label">{item.name}</span>
										{/if}
									</span>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			{/each}
		</div>
	</div>
	{#if tooltip.visible}
		<div
			use:portal
			class="logo-loop__floating-tooltip"
			style={`left:${tooltip.x}px;top:${tooltip.y}px;`}
			role="tooltip"
		>
			{tooltip.name}
		</div>
	{/if}
</div>
