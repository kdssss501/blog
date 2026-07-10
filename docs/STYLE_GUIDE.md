# Firefly-Mod 项目风格指南

> 本文档是项目视觉与代码风格的**唯一权威**。所有新增功能、组件、页面都必须严格遵循本指南，以保持整体风格一致性。
>
> 最后更新：2026-07-10 ｜ 适用版本：Firefly-Mod V2.4.6

---

## 0. 核心设计哲学（必须内化）

本项目从 fuwari / Firefly 演化而来，但已**彻底脱离原版视觉**，走极简黑白路线：

| 原则 | 说明 | 反例（禁止） |
|------|------|------------|
| **极简中性灰阶** | 模拟 x.ai 视觉语言，全部去饱和，仅保留黑白灰 | 使用彩色主题色块、渐变背景 |
| **无背景图** | 页面/卡片背景透明或纯色，靠线条与字体构建层次 | 大图背景、毛玻璃彩色光斑 |
| **粗边框 + 圆角 + 加粗** | 卡片、按钮、分页统一 `2px solid #000/#fff` + `border-radius: 0.75rem` + `font-weight: 700` | 细发丝边框、阴影投射 |
| **hover 反相填充** | 白底黑字 hover 变黑底白字（暗色模式反之） | 颜色渐变 hover、阴影抬起 |
| **交互优先** | 组件以可交互为主，动效服务于反馈 | 纯装饰性动画、自动播放特效 |
| **单列居中** | 首页删除侧边栏，主内容 `max-w-5xl` 居中 | 三栏布局、左右固定侧栏 |

---

## 1. 技术栈与版本基线

| 分类 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | Astro | 6.4.6 | SSG 主框架 |
| 交互 | Svelte | 5.x（runes `$state`） | 客户端交互组件 |
| 语言 | TypeScript | 5.9.x | 全量 TS |
| 样式 | Tailwind CSS | v4（`@import 'tailwindcss'`） | 原子化 CSS |
| 样式扩展 | Stylus | 0.64.x | 变量定义（`variables.styl`） |
| 图标 | astro-icon + Iconify | - | `material-symbols` / `mingcute` / `ri` / `fa7-*` |
| 动效 | GSAP / anime.js / @vfx-js/core | - | 复杂动画 |
| 3D | three.js | 0.184 | 音乐可视化等 |
| 代码格式化 | Biome | 2.4.x | tab 缩进 + 双引号 |
| 包管理 | pnpm | 9.14.4 | **强制**（`preinstall` 钩子拦截） |
| 页面切换 | Swup | 4.x | 无刷新导航 + View Transitions |

---

## 2. 目录结构与文件归属

### 2.1 组件分类（`src/components/`）

新增组件时，按职责放入对应目录，**不得新建顶层分类**：

| 目录 | 用途 | 选用规则 |
|------|------|---------|
| `layout/` | 页面框架（Navbar / Footer / PostCard / Home*） | 决定整体页面结构 |
| `controls/` | 导航与交互控件（Search / LightDarkSwitch / FloatingDock） | 用户交互入口 |
| `common/` | 跨页复用基础组件（ButtonLink / Icon / Pagination / WidgetLayout） | 可被任意页面引用 |
| `widget/` | 侧边栏小部件（Profile / Tags / Calendar / Heatmap） | 仅侧边栏场景 |
| `features/` | 全局功能特效（MusicManager / PageLoader / Live2D / Guestbook*） | 全局加载、单例管理 |
| `pages/` | 页面专属组件（calendar/ / gallery/ / AdvancedSearch） | 只在单一页面使用 |
| `comment/` | 评论系统集成 | 第三方服务对接 |
| `analytics/` | 统计代码 | 第三方服务对接 |
| `misc/` | 杂项工具 | 无法归类的辅助组件 |

### 2.2 样式与组件镜像

**核心规则：组件样式必须抽取到独立 CSS 文件，组件文件内不写大段 `<style>`。**

样式目录与组件目录严格镜像：

```
src/styles/
├── main.css                    # 总入口，按层 @import
├── variables.styl              # 主题变量（OKLCH 色板）
├── markdown.css / toc.css      # 全局内容样式
├── transition.css              # Swup / 主题切换动画
├── components/                 # 对应 src/components/*
├── layout/                     # 对应布局组件
├── pages/                      # 对应页面级样式
└── widgets/                    # 对应 widget/
```

