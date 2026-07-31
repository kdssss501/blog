# Fqzlr 视觉功能全量迁移完成审计

审计日期：2026-07-23。

## 1. 审计结论

目标文件中的应用外壳、页面、内容模型、管理接口、小爱中枢、兼容边界和自动化门禁均已实现并取得当前工作区证据。项目继续使用 Astro 6、Svelte 5、Cloudflare Functions/D1 与统一存储端口，没有整仓覆盖或引入目标站凭据。

留言板、笔记本、动态和左右侧栏采用 `tianshihao2003/dumpling-theme` 的 MIT 许可边界；首页、文章、导航、Dock、主题和新增页面依据 fqzlr 公开页面行为重新实现。`.pages.yml.backup` 的既有删除状态保持不变。

当前唯一需要站长继续提供的内容输入是经确认授权的插图/背景，以及书架、规划、足迹等个人数据。这些目录为空时页面显示完整空状态，不影响功能和路由验收，也不会用未授权素材填充。

## 2. 需求证据

| 目标 | 实现证据 | 验收证据 | 结果 |
| --- | --- | --- | --- |
| 设计令牌与四种壁纸 | `features/settings`、`styles/variables.css`、`styles/main.css` | 设置迁移单测、桌面/移动 Shell E2E、设置截图 | 通过 |
| 顶部导航与统一 Dock | `app/features`、`app/navigation`、`app/shell` | 导航/Dock 单测；主题、抽屉、移动工具 Sheet E2E | 通过 |
| fqzlr 首页与文章 | `features/home`、`features/posts` | 文章列表/详情/分类/归档 E2E；SSIM 与 4px 几何门禁 | 通过 |
| tsh520 留言板 | `features/guestbook`、统一 guestbook API | 读取、分页、编辑器、提交、限流、移动布局 E2E | 通过 |
| tsh520 笔记本与动态 | `features/notebook`、`features/activity` | 索引/详情、统计、动态合并、管理鉴权 E2E 与单测 | 通过 |
| 相册与兼容路由 | `features/gallery`、`/gallery/`、`/album/` | 来源/标签/hash/键盘 E2E，空集合路由检查 | 通过 |
| 书架与影视游戏 | `features/records`、`bangumi` 内容集合 | Schema、类型/状态/评分/分页/详情和空状态检查 | 通过 |
| 更新日志、规划、足迹 | `changelog`、`routines`、`places` 内容集合 | 现有日志渲染、空状态路由；无高德 Key 时不加载失效地图 | 通过 |
| 朋友圈 | `features/friend-feed`、`server/api/routes/friend-feed.ts` | RSS/Atom、HTTPS 白名单、危险 URL、缓存、503、管理员刷新单测/API | 通过 |
| 写作与配置工作台 | `features/writing`、`features/admin`、posts/site-config API | Markdown 导入、预览净化、草稿、发布 503、密钥不回显 API/E2E | 通过 |
| 小爱角色中枢 | `features/xiao`、`features/search`、`workers/ai-chat.js` | 心想、未来时段、锚点、SSE、引用、停止、历史、全屏 Sheet、视口缩放、视频懒加载 E2E | 通过 |
| 树洞移除 | 页面、导航、Worker 和类型已移除 | `/treehole/`、`/treehole-admin/`、`/api/treehole/` 双端均为 404 | 通过 |

## 3. 接口与安全

| 要求 | 当前证据 | 结果 |
| --- | --- | --- |
| 统一 API 路由 | Astro 与 Cloudflare Functions 共用 `src/server/api/router.ts` | 通过 |
| 两小时管理会话 | HMAC 签名，`HttpOnly`、`Secure`、`SameSite=Strict` | 通过 |
| 旧 Token 兼容 | Notebook/Activity Bearer Token API 回归为 200 | 通过 |
| 未授权与未配置 | 配置后无凭据为 401；未配置或发布缺配置为 503 | 通过 |
| GitHub 发布 | Token、仓库和分支只从服务端环境读取；未配置返回 503 | 通过 |
| 统一存储 | 草稿、公开配置、朋友圈缓存写入 File/KV/D1 同一 `StorageAdapter`；D1 使用现有 `kv_store` | 通过 |
| 输入净化 | Markdown 预览移除脚本；RSS 摘要净化并拒绝非 HTTP/HTTPS 链接 | 通过 |
| 密钥隔离 | 配置页和公开 API 不包含管理 Token/GitHub Token | 通过 |

