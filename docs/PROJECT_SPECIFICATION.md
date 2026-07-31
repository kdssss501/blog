# 博客重构、视觉迁移与小爱中枢项目规格

## 1. 项目定义

本项目以 Astro 6、Svelte 5、Cloudflare Pages/Functions、D1 和现有 KV 兼容层为基础。目标是在不推倒模块化架构、不迁移既有数据的前提下，重新实现 fqzlr 的公开页面视觉与交互，并迁移 `tianshihao2003/dumpling-theme` 中 MIT 授权的留言板、笔记本、动态流和侧栏行为。

fqzlr 未公开源码的部分只能依据公开页面行为重新实现。目标站的图片、字体、音乐、头像、私人内容、统计标识和凭据不进入项目。

## 2. 交付范围

### 2.1 应用外壳

- fqzlr 风格的首页、文章列表、文章详情、顶部导航、左右侧栏和桌面 Dock。
- 统一 OKLCH 色彩令牌，默认 `hue=165`；主题色必须驱动按钮、链接、图标、描边、焦点和选中状态。
- 亮色、暗色、跟随系统，以及 `banner`、`full`、`overlay`、`none` 四种壁纸模式。
- 色相滑杆、分组重置、樱花开关和文章列表/网格切换。
- 桌面与移动端共享 `DockCommand`；移动端固定首页、主题、搜索、工具、菜单五个主命令。
- 抽屉支持焦点管理、Escape、点击外部关闭、滚动锁定、Swup 清理和移动 Dock 避让。

### 2.2 页面与内容域

| 内容域 | 路由 | 所有者 |
| --- | --- | --- |
| 首页 | `/` | `features/home` |
| 文章 | `/posts/`、`/list/`、`/posts/*`、`/archive/`、`/categories/` | `features/posts` |
| 社区 | `/friends/`、`/guestbook/`、`/pengyou/` | `features/friends`、`guestbook`、`friend-feed` |
| 动态 | `/activity/`、`/moments/` | `features/activity` |
| 笔记与相册 | `/notebook/`、`/life/notebooks/`、`/gallery/`、`/album/` | `features/notebook`、`gallery` |
| 记录 | `/books/`、`/movies-games/`、`/changelog/`、`/life/routines/`、`/life/places/` | `features/records` |
| 工具 | `/calendar/`、`/music/`、`/collections/`、`/projects/`、`/rss/` | 对应纵向功能模块 |
| 管理 | `/write/`、`/config/` | `features/writing`、`admin` |
| 小爱 | `/xiao/` | `features/xiao` 与 `features/search` |
| 其他 | `/about/`、`/sponsor/` | 对应纵向功能模块 |

旧 `/collections/`、`/gallery/`、`/notebook/`、`/activity/` 地址继续可用。树洞页面、导航和 API 必须返回 404，历史 `treehole:*` 数据不主动删除。

### 2.3 记录与朋友圈

- `bangumi` 内容集合支持书籍、动画、电影、剧集、纪录片、游戏和真人内容；字段包含状态、评分、封面、评论、标签和详情页。
- 书架与影视游戏支持类型筛选、状态筛选、分页和无数据空状态。
- 更新日志、规划和足迹使用独立内容集合；足迹没有公开高德 Key 时只显示地点列表。
- 朋友圈只读取友链配置中显式声明的 HTTPS RSS/Atom；服务端限制超时、响应大小和 URL 协议，净化摘要并缓存到统一存储。
- 朋友圈支持最新排序、来源筛选、缓存失效回退，以及登录管理会话后的强制刷新。

### 2.4 写作与公开配置

- 写作页支持 Markdown 文件导入、Frontmatter 解析、编辑、预览、校验、草稿增删改查和发布。
- 发布只在服务端读取 `GITHUB_CONTENT_TOKEN`、`GITHUB_REPOSITORY`、`GITHUB_BRANCH`；未配置时返回 503。
- 配置页只编辑结构化公开字段，任何密钥字段都不得回显或写入公开配置。

### 2.5 小爱角色中枢

