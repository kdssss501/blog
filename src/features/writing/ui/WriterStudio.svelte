<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import {
	checkAdminSession,
	loginAdminSession,
	logoutAdminSession,
} from "@/features/admin";
import { createApiUrl } from "@/shared/http";
import type {
	ContentDocumentInput,
	ContentDraft,
	ContentKind,
	ContentValidationIssue,
} from "../model/content-document";

type AuthState = "checking" | "required" | "authenticated" | "unconfigured";

function today(): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}

function blankDocument(kind: ContentKind = "post"): ContentDocumentInput {
	return {
		kind,
		title: "",
		slug: "",
		description: "",
		category: kind === "post" ? "others" : "",
		notebook: kind === "notebook" ? "随手笔记" : "",
		tags: [],
		published: today(),
		draft: true,
		cover: "",
		images: [],
		location: "",
		device: "",
		author: "",
		body: "",
	};
}

let authState = $state<AuthState>("checking");
let token = $state("");
let authError = $state("");
let loginBusy = $state(false);
let drafts = $state<ContentDraft[]>([]);
let document = $state<ContentDocumentInput>(blankDocument());
let tagsText = $state("");
let imagesText = $state("");
let previewHtml = $state("");
let previewIssues = $state<ContentValidationIssue[]>([]);
let activeDraftId = $state("");
let busy = $state(false);
let status = $state("");
let publishedUrl = $state("");
let publishedKind = $state<ContentKind | "">("");
let publishedSlug = $state("");
let mobileView = $state<"editor" | "preview">("editor");

const api = (...segments: string[]) =>
	createApiUrl("api", "content", ...segments);

onMount(() => {
	void initialize();
});

async function initialize() {
	try {
		const session = await checkAdminSession();
		if (session.authenticated) {
			authState = "authenticated";
			await loadDrafts();
		} else {
			authState = /not configured/i.test(session.error || "")
				? "unconfigured"
				: "required";
			authError = session.error || "";
		}
	} catch {
		authState = "required";
		authError = "无法连接管理接口。";
	}
}

async function login(event: SubmitEvent) {
	event.preventDefault();
	if (!token || loginBusy) return;
	loginBusy = true;
	authError = "";
	try {
		const session = await loginAdminSession(token);
		token = "";
		if (!session.authenticated) {
			authError = session.error || "Token 无效。";
			return;
		}
		authState = "authenticated";
		await loadDrafts();
	} catch {
		authError = "登录请求失败。";
	} finally {
		loginBusy = false;
	}
}

async function logout() {
	await logoutAdminSession();
	authState = "required";
	drafts = [];
	newDocument();
}

async function request(path: string, options?: RequestInit) {
	const response = await fetch(path, {
		credentials: "same-origin",
		...options,
		headers: {
			...(options?.body ? { "Content-Type": "application/json" } : {}),
			...options?.headers,
		},
	});
	const value = (await response.json().catch(() => ({}))) as Record<
		string,
		unknown
	>;
	if (response.status === 401) authState = "required";
	if (!response.ok) {
		throw new Error(
			typeof value.error === "string"
				? value.error
				: `请求失败 (${response.status})`,
		);
	}
	return value;
}

async function loadDrafts() {
	const value = await request(api("drafts"));
	drafts = Array.isArray(value.drafts) ? (value.drafts as ContentDraft[]) : [];
}

function payload(): ContentDocumentInput {
	return {
		...document,
		tags: tagsText
			.split(/[,，\n]/)
			.map((item) => item.trim())
			.filter(Boolean),
		images: imagesText
			.split(/[\n,]/)
			.map((item) => item.trim())
			.filter(Boolean),
	};
}

function selectDraft(draft: ContentDraft) {
	activeDraftId = draft.id;
	document = { ...draft };
	tagsText = draft.tags.join(", ");
	imagesText = draft.images.join("\n");
	previewHtml = "";
	previewIssues = [];
	publishedUrl = "";
	publishedKind = "";
	publishedSlug = "";
	status = `已载入“${draft.title || "未命名草稿"}”`;
}

function newDocument() {
	activeDraftId = "";
	document = blankDocument();
	tagsText = "";
	imagesText = "";
	previewHtml = "";
	previewIssues = [];
	publishedUrl = "";
	publishedKind = "";
	publishedSlug = "";
	status = "已新建空白文章";
}