新增组件时，在对应 styles 子目录新建 `{kebab-case-name}.css`，并在 `main.css` 中按层级 `@import`。

### 2.3 配置系统（`src/config/`）

- 所有可配置项集中在 `src/config/`，通过 barrel `index.ts` 统一导出。
- 导入方式：`import { siteConfig, homeConfig } from "@/config";`
- **禁止**在组件内硬编码可配置值（标题、链接、开关、颜色等）。

### 2.4 别名

| 别名 | 指向 |
|------|------|
| `@/` | `src/` |
| `@components/` | `src/components/` |
| `@rehype-callouts-theme` | 动态指向 callouts 主题 |

---

## 3. 色彩与主题系统

### 3.1 色彩变量（`src/styles/variables.styl`）

**所有颜色使用 OKLCH 色彩空间**，亮度 0=黑、1=白，色度 `0` 表示纯灰阶。

| 变量 | 亮色值 | 暗色值 | 用途 |
|------|--------|--------|------|
| `--primary` | `oklch(0.30 0 0)` | `oklch(0.85 0 0)` | link / focus / 选中点缀 |
| `--page-bg` | `oklch(1 0 0)` 纯白 | `oklch(0.08 0 0)` 近黑 | 页面背景 |
| `--deep-text` | `oklch(0.10 0 0)` | `oklch(0.90 0 0)` | 主文字 |
| `--title-active` | `oklch(0.30 0 0)` | `oklch(0.70 0 0)` | 标题激活 |
| `--content-meta` | `oklch(0.45 0 0)` | `oklch(0.65 0 0)` | 次要元数据 |
| `--line-divider` | `oklch(0.85 0 0)` | `oklch(0.25 0 0)` | 分隔线 |
| `--card-bg` | `transparent` | `transparent` | 卡片透明 |
| `--btn-plain-bg-hover` | `oklch(0.94 0 0)` | `oklch(0.18 0 0)` | 按钮 hover |
| `--float-panel-bg` | `oklch(1 0 0)` | `oklch(0.10 0 0)` | 浮层面板 |

### 3.2 主题切换机制

- 主题仅 `light` / `dark` 两态，**无色相选择器**（`--hue` 保留兼容但视觉无效）。
- 暗色模式通过 `<html class="dark">` 切换，CSS 用 `:root.dark { ... }` 覆盖。
- Tailwind v4 暗色变体：`@custom-variant dark (&:where(.dark, .dark *));`
- 默认模式在 `siteConfig.themeColor.defaultMode` 配置（当前 `"dark"`）。
- 主题切换走 View Transitions API，`.is-theme-transitioning` 类用于禁用复杂过渡。

### 3.3 阴影策略

**全局禁用阴影**：`--shadow-md: none`、`--shadow-navbar: none`。层次靠边框与留白构建，不靠投影。

---

## 4. 排版与字体

### 4.1 字体族

```css
--font-sans: 'Roboto', 'sans-serif', ui-sans-serif, system-ui, ...;
/* 代码字体 */
'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, ...
```

- 自定义字体通过 `fontConfig.ts` + `FontManager.astro` 加载，body 加 `font-{id}-enabled` 类启用。
- 等宽字体用于：section 标签、代码块、分页按钮 label。

### 4.2 字号

- 基础：`text-[14px]`（移动）/ `text-[16px]`（桌面），在 `<html>` 上设置。
- 文字透明度梯度（Tailwind 工具类）：
  - `.text-90` = `text-black/90 dark:text-white/90`（主文字）
  - `.text-75` = `text-black/75 dark:text-white/75`（正文）
  - `.text-50` / `.text-30` / `.text-25`（次要 → 极淡）

### 4.3 section 标签格式

区块标题统一用方括号包裹的等宽小字：

```html
<div class="section-label">[ SECTION NAME ]</div>
```

CSS 已内置 `::before` / `::after` 自动加 `[ ` ` ]`，只需写文本。

---

## 5. 组件编码规范

### 5.1 文件格式选择

| 场景 | 选用 | 示例 |
|------|------|------|
| 纯展示、SSG 渲染、无需客户端逻辑 | `.astro` | `PostCard.astro`、`Footer.astro` |
| 需要客户端状态、事件、生命周期 | `.svelte` | `LightDarkSwitch.svelte`、`Search.svelte` |
| 纯逻辑/工具 | `.ts` | `AudioAnalyzer.ts` |

### 5.2 Astro 组件模板

