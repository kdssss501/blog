# 移动端底部悬浮 Dock 设计文档

> 日期：2026-07-01
> 状态：已对齐，待实施
> 范围：移动端（≤768px）导航体系重构

## 一、背景与目标

当前移动端导航为双层结构：顶部 pill 形 sticky Navbar（Logo + 标题 + 搜索 + 汉堡）+ 右下角垂直堆叠 FloatingDock（10+ 按钮，默认折叠）。汉堡按钮触发右侧 NavMenuPanel 抽屉承载完整导航。

目标：将移动端导航与工具入口合并为底部悬浮 dock，采用"两边小中间大"的 5 栏位单浮岛形态，提升单手操作效率与视觉聚焦。桌面端（>768px）保持现状不变。

## 二、决策汇总

| 决策项 | 结论 |
|---|---|
| 顶部 Navbar | ≤768px 完全隐藏，Logo/标题移入菜单抽屉 |
| 中间大按钮 | 搜索（打开 SearchModal） |
| 5 栏位 | [首页][主题][搜索][工具栏][菜单] |
| UI 形态 | 单浮岛 + 中间凸出圆形按钮 |
| 按钮布局 | 图标在上、文字在下（iOS Tab Bar 风） |
| 触发范围 | `@media (max-width: 768px)` |
| 工具栏抽屉 | 从 dock 上方滑出的底部 sheet |
| 菜单抽屉 | 复用 NavMenuPanel 右侧滑入抽屉 |
| 滚动行为 | 向下滚动隐藏，向上滚动或停止时恢复 |
| 现有 FloatingDock | ≤768px 隐藏（不删除，桌面端保留） |

## 三、架构与组件结构

### 3.1 Swup 容器位置

MobileDock 放在 Swup 容器**外**（持久化，跨页面保持），与 FloatingDock 同级。符合 CLAUDE.md 4.2 节"必须在 Swup 容器外的组件"规范。

```
MainGridLayout.astro
├─ #top-row (Navbar) — ≤768px 隐藏
├─ NavMenuPanel — 复用，菜单按钮触发
├─ #main-grid
│  ├─ #left-sidebar-dynamic (Swup 占位，hidden)
│  ├─ #right-sidebar-dynamic (Swup 占位，hidden)
│  └─ #swup-container (页面内容)
├─ FloatingDock — ≤768px 隐藏
└─ MobileDock — ≤768px 显示（新增，OUTSIDE swup）
```

### 3.2 文件变更清单

| 操作 | 文件 | 说明 |
|---|---|---|
| 新增 | `src/components/layout/MobileDock.astro` | 底部 dock 主体组件 |
| 新增 | `src/styles/components/mobile-dock.css` | dock 样式（BEM 命名） |
| 修改 | `src/styles/main.css` | 导入 `mobile-dock.css`；FloatingDock 段增加 ≤768px 隐藏 |
| 修改 | `src/styles/layout/navbar-new.css` | ≤768px 隐藏 `#navbar` |
| 修改 | `src/layouts/MainGridLayout.astro` | 引入 MobileDock（Swup 容器外） |
| 修改 | `src/components/layout/NavMenuPanel.astro` | 触发器适配新菜单按钮；顶部加 Logo+标题区 |

## 四、5 栏位详细规格

从左到右排列于 pill 形单浮岛容器内，中间搜索按钮圆形凸出：

```
┌─────────────────────────────────────────────┐
│  [首页]  [主题]    ◉    [工具]  [菜单]      │
│   🏠     🌓    🔍(凸)   🧩     ☰          │
│  首页   主题   搜索    工具    菜单        │
└─────────────────────────────────────────────┘
```

| 位 | 标签 | 图标 | 功能 | 显隐逻辑 |
|---|---|---|---|---|
| 左1 | 首页 | `material-symbols:home-outline-rounded` | Swup 导航到 `/` | 非首页时 `is-active` 可点；首页时置灰 |
| 左2 | 主题 | `material-symbols:light-mode` / `dark-mode` | 切换亮/暗主题 | 图标随当前主题切换 |
| 中 | 搜索 | `material-symbols:search-rounded` | 打开 SearchModal | 凸出圆形大按钮，常驻 |
| 右2 | 工具 | `material-symbols:apps-rounded` | 打开工具栏底部 sheet | 常驻；sheet 打开时图标变 `close` |
| 右1 | 菜单 | `material-symbols:menu-rounded` | 打开 NavMenuPanel 抽屉 | 常驻；抽屉打开时图标变 `close` |

## 五、UI 样式规范

所有颜色、圆角、阴影使用 `variables.styl` 中定义的 CSS 自定义属性，禁止硬编码。

### 5.1 浮岛容器

```css
.mobile-dock {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: 0.75rem;
    z-index: 70;
    display: flex;
    align-items: flex-end;
    gap: 0.25rem;
    padding: 0.375rem 0.5rem;
    background: var(--float-panel-bg);
    backdrop-filter: blur(12px) saturate(1.2);
    -webkit-backdrop-filter: blur(12px) saturate(1.2);
    border: 2px solid var(--line-divider);
    border-radius: var(--radius-full);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    max-width: min(92vw, 24rem);
    transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s;
}
```

