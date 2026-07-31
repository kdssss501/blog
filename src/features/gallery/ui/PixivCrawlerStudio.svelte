<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import type {
	PixivCrawlerMode,
	PixivCrawlerStatus,
} from "@/shared/pixiv-crawler/contract";

const MODES: Array<{
	id: PixivCrawlerMode;
	label: string;
	icon: string;
	description: string;
}> = [
	{
		id: "keyword",
		label: "关键词",
		icon: "material-symbols:search-rounded",
		description: "按安全关键词采集公开插画",
	},
	{
		id: "ranking",
		label: "排行榜",
		icon: "material-symbols:leaderboard-outline-rounded",
		description: "采集指定日期的日榜作品",
	},
	{
		id: "user",
		label: "画师",
		icon: "material-symbols:person-search-outline-rounded",
		description: "按 Pixiv 画师 UID 整理作品",
	},
];

const EMPTY_STATUS: PixivCrawlerStatus = {
	available: false,
	state: "unavailable",
	reason: "正在检测本地采集器……",
};

let mode = $state<PixivCrawlerMode>("keyword");
let query = $state("鸣潮");
let count = $state(12);
let rankingDate = $state("");
let status = $state<PixivCrawlerStatus>(EMPTY_STATUS);
let busy = $state(false);
let error = $state("");
let copied = $state(false);
let pollTimer = 0;

const activeMode = $derived(MODES.find((item) => item.id === mode) ?? MODES[0]);
const isRunning = $derived(status.state === "running");
const statusLabel = $derived(
	(
		{
			unavailable: "仅限本机",
			idle: "等待任务",
			running: "正在采集",
			succeeded: "采集完成",
			failed: "任务失败",
			cancelled: "任务已停止",
		} as const
	)[status.state],
);
const commandPreview = $derived.by(() => {
	const amount = Math.min(30, Math.max(1, Number(count) || 1));
	if (mode === "ranking") {
		return `.\\run.cmd ranking --date ${rankingDate || "YYYY-MM-DD"} --number ${amount}`;
	}
	const argument = query.trim() || (mode === "user" ? "PIXIV_UID" : "关键词");
	return `.\\run.cmd ${mode} ${JSON.stringify(argument)} --number ${amount}`;
});

function yesterday(): string {
	const date = new Date();
	date.setDate(date.getDate() - 1);
	return date.toISOString().slice(0, 10);
}

function schedulePoll() {
	window.clearTimeout(pollTimer);
	if (status.state !== "running") return;
	pollTimer = window.setTimeout(() => void refreshStatus(), 1800);
}

async function readResponse(response: Response) {
	const payload = (await response
		.json()
		.catch(() => ({}))) as PixivCrawlerStatus & {
		error?: string;
	};
	if (!response.ok)
		throw new Error(payload.error || payload.reason || "采集器请求失败。");
	return payload;
}

async function refreshStatus() {
	try {
		status = await readResponse(
			await fetch("/api/pixiv-crawler/", { cache: "no-store" }),
		);
		error = "";
	} catch (cause) {
		error = cause instanceof Error ? cause.message : "无法读取采集器状态。";
	} finally {
		schedulePoll();
	}
}

async function startTask(event: SubmitEvent) {
	event.preventDefault();
	if (!status.available || busy || isRunning) return;
	busy = true;
	error = "";
	try {
		status = await readResponse(
			await fetch("/api/pixiv-crawler/", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Pixiv-Crawler-Client": "album-studio",
				},
				body: JSON.stringify({
					mode,
					query,
					count: Number(count),
					date: rankingDate,
				}),
			}),
		);
		schedulePoll();
	} catch (cause) {
		error = cause instanceof Error ? cause.message : "无法启动采集任务。";
	} finally {
		busy = false;
	}
}

async function cancelTask() {
	if (!isRunning || busy) return;
	busy = true;
	error = "";
	try {
		status = await readResponse(
			await fetch("/api/pixiv-crawler/", {
				method: "DELETE",
				headers: { "X-Pixiv-Crawler-Client": "album-studio" },
			}),
		);
		schedulePoll();
	} catch (cause) {
		error = cause instanceof Error ? cause.message : "无法停止采集任务。";
	} finally {
		busy = false;
	}
}

async function copyCommand() {
	try {
		await navigator.clipboard.writeText(commandPreview);
		copied = true;
		window.setTimeout(() => (copied = false), 1400);
	} catch {
		error = "浏览器没有授予剪贴板权限。";
	}
}

onMount(() => {
	rankingDate = yesterday();
	void refreshStatus();
	return () => window.clearTimeout(pollTimer);
});
</script>

