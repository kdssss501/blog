# Obsidian 内容工作流

本仓库根目录可以直接作为 Obsidian vault 打开。Obsidian 负责编辑本地 Markdown，Astro 内容集合和 PagesCMS 直接读取仓库中的内容文件，因此三者共享同一份源文件，不需要导出或专用同步服务。

文章由 Astro 文章集合直接渲染；动态和笔记会在页面加载时把 Obsidian 内容与 D1/KV 运行时内容按稳定身份去重合并。即使 API 暂时不可用，已提交的 Markdown 动态和笔记仍会显示。

## 内容位置

| 内容 | 仓库目录 | Obsidian 模板 |
| --- | --- | --- |
| 文章 | `src/content/posts/<category>/` | `.obsidian/templates/文章.md` |
| 动态 | `src/content/moments/` | `.obsidian/templates/动态.md` |
| 笔记本 | `src/content/life/notebooks/` | `.obsidian/templates/笔记.md` |

`.obsidian/content-vault.json` 是供自动化工具读取的映射，不会参与 Astro 构建。请保持内容目录和 frontmatter 字段不变，以继续兼容 PagesCMS。

## 写作与发布

1. 在 Obsidian 中使用对应模板新建 Markdown 文件，并保存到内容目录。
2. 本地预览使用 `pnpm dev`；确认后按既有 Git/PagesCMS 流程提交内容。
3. `/write` 提供同一文档模型的受保护草稿、Markdown 导入、预览和图片插入。它通过 `BLOG_ADMIN_TOKEN` 的会话认证。

笔记本分组的规范字段是 `notebook`。旧文件中的 `name` 仍兼容读取，但新模板和在线写作台只输出 `notebook`，避免分组字段分叉。

`POST /api/content/publish` 保存的是运行时发布副本，适合动态内容或无 Git 写入权限的部署；它不会修改仓库文件，也不会使静态 Astro 页面立刻重建。要让文章、静态动态和笔记出现在下一次构建中，请经由 Obsidian 或 PagesCMS 将 Markdown 提交到上述目录。原有 `/api/posts/*`、`/api/activity/*`、`/api/notebook/*` API 保持可用。

## 图片

`POST /api/content/assets` 接受 AVIF、GIF、JPEG、PNG、WebP，单个文件最大 15 MB，并返回可直接放入 Markdown 的 URL。

- 本地开发：文件保存到 `public/uploads/content/`。
- Cloudflare：在 `wrangler.toml` 中绑定 `CONTENT_ASSETS` R2 bucket，并配置 `CONTENT_ASSET_PUBLIC_BASE_URL`。
- 外部图床：配置 `CONTENT_ASSET_EXTERNAL_UPLOAD_URL`，其应接受原始图片 `POST`，并返回 `{ "url": "https://..." }`；可选 token 放在 `CONTENT_ASSET_EXTERNAL_TOKEN`。

这些变量只应在部署平台或本地私有 `.env` 配置，切勿提交 token。外部资源 URL 必须使用 HTTPS。