### 5.2 普通按钮（左右 4 个）

```css
.mobile-dock__btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.125rem;
    width: 2.75rem;
    height: 3rem;
    border-radius: var(--radius-large);
    color: var(--content-meta);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: color 0.2s, background 0.2s;
}
.mobile-dock__icon {
    font-size: 1.25rem;
    line-height: 1;
}
.mobile-dock__label {
    font-size: 0.625rem;
    line-height: 1;
    font-weight: 500;
}
.mobile-dock__btn.is-active {
    color: var(--deep-text);
}
.mobile-dock__btn:active {
    background: var(--btn-plain-bg-active);
}
```

### 5.3 中间搜索按钮（凸出）

```css
.mobile-dock__btn--center {
    width: 3.25rem;
    height: 3.25rem;
    margin: -0.875rem 0.25rem 0;
    border-radius: var(--radius-full);
    background: var(--deep-text);
    color: var(--page-bg);
    border: 2px solid var(--line-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.mobile-dock__btn--center .mobile-dock__icon {
    font-size: 1.5rem;
}
.mobile-dock__btn--center:active {
    transform: scale(0.95);
}
```

### 5.4 滚动隐藏状态

```css
.mobile-dock.is-hidden {
    transform: translateX(-50%) translateY(120%);
    opacity: 0;
    pointer-events: none;
}
```

### 5.5 命名规范

严格 BEM：
- Block：`.mobile-dock`
- Element：`.mobile-dock__btn`、`.mobile-dock__icon`、`.mobile-dock__label`、`.mobile-dock__sheet`、`.mobile-dock__sheet-grid`、`.mobile-dock__sheet-item`
- Modifier：`.mobile-dock__btn--center`
- 状态类（kebab-case，无 BEM 前缀）：`.is-hidden`、`.is-active`、`.is-open`

### 5.6 响应式

```css
/* 默认（桌面端 >768px）隐藏 MobileDock */
.mobile-dock { display: none; }

@media (max-width: 768px) {
    .mobile-dock { display: flex; }
    /* 隐藏顶部 Navbar */
    #navbar { display: none !important; }
    /* 隐藏现有 FloatingDock */
    .floating-dock { display: none !important; }
}
```

## 六、工具栏底部 Sheet

从 dock 上方滑出，贴 dock 顶部：

```css
.mobile-dock__sheet {
    position: fixed;
    left: 0.5rem;
    right: 0.5rem;
    bottom: calc(0.75rem + 3.75rem + 0.5rem); /* dock 高度 + 间距 */
    background: var(--float-panel-bg);
    backdrop-filter: blur(12px) saturate(1.2);
    -webkit-backdrop-filter: blur(12px) saturate(1.2);
    border: 2px solid var(--line-divider);
    border-radius: var(--radius-large);
    padding: 0.75rem;
    z-index: 69; /* 低于 dock 70 */
    transform: translateY(calc(100% + 1rem));
    opacity: 0;
    pointer-events: none;
    transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s;
    max-height: 50vh;
    overflow-y: auto;
}
.mobile-dock__sheet.is-open {
    transform: translateY(0);
    opacity: 1;
    pointer-events: auto;
}
.mobile-dock__sheet-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
}
.mobile-dock__sheet-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    border-radius: var(--radius-large);
    color: var(--deep-text);
    cursor: pointer;
    transition: background 0.2s;
}
.mobile-dock__sheet-item:active {
    background: var(--btn-plain-bg-active);
}
```

### Sheet 内工具列表

3 列网格，复用 dock-btn 样式：

| 工具 | 图标 | 显隐条件 |
|---|---|---|
| AI 搜索 | `ri:ai` | 始终 |
| 音乐 | `material-symbols:music-note-rounded` | `musicPlayerConfig.showInNavbar !== false` |
| 公告 | `material-symbols:notifications-outline-rounded` | `announcementConfig.items.length > 0` |
| 标签 | `material-symbols:label-outline` | 始终 |
| TOC | `material-symbols:format-list-bulleted` | 仅文章页 |
| 评论 | `mingcute:comment-line` | 仅文章页且有评论 |
| 回顶部 | `material-symbols:keyboard-arrow-up-rounded` | 滚动 >200px |
| Spine | `material-symbols:image-outline` | `spineModelConfig?.enable` |
| 首页 | `material-symbols:home-outline-rounded` | 仅非首页 |

关闭方式：点击 sheet 外部、再次点击工具按钮、Escape 键。

## 七、菜单抽屉（复用 NavMenuPanel）

- **复用**：现有 NavMenuPanel 右侧滑入抽屉，`width: min(80vw, 360px)`，z-index 9999
- **触发**：MobileDock 菜单按钮（`#mobile-dock-menu-btn`），复用 NavMenuPanel 的 open/close 逻辑
- **顶部新增**：Logo + 标题区（因顶部 Navbar 已隐藏），置于抽屉内容顶部
- **内容**：完整 `navBarConfig` 导航树（已有实现，无需改动）
- **关闭**：Close 按钮、点击遮罩、Escape 键（已有实现）

