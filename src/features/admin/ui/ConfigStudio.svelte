<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import { createApiUrl } from "@/shared/http";
import {
	checkAdminSession,
	loginAdminSession,
	logoutAdminSession,
} from "../client";
import type { PublicSiteConfig } from "../model/public-site-config";

type AuthState = "checking" | "required" | "authenticated" | "unconfigured";

const endpoint = createApiUrl("api", "site-config");
let authState = $state<AuthState>("checking");
let config = $state<PublicSiteConfig | null>(null);
let token = $state("");
let message = $state("");
let busy = $state(false);

onMount(() => {
	void initialize();
});

async function initialize() {
	try {
		const [session] = await Promise.all([checkAdminSession(), loadConfig()]);
		authState = session.authenticated
			? "authenticated"
			: /not configured/i.test(session.error || "")
				? "unconfigured"
				: "required";
		if (!session.authenticated) message = session.error || "";
	} catch {
		authState = "required";
		message = "无法连接站点配置接口。";
	}
}

async function loadConfig() {
	const response = await fetch(endpoint, { credentials: "same-origin" });
	if (!response.ok) throw new Error("配置读取失败");
	const value = (await response.json()) as { config: PublicSiteConfig };
	config = value.config;
}

async function login(event: SubmitEvent) {
	event.preventDefault();
	if (!token || busy) return;
	busy = true;
	message = "";
	try {
		const session = await loginAdminSession(token);
		token = "";
		if (!session.authenticated) {
			message = session.error || "Token 无效。";
			return;
		}
		authState = "authenticated";
		await loadConfig();
	} catch {
		message = "登录请求失败。";
	} finally {
		busy = false;
	}
}

async function save() {
	if (!config || busy) return;
	busy = true;
	message = "正在保存...";
	try {
		const response = await fetch(endpoint, {
			method: "PUT",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(config),
		});
		const value = (await response.json().catch(() => ({}))) as {
			config?: PublicSiteConfig;
			error?: string;
			errors?: string[];
		};
		if (!response.ok) {
			if (response.status === 401) authState = "required";
			throw new Error(value.errors?.join("；") || value.error || "保存失败");
		}
		if (value.config) config = value.config;
		message = "公开配置已保存，刷新页面后全局生效。";
	} catch (error) {
		message = error instanceof Error ? error.message : "保存失败";
	} finally {
		busy = false;
	}
}

async function reset() {
	if (busy || !window.confirm("恢复代码中的默认公开配置？")) return;
	busy = true;
	try {
		const response = await fetch(endpoint, {
			method: "DELETE",
			credentials: "same-origin",
		});
		const value = (await response.json()) as {
			config?: PublicSiteConfig;
			error?: string;
		};
		if (!response.ok) throw new Error(value.error || "重置失败");
		if (value.config) config = value.config;
		message = "已恢复代码默认值。";
	} catch (error) {
		message = error instanceof Error ? error.message : "重置失败";
	} finally {
		busy = false;
	}
}

async function logout() {
	await logoutAdminSession();
	authState = "required";
	message = "";
}

function updateWidgetList(side: "left" | "right", event: Event) {
	if (!config) return;
	const widgets = (event.currentTarget as HTMLInputElement).value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
	if (side === "left") config.leftSidebarWidgets = widgets;
	else config.rightSidebarWidgets = widgets;
}
</script>

