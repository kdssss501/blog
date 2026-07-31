# 功能迁移规范

## 1. 迁移目标

把历史目录中的页面、组件、数据访问和状态逻辑迁入可独立维护的纵向功能模块，同时保持现有 URL、表单字段、API 响应和持久化数据格式不变。

文章相关的重复功能采用 fqzlr 公开页面体现的交互；留言板和笔记本采用 tianshihao2003/dumpling-theme 的公开 MIT 数据组织方式与线上可观察行为。当前项目其他独有功能继续保留，并接入同一应用外壳和设计令牌。

## 2. 迁移完成定义

一项功能只有同时满足以下条件才算完成：

- 路由只从该功能的公共入口导入。
- UI、模型、数据访问已归属同一功能目录。
- 浏览器与服务端入口没有互相泄漏运行时依赖。
- API、URL 和持久化格式兼容。
- 已有交互有自动化回归验证，或明确记录尚未覆盖的风险。
- `architecture:check`、Astro check、TypeScript 和生产构建通过。

仅移动 UI 或新增一层转发文件不视为完成。

## 3. 当前迁移状态

| 功能 | 模块 | 状态 | 保持兼容的边界 |
| --- | --- | --- | --- |
| 动态与小爱心想 | `features/activity`、`features/xiao` | 已迁移 | 动态路由、内容格式、图片画廊、稳定心想 ID、排序和管理编辑器 |
| 日历 | `features/calendar` | 已迁移 | 节假日接口、文章日期映射 |
| 相册 | `features/gallery` | 已迁移 | 相册 URL、文件系统读取仅服务端可用 |
| 留言板 | `features/guestbook` | 已迁移 | tsh520 信息架构、实时留言、表单字段、分页事件与存储格式 |
| 笔记本 | `features/notebook` | 已迁移 | 索引/详情 URL、封面与内容格式、管理编辑器与服务端 Token |
| 导航 | `app/features` | 已迁移 | 现有导航配置和页面开关 |
| 服务端 API | `server/api` | 已迁移 | Astro 与 Cloudflare 共用路由实现 |
| 普通搜索 | `features/search` | 已迁移 | Pagefind、`Ctrl/Cmd+K`、搜索弹窗 |
| AI 搜索 | `features/search` | 已迁移 | 现有 Vectorize/Workers AI 接口 |
| 音乐 | `features/music` | 已迁移 | 播放状态、音量、播放列表与存储键 |
| 显示设置 | `features/settings` | 已迁移 | 主题、色相、背景模式与存储键 |
| 桌面/移动 Dock | `app/shell` | 已迁移 | 现有 DOM id、抽屉与移动导航行为 |
| 友链 | `features/friends` | 已迁移 | 友链数据、标签筛选、分页和申请入口 |
| 文章列表 | `features/posts` | 已迁移 | fqzlr 风格纵向封面列表、分页、`/posts/` 主入口和 `/list/` 兼容入口 |
| 归档与分类 | `features/posts` | 已迁移 | 年月归档、分类筛选、分类图和标签关系图 |
| 首页 | `features/home` | 已迁移 | Hero、公告、数据展示、作品展示和现有配置 |
| 关于 | `features/about` | 已迁移 | Markdown 画布、物理模型和链接交互 |
| 赞助 | `features/sponsor` | 已迁移 | 支付方式切换、二维码、邮件/链接方式和赞助名单 |
| 工具导航 | `features/collections` | 已迁移 | 分类筛选、工具卡片和 hash 状态 |
| RSS | `features/rss` | 已迁移 | `/rss/`、`/rss.xml`、复制反馈和最新文章入口 |
| 文章详情 | `features/posts` | 已迁移 | 静态路径、JSON-LD、封面、加密正文、评论与前后篇导航 |
| 书架与影视游戏 | `features/records` | 已迁移 | `bangumi` Schema、类型/状态筛选、评分、详情、分页和空状态 |
| 更新日志、规划与足迹 | `features/records` | 已迁移 | 独立内容集合；高德 Key 缺失时回退到地点列表 |
| 朋友圈 | `features/friend-feed` | 已迁移 | 仅显式 HTTPS RSS/Atom、统一缓存、来源筛选、失败回退和管理员刷新 |
| 写作工作台 | `features/writing` | 已迁移 | Markdown 导入、Frontmatter、预览、草稿和 GitHub 发布降级 |
| 公开配置 | `features/admin` | 已迁移 | 统一管理会话、结构化公开配置、密钥不回显 |
| 小爱角色中枢 | `features/xiao`、`features/search` | 已迁移 | 沉浸页面、三段心想、官方视频懒加载、AI SSE/历史/停止和移动全屏 Sheet |