## 八、滚动隐藏逻辑

- 监听 `window.scrollY`（passive 监听器）
- 向下滚动超过 100px 且持续滚动：添加 `.is-hidden`，dock 滑出屏幕底部
- 向上滚动或停止滚动：移除 `.is-hidden`，dock 滑回
- 抽屉（工具栏 sheet / 菜单抽屉）打开时锁定，不响应滚动隐藏
- 使用 `astro:page-load` 重新绑定监听器（Swup 兼容）
- 使用 AbortController 在页面切换时清理监听器

```javascript
let lastScrollY = 0;
let isOverlayOpen = false; // sheet 或菜单抽屉打开时为 true

function onScroll() {
    if (isOverlayOpen) return;
    const y = window.scrollY;
    const dock = document.getElementById('mobile-dock');
    if (!dock) return;
    if (y > lastScrollY + 8 && y > 100) {
        dock.classList.add('is-hidden');
    } else if (y < lastScrollY - 8) {
        dock.classList.remove('is-hidden');
    }
    lastScrollY = y;
}
```

## 九、与现有 FloatingDock 的关系

- ≤768px：`.floating-dock { display: none !important; }`（CSS 媒体查询）
- >768px：FloatingDock 保持现状，MobileDock 隐藏
- **不删除** FloatingDock 组件，仅移动端隐藏，桌面端体验不变
- MobileDock 的工具栏 sheet 复用 FloatingDock 的功能逻辑（主题切换、AI 搜索抽屉、音乐抽屉、TOC 懒加载等），但 UI 独立

## 十、组件脚本规范

MobileDock.astro 脚本遵循 FloatingDock.astro 的模式：

- 所有监听器挂在 `AbortController` 上
- 通过 `astro:page-load` 事件重新初始化（Swup 兼容）
- 路径相关显隐：`updatePathDependent()` 根据是否首页/文章页 toggle
- 滚动相关显隐：`updateScrollDependent()` 根据滚动位置 toggle 回顶部按钮
- 主题切换：动态 import `setting-utils` 调用 `setTheme`
- TOC：懒加载 `TOCManager`
- 导航：使用 Swup（`navigateToPage`），禁止 `location.href`
- 容器内 `<script>` 标记 `data-swup-ignore-script` 或使用事件委托

## 十一、构建与兼容性

- 所有 CSS 在 `main.css` 导入，`cssCodeSplit: false` 合并为单文件，Swup 替换不丢失样式
- MobileDock 放 Swup 容器外，持久化跨页面
- 事件用 `astro:page-load`（每次导航完成触发，含首次加载）
- 主题兼容：支持亮色/暗色主题切换，颜色全部使用 CSS 自定义属性
- 移动端适配：完整 ≤768px 适配，无魔法数字断点

## 十二、重构检查清单

按 CLAUDE.md 第十三节：

- [ ] 无内联样式：MobileDock.astro 中没有 `<style>` 块
- [ ] 样式集中：所有 CSS 在 `src/styles/components/mobile-dock.css`
- [ ] BEM 命名：类名遵循 BEM 规范（`.mobile-dock`、`.mobile-dock__btn`、`.mobile-dock__btn--center`）
- [ ] 变量使用：颜色、间距、圆角使用 `variables.styl` 中定义的 CSS 自定义属性
- [ ] Swup 容器：MobileDock 放在 Swup 容器外（持久化）
- [ ] 事件规范：使用 `astro:page-load` 而非多个事件
- [ ] 程序化导航：使用 `navigateToPage()` 而非 `location.href`
- [ ] 无魔法数字：断点统一 768px，z-index 使用 70/69（介于 Navbar 80 与 NavMenuPanel 9998 之间）
- [ ] 主题兼容：支持亮色/暗色主题切换
- [ ] 响应式：移动端 ≤768px 完整适配

## 十三、实施顺序建议

1. 新建 `src/styles/components/mobile-dock.css`，写入浮岛、按钮、sheet 样式
2. `src/styles/main.css` 导入 `mobile-dock.css`，并在 FloatingDock 段增加 ≤768px 隐藏规则
3. `src/styles/layout/navbar-new.css` 增加 ≤768px 隐藏 `#navbar` 规则
4. 新建 `src/components/layout/MobileDock.astro`，实现 5 栏位 + 工具栏 sheet + 滚动隐藏 + 脚本
5. `src/layouts/MainGridLayout.astro` 引入 MobileDock（FloatingDock 旁，Swup 容器外）
6. `src/components/layout/NavMenuPanel.astro` 适配新菜单按钮触发，顶部加 Logo+标题区
7. 移动端测试：首页/文章页/归档页切换、滚动隐藏、抽屉开关、主题切换、Swup 导航
8. 桌面端回归测试：确认 >768px 体验不变
