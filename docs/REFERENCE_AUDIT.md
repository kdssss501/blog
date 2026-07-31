# 参考项目与许可审计

审计日期：2026-07-22。

## 1. 审计结论

| 来源 | 可用于实现的内容 | 不可直接复制的内容 | 许可状态 |
| --- | --- | --- | --- |
| Firefly | MIT 代码、结构与公共组件，保留版权声明 | 第三方资源仍按各自许可处理 | 明确 MIT |
| fqzlr.com | 公开页面的布局、交互流程、功能清单和行为规格 | 未公开源码、专属素材、凭据与站点数据 | 站点专属内容未确认授权 |
| tianshihao2003/dumpling-theme | 留言板、笔记本及 Firefly 派生代码；复用时保留许可证 | 博主专属图片、音乐、字体、Spine、头像和服务凭据 | 明确 MIT |
| tianshihao2003/qzl | 公开页面行为：权限分段、动态指令、时钟、轮播、客服弹窗、本地状态 | 仓库源码及素材 | 仓库未提供 LICENSE |

本项目可以实现相同类型的功能和交互，但不能把“网页可访问”解释为“源码和素材可以复制”。

## 2. Firefly

- 上游：<https://github.com/CuteLeaf/Firefly>
- 当前仓库 `LICENSE` 声明 MIT，并保留 `saicaca` 与 `CuteLeaf` 版权。
- 当前项目可继续修改和分发 Firefly 代码，分发时必须保留版权与许可文本。

## 3. fqzlr.com

审计页面：

- <https://www.fqzlr.com/>
- <https://www.fqzlr.com/friends/>
- 用户提供的教学视频：<https://www.bilibili.com/video/BV19SK66XEfR/>

本地审计快照位于 `.reference/fqzlr-home.html` 和 `.reference/fqzlr-friends.html`，仅用于开发比对，不进入版本控制。

从公开 HTML 与构建产物可确认的行为包括：

- Astro/Firefly 页面结构。
- 普通搜索与 AI 搜索入口。
- 音乐管理器和跨页面播放状态。
- 桌面浮动 Dock、移动底部 Dock 与工具 Sheet。
- 主题、背景模式和显示设置。
- Friend Filter Web Component 与友链编辑入口。
- 首页 Hero、Portfolio Shutter、Logo Loop 和数据展示层。
- 公告、标签、分类与笔记工具入口。

未取得 fqzlr 博客源码仓库及其明确许可，因此只把这些内容作为行为规格重新实现。页面中出现的 Umami 标识、Meting 服务地址、图片、字体、头像、音乐和模型不复制。

## 4. blog.tsh520.cn 与 tianshihao2003

审计页面包括：

- <https://blog.tsh520.cn/life/guestbook/>
- <https://blog.tsh520.cn/life/notebooks/>

本地代码级参考仓库：`.reference/tianshihao2003-dumpling-theme`。

- 上游：<https://github.com/tianshihao2003/dumpling-theme>
- 审计 commit：`73b97596c09fb8b27ee7ab56221c270b35a21ae3`
- 仓库根目录 `LICENSE`：MIT，版权声明为 2024 saicaca、2025 CuteLeaf。

该仓库可以作为留言板与笔记本的代码级实现依据。本项目仍沿用自己的 API、D1/KV、Functions 和数据格式，只迁移信息架构与交互。当前映射为：

| 参考实现 | 本项目实现 | 保留边界 |
| --- | --- | --- |
| `src/pages/life/guestbook.astro` | `features/guestbook/ui/GuestbookTimeline.svelte` | 页面说明、实时留言、编辑器与留言列表 |
| `src/components/guestbook/Danmaku.astro` | `GuestbookTimeline` 的实时留言区域 | 自动轮换最近留言，不复制内容数据 |
| `src/pages/life/notebooks/index.astro` | `features/notebook` | 标题统计、三列封面卡片与详情入口 |

MIT 只覆盖仓库中的软件代码，不自动授予站点图片、音乐、字体、Spine、头像或第三方内容的使用权；这些资源继续使用本项目素材或经单独授权的替代品。

GitHub 用户 `tianshihao2003` 的公开仓库中，`qzl` 是一个单页功能菜单展示项目，并不是博客源码。快照内容只有 `index.html`、README 和指令文本；README 描述为“前端展示一个项目功能菜单的前端项目”。该仓库没有 LICENSE，因此不复制其源码。

`qzl` 与 `dumpling-theme` 是两个不同仓库。`.reference/qzl-snapshot` 不包含 LICENSE，只能作为公开行为参考；不得用 `dumpling-theme` 的 MIT 许可证覆盖 `qzl` 的文件。

## 5. 资源引入规则

1. 先确认资源作者、原始地址和许可证。
2. MIT/Apache-2.0 等允许使用的代码保留必要声明。
3. 未明确授权的目标站资源使用当前项目资源或自制占位资源。
4. 不提交参考站 HTML 快照、Cookie、统计标识或任何密钥。
5. 新增外部服务时只提交环境变量名称、适配器和降级逻辑。

## 6. 可追溯性

视觉或交互迁移 PR 应注明对应的公开页面与实现日期。若未来取得 fqzlr 或 tsh520 的源码许可，应重新审计仓库许可证、依赖许可证和素材授权，再决定是否进行源码级迁移。