- `/xiao/` 使用全屏沉浸式页面、Canvas 星雨背景、授权海报/静音 WebM 插槽、今日心想、AI 对话和官方视频区。
- 小爱助手沿用 `/api/ai-chat` 的 SSE、Vectorize、历史会话、引用、停止生成和限流；身份明确为非官方站内 AI。
- 桌面对话为大尺寸半透明面板；移动端为依据 `VisualViewport` 调整高度的全屏 Sheet，软键盘出现后输入区仍可见。
- 每天北京时间 08:00、14:00、21:00 从本地文案池和授权图片池确定性生成三条心想，ID 为 `xiao-YYYY-MM-DD-{morning|afternoon|night}`。
- 心想同时显示在 `/xiao/` 和 `/moments/`，未来时段不得提前出现。
- 视频固定来自鸣潮官方 UID `1955897084` 的三个指定 BV 号；iframe 进入视口后才加载，并保留原页链接。

## 3. 接口与数据兼容

### 3.1 公共模型

- `DisplayPreferencesV2`
- `BangumiEntry`、`ChangelogEntry`、`RoutineEntry`、`PlaceEntry`
- `FriendFeedEntry`
- `XiaoThought`
- 带 `origin: "user" | "xiao"` 的动态模型

### 3.2 API

- 保持兼容：`/api/guestbook`、`/api/notebook`、`/api/activity`、`/api/ai-chat`。
- 新增并维护：`/api/admin/session`、`/api/posts/import`、`/api/posts/preview`、`/api/posts/drafts`、`/api/posts/publish`、`/api/site-config`、`/api/friend-feed`。
- Astro API 与 Cloudflare Functions 必须共用 `src/server/api/router.ts`，不能复制业务路由。
- 草稿、公开配置和缓存继续写入现有 `kv_store` 抽象；开发环境可使用文件适配器，Vercel 使用 KV 适配器。

## 4. 安全要求

- `BLOG_ADMIN_TOKEN` 创建有效期两小时、HMAC 签名、`HttpOnly`、`Secure`、`SameSite=Strict` 的管理会话。
- `NOTEBOOK_ADMIN_TOKEN`、`ACTIVITY_ADMIN_TOKEN` 旧 Bearer Token 保持兼容。
- 未配置管理凭据返回 503；配置后无效凭据返回 401。
- 用户 Markdown 预览必须净化脚本和危险 URL；RSS 条目只接受 HTTP/HTTPS 链接。
- 凭据只来自环境变量，不写入浏览器存储、内容集合、公开配置或日志。
- Pixiv 不在运行时抓取，不使用 Cookie、Token、反爬绕过或未知图床热链。
- 授权插图必须进入公开目录，记录画师、来源、许可、替代文本和 SHA-256；目标字体、音乐、头像和模型不复制。

## 5. 架构约束

- `src/app` 负责应用组合、导航和外壳；`src/features` 负责纵向业务；`src/server` 负责服务端路由与存储；`src/shared` 只放跨功能基础能力。
- 页面只组合功能公共入口，不包含持久化规则。
- 浏览器入口不得导入 `node:*` 或服务端模块；服务端功能通过明确的 `server.ts` 入口暴露。
- 深层导入、反向依赖和跨层运行时泄漏由 `pnpm architecture:check` 阻止。
- 缺少内容或第三方 Key 时必须提供可用空状态，导航不得指向空壳或失败页面。

## 6. 视觉验收

- 排除品牌文案、私人数据、字体和未授权媒体后，指定公共页面在 1440x1000 与 390x844 的遮罩 SSIM 不低于 `0.95`。
- 关键控件位置和尺寸与参考公开页面的误差不超过 `4px`。
- 所有路由无横向溢出、重叠、空白画布、不可见正文和无名称按钮。
- 动效支持 `prefers-reduced-motion`；视频背景默认静音且可暂停，低性能或减少动画模式回退到静态背景。

## 7. 完成门禁

```bash
pnpm architecture:check
pnpm assets:check
pnpm lint
pnpm test:unit
pnpm check
pnpm type-check
pnpm build
pnpm test:api
pnpm test:e2e
pnpm test:visual
pnpm test:fidelity
git diff --check
git status --short --branch
```

E2E 必须覆盖桌面和移动端全部新旧路由、导航、Dock、主题/壁纸、留言板、搜索、音乐、记录页、小爱、写作和配置工作台。外部媒体在回归中应被隔离，以验证失败降级且避免公网状态掩盖应用水合问题。
