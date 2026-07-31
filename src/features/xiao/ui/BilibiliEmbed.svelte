<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";

interface Props {
	bvid: string;
	title: string;
	autoLoad?: boolean;
	sequence?: number;
}

let { bvid, title, autoLoad = true, sequence = 1 }: Props = $props();
let container: HTMLElement;
let shouldLoad = $state(false);

function loadPlayer() {
	shouldLoad = true;
}

onMount(() => {
	if (!autoLoad || shouldLoad) return;
	if (!("IntersectionObserver" in window)) {
		shouldLoad = true;
		return;
	}
	const observer = new IntersectionObserver(
		(entries) => {
			if (!entries.some((entry) => entry.isIntersecting)) return;
			shouldLoad = true;
			observer.disconnect();
		},
		{ rootMargin: "80px" },
	);
	observer.observe(container);
	return () => observer.disconnect();
});
</script>

<article class="xiao-video" bind:this={container}>
	<div class="xiao-video__frame">
		{#if shouldLoad}
			<iframe
				src={`https://player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&danmaku=0&autoplay=0`}
				title={title}
				loading="lazy"
				allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
				allowfullscreen
				referrerpolicy="strict-origin-when-cross-origin"
			></iframe>
		{:else}
			<button
				type="button"
				class="xiao-video__placeholder"
				onclick={loadPlayer}
				aria-label={`加载视频：${title}`}
			>
				<span class="xiao-video__play"><Icon icon="fa7-brands:bilibili" size="2xl" /></span>
				<span class="xiao-video__wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
				<small>CLICK TO RECEIVE / {bvid}</small>
			</button>
		{/if}
	</div>
	<footer>
		<span>0{sequence}</span>
		<strong>{title}</strong>
		<a href={`https://www.bilibili.com/video/${bvid}/`} target="_blank" rel="noopener noreferrer">
			在 Bilibili 打开<Icon icon="material-symbols:arrow-outward-rounded" size="sm" />
		</a>
	</footer>
</article>
