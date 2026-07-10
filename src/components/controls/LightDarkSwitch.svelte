<script lang="ts">
import { onMount } from "svelte";
import { DARK_MODE, LIGHT_MODE } from "@/constants/constants";
import type { LIGHT_DARK_MODE } from "@/types/config.ts";
import {
	applyThemeToDocument,
	getStoredTheme,
	setTheme,
} from "@/utils/setting-utils";

interface SwupHooks {
	on(event: string, callback: () => void): void;
}

interface SwupInstance {
	hooks?: SwupHooks;
}

type WindowWithSwup = Window & { swup?: SwupInstance };

let mode: LIGHT_DARK_MODE = $state(LIGHT_MODE);

function toggleTheme() {
	const newMode = mode === LIGHT_MODE ? DARK_MODE : LIGHT_MODE;
	mode = newMode;
	setTheme(newMode);
}

onMount(() => {
	const storedTheme = getStoredTheme();
	// If stored theme is "system" (legacy), resolve to actual theme
	if (storedTheme === "system") {
		const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
		mode = isDark ? DARK_MODE : LIGHT_MODE;
		setTheme(mode);
	} else {
		mode = storedTheme;
	}

	// Ensure DOM state matches stored theme
	const currentTheme = document.documentElement.classList.contains("dark")
		? DARK_MODE
		: LIGHT_MODE;
	if (mode !== currentTheme) {
		applyThemeToDocument(mode);
	}

	// Swup listener
	const handleContentReplace = () => {
		const newTheme = getStoredTheme();
		if (newTheme !== "system") {
			mode = newTheme;
		}
	};

	const handleSwupEnable = () => {
		const w = window as WindowWithSwup;
		if (w.swup?.hooks) {
			w.swup.hooks.on("content:replace", handleContentReplace);
		}
	};

	const win = window as WindowWithSwup;
	if (win.swup?.hooks) {
		win.swup.hooks.on("content:replace", handleContentReplace);
	} else {
		document.addEventListener("swup:enable", handleSwupEnable);
	}

	// Listen for theme-change events from other components
	const handleThemeChange = () => {
		const newTheme = getStoredTheme();
		if (newTheme !== "system") {
			mode = newTheme;
		}
	};
	window.addEventListener("theme-change", handleThemeChange);

	return () => {
		window.removeEventListener("theme-change", handleThemeChange);
		document.removeEventListener("swup:enable", handleSwupEnable);
	};
});
</script>

<div class="relative z-50">
    <label for="scheme-switch" class="toggle">
        <input type="checkbox" class="input" id="scheme-switch" checked={mode === DARK_MODE} onchange={toggleTheme} />
        <div class="icon icon--light">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
            </svg>
        </div>
        <div class="icon icon--dark">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                <path fill-rule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clip-rule="evenodd" />
            </svg>
        </div>
    </label>
</div>

<style>
    .toggle {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        cursor: pointer;
        line-height: 1;
    }

    .input {
        display: none;
    }

    .icon {
        grid-column: 1 / 1;
        grid-row: 1 / 1;
        transition: transform 500ms;
        line-height: 0.1;
    }

    .icon--light {
        transition-delay: 200ms;
        color: #000;
    }

    .icon--dark {
        transform: scale(0);
        color: #fff;
    }

    .input:checked + .icon--light {
        transform: rotate(360deg) scale(0);
    }

    .input:checked ~ .icon--dark {
        transition-delay: 200ms;
        transform: scale(1) rotate(360deg);
    }
</style>
