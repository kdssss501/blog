<script lang="ts">
import { gsap } from "gsap";
import { portal } from "@/components/common/portal";

interface CategoryItem {
	name: string;
	count: number;
	url: string;
}

interface Props {
	categories: CategoryItem[];
	class?: string;
}

let { categories, class: className = "" }: Props = $props();

let isMenuOpen = $state(false);
let showOverlay = $state(false);

let overlayRef: HTMLDivElement | undefined = $state();
let bubblesRef = $state<HTMLAnchorElement[]>([]);
let labelRefs = $state<HTMLSpanElement[]>([]);

const animationEase = "elastic.out(1,0.5)";
const animationDuration = 0.8;
const staggerDelay = 0.15;

function handleToggle() {
	if (isMenuOpen) {
		isMenuOpen = false;
		showOverlay = false;
	} else {
		showOverlay = true;
		isMenuOpen = true;
	}
}

function closeMenu() {
	isMenuOpen = false;
	showOverlay = false;
}

function handleBackdropClick(e: MouseEvent) {
	if (e.target === e.currentTarget) {
		closeMenu();
	}
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Escape" && isMenuOpen) {
		closeMenu();
	}
}

$effect(() => {
	if (!isMenuOpen) return;

	const overlay = overlayRef;
	const bubbles = bubblesRef.filter(Boolean);
	const labels = labelRefs.filter(Boolean);

	if (!overlay || !bubbles.length) return;

	gsap.killTweensOf([...bubbles, ...labels]);
	gsap.set(bubbles, { scale: 0, transformOrigin: "50% 50%" });
	gsap.set(labels, { y: 24, autoAlpha: 0 });

	bubbles.forEach((bubble, i) => {
		const delay = i * staggerDelay + gsap.utils.random(-0.05, 0.05);
		const tl = gsap.timeline({ delay });

		tl.to(bubble, {
			scale: 1,
			duration: animationDuration,
			ease: animationEase,
		});
		if (labels[i]) {
			tl.to(
				labels[i],
				{
					y: 0,
					autoAlpha: 1,
					duration: animationDuration,
					ease: "power3.out",
				},
				`-=${animationDuration * 0.9}`,
			);
		}
	});
});

// 页面切换后关闭菜单，避免状态残留
$effect(() => {
	if (typeof document === "undefined") return;
	const handleClose = () => closeMenu();
	document.addEventListener("astro:page-load", handleClose);
	return () => {
		document.removeEventListener("astro:page-load", handleClose);
	};
});

function isDarkMode() {
	return (
		typeof document !== "undefined" &&
		document.documentElement.classList.contains("dark")
	);
}

function getCategoryColor(_name: string, index: number) {
	const colors = [
		"#e74c3c",
		"#3498db",
		"#2ecc71",
		"#f39c12",
		"#9b59b6",
		"#1abc9c",
		"#e67e22",
		"#34495e",
	];
	return colors[index % colors.length];
}
</script>

<div class={`category-bubble-menu-wrapper ${className}`.trim()}>
  <div class="category-bubble-menu">
    <button
      type="button"
      class={`category-toggle-btn ${isMenuOpen ? "open" : ""}`}
      onclick={handleToggle}
      onkeydown={handleKeydown}
      aria-label="Toggle categories"
      aria-pressed={isMenuOpen}
    >
      <div class="category-menu-line" id="cat-bar1"></div>
      <div class="category-menu-line" id="cat-bar2"></div>
      <div class="category-menu-line" id="cat-bar3"></div>
    </button>
  </div>

  {#if showOverlay}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      use:portal
      class="category-bubble-backdrop"
      onclick={handleBackdropClick}
      onkeydown={handleKeydown}
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label="Category menu"
      style="position:fixed;inset:0;z-index:998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.2);backdrop-filter:blur(2px);"
    >
      <div
        bind:this={overlayRef}
        class="category-bubble-items"
        aria-hidden={!isMenuOpen}
      >
        <ul class="category-pill-list" role="menu" aria-label="Categories">
          {#each categories as item, idx (item.name)}
            <li role="none" class="category-pill-col">
              <a
                role="menuitem"
                href={item.url}
                aria-label={`View all posts in ${item.name}`}
                class="category-pill-link"
                style={`
                  --item-rot: ${(idx % 2 === 0 ? -8 : 8) + (Math.random() * 4 - 2)}deg;
                  --hover-bg: ${getCategoryColor(item.name, idx)};
                  --hover-color: #ffffff;
                `}
                bind:this={bubblesRef[idx]}
              >
                <span bind:this={labelRefs[idx]} class="category-pill-label">
                  {item.name}
                  <span class="category-count">{item.count}</span>
                </span>
              </a>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}
</div>

