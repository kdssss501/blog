<script lang="ts">
import { onMount } from "svelte";
import type { VampireIntroConfig } from "@/config/xiaoConfig";
import { mountVampireYuimiGateRuntime } from "../client/vampire-yuimi-gate-runtime";
import "./vampire-yuimi-gate.css";
import "./vampire-yuimi-scrollbar.css";

interface Props {
	config: VampireIntroConfig;
	onReveal: () => void;
	onComplete: (reason: "ended" | "skipped") => void;
}
type GateProgress = {
	active?: boolean;
	progress?: number;
	stage?: string;
	guided?: boolean;
	transitioning?: boolean;
	pressure?: number;
	releaseMode?: string;
};

let { config, onReveal, onComplete }: Props = $props();
let root: HTMLElement;
let scrollbar: HTMLElement;
let completed = false;
let revealed = false;
let railProgress = $state(0);

const particles = [
	[7,21,88,-54,3.2,18.4,-4.8,.46,338], [15,73,64,-92,2.1,21.7,-13.2,.34,346],
	[24,39,-42,-68,4.1,24.2,-8.7,.38,329], [32,84,76,-74,2.7,19.6,-16.4,.42,341],
	[41,16,45,62,2.4,22.8,-10.1,.31,350], [49,66,-58,-86,3.6,25.1,-2.6,.4,334],
	[57,28,73,-48,2.2,20.3,-15.5,.36,344], [64,79,-66,-96,3.1,23.7,-7.4,.44,327],
	[72,46,51,58,2.5,17.9,-11.6,.33,348], [79,17,-84,72,3.8,26.2,-19.3,.39,336],
	[86,69,-52,-82,2.2,19.1,-5.9,.37,343], [93,35,-77,-61,3.4,22.4,-14.1,.43,331],
] as const;

const sceneManifest = $derived(JSON.stringify(config.frames.map((frame, index) => ({
	id: `vampire-shot-${index + 1}`, image: frame.src, position: "center 50%",
	saturation: index === 2 ? .92 : 1, brightness: index === 2 ? 1.08 : 1,
	kind: index < 3 ? "memory" : "transformation", index, order: index,
}))));
const rootStyle = $derived(`--kisara-gate-background-image:url("${config.posterPath}");--kisara-fight-background-image:url("${config.frames.at(-1)?.src ?? config.posterPath}");`);
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const releaseStages = new Set([
	"rupture",
	"enchant",
	"blade",
	"warning",
	"singularity",
	"collapse",
	"detonation",
	"reconstruction",
	"complete",
]);

function resolveGateState(progress: number, stage: string, active: boolean) {
	if (root?.classList.contains("is-released")) return "opening";
	if (!active) return "done";
	if (progress <= 0.001 && stage === "awakening") return "idle";
	if (releaseStages.has(stage)) return "release";
	return stage === "maximum-tension" ? "sealing" : "charging";
}

function updateScrollbar(detail: GateProgress) {
	if (!scrollbar) return;
	const progress = clamp(Number(detail.progress) || 0);
	railProgress = Math.round(progress * 100);
	const active = Boolean(detail.active);
	const stage = detail.stage ?? "awakening";
	root?.setAttribute("data-gate-state", resolveGateState(progress, stage, active));
	const thumbSize = window.innerWidth <= 600 ? 34 : 46;
	const thumbY = Math.max(0, scrollbar.getBoundingClientRect().height - thumbSize) * progress;
	scrollbar.classList.toggle("is-idle", !active);
	scrollbar.classList.toggle("is-gate-progress", active);
	scrollbar.classList.toggle("is-scroll-guided", active && Boolean(detail.guided));
	scrollbar.classList.toggle("is-returning", active && Boolean(detail.transitioning));
	scrollbar.classList.toggle("is-release-boosted", active && detail.releaseMode === "forward" && Number(detail.pressure) > .08);
	scrollbar.dataset.stage = stage;
	scrollbar.dataset.releaseMode = detail.releaseMode ?? "manual";
	scrollbar.style.setProperty("--kisara-scroll-thumb-size", `${thumbSize}px`);
	scrollbar.style.setProperty("--kisara-scroll-thumb-y", `${thumbY}px`);
	scrollbar.style.setProperty("--kisara-scroll-marker-y", `${thumbY + thumbSize * .5}px`);
	scrollbar.style.setProperty("--kisara-scroll-energy", String(active ? progress : 0));
	scrollbar.style.setProperty("--kisara-scroll-boost", String(active ? detail.pressure ?? 0 : 0));
	scrollbar.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
	scrollbar.setAttribute("aria-valuetext", `${stage} ${Math.round(progress * 100)}%`);
}
function reveal() { if (!revealed) { revealed = true; onReveal(); } }
function finish(reason: "ended" | "skipped") { if (!completed) { completed = true; reveal(); onComplete(reason); } }

