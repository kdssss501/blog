<script lang="ts">
interface Props {
	src: string;
	albumId: string;
	alt?: string;
}

const { src, albumId, alt = "" }: Props = $props();

let container: HTMLDivElement | undefined = $state();
let visible = $state(false);
let status = $state<"loading" | "loaded" | "error">("loading");

$effect(() => {
	if (!container) return;
	const observer = new IntersectionObserver(
		(entries) => {
			if (entries[0].isIntersecting) {
				visible = true;
				observer.disconnect();
			}
		},
		{ rootMargin: "200px" },
	);
	observer.observe(container);
	return () => observer.disconnect();
});

function onLoad() {
	status = "loaded";
}

function onError() {
	status = "error";
}
</script>

<div class="break-inside-avoid mb-3" bind:this={container}>
  <div
    data-fancybox={`gallery-${albumId}`}
    data-src={src}
    data-type="image"
    class="block rounded-xl overflow-hidden group cursor-pointer relative {visible ? '' : 'invisible'}"
  >
    {#if status !== "error"}
      <!-- 骨架屏：加载期间作为正常流元素撑起容器高度，加载完成后淡出 -->
      <div
        class="w-full aspect-[4/3] bg-neutral-200 dark:bg-neutral-800 transition-opacity duration-500 {status === 'loaded' ? 'opacity-0 absolute inset-0' : 'animate-pulse'}"
      ></div>
      <img
        {src}
        {alt}
        loading="lazy"
        decoding="async"
        onload={onLoad}
        onerror={onError}
        class="block w-full h-auto object-cover transition-all duration-500 {status === 'loaded' ? 'opacity-100 group-hover:scale-105' : 'opacity-0 absolute inset-0'}"
      />
      <!-- 悬停遮罩 + 放大镜图标 -->
      <div class="absolute inset-0 flex items-center justify-center bg-transparent transition-colors duration-200 group-hover:bg-black/35 pointer-events-none">
        <svg class="w-7 h-7 text-white opacity-0 scale-75 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="14"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </div>
    {:else}
      <div class="flex items-center justify-center w-full aspect-[4/3]">
        <svg class="w-8 h-8 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
        </svg>
      </div>
    {/if}
  </div>
</div>