<section class="pixiv-studio" data-pagefind-body>
	<a class="pixiv-studio__back" href="/album/">
		<Icon icon="material-symbols:arrow-left-rounded" />
		返回相册
	</a>

	<header class="pixiv-studio__header">
		<div>
			<p>LOCAL COLLECTION TOOL</p>
			<h1 data-pagefind-meta="title">Pixiv 素材采集</h1>
			<span>采集结果进入待审目录，确认使用许可后再导入公开相册。</span>
		</div>
		<div class:status-online={status.available} class={`pixiv-studio__status is-${status.state}`} aria-live="polite">
			<i aria-hidden="true"></i>
			<strong>{statusLabel}</strong>
			<small>{status.available ? "PYTHON READY" : "LOCAL ONLY"}</small>
		</div>
	</header>

	<div class="pixiv-studio__workspace">
		<form class="pixiv-studio__form" onsubmit={startTask}>
			<div class="pixiv-studio__section-heading">
				<span>01</span>
				<div><strong>选择采集方式</strong><small>{activeMode.description}</small></div>
			</div>

			<div class="pixiv-studio__modes" role="radiogroup" aria-label="采集方式">
				{#each MODES as item (item.id)}
					<button
						type="button"
						class:is-active={mode === item.id}
						onclick={() => (mode = item.id)}
						role="radio"
						aria-checked={mode === item.id}
					>
						<Icon icon={item.icon} /><span>{item.label}</span>
					</button>
				{/each}
			</div>

			<div class="pixiv-studio__fields">
				{#if mode === "keyword"}
					<label><span>安全关键词</span><input bind:value={query} maxlength="60" required autocomplete="off" placeholder="例如：鸣潮" /></label>
				{:else if mode === "user"}
					<label><span>画师 UID</span><input bind:value={query} inputmode="numeric" pattern="[0-9]{4,20}" required autocomplete="off" placeholder="例如：32548944" /></label>
				{:else}
					<label><span>排行榜日期</span><input bind:value={rankingDate} type="date" required /></label>
				{/if}
				<label><span>作品数量</span><input bind:value={count} type="number" min="1" max="30" step="1" required /></label>
			</div>

			<div class="pixiv-studio__command">
				<div><span>命令预览</span><code>{commandPreview}</code></div>
				<button type="button" onclick={copyCommand} title="复制命令" aria-label="复制命令">
					<Icon icon={copied ? "material-symbols:check-rounded" : "material-symbols:content-copy-outline-rounded"} />
				</button>
			</div>

			{#if error}<p class="pixiv-studio__error" role="alert">{error}</p>{/if}
			{#if !status.available && status.reason}<p class="pixiv-studio__notice"><Icon icon="material-symbols:info-outline-rounded" />{status.reason}</p>{/if}

			<div class="pixiv-studio__actions">
				<button type="submit" disabled={!status.available || busy || isRunning}>
					<Icon icon={isRunning ? "svg-spinners:3-dots-bounce" : "material-symbols:download-rounded"} />
					{isRunning ? "采集中" : "开始采集"}
				</button>
				{#if isRunning}
					<button type="button" class="is-secondary" onclick={cancelTask} disabled={busy}>
						<Icon icon="material-symbols:stop-rounded" />停止
					</button>
				{/if}
			</div>
		</form>

		<aside class="pixiv-studio__monitor" aria-label="任务状态">
			<div class="pixiv-studio__section-heading">
				<span>02</span>
				<div><strong>任务监视器</strong><small>单任务队列 · 本机执行</small></div>
			</div>
			<dl>
				<div><dt>状态</dt><dd>{statusLabel}</dd></div>
				<div><dt>已保存</dt><dd>{status.imageCount ?? 0} 张</dd></div>
				<div><dt>任务编号</dt><dd>{status.jobId ?? "—"}</dd></div>
				<div><dt>输出目录</dt><dd>{status.outputPath ?? "PixivCrawler/downloads/album-inbox"}</dd></div>
			</dl>
			<pre aria-live="polite">{status.log || "等待新的采集任务。\n这里会显示精简后的运行日志。"}</pre>
			<footer>
				<Icon icon="material-symbols:verified-user-outline-rounded" />
				<p><strong>发布前检查</strong><span>这里只负责下载与整理，不会自动公开图片，也不会读取浏览器 Cookie。</span></p>
			</footer>
		</aside>
	</div>

	<ol class="pixiv-studio__workflow" aria-label="素材发布流程">
		<li><span>1</span><div><strong>采集</strong><small>保存到本地待审目录</small></div></li>
		<li><span>2</span><div><strong>确认授权</strong><small>核对来源与使用许可</small></div></li>
		<li><span>3</span><div><strong>导入相册</strong><small>转换 WebP 并写入目录</small></div></li>
	</ol>
</section>
