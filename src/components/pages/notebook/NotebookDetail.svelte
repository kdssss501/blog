<script lang="ts">
	import { onMount } from "svelte";
	import { GALLERY_IMAGES, hashString, getCoverImage } from "@/utils/notebook-covers";

	interface NotebookEntry {
		id: string;
		title: string;
		content: string;
		date: string;
		notebook: string;
		cover: string;
		updatedAt: number;
	}

	interface NotebookData {
		entries: NotebookEntry[];
	}

	let loading = $state(true);
	let error = $state(false);
	let errorMessage = $state("");
	let notebookName = $state("");
	let entries = $state<NotebookEntry[]>([]);
	let heroCover = $state("/gallery/gpt-img2-2026/1.webp");

	let tocOpen = $state(false);

	const cache = {
		get: <T>(key: string): T | null => {
			try {
				const cached = sessionStorage.getItem("notebook_" + key);
				if (!cached) return null;
				const parsed = JSON.parse(cached);
				if (Date.now() - parsed.timestamp < 300000) {
					return parsed.data;
				}
				sessionStorage.removeItem("notebook_" + key);
				return null;
			} catch {
				return null;
			}
		},
		set: <T>(key: string, data: T): void => {
			try {
				sessionStorage.setItem("notebook_" + key, JSON.stringify({
					data,
					timestamp: Date.now()
				}));
			} catch {}
		}
	};

	function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 10000): Promise<Response> {
		return new Promise((resolve, reject) => {
			const controller = new AbortController();
			const timer = setTimeout(() => {
				controller.abort();
				reject(new Error("请求超时"));
			}, timeoutMs);
			options.signal = controller.signal;
			fetch(url, options)
				.then((res) => { clearTimeout(timer); resolve(res); })
				.catch((err) => { clearTimeout(timer); reject(err); });
		});
	}

	function fetchWithExponentialRetry(url: string, options: RequestInit = {}, timeoutMs: number = 10000, maxRetries: number = 3): Promise<Response> {
		return new Promise((resolve, reject) => {
			let attempts = 0;
			let delay = 500;

			function attempt() {
				fetchWithTimeout(url, options, timeoutMs)
					.then(resolve)
					.catch((err) => {
						attempts++;
						if (attempts <= maxRetries) {
							setTimeout(attempt, delay);
							delay = delay * 2;
						} else {
							reject(err);
						}
					});
			}

			attempt();
		});
	}

	function scrollToEntry(entryId: string) {
		const target = document.getElementById("entry-" + entryId);
		if (target) {
			target.scrollIntoView({ behavior: "smooth", block: "start" });
		}
		tocOpen = false;
	}

	async function loadEntries() {
		loading = true;
		error = false;
		errorMessage = "";

		const params = new URLSearchParams(window.location.search);
		const name = params.get("name") || "";
		notebookName = name;

		if (!name) {
			loading = false;
			error = true;
			errorMessage = "未指定笔记本名称";
			return;
		}

		document.title = "笔记本 / " + name;

		try {
			const url = "/api/notebook/?notebook=" + encodeURIComponent(name);
			const res = await fetchWithExponentialRetry(url, { method: "GET" }, 10000, 3);
			if (!res.ok) throw new Error("加载失败");

			const data: NotebookData = await res.json();
			const sorted = (data.entries || []).sort((a, b) => {
				return a.date < b.date ? 1 : a.date > b.date ? -1 : b.updatedAt - b.updatedAt;
			});

			entries = sorted;

			if (sorted.length > 0) {
				heroCover = getCoverImage(sorted[0].cover, name);
			} else {
				heroCover = "/gallery/gpt-img2-2026/1.webp";
			}
		} catch (err) {
			error = true;
			errorMessage = "加载失败，请稍后重试";
			console.error("[notebook-detail] load failed:", err);
		} finally {
			loading = false;
		}
	}

	function toggleToc() {
		tocOpen = !tocOpen;
	}

	function closeToc() {
		tocOpen = false;
	}

	function handleBackdropClick(e: MouseEvent) {
		if ((e.target as HTMLElement).classList.contains("notebook-toc-modal-backdrop")) {
			closeToc();
		}
	}

	onMount(() => {
		loadEntries();

		const handlePageLoad = () => {
			loadEntries();
		};

		document.addEventListener("astro:page-load", handlePageLoad);

		return () => {
			document.removeEventListener("astro:page-load", handlePageLoad);
		};
	});
