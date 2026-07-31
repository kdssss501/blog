# Dumpling Theme 迁移映射

基准仓库：`tianshihao2003/dumpling-theme@73b97596c09fb8b27ee7ab56221c270b35a21ae3`。

| 上游模块 | 当前模块 | 保留的项目能力 |
| --- | --- | --- |
| `PostCard`、`PostMeta`、`PostPage` | `features/posts` | 当前文章集合、封面回退和 `/posts/` 路由 |
| `MainGridLayout`、`SideBar` | `layouts/MainGridLayout`、配置驱动 `Sidebar` | fqzlr Dock、Swup 和文章目录 |
| `DisplaySettingsIntegrated` | `features/settings` | 统一偏好存储和后台公开配置 |
| `life/guestbook`、`Danmaku` | `features/guestbook` | D1 留言、限流和管理员身份 |
| `MomentCard`、`moments` | `features/activity` | D1 CRUD 与版本化迁移 |
| `life/notebooks` | `features/notebook` | D1 CRUD、管理页和缓存 |
| `album` | `features/gallery` | 图片错误降级和灯箱 |
| `books`、`movies-games`、`life` | `features/records` | 当前内容 schema 与模块边界 |
| `FloatingControls` | `app/shell` | fqzlr 工具栏外壳和小爱入口 |

重复页面只保留规范路由；旧 `activity`、`notebook`、`gallery` 和 `list`
地址永久重定向。参考仓库的示例文章和作者身份不导入。