function changeKind(kind: ContentKind) {
	if (document.kind === kind) return;
	document = { ...blankDocument(kind), body: document.body };
	activeDraftId = "";
	imagesText = "";
	publishedUrl = "";
	publishedKind = "";
	publishedSlug = "";
}

async function saveDraft() {
	if (busy) return;
	busy = true;
	status = "正在保存草稿...";
	try {
		const value = await request(
			activeDraftId ? api("drafts", activeDraftId) : api("drafts"),
			{
				method: activeDraftId ? "PUT" : "POST",
				body: JSON.stringify(payload()),
			},
		);
		const saved = value.draft as ContentDraft;
		activeDraftId = saved.id;
		document = { ...saved };
		tagsText = saved.tags.join(", ");
		imagesText = saved.images.join("\n");
		await loadDrafts();
		status = "草稿已保存";
	} catch (error) {
		status = error instanceof Error ? error.message : "保存失败";
	} finally {
		busy = false;
	}
}

async function deleteDraft() {
	if (!activeDraftId || busy) return;
	if (!window.confirm("确定删除当前草稿？此操作无法撤销。")) return;
	busy = true;
	try {
		await request(api("drafts", activeDraftId), { method: "DELETE" });
		await loadDrafts();
		newDocument();
		status = "草稿已删除";
	} catch (error) {
		status = error instanceof Error ? error.message : "删除失败";
	} finally {
		busy = false;
	}
}

async function preview() {
	if (busy) return;
	busy = true;
	status = "正在生成预览...";
	try {
		const value = await request(api("preview"), {
			method: "POST",
			body: JSON.stringify(payload()),
		});
		previewHtml = typeof value.html === "string" ? value.html : "";
		previewIssues = Array.isArray(value.issues)
			? (value.issues as ContentValidationIssue[])
			: [];
		mobileView = "preview";
		status = previewIssues.length
			? `预览完成，发现 ${previewIssues.length} 项需要修正`
			: "预览已更新";
	} catch (error) {
		status = error instanceof Error ? error.message : "预览失败";
	} finally {
		busy = false;
	}
}

async function publish() {
	if (busy) return;
	busy = true;
	status = "正在发布...";
	try {
		const value = await request(api("publish"), {
			method: "POST",
			body: JSON.stringify({ ...payload(), draft: false }),
		});
		publishedUrl =
			typeof value.url === "string" && value.url.startsWith("/content/view/?")
				? value.url
				: "";
		const published =
			value.published && typeof value.published === "object"
				? (value.published as Partial<ContentDraft>)
				: null;
		publishedKind =
			published?.kind === "post" ||
			published?.kind === "moment" ||
			published?.kind === "notebook"
				? published.kind
				: "";
		publishedSlug = typeof published?.slug === "string" ? published.slug : "";
		status = publishedUrl
			? "发布完成，公开页面已经可以访问。"
			: "发布完成，但服务端未返回公开查看地址。";
	} catch (error) {
		status = error instanceof Error ? error.message : "发布失败";
	} finally {
		busy = false;
	}
}

async function unpublish() {
	if (!publishedKind || !publishedSlug || busy) return;
	if (!window.confirm("确定撤回刚刚发布的内容吗？公开链接将不再可用。")) return;
	busy = true;
	status = "正在撤回发布...";
	try {
		await request(api("published", publishedKind, publishedSlug), {
			method: "DELETE",
		});
		publishedUrl = "";
		publishedKind = "";
		publishedSlug = "";
		status = "内容已撤回，草稿仍保留在写作台。";
	} catch (error) {
		status = error instanceof Error ? error.message : "撤回失败";
	} finally {
		busy = false;
	}
}

async function importMarkdown(event: Event) {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;
	busy = true;
	status = `正在导入 ${file.name}...`;
	try {
		const value = await request(api("import"), {
			method: "POST",
			body: JSON.stringify({ source: await file.text(), kind: document.kind }),
		});
		document = value.document as ContentDocumentInput;
		tagsText = document.tags.join(", ");
		imagesText = document.images.join("\n");
		activeDraftId = "";
		previewIssues = Array.isArray(value.issues)
			? (value.issues as ContentValidationIssue[])
			: [];
		status = `已导入 ${file.name}`;
	} catch (error) {
		status = error instanceof Error ? error.message : "导入失败";
	} finally {
		input.value = "";
		busy = false;
	}
}

