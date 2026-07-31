# 兼容组件目录

`src/components` 保存尚未迁移的通用组件和兼容组件。业务功能不再以 `components/features` 或 `components/pages` 作为归属目录；新功能应遵循 [项目架构](../../docs/ARCHITECTURE.md) 放入 `src/features/<feature>`。

## 目录职责

| 目录 | 职责 |
| --- | --- |
| `analytics/` | Google Analytics、Clarity、Umami 等统计适配器 |
| `comment/` | Waline、Twikoo、Giscus、Artalk、Disqus 适配器 |
| `common/` | 无业务含义的基础 UI 与内容包装器 |
| `controls/` | 尚未迁移的通用交互控件 |
| `features/` | 尚未迁移的全局特效和运行时管理器 |
| `layout/` | Navbar、Footer、Sidebar 等页面结构组件 |
| `misc/` | 许可证、分享等辅助组件 |
| `pages/` | 尚未迁移的页面专用组件 |
| `widget/` | 侧边栏小部件和功能模块的组合适配器 |

## 已迁移位置

| 能力 | 新位置 |
| --- | --- |
| 动态、日历、相册、留言、笔记本 | `src/features/<feature>` |
| 首页、文章列表、归档和分类图表 | `src/features/home`、`src/features/posts` |
| 关于页画布和内容物理模型 | `src/features/about` |
| 赞助方式与工具导航 | `src/features/sponsor`、`src/features/collections` |
| 普通搜索、AI 搜索 | `src/features/search` |
| 音乐播放器与 3D 可视化 | `src/features/music` |
| 主题、色相与背景设置 | `src/features/settings` |
| 桌面/移动 Dock | `src/app/shell` |

模块外代码必须从功能根 `index.ts` 或声明的 `client.ts`、`server.ts` 入口导入，不能访问功能内部的 `ui`、`model` 或 `data` 文件。