```astro
---
// 1. 导入（按别名）
import Icon from "@components/common/Icon.astro";
import { siteConfig } from "@/config";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";

// 2. Props 接口（显式声明）
interface Props {
  title: string;
  description?: string;
  class?: string;
}

// 3. 解构 Props（带默认值）
const { title, description, class: className } = Astro.props;
---
<!-- 4. 模板：用 class:list 处理条件类 -->
<div class:list={["base-class", { "is-active": isActive }, className]}>
  <Icon name="material-symbols:home" />
  {title}
</div>
<!-- 5. 样式注释：指向外部 CSS 文件 -->
<!-- 样式已迁移至 src/styles/components/xxx.css -->
```

### 5.3 Svelte 5 组件模板（runes 语法）

```svelte
<script lang="ts">
import { onMount } from "svelte";
import { DARK_MODE, LIGHT_MODE } from "@/constants/constants";

// 用 $state rune 声明响应式状态
let mode = $state(LIGHT_MODE);

function toggle() {
  mode = mode === LIGHT_MODE ? DARK_MODE : LIGHT_MODE;
}

onMount(() => {
  // 客户端初始化
  // 监听 Swup 切换
  window.swup?.hooks.on("content:replace", () => { /* ... */ });
  return () => { /* 清理 */ };
});
</script>

<div class="relative z-50">
  <!-- 内容 -->
</div>

<style>
  /* 仅组件私有样式，复杂样式仍抽到外部 CSS */
</style>
```

### 5.4 Swup 兼容性（重要）

项目使用 Swup 做无刷新导航，**全局持久化组件**（FloatingDock / MobileDock / AISearch / SearchModal / PrivacyModal / MusicManager 等）必须放在 `Layout.astro` 的 `<body>` 中、Swup 容器（`#swup-container`）**之外**，确保跨页面存活。

页面切换后需重新初始化的逻辑，监听：
```js
window.swup.hooks.on("content:replace", () => { /* 重初始化 */ });
// 或
document.addEventListener("astro:page-load", () => { /* ... */ });
```

---

## 6. 通用样式类（必须复用，禁止重复造轮子）

以下类定义在 `main.css` 的 `@layer components`，新增组件优先套用：

### 6.1 按钮家族

| 类名 | 视觉 | 适用场景 |
|------|------|---------|
| `.btn-line` | 描边圆角，hover 反相填充（白底黑字→黑底白字） | 次级按钮、展开按钮 |
| `.btn-plain` | 透明背景，hover 浅灰底，文字变 `--primary` | 图标按钮、工具栏按钮 |
| `.btn-regular` | `--btn-regular-bg` 底，hover 加深 | 常规按钮 |
| `.btn-card` | 卡片底色，hover `--btn-card-bg-hover` | 卡片内操作按钮 |
| `.expand-animation` | hover 缩放伪元素底色 | 配合 `.btn-plain.scale-animation` |

### 6.2 容器与面板

| 类名 | 用途 |
|------|------|
| `.card-base` / `.card-base-transparent` | 极简模式下退化为透明无边框（保留类名兼容） |
| `.section` + `.section + .section` | 区块容器，相邻区块自动 `border-t` 分隔 |
| `.float-panel` | 顶部浮层面板，`--float-panel-bg` 底 + 边框 |
| `.dropdown-content` / `.dropdown-content-wrapper` | 下拉面板，hover 边框转虚线 |
| `.dropdown-item` | 下拉项，hover 显示边框 |

### 6.3 分页与卡片边框（全局硬性）

**文章卡片、分页、tabs 必须使用粗边框反相风格**：

```css
/* 卡片外框 */
.post-card-wrapper { border: 2px solid #000 !important; }
:root.dark .post-card-wrapper { border-color: #fff !important; }

/* 分页按钮 */
.pagination-btn, .pagination-page {
  border: 2px solid #000 !important;
  border-radius: 0.75rem !important;
  font-weight: 700 !important;
  background: #fff !important; color: #000 !important;
}
.pagination-btn:hover { background: #000 !important; color: #fff !important; }
```

### 6.4 链接与文字

| 类名 | 用途 |
|------|------|
| `.link` / `.link-lg` | 带展开动画的链接 |
| `.link-underline` | 虚线下划线链接 |
| `.with-divider` | 元数据间 `/` 分隔符 |
| `.text-90 / .75 / .50 / .30 / .25` | 文字透明度梯度 |

---

## 7. 图标使用规范