async function uploadImage(event: Event) {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0];
	if (!file || busy) return;
	busy = true;
	try {
		const form = new FormData();
		form.append("file", file);
		const response = await fetch(api("assets"), {
			method: "POST",
			credentials: "same-origin",
			body: form,
		});
		const value = (await response.json().catch(() => ({}))) as {
			asset?: { url?: string };
			error?: string;
		};
		if (!response.ok || !value.asset?.url)
			throw new Error(value.error || "图片上传失败");
		imagesText = [imagesText, value.asset.url].filter(Boolean).join("\n");
		const imageAlt = file.name
			.replace(/[\r\n]+/g, " ")
			.replace(/\\/g, "\\\\")
			.replace(/([[\]])/g, "\\$1");
		const imageUrl = value.asset.url.replace(/>/g, "%3E");
		document = {
			...document,
			body: `${document.body}${document.body.endsWith("\n") || !document.body ? "" : "\n\n"}![${imageAlt}](<${imageUrl}>)\n`,
		};
		status = "图片已插入 Markdown 与资源列表";
	} catch (error) {
		status = error instanceof Error ? error.message : "图片上传失败";
	} finally {
		input.value = "";
		busy = false;
	}
}
</script>

{#if authState === "checking"}
	<div class="admin-state" role="status"><span></span>正在确认管理会话...</div>
{:else if authState !== "authenticated"}
	<section class="admin-login" aria-labelledby="writer-login-title">
		<div class="admin-login__signal"><Icon icon="material-symbols:edit-square-outline-rounded" size="2xl" /></div>
		<p>WRITING CONSOLE</p>
		<h1 id="writer-login-title">写作控制台</h1>
		{#if authState === "unconfigured"}
			<div class="admin-login__notice">服务端尚未配置 <code>BLOG_ADMIN_TOKEN</code>，写作后台已锁定。</div>
		{:else}
			<form onsubmit={login}>
				<label for="writer-token">管理员 Token</label>
				<div>
					<input id="writer-token" type="password" bind:value={token} autocomplete="current-password" required />
					<button type="submit" disabled={loginBusy}>{loginBusy ? "验证中" : "进入"}</button>
				</div>
				{#if authError}<small>{authError}</small>{/if}
			</form>
		{/if}
	</section>
{:else}
	<section class="writer-studio">
		<header class="writer-toolbar">
			<div><p>WRITING CONSOLE</p><h1>文章工作台</h1></div>
			<div class="writer-toolbar__actions">
				<label class="icon-command" title="导入 Markdown"><Icon icon="material-symbols:upload-file-outline-rounded" /><input type="file" accept=".md,.markdown,text/markdown" onchange={importMarkdown} /></label>
				<label class="icon-command" title="上传图片"><Icon icon="material-symbols:image-outline-rounded" /><input type="file" accept="image/avif,image/gif,image/jpeg,image/png,image/webp" onchange={uploadImage} /></label>
				<button class="icon-command" type="button" onclick={newDocument} title="新文章"><Icon icon="material-symbols:note-add-outline-rounded" /></button>
				<button class="icon-command" type="button" onclick={saveDraft} disabled={busy} title="保存草稿"><Icon icon="material-symbols:save-outline-rounded" /></button>
				<button class="icon-command" type="button" onclick={preview} disabled={busy} title="更新预览"><Icon icon="material-symbols:visibility-outline-rounded" /></button>
				<button class="writer-publish" type="button" onclick={publish} disabled={busy}><Icon icon="material-symbols:publish-rounded" />发布</button>
				<button class="icon-command" type="button" onclick={logout} title="退出管理"><Icon icon="material-symbols:logout-rounded" /></button>
			</div>
		</header>

		<div class="writer-mobile-tabs" role="tablist" aria-label="工作区视图">
			<button class:is-active={mobileView === "editor"} type="button" onclick={() => (mobileView = "editor")}>编辑</button>
			<button class:is-active={mobileView === "preview"} type="button" onclick={() => (mobileView = "preview")}>预览</button>
		</div>

		<div class="writer-grid">
			<aside class="writer-drafts">
				<div><strong>草稿</strong><span>{drafts.length}</span></div>
				{#if drafts.length === 0}<p>还没有保存的草稿。</p>{/if}
				{#each drafts as draft (draft.id)}
					<button class:is-active={draft.id === activeDraftId} type="button" onclick={() => selectDraft(draft)}>
						<strong>{draft.title || "未命名草稿"}</strong>
						<span>{new Date(draft.updatedAt).toLocaleString("zh-CN")}</span>
					</button>
				{/each}
			</aside>

			<div class:hidden-mobile={mobileView !== "editor"} class="writer-editor">
				<div class="writer-fields">
					<label>内容类型<select value={document.kind} onchange={(event) => changeKind((event.currentTarget as HTMLSelectElement).value as ContentKind)}><option value="post">文章</option><option value="moment">动态</option><option value="notebook">笔记</option></select></label>
					<label class="is-wide">标题<input bind:value={document.title} maxlength="120" placeholder="文章标题" /></label>
					<label>Slug<input bind:value={document.slug} maxlength="96" placeholder="article-slug" /></label>
					{#if document.kind === "post"}<label>分类<input bind:value={document.category} maxlength="48" placeholder="others" /></label>{/if}
					{#if document.kind === "notebook"}<label>笔记本<input bind:value={document.notebook} maxlength="80" placeholder="随手笔记" /></label>{/if}
					<label class="is-wide">摘要<textarea bind:value={document.description} rows="2" maxlength="300" placeholder="用于列表与搜索结果的简短说明"></textarea></label>
					<label>发布日期<input type="date" bind:value={document.published} /></label>
					<label>标签<input bind:value={tagsText} placeholder="Astro, Svelte" /></label>
					{#if document.kind !== "post"}<label>作者<input bind:value={document.author} maxlength="80" placeholder="可选" /></label>{/if}
					{#if document.kind === "moment"}<label>位置<input bind:value={document.location} maxlength="80" placeholder="可选" /></label><label>设备<input bind:value={document.device} maxlength="80" placeholder="可选" /></label>{/if}
					<label class="is-wide">封面 URL<input bind:value={document.cover} placeholder="https://... 或 /uploads/..." /></label>
					<label class="is-wide">图片资源（每行一个）<textarea bind:value={imagesText} rows="2" placeholder="上传图片后会自动添加"></textarea></label>
					<label class="writer-draft-toggle"><input type="checkbox" bind:checked={document.draft} /><span>保存为草稿状态</span></label>
				</div>
				<label class="writer-body">Markdown 正文<textarea bind:value={document.body} spellcheck="false" placeholder="# 从这里开始"></textarea></label>
			</div>

			<section class:hidden-mobile={mobileView !== "preview"} class="writer-preview" aria-label="文章预览">
				<div class="writer-preview__top"><strong>预览</strong><span>{previewHtml ? "已渲染" : "等待更新"}</span></div>
				{#if previewIssues.length > 0}
					<ul class="writer-issues">{#each previewIssues as issue}<li><strong>{issue.field}</strong>{issue.message}</li>{/each}</ul>
				{/if}
				{#if previewHtml}<article class="writer-preview__content">{@html previewHtml}</article>{:else}<div class="writer-preview__empty"><Icon icon="material-symbols:visibility-outline-rounded" size="2xl" /><span>点击预览生成文章效果</span></div>{/if}
			</section>
		</div>

		<footer class="writer-status" aria-live="polite">
			<span>{busy ? "PROCESSING" : "READY"}</span><p>{status || "编辑内容后保存草稿或生成预览。"}</p>
			{#if publishedUrl}<a class="writer-status__published" href={publishedUrl}>{publishedUrl}</a>{/if}
			{#if publishedKind && publishedSlug}<button type="button" onclick={unpublish} disabled={busy}>撤回发布</button>{/if}
			{#if activeDraftId}<button type="button" onclick={deleteDraft} disabled={busy}>删除当前草稿</button>{/if}
		</footer>
	</section>
{/if}

<style>
	.admin-state { display:flex; min-height:28rem; align-items:center; justify-content:center; gap:.75rem; color:var(--content-meta); }
	.admin-state span { width:.65rem; height:.65rem; border-radius:50%; background:var(--primary); animation:pulse 1s infinite alternate; }
	.admin-login { display:grid; max-width:28rem; margin:5rem auto; padding:2rem; border:1px solid var(--line-divider); border-radius:8px; background:var(--card-bg); }
	.admin-login__signal { display:grid; width:3.5rem; height:3.5rem; place-items:center; margin-bottom:1.5rem; border-radius:50%; background:var(--deep-text); color:var(--page-bg); }
	.admin-login > p, .writer-toolbar p { margin:0; color:var(--primary); font:700 .68rem/1 ui-monospace,monospace; }
	.admin-login h1 { margin:.35rem 0 1.5rem; font-size:1.75rem; }
	.admin-login form { display:grid; gap:.55rem; }
	.admin-login form > div { display:grid; grid-template-columns:1fr auto; }
	.admin-login input { min-width:0; border:1px solid var(--line-divider); border-radius:6px 0 0 6px; background:var(--page-bg); color:var(--deep-text); padding:.7rem .8rem; }
	.admin-login button { border:0; border-radius:0 6px 6px 0; background:var(--deep-text); color:var(--page-bg); padding:0 1rem; font-weight:700; }
	.admin-login small, .admin-login__notice { color:var(--content-meta); line-height:1.6; }
	.writer-studio { container-type:inline-size; width:100%; min-width:0; border:1px solid var(--line-divider); border-radius:8px; overflow:hidden; background:var(--card-bg); }
	.writer-toolbar { display:flex; min-height:4.25rem; align-items:center; justify-content:space-between; gap:1rem; padding:.75rem 1rem; border-bottom:1px solid var(--line-divider); }
	.writer-toolbar h1 { margin:.2rem 0 0; font-size:1.2rem; }
	.writer-toolbar__actions { display:flex; align-items:center; gap:.35rem; }
	.icon-command, .writer-publish { display:inline-flex; height:2.5rem; align-items:center; justify-content:center; border:1px solid var(--line-divider); border-radius:6px; background:transparent; color:var(--deep-text); cursor:pointer; }
	.icon-command { width:2.5rem; }
	.icon-command input { display:none; }
	.writer-publish { gap:.35rem; padding:0 .8rem; background:var(--deep-text); color:var(--page-bg); font-weight:750; }
	.icon-command:disabled, .writer-publish:disabled { opacity:.4; cursor:not-allowed; }
	.writer-grid { display:grid; grid-template-columns:13rem minmax(24rem,1fr) minmax(20rem,.85fr); min-height:42rem; }
	.writer-drafts, .writer-editor { border-right:1px solid var(--line-divider); }
	.writer-drafts { overflow:auto; padding:.75rem; background:color-mix(in oklch,var(--card-bg) 82%,var(--page-bg)); }
	.writer-drafts > div { display:flex; justify-content:space-between; margin-bottom:.6rem; font-size:.78rem; }
	.writer-drafts > p { color:var(--content-meta); font-size:.75rem; }
	.writer-drafts > button { display:grid; width:100%; gap:.25rem; padding:.65rem; border:0; border-radius:5px; background:transparent; color:var(--deep-text); text-align:left; cursor:pointer; }
	.writer-drafts > button:hover, .writer-drafts > button.is-active { background:var(--btn-regular-bg); }
	.writer-drafts button strong { overflow:hidden; font-size:.78rem; text-overflow:ellipsis; white-space:nowrap; }
	.writer-drafts button span { color:var(--content-meta); font-size:.65rem; }
	.writer-editor { display:grid; grid-template-rows:auto minmax(20rem,1fr); min-width:0; }
	.writer-fields { display:grid; grid-template-columns:1fr 1fr; gap:.65rem; padding:1rem; border-bottom:1px solid var(--line-divider); }
	.writer-fields label, .writer-body { display:grid; gap:.3rem; color:var(--content-meta); font-size:.68rem; font-weight:700; }
	.writer-fields .is-wide { grid-column:1/-1; }
	.writer-fields input:not([type="checkbox"]), .writer-fields textarea, .writer-fields select, .writer-body textarea { width:100%; border:1px solid var(--line-divider); border-radius:5px; background:var(--page-bg); color:var(--deep-text); font:inherit; font-size:.8rem; padding:.55rem .65rem; }
	.writer-draft-toggle { display:flex!important; align-items:center; align-self:end; }
	.writer-body { min-height:0; padding:1rem; }
	.writer-body textarea { min-height:28rem; resize:none; font-family:ui-monospace,monospace; line-height:1.7; }
	.writer-preview { min-width:0; overflow:auto; background:var(--page-bg); }
	.writer-preview__top { position:sticky; top:0; z-index:1; display:flex; justify-content:space-between; padding:.8rem 1rem; border-bottom:1px solid var(--line-divider); background:color-mix(in oklch,var(--page-bg) 92%,transparent); backdrop-filter:blur(12px); font-size:.75rem; }
	.writer-preview__top span { color:var(--content-meta); }
	.writer-preview__content { padding:1.5rem; color:var(--content-text); line-height:1.75; overflow-wrap:anywhere; }
	.writer-preview__content :global(img) { max-width:100%; height:auto; }
	.writer-preview__content :global(pre) { overflow:auto; padding:1rem; border-radius:6px; background:#12151b; color:#eef2f1; }
	.writer-preview__empty { display:grid; min-height:24rem; place-items:center; align-content:center; gap:.5rem; color:var(--content-meta); font-size:.75rem; }
	.writer-issues { margin:1rem; padding:.75rem 1rem .75rem 2rem; border-left:3px solid #d96862; background:color-mix(in oklch,#d96862 8%,transparent); font-size:.72rem; }
	.writer-issues li+li { margin-top:.35rem; }
	.writer-issues strong { margin-right:.5rem; }
	.writer-status { display:flex; min-height:2.75rem; align-items:center; gap:.75rem; padding:.5rem 1rem; border-top:1px solid var(--line-divider); color:var(--content-meta); font-size:.68rem; }
	.writer-status > span { color:var(--primary); font:700 .64rem/1 ui-monospace,monospace; }
	.writer-status p { min-width:0; flex:1; margin:0; }
	.writer-status__published { max-width:21rem; overflow:hidden; color:var(--primary); font-weight:750; text-overflow:ellipsis; white-space:nowrap; }
	.writer-status button { border:0; background:transparent; color:#b34e49; font:inherit; cursor:pointer; }
	.writer-mobile-tabs { display:none; }
	@keyframes pulse { to { opacity:.25; } }
	@container (max-width:68rem) {
		.writer-grid { grid-template-areas:"drafts editor" "drafts preview"; grid-template-columns:minmax(9rem,11rem) minmax(0,1fr); grid-template-rows:auto auto; }
		.writer-drafts { grid-area:drafts; }
		.writer-editor { grid-area:editor; border-right:0; }
		.writer-preview { grid-area:preview; min-height:30rem; border-top:1px solid var(--line-divider); }
	}
	@media (min-width:900px) { .writer-studio { width:calc(100% - 4.75rem); } }
	@media (max-width:760px) {
		.writer-studio { border-inline:0; border-radius:0; }
		.writer-toolbar { display:grid; align-items:flex-start; }
		.writer-toolbar__actions { flex-wrap:wrap; justify-content:flex-start; }
		.writer-grid { display:block; min-height:36rem; }
		.writer-drafts { display:flex; gap:.4rem; overflow-x:auto; border-bottom:1px solid var(--line-divider); }
		.writer-drafts > div, .writer-drafts > p { flex:0 0 auto; }
		.writer-drafts > button { width:9rem; flex:0 0 auto; }
		.writer-editor { border-right:0; }
		.writer-preview { min-height:34rem; }
		.writer-mobile-tabs { display:grid; grid-template-columns:1fr 1fr; padding:.4rem; border-bottom:1px solid var(--line-divider); }
		.writer-mobile-tabs button { height:2.2rem; border:0; border-radius:5px; background:transparent; color:var(--content-meta); }
		.writer-mobile-tabs button.is-active { background:var(--deep-text); color:var(--page-bg); }
		.hidden-mobile { display:none; }
		.writer-body textarea { min-height:22rem; }
		.writer-status { align-items:flex-start; flex-wrap:wrap; }
		.writer-status__published { width:100%; max-width:100%; }
	}
	@media (prefers-reduced-motion:reduce) { .admin-state span { animation:none; } }
</style>