### 3.1 公开参考行为映射

参考 `tianshihao2003/qzl` 的公开页面只能提取行为，不引入其无许可证源码。其“权限分段、动态目录、时钟、轮播、客服弹窗和本地状态”在本项目中的归属如下：

| 参考行为 | 本项目实现 | 设计边界 |
| --- | --- | --- |
| 权限/分段切换 | `features/collections/model/directory.ts` + `CollectionsDirectory` 分类标签 | 以公开工具分类表达，不把未授权的机器人权限模型写入博客后端 |
| 动态指令/目录 | `collectionsApiConfig` 驱动的工具分组与条目模型 | 配置只描述公开链接和文案，页面不执行第三方指令 |
| 实时时钟 | `getBeijingClockSnapshot` 与目录状态栏 | 固定 `Asia/Shanghai` 展示，组件卸载时清理定时器 |
| 轮播/动态展示 | `features/home` 的展示层与音乐可视化层 | 使用项目已有资源，不引用快照中的外部图片接口 |
| 客服弹窗 | 友链申请与赞助方式弹窗 | 只使用当前项目配置的联系入口，不复制目标二维码或凭据 |
| 本地状态 | `collections:selected-category`、设置和播放器存储键 | 存储键由功能集中定义，禁用存储时降级为内存状态 |

## 4. 视觉迁移顺序

1. 应用外壳：导航、Dock、搜索、音乐和设置。
2. 高频公共页面：首页、文章列表、归档、分类。
3. 社区页面：友链与留言板。
4. 内容页面：文章、日历、音乐、赞助与关于。
5. 独有页面：动态、笔记本、相册和自定义工具。

每一步都应复用同一组颜色、间距、圆角、阴影、字体和响应式令牌，不能为单个页面复制一套主题变量。

动态与笔记本管理页已经按 `data`、`client` 与 `ui` 拆分，路由只负责页面组合。写接口分别通过 `ACTIVITY_ADMIN_TOKEN` 和 `NOTEBOOK_ADMIN_TOKEN` 在服务端鉴权，前端只在当前会话保存用户输入的 Token，不包含默认凭据。

相册目录由 `GalleryDirectory` 管理本地/网络来源、标签筛选、ARIA tab、方向键与 hash/session 状态，不使用 `window.__galleryReady` 或文档级永久监听器。RSS 复制、文章过期提示也使用可连接/断开的自定义元素。

## 5. 数据与平台策略

- 留言、评论和笔记继续沿用当前 Functions、D1、KV 或既有评论服务。
- 树洞页面、接口和代码已移除；历史 `treehole:*` 数据保留但不再读取，避免未经确认的数据销毁。
- 不复制参考站的密钥、KV、Vectorize、Umami 标识或第三方凭据。
- PagesCMS 配置继续保留；只有内容路径或字段模型变化时才调整。
- Firefly MIT 代码可以继续使用，但必须保留许可证与版权声明。
- fqzlr、tsh520 和 qzl 的专属代码或资源只有在取得明确许可后才能直接引入。
- 新管理功能使用 `BLOG_ADMIN_TOKEN` 的两小时签名会话；旧 Notebook/Activity Bearer Token 继续兼容。
- 草稿、朋友圈缓存和公开配置沿用统一存储端口，在 Cloudflare 上写入现有 `kv_store`。

## 6. 页面验收

所有迁移页面至少验证：

- 390px 移动端和 1440px 桌面端无横向溢出、遮挡或跳动。
- 暗色模式、背景模式、导航菜单和 Swup 页面切换正常。
- 键盘可访问，图标按钮具有可理解的 `aria-label`。
- 搜索、音乐、友链筛选、留言读取与提交可以完成主流程。
- 文章纵向列表、分页、文章详情、分类图和归档筛选可以完成主流程。
- 动态、笔记本、相册和 AI 搜索无行为回归。
- `/treehole/`、`/treehole-admin/` 与 `/api/treehole/` 返回 404。
- 管理接口公共 GET 为 200；未配置 Token 的管理检查与写入为 503；配置后错误 Token 为 401。