</script>

<div class="notebook-detail-page">
	<a href="/notebook/" class="notebook-back-link">
		<span class="notebook-back-icon">←</span>
		<span class="notebook-back-text">返回笔记本列表</span>
	</a>

	<div class="notebook-hero" style="background-image: url('{heroCover}');">
		<div class="notebook-hero-overlay"></div>
		<div class="notebook-hero-content">
			<h1 class="notebook-hero-title">{notebookName || "笔记本"}</h1>
			<p class="notebook-hero-count">{entries.length} 篇笔记</p>
		</div>
	</div>

	<div class="notebook-content-wrapper">
		<main class="notebook-main-content">
			{#if loading}
				<div class="notebook-loading-state">
					<div class="notebook-loading-spinner"></div>
					<p class="notebook-loading-text">正在加载笔记...</p>
				</div>
			{:else if error}
				<div class="notebook-error-state">
					<p class="notebook-error-text">{errorMessage}</p>
				</div>
			{:else if entries.length === 0}
				<div class="notebook-empty-state">
					<p class="notebook-empty-text">这个笔记本还没有任何笔记</p>
					<p class="notebook-empty-hint">点击右上角按钮创建第一篇笔记吧</p>
				</div>
			{:else}
				<div class="notebook-entry-list">
					{#each entries as entry, index}
						<section id="entry-{entry.id}" class="notebook-entry-section">
							<div class="notebook-entry-header">
								<span class="notebook-entry-number">{index + 1}</span>
								<h2 class="notebook-entry-title">{entry.title}</h2>
							</div>
							<div class="notebook-entry-meta">
								<span class="notebook-entry-date">{entry.date}</span>
							</div>
							<div class="notebook-entry-content">
								{@html entry.content}
							</div>
						</section>
					{/each}
				</div>
			{/if}
		</main>

		<aside class="notebook-sidebar-desktop">
			<div class="notebook-sidebar-header">
				<span class="notebook-sidebar-title">目录</span>
			</div>
			<div class="notebook-sidebar-body">
				<nav class="notebook-toc-nav">
					{#each entries as entry, index}
						<button
							class="notebook-toc-item"
							data-index="{index}"
							on:click={() => scrollToEntry(entry.id)}
						>
							<span class="notebook-toc-item__number">{index + 1}</span>
							<span class="notebook-toc-item__title">{entry.title}</span>
						</button>
					{/each}
				</nav>
			</div>
		</aside>
	</div>

	<button class="notebook-toc-toggle-btn" on:click={toggleToc}>
		<span class="notebook-toc-toggle-text">目录</span>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<line x1="8" y1="6" x2="21" y2="6" />
			<line x1="8" y1="12" x2="21" y2="12" />
			<line x1="8" y1="18" x2="21" y2="18" />
			<line x1="3" y1="6" x2="3.01" y2="6" />
			<line x1="3" y1="12" x2="3.01" y2="12" />
			<line x1="3" y1="18" x2="3.01" y2="18" />
		</svg>
	</button>

	{#if tocOpen}
		<div class="notebook-toc-modal" on:click={handleBackdropClick}>
			<div class="notebook-toc-modal-backdrop"></div>
			<div class="notebook-toc-modal-content">
				<div class="notebook-toc-modal-header">
					<span class="notebook-toc-modal-title">目录</span>
					<button class="notebook-toc-modal-close" on:click={closeToc}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>
				<div class="notebook-toc-modal-body">
					<nav class="notebook-toc-nav">
						{#each entries as entry, index}
							<button
								class="notebook-toc-item"
								data-index="{index}"
								on:click={() => scrollToEntry(entry.id)}
							>
								<span class="notebook-toc-item__number">{index + 1}</span>
								<span class="notebook-toc-item__title">{entry.title}</span>
							</button>
						{/each}
					</nav>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.notebook-detail-page {
		width: 100%;
		max-width: var(--page-width, 100rem);
		margin: 0 auto;
		padding: 0 1rem;
	}

	.notebook-back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 1rem;
		margin-bottom: 1.5rem;
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--deep-text);
		background: transparent;
		border: 2px solid var(--deep-text);
		border-radius: var(--radius-large);
		text-decoration: none;
		transition: background-color 0.15s, color 0.15s;
		position: relative;
		z-index: 10;
	}

	.notebook-back-link:hover {
		background: var(--deep-text);
		color: var(--page-bg);
	}

	.notebook-back-icon {
		font-size: 1.1rem;
	}

	.notebook-back-text {
		white-space: nowrap;
	}

	.notebook-hero {
		position: relative;
		width: 100%;
		height: 320px;
		border-radius: var(--radius-large);
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		overflow: hidden;
		margin-bottom: 2.5rem;
		border: 2px solid var(--deep-text);
	}

	.notebook-hero-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to bottom,
			rgba(0, 0, 0, 0.3) 0%,
			rgba(0, 0, 0, 0.5) 50%,
			rgba(0, 0, 0, 0.75) 100%
		);
	}

	.notebook-hero-content {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 2.5rem;
		z-index: 1;
	}

	.notebook-hero-title {
		margin: 0 0 0.5rem;
		color: #fff;
		font-size: clamp(2rem, 5vw, 3.2rem);
		font-weight: 900;
		line-height: 1.05;
		text-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
	}

	.notebook-hero-count {
		margin: 0;
		color: rgba(255, 255, 255, 0.9);
		font-size: 0.95rem;
		font-weight: 700;
		font-family: ui-monospace, SFMono-Regular, monospace;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
	}

	.notebook-content-wrapper {
		display: grid;
		grid-template-columns: 1fr 260px;
		gap: 2.5rem;
		max-width: 100%;
	}

	.notebook-main-content {
		position: relative;
		min-width: 0;
	}

	.notebook-loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 8rem 0;
	}

	.notebook-loading-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--deep-text);
		border-top-color: transparent;
		border-radius: 50%;
		animation: notebook-spin 1s linear infinite;
	}

	@keyframes notebook-spin {
		to { transform: rotate(360deg); }
	}

	.notebook-loading-text {
		color: var(--content-meta);
		font-size: 0.9rem;
		font-weight: 700;
	}

	.notebook-error-state,
	.notebook-empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 8rem 0;
		text-align: center;
	}

	.notebook-error-text,
	.notebook-empty-text {
		color: var(--content-meta);
		font-size: 1rem;
		font-weight: 700;
		margin: 0;
	}

	.notebook-empty-hint {
		color: var(--content-meta);
		font-size: 0.85rem;
		margin: 0;
		opacity: 0.7;
	}

	.notebook-entry-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.notebook-entry-section {
		position: relative;
		border-radius: var(--radius-large);
		overflow: hidden;
		background: var(--page-bg);
		border: 2px solid var(--deep-text);
		padding: 1.5rem;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.notebook-entry-section:hover {
		transform: translateY(-4px);
		box-shadow: 8px 8px 0px var(--deep-text);
	}

	.notebook-entry-header {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.notebook-entry-number {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 0.5rem;
		background: var(--deep-text);
		color: var(--page-bg);
		font-size: 0.8rem;
		font-weight: 800;
		font-family: ui-monospace, monospace;
		flex-shrink: 0;
	}

	.notebook-entry-title {
		margin: 0;
		color: var(--deep-text);
		font-size: 1.35rem;
		font-weight: 800;
		line-height: 1.3;
	}

	.notebook-entry-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		color: var(--content-meta);
		font-size: 0.8rem;
		font-weight: 700;
		font-family: ui-monospace, SFMono-Regular, monospace;
	}

	.notebook-entry-content {
		color: var(--deep-text);
		font-size: 1rem;
		line-height: 1.8;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.notebook-entry-content p {
		margin: 0 0 1rem 0;
	}

	.notebook-entry-content p:last-child {
		margin-bottom: 0;
	}

	.notebook-entry-content strong {
		font-weight: 800;
	}

	.notebook-entry-content em {
		font-style: italic;
	}

	.notebook-entry-content ul,
	.notebook-entry-content ol {
		margin: 1rem 0;
		padding-left: 1.5rem;
	}

	.notebook-entry-content li {
		margin: 0.375rem 0;
	}

	.notebook-sidebar-desktop {
		position: sticky;
		top: 80px;
		height: fit-content;
		max-height: calc(100vh - 140px);
		display: none;
	}

	.notebook-sidebar-header {
		padding: 1rem;
		border-bottom: 2px solid var(--deep-text);
		background: var(--page-bg);
	}

	.notebook-sidebar-title {
		font-size: 0.9rem;
		font-weight: 800;
		color: var(--deep-text);
	}

	.notebook-sidebar-body {
		padding: 0.5rem 0;
		max-height: 600px;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.notebook-toc-nav {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.notebook-toc-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.65rem 0.875rem;
		min-height: 2.5rem;
		color: var(--deep-text);
		text-decoration: none;
		font-size: 0.85rem;
		font-weight: 700;
		border-radius: var(--radius-large);
		border: none;
		background: transparent;
		cursor: pointer;
		transition: background-color 0.15s, transform 0.15s;
		text-align: left;
		width: 100%;
	}

	.notebook-toc-item:hover {
		background: rgba(0, 0, 0, 0.05);
		transform: translateX(3px);
	}

	.notebook-toc-item__number {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 0.375rem;
		background: rgba(0, 0, 0, 0.05);
		color: var(--content-meta);
		font-size: 0.7rem;
		font-weight: 800;
		font-family: ui-monospace, monospace;
		flex-shrink: 0;
	}

	.notebook-toc-item__title {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.notebook-toc-toggle-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.875rem 1.25rem;
		border: 2px solid var(--deep-text);
		border-radius: var(--radius-large);
		background: var(--page-bg);
		color: var(--deep-text);
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 4px 4px 0px var(--deep-text);
		z-index: 50;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
		position: fixed;
		bottom: 2rem;
		right: 1.5rem;
	}

	.notebook-toc-toggle-btn:hover {
		transform: translateY(-2px);
		box-shadow: 6px 6px 0px var(--deep-text);
	}

	.notebook-toc-toggle-btn svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.notebook-toc-modal {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	.notebook-toc-modal-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
	}

	.notebook-toc-modal-content {
		position: relative;
		width: 100%;
		max-height: 80vh;
		border-top-left-radius: var(--radius-large);
		border-top-right-radius: var(--radius-large);
		border: 2px solid var(--deep-text);
		border-bottom: none;
		background: var(--page-bg);
		overflow: hidden;
		animation: notebook-slide-up 0.3s ease-out;
	}

	@keyframes notebook-slide-up {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}

	.notebook-toc-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 2px solid var(--deep-text);
	}

	.notebook-toc-modal-title {
		font-size: 1rem;
		font-weight: 800;
		color: var(--deep-text);
	}

	.notebook-toc-modal-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border: none;
		background: transparent;
		color: var(--content-meta);
		font-size: 1.25rem;
		cursor: pointer;
		border-radius: var(--radius-large);
		transition: background-color 0.15s, color 0.15s;
	}

	.notebook-toc-modal-close:hover {
		background: var(--deep-text);
		color: var(--page-bg);
	}

	.notebook-toc-modal-close svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.notebook-toc-modal-body {
		padding: 0.5rem 0;
		max-height: calc(80vh - 60px);
		overflow-y: auto;
	}

	@media (min-width: 1280px) {
		.notebook-sidebar-desktop {
			display: block;
		}

		.notebook-toc-toggle-btn {
			display: none;
		}
	}

	@media (max-width: 768px) {
		.notebook-hero {
			height: 220px;
		}

		.notebook-hero-content {
			padding: 1.75rem;
		}

		.notebook-hero-title {
			font-size: clamp(1.5rem, 4vw, 2.2rem);
		}

		.notebook-content-wrapper {
			grid-template-columns: 1fr;
			gap: 2rem;
		}

		.notebook-entry-section {
			padding: 1.25rem;
		}

		.notebook-entry-title {
			font-size: 1.2rem;
		}

		.notebook-entry-content {
			font-size: 0.95rem;
		}
	}

	@media (max-width: 640px) {
		.notebook-back-link {
			font-size: 0.8rem;
			padding: 0.4rem 0.875rem;
		}

		.notebook-entry-section {
			padding: 1rem;
		}

		.notebook-entry-title {
			font-size: 1.15rem;
		}
	}
</style>