onMount(() => {
	const unmountRuntime = mountVampireYuimiGateRuntime();
	const progressHandler = (event: Event) => { if (event instanceof CustomEvent) updateScrollbar(event.detail as GateProgress); };
	const observer = new MutationObserver(() => {
		if (!root.classList.contains("is-released") || completed) return;
		root.dataset.gateState = "opening";
		reveal();
		window.setTimeout(() => finish("ended"), 680);
	});
	window.addEventListener("kisara:gate-progress", progressHandler);
	observer.observe(root, { attributes: true, attributeFilter: ["class"] });
	updateScrollbar({ active: true, progress: 0, stage: "awakening" });
	return () => { observer.disconnect(); window.removeEventListener("kisara:gate-progress", progressHandler); unmountRuntime(); };
});
</script>

<div bind:this={root} class="vampire-intro kisara-gate" data-kisara-gate data-chain-source="yuimi-full-runtime-port" data-gate-state="idle" style={rootStyle} role="dialog" aria-label="VAMPIRE seal gate">
	<script type="application/json" data-kisara-scene-manifest>{sceneManifest}</script>
	<div class="kisara-gate-visual-shell" aria-hidden="true"><div class="kisara-gate-visual-camera"><div class="kisara-gate-bridge-underlay"></div><div class="kisara-gate-bridge-current"><div class="kisara-gate-visual"><div class="kisara-gate-background kisara-gate-background-base"></div><div class="kisara-gate-background kisara-gate-scene-slot" data-kisara-scene-slot="0"></div><div class="kisara-gate-background kisara-gate-scene-slot" data-kisara-scene-slot="1"></div><div class="kisara-gate-background kisara-gate-background-fight"></div><div class="kisara-memory-flare"></div><div class="kisara-gate-background kisara-gate-background-fight-wash"></div><div class="kisara-gate-atmosphere"></div></div><canvas class="kisara-space-lens-canvas" data-kisara-space-lens data-base-src={config.posterPath} data-pre-release-src={config.frames.at(2)?.src ?? config.posterPath} data-fight-src={config.frames.at(-1)?.src ?? config.posterPath} width="1280" height="900"></canvas><canvas class="kisara-post-release-canvas" data-kisara-post-release-canvas data-fight-src={config.frames.at(-1)?.src ?? config.posterPath} width="1280" height="900"></canvas></div></div></div>
	<div class="kisara-ambient-particles" aria-hidden="true">{#each particles as p}<i style={`--kisara-particle-x:${p[0]}%;--kisara-particle-y:${p[1]}%;--kisara-particle-drift-x:${p[2]}px;--kisara-particle-drift-y:${p[3]}px;--kisara-particle-size:${p[4]}px;--kisara-particle-duration:${p[5]}s;--kisara-particle-delay:${p[6]}s;--kisara-particle-opacity:${p[7]};--kisara-particle-hue:${p[8]}`}></i>{/each}</div>
	<canvas class="kisara-burst-canvas" data-kisara-burst-canvas width="1280" height="900" aria-hidden="true"></canvas>
	<div class="kisara-screen-impact" aria-hidden="true"><span class="kisara-warning-monochrome"></span><span class="kisara-warning-focus"></span><span class="kisara-warning-exposure"></span><i class="kisara-title-cross"><span class="kisara-cross-ring"></span><span class="kisara-cross-ray kisara-cross-ray-north"></span><span class="kisara-cross-ray kisara-cross-ray-east"></span><span class="kisara-cross-ray kisara-cross-ray-south"></span><span class="kisara-cross-ray kisara-cross-ray-west"></span><span class="kisara-cross-shard kisara-cross-shard-a"></span><span class="kisara-cross-shard kisara-cross-shard-b"></span><span class="kisara-cross-shard kisara-cross-shard-c"></span><span class="kisara-cross-shard kisara-cross-shard-d"></span><span class="kisara-cross-spark kisara-cross-spark-a"></span><span class="kisara-cross-spark kisara-cross-spark-b"></span><span class="kisara-cross-spark kisara-cross-spark-c"></span><span class="kisara-cross-spark kisara-cross-spark-d"></span><span class="kisara-cross-core"></span></i></div>
	<div class="kisara-title-stage"><span class="kisara-title-reset-underlay kisara-title-base" aria-hidden="true">VAMPIRE</span><h1 class="kisara-title" aria-label="VAMPIRE"><canvas class="kisara-title-chain-canvas kisara-title-chain-canvas-back" data-kisara-chain-back width="1400" height="420" aria-hidden="true"></canvas><span class="kisara-title-base" aria-hidden="true">VAMPIRE</span><span class="kisara-title-tide" aria-hidden="true">VAMPIRE</span><canvas class="kisara-title-chain-canvas kisara-title-chain-canvas-front" data-kisara-chain-front width="1400" height="420" aria-hidden="true"></canvas><span class="kisara-title-enchant" aria-hidden="true">VAMPIRE</span><span class="kisara-title-gloss" aria-hidden="true">VAMPIRE</span><canvas class="kisara-title-data-canvas" data-kisara-title-data width="1200" height="320" aria-hidden="true"></canvas><canvas class="kisara-title-lens-canvas" data-kisara-title-lens width="1200" height="260" aria-hidden="true"></canvas></h1></div>
	<div class="kisara-contract-meter" aria-hidden="true"><canvas class="kisara-energy-canvas" data-kisara-energy width="640" height="64"></canvas></div><p class="kisara-contract-state" data-kisara-state>SEAL CHAINS / DORMANT</p><p class="kisara-scroll-cue" data-kisara-cue>SCROLL TO UNSEAL</p><button class="kisara-motion-toggle" type="button" data-kisara-motion-toggle hidden aria-pressed="false">motion</button><button class="kisara-gate-auto" type="button" data-kisara-auto data-state="idle" aria-label="Auto play seal gate"><span class="kisara-gate-auto-mark" aria-hidden="true"></span><span data-kisara-auto-label>AUTO</span></button><a class="kisara-gate-skip" href="#kisara-opening" data-kisara-skip onclick={(event) => { event.preventDefault(); finish("skipped"); }}>SKIP</a>
</div>
<section id="kisara-opening" class="vampire-gate-opening" aria-hidden="true"></section>
<div bind:this={scrollbar} class="kisara-scrollbar is-gate-progress" data-kisara-scrollbar role="progressbar" aria-label="Seal gate progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="kisara-scrollbar-progress" aria-hidden="true"></span><span class="kisara-scrollbar-thumb" data-kisara-scrollbar-thumb aria-hidden="true"><i></i></span><b class="kisara-scrollbar-value" aria-hidden="true">{railProgress}%</b></div>

<style>
	.vampire-intro.kisara-gate { position: fixed; z-index: 120; inset: 0; min-height: 100svh; width: 100%; margin: 0; }
	.vampire-gate-opening { position: fixed; inset: 100% 0 auto; min-height: 100svh; pointer-events: none; }
	:global(.vampire-intro [data-kisara-motion-toggle][hidden]) { display: none !important; }
	:global(.vampire-intro .kisara-title-tide::before), :global(.vampire-intro .kisara-title-tide::after) { content: "VAMPIRE"; }
	@media (max-width: 600px) {
		:global(.vampire-intro .kisara-title-stage) { width: min(100%, calc(100vw - 28px)); font-size: clamp(3.2rem, 17vw, 4.6rem); }
		:global(.vampire-intro .kisara-title-chain-canvas) { inset: -42% -20%; width: 140%; }
	}
	@media (prefers-reduced-motion: reduce) { .vampire-intro { display: none; } }
</style>