## 4. 小爱专项

- 每日心想使用北京时间 08:00、14:00、21:00 和稳定 ID；同日生成确定，未来时段不提前发布。
- `/xiao/` 与 `/moments/` 使用同一生成模型，排序、锚点和分享链接一致。
- AI 对话覆盖推荐问题、503 降级、SSE、文章引用、停止生成、新会话、历史恢复和本地持久化。
- 移动面板使用 `VisualViewport` 高度变量和 `100dvh` 全屏布局；E2E 将视口缩短到 560px 后确认面板和输入区仍在可视范围。
- 官方视频固定为 UID `1955897084` 的 `BV1Zcf9BtEvm`、`BV1EAFTzeEfY`、`BV1qZ6yBXEVv`，只使用懒加载 iframe 和原页链接。
- 未提供授权海报/WebM 时使用本地 Canvas 星雨背景；配置中保留授权海报和静音 WebM 插槽，不抓取 Pixiv 或下载 Bilibili 视频。

## 5. 视觉门禁

最终报告：`test-results/fidelity-report-final5.json`。

| 页面 | 桌面 SSIM | 移动 SSIM |
| --- | ---: | ---: |
| 首页 | 0.9990 | 0.9995 |
| 文章列表 | 0.9612 | 0.9537 |
| 文章详情 | 0.9692 | 0.9562 |
| 友链 | 0.9668 | 0.9855 |
| 留言板 | 0.9949 | 0.9618 |
| 笔记本 | 0.9650 | 0.9676 |

12 项均高于 0.95。`tests/e2e/fidelity-geometry.mjs` 的 12 项关键尺寸和位置均在 4px 容差内。标准保真截图目录为 `goal-fidelity-final5`；完整视觉目录 `goal-visual-final5` 覆盖桌面/移动主要页面、设置、工具 Sheet、写作/配置管理页和音乐 Canvas。全部截图非空，音乐 Canvas 双端像素变化有效。

## 6. 自动化结果

| 命令 | 结果 |
| --- | --- |
| `pnpm architecture:check` | 通过 |
| `pnpm assets:check` | 通过，授权插图目录当前为 0 项 |
| `pnpm lint` | 通过 |
| `pnpm test:unit` | 通过，15 组模型/安全测试 |
| `pnpm check` | 通过，294 个文件、0 error、0 warning；重定向提示已内联修复 |
| `pnpm type-check` | 通过 |
| `pnpm build` | 通过，57 个 HTML、56 个 Pagefind 页面、155 张优化图片 |
| `pnpm test:api` | 通过 |
| `pnpm test:e2e` | 通过，30 个路由 x 2 个视口，共 60 项及主交互 |
| `pnpm test:visual` | 通过，含管理页和音乐 Canvas |
| `pnpm test:fidelity:geometry` | 通过，12 项、4px 容差 |
| `visual-fidelity.mjs` | 通过，12 项 SSIM 均不低于 0.95 |

构建仍会报告非阻塞信息：`bangumi`、`album`、`routines`、`places` 暂无个人内容；节假日远端超时后使用本地回退；Astro Markdown API 有上游弃用提示；Pagefind 跳过仅返回重定向的 `/client/activity/view/`；Vite 提示部分大块可继续按需拆分。

## 7. 资源与许可边界

- `public/assets/illustrations/catalog.json` 是新增授权素材的唯一公开目录，导入工具默认只检查，显式 `--apply` 才写入。
- 内容 Schema 拒绝 Pixiv/pximg 热链；授权目录文件必须有画师、原作页、许可、主题、替代文本和 SHA-256。
- `public/assets/images`、`public/gallery`、`public/pio`、`public/fonts` 等迁移前资源仍是“历史待确认”，没有被本次迁移冒充为已授权。
- 参考仓库快照和目标站素材不进入 Git 变更；现有 MIT `LICENSE` 保留原版权声明。