### 7.1 统一通过 Icon 组件

```astro
import Icon from "@components/common/Icon.astro";
<Icon name="material-symbols:home-outline" class="text-2xl" />
```

- `.astro` 用 `Icon.astro`，`.svelte` 用 `Icon.svelte`。
- `Icon.astro` 强制 `is:inline` 模式，直接输出 SVG，解决 SSG 下 sprite 丢失问题。
- 图标集优先级：`material-symbols` > `mingcute` > `ri` > `fa7-*` > `simple-icons`。

### 7.2 图标命名

- 用 `kebab-case`：`material-symbols:arrow-outward-rounded`。
- 禁止在模板内联 SVG（除非像 `LightDarkSwitch` 那样需要精确动画控制）。

---

## 8. 布局系统

### 8.1 页面骨架

所有页面继承 `MainGridLayout.astro` → `Layout.astro`：

```
<html>
  <head> ... <FontManager /> </head>
  <body>
    <PageLoader /> <ConfigCarrier /> <MusicManager /> <FloatingLyrics />
    <slot />  ← MainGridLayout 内容
    <FloatingDock /> <MobileDock /> <AISearch /> <SearchModal /> <PrivacyModal /> <FancyboxManager />
  </body>
</html>
```

### 8.2 主内容容器

```astro
<div class="mx-auto max-w-5xl px-4 md:px-6" id="main-grid">
  <main id="swup-container" class="transition-swup-main">
    <div id="content-wrapper" class="onload-animation">
      <slot />  ← 页面内容
    </div>
    <div class="footer onload-animation mt-16 pt-8 border-t">
      <Footer />
    </div>
  </main>
</div>
```

- **单列居中**，无侧栏（侧栏容器 `#left-sidebar-dynamic` / `#right-sidebar-dynamic` 已 `hidden`，仅为 Swup 协议保留）。
- 页面宽度由 `siteConfig.pageWidth`（默认 `100rem`）控制，通过 CSS 变量 `--page-width` 注入。

### 8.3 Navbar

- sticky 顶部，`pt-2.5` 留距。
- `widthFull: false` 时限宽 `max-w-(--page-width)`，`true` 时全宽。
- 极简模式下无边框无阴影，靠背景透明 + 内容区分隔。

### 8.4 响应式断点

沿用 Tailwind 默认断点，关键点：
- `md:` (768px) — 移动/桌面切换，dock 抽屉变全宽底部
- `xl:` (1280px) — 文章 TOC 侧栏显示（`hidden xl:block`）

---

## 9. 动效规范

### 9.1 过渡时长

- **通用过渡**：`transition-colors duration-150`（颜色）、`duration-200`（dock）、`duration-300`（图片缩放）。
- 缓动函数：`cubic-bezier(0.4, 0, 0.2, 1)`（Material 标准）。
- 主题切换：`0.35s`。

### 9.2 禁区

- 主题切换期间用 `.is-theme-transitioning` 禁用 `.expressive-code`、`.float-panel`、`.widget` 等复杂过渡，避免性能抖动。
- 禁用 `console.log` / `debugger`（构建时 esbuild `drop`）。

### 9.3 推荐动效库

| 场景 | 库 |
|------|-----|
| 简单 CSS 过渡 | Tailwind `transition-*` |
| 复杂时间线动画 | GSAP |
| 轻量动画 | anime.js |
| 视觉特效 | @vfx-js/core |
| 数字滚动 | `NumberTicker.svelte`（自研） |

---

## 10. 代码风格（Biome 强制）

### 10.1 格式化规则

```json
{
  "formatter": { "indentStyle": "tab" },
  "javascript": { "formatter": { "quoteStyle": "double" } }
}
```

- **Tab 缩进**（非空格）
- **双引号**字符串
- 末尾分号
- `useSelfClosingElements`: 报错（自闭合标签）
- `noInferrableTypes`: 报错（不写可推断的类型注解）

### 10.2 Svelte/Astro 放宽项

`.svelte` / `.astro` / `.vue` 文件中：
- `useConst` / `useImportType` / `noUnusedVariables` / `noUnusedImports` 关闭。

### 10.3 命名

- 组件文件：`PascalCase.astro` / `PascalCase.svelte`（如 `PostCard.astro`）。
- 工具/逻辑文件：`kebab-case.ts`（如 `content-utils.ts`）。
- CSS 文件：`kebab-case.css`，与组件名对应（`post-card.css` ↔ `PostCard.astro`）。
- CSS 变量：`--kebab-case`。
- 常量：`UPPER_SNAKE_CASE`（如 `PAGE_WIDTH`、`DARK_MODE`）。