{#if authState === "checking"}
	<div class="config-state" role="status"><span></span>正在读取公开配置...</div>
{:else if authState !== "authenticated"}
	<section class="config-login" aria-labelledby="config-login-title">
		<div><Icon icon="material-symbols:tune-rounded" size="2xl" /></div>
		<p>SITE CONTROL</p><h1 id="config-login-title">站点配置</h1>
		{#if authState === "unconfigured"}
			<aside>服务端尚未配置 <code>BLOG_ADMIN_TOKEN</code>，配置写入已锁定。</aside>
		{:else}
			<form onsubmit={login}>
				<label for="config-token">管理员 Token</label>
				<section><input id="config-token" type="password" bind:value={token} autocomplete="current-password" required /><button type="submit" disabled={busy}>进入</button></section>
				{#if message}<small>{message}</small>{/if}
			</form>
		{/if}
	</section>
{:else if config}
	<section class="config-studio">
		<header>
			<div><p>SITE CONTROL</p><h1>公开配置</h1><span>只编辑可以公开返回给访客的字段。</span></div>
			<nav>
				<button type="button" onclick={reset} disabled={busy} title="恢复默认"><Icon icon="material-symbols:restart-alt-rounded" /></button>
				<button type="button" onclick={logout} title="退出管理"><Icon icon="material-symbols:logout-rounded" /></button>
				<button class="is-primary" type="button" onclick={save} disabled={busy}><Icon icon="material-symbols:save-outline-rounded" />保存配置</button>
			</nav>
		</header>
		<div class="config-grid">
			<section>
				<p>IDENTITY</p><h2>站点身份</h2>
				<label>站点名称<input bind:value={config.title} maxlength="80" /></label>
				<label>副标题<input bind:value={config.subtitle} maxlength="120" /></label>
				<label>作者名称<input bind:value={config.authorName} maxlength="60" /></label>
				<label>站点 URL<input type="url" bind:value={config.siteUrl} maxlength="240" /></label>
			</section>
			<section>
				<p>APPEARANCE</p><h2>外观默认值</h2>
				<label>默认主题色相 <output>{config.accentHue}</output><input type="range" min="0" max="360" step="1" bind:value={config.accentHue} /></label>
				<div class="hue-preview" style={`--preview-hue:${config.accentHue}`}><span></span><strong>HUE {config.accentHue}</strong></div>
				<label>默认主题<select bind:value={config.themeMode}><option value="system">跟随系统</option><option value="light">亮色</option><option value="dark">暗色</option></select></label>
				<label>默认壁纸模式<select bind:value={config.wallpaperMode}><option value="none">纯色</option><option value="banner">顶部横幅</option><option value="full">全屏壁纸</option><option value="overlay">沉浸叠加</option></select></label>
				<label class="config-check"><input type="checkbox" bind:checked={config.sakuraEnabled} /><span>默认启用樱花特效</span></label>
				<label>樱花数量<input type="number" min="0" max="100" bind:value={config.sakuraCount} /></label>
				<label>页面最大宽度（rem）<input type="number" min="48" max="140" bind:value={config.pageWidth} /></label>
				<label class="config-check"><input type="checkbox" bind:checked={config.cardBorder} /><span>显示卡片边框</span></label>
				<label class="config-check"><input type="checkbox" bind:checked={config.wavesEnabled} /><span>启用横幅水波纹</span></label>
			</section>
			<section>
				<p>LAYOUT</p><h2>内容与侧栏</h2>
				<label>默认文章布局<select bind:value={config.defaultPostLayout}><option value="grid">三列网格</option><option value="list">单列列表</option></select></label>
				<label>侧栏位置<select bind:value={config.sidebarPosition}><option value="both">左右双栏</option><option value="left">仅左栏</option><option value="right">仅右栏</option></select></label>
				<label>每页文章数量<input type="number" min="1" max="50" bind:value={config.postsPerPage} /></label>
				<label>网格列数<select bind:value={config.postGridColumns}><option value={3}>三列</option><option value={2}>两列</option></select></label>
				<label class="config-check"><input type="checkbox" bind:checked={config.allowPostLayoutSwitch} /><span>允许访客切换文章布局</span></label>
				<label class="config-check"><input type="checkbox" bind:checked={config.postMasonry} /><span>启用文章瀑布流</span></label>
			</section>
			<section class="is-wide">
				<p>MEDIA</p><h2>壁纸与组件</h2>
				<label>桌面壁纸<input type="text" bind:value={config.wallpaperDesktop} maxlength="500" /></label>
				<label>移动壁纸<input type="text" bind:value={config.wallpaperMobile} maxlength="500" /></label>
				<label>横幅标题<input type="text" bind:value={config.bannerTitle} maxlength="120" /></label>
				<label>个人签名<input type="text" bind:value={config.profileBio} maxlength="240" /></label>
				<div class="config-inline-checks">
					<label class="config-check"><input type="checkbox" bind:checked={config.musicEnabled} /><span>音乐组件</span></label>
					<label class="config-check"><input type="checkbox" bind:checked={config.live2dEnabled} /><span>Live2D 小爱</span></label>
					<label class="config-check"><input type="checkbox" bind:checked={config.spineEnabled} /><span>Spine 模型</span></label>
				</div>
				<label>左栏组件（逗号分隔）<input value={config.leftSidebarWidgets.join(", ")} oninput={(event) => updateWidgetList("left", event)} /></label>
				<label>右栏组件（逗号分隔）<input value={config.rightSidebarWidgets.join(", ")} oninput={(event) => updateWidgetList("right", event)} /></label>
			</section>
			<section class="is-wide">
				<p>PAGES</p><h2>页面开关</h2>
				<div class="config-inline-checks config-page-flags">
					{#each Object.keys(config.pageFlags) as page (page)}
						<label class="config-check"><input type="checkbox" bind:checked={config.pageFlags[page]} /><span>{page}</span></label>
					{/each}
				</div>
			</section>
			<section class="is-wide">
				<p>CONTENT</p><h2>公开文案</h2>
				<label>站点描述<textarea bind:value={config.description} rows="3" maxlength="300"></textarea></label>
				<label>首页状态<textarea bind:value={config.homeStatus} rows="2" maxlength="160"></textarea></label>
				<label>公告<textarea bind:value={config.announcement} rows="4" maxlength="500" placeholder="留空时不显示运行时公告"></textarea></label>
			</section>
		</div>
		<footer aria-live="polite"><span>{busy ? "SYNCING" : "READY"}</span><p>{message || `上次更新：${config.updatedAt ? new Date(config.updatedAt).toLocaleString("zh-CN") : "代码默认值"}`}</p></footer>
	</section>
{/if}

<style>
	.config-state { display:flex; min-height:28rem; align-items:center; justify-content:center; gap:.7rem; color:var(--content-meta); }
	.config-state span { width:.65rem; height:.65rem; border-radius:50%; background:var(--primary); }
	.config-login { display:grid; max-width:28rem; margin:5rem auto; padding:2rem; border:1px solid var(--line-divider); border-radius:8px; background:var(--card-bg); }
	.config-login > div { display:grid; width:3.5rem; height:3.5rem; place-items:center; margin-bottom:1.5rem; border-radius:50%; background:var(--deep-text); color:var(--page-bg); }
	.config-login > p, .config-studio header p, .config-grid section > p { margin:0; color:var(--primary); font:700 .68rem/1 ui-monospace,monospace; }
	.config-login h1 { margin:.35rem 0 1.5rem; font-size:1.75rem; }
	.config-login form { display:grid; gap:.55rem; }
	.config-login form section { display:grid; grid-template-columns:1fr auto; }
	.config-login input { min-width:0; padding:.7rem .8rem; border:1px solid var(--line-divider); border-radius:6px 0 0 6px; background:var(--page-bg); color:var(--deep-text); }
	.config-login button { border:0; border-radius:0 6px 6px 0; background:var(--deep-text); color:var(--page-bg); padding:0 1rem; }
	.config-login aside, .config-login small { color:var(--content-meta); line-height:1.65; }
	.config-studio { overflow:hidden; border:1px solid var(--line-divider); border-radius:8px; background:var(--card-bg); }
	.config-studio > header { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1rem 1.25rem; border-bottom:1px solid var(--line-divider); }
	.config-studio header h1 { margin:.25rem 0; font-size:1.3rem; }
	.config-studio header span { color:var(--content-meta); font-size:.72rem; }
	.config-studio nav { display:flex; gap:.4rem; }
	.config-studio nav button { display:inline-flex; height:2.5rem; align-items:center; justify-content:center; gap:.35rem; padding:0 .7rem; border:1px solid var(--line-divider); border-radius:6px; background:transparent; color:var(--deep-text); cursor:pointer; }
	.config-studio nav button:not(.is-primary) { width:2.5rem; padding:0; }
	.config-studio nav .is-primary { background:var(--deep-text); color:var(--page-bg); font-weight:750; }
	.config-grid { display:grid; grid-template-columns:1fr 1fr; }
	.config-grid section { display:grid; align-content:start; gap:.8rem; min-width:0; padding:1.4rem; border-right:1px solid var(--line-divider); border-bottom:1px solid var(--line-divider); }
	.config-grid section:nth-child(even) { border-right:0; }
	.config-grid section.is-wide { grid-column:1/-1; border-right:0; }
	.config-grid h2 { margin:-.4rem 0 .35rem; font-size:1.05rem; }
	.config-grid label { display:grid; gap:.35rem; color:var(--content-meta); font-size:.7rem; font-weight:700; }
	.config-grid label output { justify-self:end; margin-top:-1rem; color:var(--deep-text); }
	.config-grid input:not([type="range"]):not([type="checkbox"]), .config-grid select, .config-grid textarea { width:100%; padding:.62rem .7rem; border:1px solid var(--line-divider); border-radius:5px; background:var(--page-bg); color:var(--deep-text); font:inherit; font-size:.82rem; }
	.config-grid .config-check { grid-template-columns:auto 1fr; align-items:center; gap:.55rem; color:var(--deep-text); font-size:.78rem; }
	.config-grid .config-check input { width:1rem; height:1rem; accent-color:var(--primary); }
	.config-inline-checks { display:flex; flex-wrap:wrap; gap:.75rem 1.25rem; }
	.config-page-flags { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); }
	.config-grid textarea { resize:vertical; line-height:1.6; }
	.config-grid input[type="range"] { width:100%; accent-color:oklch(.58 .16 var(--preview-hue,310)); }
	.hue-preview { display:flex; min-height:5rem; align-items:center; gap:1rem; padding:1rem; border:1px solid var(--line-divider); border-radius:6px; background:var(--page-bg); }
	.hue-preview span { width:2.5rem; height:2.5rem; border-radius:50%; background:oklch(.58 .16 var(--preview-hue)); box-shadow:0 0 1.2rem oklch(.58 .16 var(--preview-hue) / .3); }
	.hue-preview strong { font:700 .72rem/1 ui-monospace,monospace; }
	.config-studio > footer { display:flex; align-items:center; gap:.7rem; min-height:2.75rem; padding:.5rem 1rem; color:var(--content-meta); font-size:.68rem; }
	.config-studio footer span { color:var(--primary); font:700 .64rem/1 ui-monospace,monospace; }
	.config-studio footer p { margin:0; }
	@media (min-width:900px) { .config-studio { width:calc(100% - 4.75rem); } }
	@media (max-width:700px) {
		.config-studio { border-inline:0; border-radius:0; }
		.config-studio > header { align-items:flex-start; }
		.config-studio nav { flex-wrap:wrap; justify-content:flex-end; }
		.config-grid { grid-template-columns:1fr; }
		.config-grid section, .config-grid section:nth-child(2), .config-grid section.is-wide { grid-column:auto; border-right:0; }
		.config-page-flags { grid-template-columns:repeat(2,minmax(0,1fr)); }
	}
</style>
