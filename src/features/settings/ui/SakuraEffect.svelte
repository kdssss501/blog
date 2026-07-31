<script lang="ts">
import { onMount } from "svelte";
import { getSakuraEnabled, SAKURA_CHANGE_EVENT } from "../client";
import { SakuraManager } from "../client/sakura-manager";

let canvas: HTMLCanvasElement;

onMount(() => {
	const manager = new SakuraManager(canvas);
	const sync = () => manager.setEnabled(getSakuraEnabled());
	sync();
	window.addEventListener(SAKURA_CHANGE_EVENT, sync);
	return () => {
		window.removeEventListener(SAKURA_CHANGE_EVENT, sync);
		manager.destroy();
	};
});
</script>

<canvas
	bind:this={canvas}
	class="sakura-effect"
	aria-hidden="true"
	data-active="false"
></canvas>

<style>
	.sakura-effect {
		position: fixed;
		inset: 0;
		pointer-events: none;
		opacity: 0;
		transition: opacity 180ms ease;
	}

	:global(.sakura-effect[data-active="true"]) {
		opacity: 1;
	}
</style>