### 10.4 注释

- 注释用**中文**，与项目现有风格一致。
- 组件尾部加 `<!-- 样式已迁移至 src/styles/... -->` 指明样式位置。

---

## 11. i18n 国际化

- 所有用户可见文案走 i18n：`import { i18n } from "@/i18n/translation"; import I18nKey from "@/i18n/i18nKey";`
- 调用：`i18n(I18nKey.more)`，禁止硬编码中文 UI 文本。
- 语言文件在 `src/i18n/languages/`（zh_CN / zh_TW / en / ja / ru）。
- 新增 key 先在 `i18nKey.ts` 定义枚举，再在各语言文件补全。

---

## 12. 新增功能 Checklist

开发新功能/组件前，逐项对照：

- [ ] **目录归属**：组件放入正确的 `src/components/{分类}/`，样式放入镜像的 `src/styles/{分类}/`。
- [ ] **配置抽取**：可配置项写入 `src/config/` 对应文件，通过 `@/config` 导入，不硬编码。
- [ ] **色彩合规**：只用 `variables.styl` 定义的变量，OKLCH 灰阶，无饱和色；暗色模式 `:root.dark` 覆盖。
- [ ] **边框风格**：卡片/按钮/分页用 `2px solid #000/#fff` + `0.75rem` 圆角 + `font-weight: 700`；hover 反相。
- [ ] **无阴影**：不写 `box-shadow`（除 `card-shadow` 极淡值）。
- [ ] **样式外置**：大段样式抽到 `src/styles/` 对应 CSS，组件内只留私有 `<style>`；在 `main.css` 注册 `@import`。
- [ ] **复用通用类**：优先用 `.btn-line` / `.btn-plain` / `.section` / `.text-90` 等，不重复造。
- [ ] **图标**：用 `<Icon name="..." />`，不内联 SVG。
- [ ] **i18n**：用户文案走 `i18n(I18nKey.xxx)`。
- [ ] **Swup 兼容**：全局组件放 Swup 容器外；页面逻辑监听 `content:replace` 重初始化。
- [ ] **文件格式**：`.astro` 服务端 / `.svelte` 客户端交互；按职责选型。
- [ ] **代码风格**：Tab 缩进、双引号、显式 Props 接口、中文注释。
- [ ] **响应式**：移动端 `768px` 断点测试，dock 抽屉等组件需适配。
- [ ] **暗色模式**：light/dark 双态视觉均正常。

---

## 13. 参考索引

| 主题 | 文件位置 |
|------|---------|
| 主题变量 | [variables.styl](file:///c:/Users/41462/Desktop/blog/src/styles/variables.styl) |
| 全局样式入口 | [main.css](file:///c:/Users/41462/Desktop/blog/src/styles/main.css) |
| 站点配置 | [siteConfig.ts](file:///c:/Users/41462/Desktop/blog/src/config/siteConfig.ts) |
| 布局骨架 | [Layout.astro](file:///c:/Users/41462/Desktop/blog/src/layouts/Layout.astro) / [MainGridLayout.astro](file:///c:/Users/41462/Desktop/blog/src/layouts/MainGridLayout.astro) |
| 组件目录说明 | [components/README.md](file:///c:/Users/41462/Desktop/blog/src/components/README.md) |
| 配置目录说明 | [config/README.md](file:///c:/Users/41462/Desktop/blog/src/config/README.md) |
| Biome 规则 | [biome.json](file:///c:/Users/41462/Desktop/blog/biome.json) |
| 构建配置 | [astro.config.mjs](file:///c:/Users/41462/Desktop/blog/astro.config.mjs) |
| 代表性组件 | [PostCard.astro](file:///c:/Users/41462/Desktop/blog/src/components/layout/PostCard.astro) / [WidgetLayout.astro](file:///c:/Users/41462/Desktop/blog/src/components/common/WidgetLayout.astro) / [LightDarkSwitch.svelte](file:///c:/Users/41462/Desktop/blog/src/components/controls/LightDarkSwitch.svelte) |

---

> **使用方式**：开发任何新功能前，先把本文档第 0、6、12 节读一遍。提交代码时对照第 12 节 Checklist 自检。如对风格有疑问，以本文档为准；如需更新文档，修改后在此处注明变更。
