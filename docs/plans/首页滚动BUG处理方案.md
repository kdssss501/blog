# 首页滚动BUG处理方案

记录时间：2026-06-16 13:52 +08:00

状态：已完成定位记录；临时补丁已按要求回滚，当前不保留生产代码修改。

## 一、问题现象

首页从首屏快速向下滚动时，下方滚动动画区域会出现大块黑色横条或图片空白。截图中黑色区域位于首页作品百叶窗/快门动画层附近，表现为背景图片没有正常铺满动画视口。

触发特征：

- 桌面端更容易出现，尤其是宽屏视口。
- 从 Hero 区域快速滚到下方动画层时更容易出现。
- 慢速滚动时不一定复现，因为图片和动画状态有时间完成。

## 二、涉及模块

- `src/components/layout/HomeHero.astro`
  - `initHomeScrollMotion()` 会对首页后续 section 做通用入场动画。
  - 当前图片选择器为 `section.querySelectorAll("img, [data-motion-image]")`。

- `src/styles/components/home-hero.css`
  - `.home-page--motion-pending > :not(#home-hero) img` 会在首页动画 pending 阶段裁剪所有非 Hero 图片。

- `src/components/layout/HomePortfolioShutterLayer.astro`
  - 首页作品百叶窗/快门滚动动画层。
  - 快门图片初始使用透明 1px 占位图，真实地址存在 `data-src`，由 JS 初始化时再写入 `src`。

- `src/styles/components/home-portfolio-shutter.css`
  - 快门层使用 `margin-top: -100vh` 覆盖数据层，并通过 GSAP ScrollTrigger pin 住 100vh 视口。

## 三、实际检测记录

使用本地开发服务 `http://127.0.0.1:4321/` 和 in-app browser 检测，临时视口约为 `2048 x 544`。

初始进入首页时观察到：

- `#home-portfolio-shutter` 的 `data-shutter-ready` 为 `loading`。
- 快门层 6 张图片的 `src` 已从透明占位切换到真实图片路径。
- 但这些图片仍然 `complete=false`、`naturalWidth=0`、`currentSrc=""`，说明图片还没有完成加载/解码。

快速滚动后观察到：

- ScrollTrigger 初始化后页面高度从约 `1722px` 增加到约 `5721px`，快门 pin 生效。
- 快门层图片出现 `clip-path: inset(0px 0px 100%)`。
- final image 同时处于 `opacity: 0`、`visibility: hidden`。
- 黑色 mask 层存在并可见，导致用户看到黑色横条/空白区域。

## 四、根因判断

这是两个机制叠加导致的竞态问题。

第一层：快门图片加载时序

快门组件为了懒加载，初始把所有图片 `src` 设置为透明 1px 占位图，真实图片在 JS 初始化时从 `data-src` 写回。用户快速滚动时，可能在图片尚未完成 decode 前就进入快门 pin 动画段。

第二层：首页通用滚动动画误伤快门图片

`HomeHero.astro` 的 `initHomeScrollMotion()` 会遍历 `.home-page > :not(#home-hero)`，而 `home-data-stack` 同时包含 `HomeDataLayer` 和 `HomePortfolioShutterLayer`。通用选择器 `img, [data-motion-image]` 会把快门层图片也纳入普通 section 图片入场动画。

这会给快门图片设置 `clip-path: inset(0 0 100% 0)` 和 scale 动画。快门层自己的 GSAP 动画又期待这些图片始终作为百叶窗面板背景可见。两套动画争抢同一批图片，快速滚动时图片会被裁成 0 高度，只剩黑色 mask 或透明底。

第三层：CSS pending 初始状态也有同类问题

`home-hero.css` 中：

```css
.home-page--motion-pending > :not(#home-hero) img,
.home-page--motion-pending > :not(#home-hero) [data-motion-image] {
  clip-path: inset(0 0 100% 0);
  transform: scale(1.1);
}
```

该规则同样会命中快门层图片，使它们在 JS 初始化前就可能被裁剪。

## 五、临时补丁内容

本次曾临时验证过一个最小补丁，后来按要求已回滚。

补丁思路：

1. `HomeHero.astro` 中通用图片入场动画排除快门图片。
2. `home-hero.css` 中 pending 初始裁剪规则排除快门图片。
3. 增加源码级回归测试，确保通用图片选择器不会再选中 `data-shutter-image` 和 `data-shutter-final-image`。

临时改动示意：

```ts
const images = section.querySelectorAll(
  "img:not([data-shutter-image]):not([data-shutter-final-image]), [data-motion-image]:not([data-shutter-image]):not([data-shutter-final-image])",
);
```

```css
.home-page--motion-pending > :not(#home-hero) img:not([data-shutter-image]):not([data-shutter-final-image]),
.home-page--motion-pending > :not(#home-hero) [data-motion-image]:not([data-shutter-image]):not([data-shutter-final-image]) {
  clip-path: inset(0 0 100% 0);
  transform: scale(1.1);
}
```

## 六、回滚记录

按用户要求，临时补丁已回滚：

- 已恢复 `src/components/layout/HomeHero.astro` 中的原始图片选择器。
- 已恢复 `src/styles/components/home-hero.css` 中的原始 pending 图片规则。
- 已删除临时测试文件 `tests/home-shutter-selector.test.mjs`。
- 当前仅保留本方案文档。

## 七、建议正式修复方案

推荐分两步处理。

第一步：隔离动画作用域

- 让首页通用滚动动画只处理普通内容图片，显式排除快门层图片。
- 更稳妥的长期方案是改成显式标记，例如只选择 `[data-home-motion-image]`，避免以后新增复杂组件时再次被 `img` 这种宽泛选择器误伤。

第二步：消除图片加载竞态

可选方案：

- 快门图直接在 HTML 中使用真实 `src`，不再用透明占位。图片总量约 1.7MB，适合评估首屏负载后决定。
- 或者保留 `data-src`，但快门 ScrollTrigger/timeline 的 `ready` 状态必须等 `hydrateLazyImages()` 完成后再进入可播放状态。
- 最终图 `finalImage` 不应在黑色 mask 已覆盖时仍处于未解码状态；可以单独优先预加载最终图。

## 八、验收标准

- 首页桌面端快速滚动到快门层，不再出现黑色横条或图片空白。
- 快门层图片不再出现来自通用首页动画的 `clip-path: inset(0px 0px 100%)`。
- `data-shutter-image` 和 `data-shutter-final-image` 不被 `HomeHero` 的通用图片入场动画选中。
- 图片完成加载后触发 `ScrollTrigger.refresh()`，pin 高度和动画进度稳定。
- 移动端仍保持当前禁用快门层的行为。
