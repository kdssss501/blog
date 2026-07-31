# 项目架构

## 1. 架构目标

本项目采用“应用组合层 + 纵向功能模块 + 服务端端口 + 共享基础设施”的结构。目标是让每项功能能够独立开发、测试、替换和迁移，同时保持现有 URL、数据格式与部署方式稳定。

核心依赖方向固定为：

```text
pages -> app -> features -> shared
                 ^
server ----------+
```

任何模块都不得反向依赖上层。`src/pages` 和平台 Functions 只是入口，不承载业务规则。

## 2. 目录职责

| 目录 | 职责 | 禁止事项 |
| --- | --- | --- |
| `src/pages/` | Astro 路由、参数读取、SEO、页面组合 | 直接访问数据库；实现领域规则 |
| `src/app/` | 功能注册、导航、应用外壳与启动组合 | 实现具体功能的数据访问 |
| `src/features/` | 按业务能力组织 UI、模型和数据适配 | 跨功能读取其他模块内部文件 |
| `src/server/` | HTTP 路由、存储端口、平台无关服务端逻辑 | 依赖 Astro 页面或浏览器对象 |
| `src/shared/` | 无业务含义的事件、HTTP、基础 UI 和工具 | 依赖任一具体功能 |
| `src/config/` | 站点配置兼容层 | 存放密钥或运行时凭据 |
| `functions/` | Cloudflare Pages Functions 薄适配器 | 复制一套服务端业务实现 |

`src/components`、`src/utils` 与 `src/types` 是迁移期兼容目录。新业务代码必须进入对应的 `features`、`app`、`server` 或 `shared` 模块。首页和文章体系已经完成纵向迁移，旧目录不再保留同名实现。

笔记本列表、详情与管理页已经遵循同一边界：API 请求在 `features/notebook/data`，分组与排序在 `model`，缓存和 DOM 生命周期在 `client`，页面只组合 `NotebookDirectory`、`NotebookDetail` 与 `NotebookAdmin`。动态管理页同样通过 `features/activity/data`、`client` 和 `ui` 组合；两类写接口都使用服务端 Token 鉴权，未配置 Token 时必须拒绝写入。

相册、RSS 和文章体系也采用相同结构：相册的标签/hash/键盘状态位于 `features/gallery/model` 与 `client`；RSS 复制生命周期位于 `features/rss/client`；文章列表 DTO、文章图片与 JSON-LD 在 `features/posts/server.ts` 装配，详情展示由 `PostArticle` 负责。`src/pages` 只保留 Astro 必需的静态路径、内容渲染、SEO 插槽与布局组合。

## 3. 功能模块契约

标准功能目录按实际需要使用以下结构，不为没有逻辑的层级创建空文件：

```text
src/features/<feature>/
  data/       # HTTP 客户端、仓储和外部服务适配器
  model/      # 领域类型、状态与纯函数
  ui/         # Astro/Svelte 视图组件
  index.ts    # 浏览器安全的默认公共入口
  client.ts   # 可选：仅浏览器能力
  server.ts   # 可选：仅服务端能力
```

模块外代码只能从功能根入口或已声明的 `client`、`server` 次级入口导入。默认 `index.ts` 必须保持浏览器安全，不能导出 `node:*`、数据库客户端或平台运行时对象。

功能之间需要协作时，优先使用以下方式：

1. 共享稳定的数据契约。
2. 通过 `src/shared/events` 发布类型化浏览器事件。
3. 由 `src/app` 组合多个功能。

禁止从一个功能模块直接读取另一个功能的 `ui/`、`data/` 或 `model/` 内部文件。

## 4. 应用组合

`src/app/features/feature-registry.ts` 是页面能力、路由元数据和功能开关的单一来源。`src/app/navigation/create-navigation.ts` 根据注册表生成导航，页面和组件不得重复维护页面开关判断。

应用外壳负责挂载跨页面持久组件，包括：

- 顶部导航与移动菜单。
- 普通搜索与 AI 搜索入口。
- 桌面浮动 Dock 与移动底部 Dock。
- 音乐播放器管理器。
- 显示设置、主题与背景模式。

外壳只负责组合，功能状态和交互实现归各自功能模块所有。

## 5. 服务端边界

`src/server/api/router.ts` 是 Astro API 与 Cloudflare Functions 共用的唯一业务路由。平台入口只把原始请求和运行时绑定转换为服务端端口：

```text
Astro API ---------+
                   +--> server/api/router --> route handler --> storage port
Cloudflare Function+
```

持久化必须通过 `src/server/storage` 的端口访问。D1、Vercel KV 和本地文件存储都是适配器，不允许业务路由依赖某个平台的具体对象。

已有 API 路径、请求字段、响应字段、状态码和存储键默认保持兼容。需要破坏性变更时，必须新增版本化接口和迁移说明。

## 6. 客户端状态

- 浏览器事件必须通过类型化事件模块定义，不新增散落的裸事件名。
- 全局 `window` 扩展必须集中声明在类型文件中。
- `localStorage` 键由所属功能集中定义，兼容旧键时必须注明迁移策略。
- 临时页面状态可以使用 `sessionStorage`，键仍必须由所属功能集中定义；相册使用 `gallery:selected-view` 与 `gallery:selected-tag`。
- Swup 页面切换后的初始化应可重复执行并支持清理，禁止重复注册永久监听器。

## 7. 配置与安全

- 可公开站点选项放在 `src/config`。
- 密钥、Token、Cookie 和私钥只从运行时环境读取。
- 第三方服务必须通过适配器接入，并为缺少配置提供可预期的降级状态。
- 未获授权的图片、字体、Live2D/Spine 模型、音乐和头像不得进入仓库。

## 8. 新增功能流程

1. 在功能注册表登记路由能力和开关。
2. 在 `src/features/<feature>` 建立最小纵向模块。
3. 先定义模型与外部契约，再实现数据适配和 UI。
4. 页面只从功能公共入口组合视图。
5. 服务端能力通过统一路由和存储端口接入。
6. 增加该功能的单元、类型或浏览器回归验证。
7. 更新 `docs/FEATURE_MIGRATION.md` 的状态与差距。

## 9. 质量门禁

提交前必须执行：

```bash
pnpm architecture:check
pnpm assets:check
pnpm test:unit
pnpm check
pnpm type-check
pnpm build
pnpm test:e2e
pnpm test:visual
```

其中 `architecture:check` 必须至少检查依赖方向、功能公共入口和服务端/浏览器边界；`assets:check` 检查授权插图目录、文件摘要和公开署名目录一致。Lint 默认只检查；自动修改使用单独的 `lint:fix` 命令。

`pnpm lint` 覆盖新架构目录、架构脚本、核心回归测试和已瘦身路由，必须保持通过。`pnpm lint:legacy` 用于观测迁移期兼容目录的历史债务，不作为新代码绕过门禁的理由；兼容文件迁入 feature 后应立即进入默认 lint 范围。
