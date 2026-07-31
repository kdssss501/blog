<script lang="ts">
import {
	getVampireChibiFrameIndex,
	VAMPIRE_CHIBI_ATLAS_COLUMNS,
	VAMPIRE_CHIBI_FRAME_COUNT,
	VAMPIRE_CHIBI_FRAME_SIZE,
} from "../model/vampire-chibi-timeline";

type ChibiExpression = "happy" | "shy" | "startled";
type ChibiPhase =
	| "reaction"
	| "thinking"
	| "generating"
	| "buffering"
	| "playing"
	| "complete";

interface Props {
	visible: boolean;
	variant: "normal" | "white";
	expression: ChibiExpression;
	token: number;
	phase: ChibiPhase;
}

let { visible, variant, expression, token, phase }: Props = $props();
let canvas = $state<HTMLCanvasElement>();
let frame = $state(0);
let atlasReady = $state(false);
const assetBase = $derived(
	`/assets/images/xiao/vampire-chibi/${variant === "white" ? "white" : "black"}/${expression}`,
);
const atlasUrl = $derived(`${assetBase}-atlas.webp`);

const entryStyle = $derived.by(() => {
	const random = (salt: number) => {
		const value = Math.sin((token + 1) * 12.9898 + salt * 78.233) * 43758.5453;
		return value - Math.floor(value);
	};
	const landingX = 12 + random(1) * 76;
	const enterFromLeft = random(2) > 0.5;
	const entryX = enterFromLeft ? "-48vw" : "48vw";
	const entryY = `${-42 - random(3) * 34}vh`;
	const entryRotation = enterFromLeft ? "-18deg" : "18deg";
	return `--chibi-landing-x: ${landingX.toFixed(2)}vw; --chibi-entry-x: ${entryX}; --chibi-entry-y: ${entryY}; --chibi-entry-rotation: ${entryRotation};`;
});

$effect(() => {
	const node = canvas;
	const source = atlasUrl;
	const active = visible;
	const restartToken = token;
	if (!node || !active) return;
	void restartToken;

	const context = node.getContext("2d", { alpha: true });
	if (!context) return;
	const image = new Image();
	let cancelled = false;
	let animationFrame = 0;
	const startedAt = window.performance.now();
	const reduceMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;

	const drawFrame = (nextFrame: number) => {
		if (cancelled) return;
		const sourceX =
			(nextFrame % VAMPIRE_CHIBI_ATLAS_COLUMNS) * VAMPIRE_CHIBI_FRAME_SIZE;
		const sourceY =
			Math.floor(nextFrame / VAMPIRE_CHIBI_ATLAS_COLUMNS) *
			VAMPIRE_CHIBI_FRAME_SIZE;
		context.clearRect(0, 0, node.width, node.height);
		context.drawImage(
			image,
			sourceX,
			sourceY,
			VAMPIRE_CHIBI_FRAME_SIZE,
			VAMPIRE_CHIBI_FRAME_SIZE,
			0,
			0,
			node.width,
			node.height,
		);
		frame = nextFrame;
	};

	const animate = (now: number) => {
		const nextFrame = getVampireChibiFrameIndex(now - startedAt);
		drawFrame(nextFrame);
		animationFrame = window.requestAnimationFrame(animate);
	};

	atlasReady = false;
	image.decoding = "async";
	image.onload = () => {
		if (cancelled) return;
		atlasReady = true;
		drawFrame(0);
		if (!reduceMotion && VAMPIRE_CHIBI_FRAME_COUNT > 1) {
			animationFrame = window.requestAnimationFrame(animate);
		}
	};
	image.onerror = () => {
		if (!cancelled) atlasReady = false;
	};
	image.src = source;

	return () => {
		cancelled = true;
		image.onload = null;
		image.onerror = null;
		if (animationFrame) window.cancelAnimationFrame(animationFrame);
	};
});
</script>

{#if visible}
	{#key token}
		<figure
			class:is-atlas-ready={atlasReady}
			class="vampire-chibi-reaction"
			data-expression={expression}
			data-frame={frame}
			data-phase={phase}
			data-token={token}
			data-variant={variant}
			data-animation="chat-edge-drop"
			style={entryStyle}
			aria-hidden="true"
		>
			<canvas
				bind:this={canvas}
				class="is-timeline"
				width={VAMPIRE_CHIBI_FRAME_SIZE}
				height={VAMPIRE_CHIBI_FRAME_SIZE}
			></canvas>
			<img class="is-fallback" src={`${assetBase}.png`} alt="" decoding="async" />
		</figure>
	{/key}
{/if}

<style>
	.vampire-chibi-reaction {
		position: fixed;
		z-index: 140;
		left: var(--chibi-landing-x);
		bottom: max(20px, env(safe-area-inset-bottom));
		width: clamp(104px, 10vw, 148px);
		aspect-ratio: 1;
		margin: 0;
		pointer-events: none;
		transform-origin: 50% 94%;
		animation: chibi-chat-drop 3.45s cubic-bezier(0.22, 0.8, 0.26, 1) both;
		filter: drop-shadow(0 8px 10px rgb(0 0 0 / 0.34));
		will-change: transform, opacity;
	}

	.vampire-chibi-reaction canvas,
	.vampire-chibi-reaction img {
		display: block;
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.vampire-chibi-reaction .is-timeline {
		opacity: 0;
	}

	.vampire-chibi-reaction.is-atlas-ready .is-timeline {
		opacity: 1;
	}

	.vampire-chibi-reaction.is-atlas-ready .is-fallback {
		opacity: 0;
	}

	@keyframes chibi-chat-drop {
		0% {
			opacity: 0;
			transform: translate(calc(-50% + var(--chibi-entry-x)), var(--chibi-entry-y)) rotate(var(--chibi-entry-rotation)) scale(0.7);
		}
		48% {
			opacity: 1;
			transform: translate(-50%, 2px) rotate(0deg) scale(1.08);
		}
		60% {
			opacity: 1;
			transform: translate(-50%, -18px) rotate(-2deg) scale(0.99);
		}
		72% {
			opacity: 1;
			transform: translate(-50%, 0) rotate(0deg) scale(1.02);
		}
		83% {
			opacity: 1;
			transform: translate(-50%, -9px) rotate(1deg) scale(0.99);
		}
		91% {
			opacity: 1;
			transform: translate(-50%, 0) rotate(0deg) scale(1);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, 7px) rotate(0deg) scale(0.86);
		}
	}

	@media (max-width: 720px) {
		.vampire-chibi-reaction {
			bottom: max(16px, env(safe-area-inset-bottom));
			width: clamp(90px, 25vw, 122px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.vampire-chibi-reaction {
			animation: none;
		}
	}
</style>
