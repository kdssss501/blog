# 首页「展示层」动画组件设计文档

> 日期：2026-07-07
> 状态：已对齐，待实施
> 范围：首页 `src/pages/index.astro` 新增全屏「展示层」组件，插入在 `HomeDataLayer` 与 `HomePortfolioShutterLayer` 之间，桌面端（≥769px）显示

## 一、背景与目标

### 1.1 当前问题

首页 `home-data-stack` 目前由两层组成：

```
home-data-stack (position: relative; isolation: isolate)
├── HomeDataLayer          z:0  含「能力矩阵」标题 + 数据卡 + 技能轨道
└── HomePortfolioShutterLayer  z:4  margin-top:-100vh 覆盖，百叶窗三阶段动画
```

用户希望将「能力矩阵」标题从 `HomeDataLayer` 移除，并在 `HomeDataLayer` 与百叶窗之间新增一个独立的「展示层」全屏动画层，作为百叶窗的前奏过渡。

### 1.2 目标

1. 新增 `HomeDisplayLayer.astro` 组件，插入在 `HomeDataLayer` 和 `HomePortfolioShutterLayer` 之间
2. 从 `HomeDataLayer` 移除「能力矩阵」标题及其入场动画
3. 展示层为独立 GSAP ScrollTrigger pin，7 阶段 scrub 动画
4. 动画完成后柱子扩全屏，纯色过渡到百叶窗
5. 移动端（<768px）和 `prefers-reduced-motion` 下隐藏，与百叶窗策略一致
6. 遵循 [CLAUDE.md](../../CLAUDE.md) 全部规范

### 1.3 决策汇总

| 决策项 | 结论 |
|---|---|
| 方案选型 | 方案 A：独立 Astro 组件，镜像百叶窗架构 |
| 层级位置 | 插入中间层：`HomeDataLayer → 展示层(新) → 百叶窗` |
| 动画序列 | 线生长 → 柱扩展 → 左右文字滑入 → 中间文字渐入 → 停留 → 文字渐出 → 柱扩全屏 |
| 配色 | 跟随站点主题：柱子 `var(--deep-text)`，背景 `var(--card-bg)` |
| 文字内容 | 全部放 `homeConfig.ts` 的 `displayLayer` 段，不走 i18n |
| 英文文案 | 助手撰写诗意长句，config 可替换 |
| 衔接百叶窗 | 独立 pin，纯色过渡（柱子扩全屏后释放 pin） |
| 移动端 | `display: none`，与百叶窗一致 |
| 初始化事件 | `astro:page-load`（CLAUDE.md 6.2 规范） |
| 清理事件 | `swup:willReplaceContent` |

## 二、架构与文件结构

### 2.1 新增文件

| 文件 | 作用 |
|---|---|
| `src/components/layout/HomeDisplayLayer.astro` | 展示层组件，含 DOM 结构 + GSAP timeline 脚本 |
| `src/styles/components/home-display-layer.css` | 展示层样式，在 `main.css` 按层级导入 |
| `src/utils/home-display-layer.js` | 工具函数与常量（pin 距离计算、校验） |

### 2.2 修改文件

| 文件 | 改动 |
|---|---|
| [src/pages/index.astro](../../src/pages/index.astro) | 在 `<HomeDataLayer />` 和 `<HomePortfolioShutterLayer />` 之间插入 `<HomeDisplayLayer />` |
| [src/components/layout/HomeDataLayer.astro](../../src/components/layout/HomeDataLayer.astro) | 移除第 64 行「能力矩阵」标题 + 第 362-376 行 `titleMatrix` 动画 + 变量声明 |
| [src/config/homeConfig.ts](../../src/config/homeConfig.ts) | 新增 `displayLayer` 配置段 |
| [src/config/index.ts](../../src/config/index.ts) | 导出新类型 |
| [src/types/config.ts](../../src/types/config.ts) | 新增 `HomeDisplayLayerConfig` 类型 |
| [src/styles/main.css](../../src/styles/main.css) | 导入 `home-display-layer.css` |
| HomeDataLayer 对应样式文件 | 删除 `.home-data-layer__title-matrix` 选择器（实现阶段 grep 确认） |

### 2.3 挂载位置

```astro
<!-- src/pages/index.astro -->
<div class="home-data-stack">
  <HomeDataLayer />              {/* z:0, 移除能力矩阵标题 */}
  <HomeDisplayLayer />           {/* z:2, 新增, 独立 pin */}
  <HomePortfolioShutterLayer />  {/* z:4, margin-top:-100vh 覆盖展示层 */}
</div>
```

### 2.4 z-index 与堆叠

```
home-data-stack (position: relative; isolation: isolate)
├── HomeDataLayer          z:0  正常流
├── HomeDisplayLayer       z:2  正常流（独占一段滚动空间）
└── HomePortfolioShutterLayer  z:4  margin-top:-100vh 覆盖展示层
```

展示层为正常流（不像百叶窗负 margin 覆盖），独占自己那段滚动空间。百叶窗仍用 `margin-top:-100vh` 覆盖在展示层之上，覆盖对象从 `HomeDataLayer` 变成 `HomeDisplayLayer`。

## 三、DOM 结构与 CSS

### 3.1 DOM 结构

```html
<section class="home-display-layer" data-display-layer data-display-enabled="true">
  <div class="home-display-layer__viewport" data-display-viewport>
    <!-- 中央柱子（线→柱→全屏）-->
    <div class="home-display-layer__pillar" data-display-pillar></div>

    <!-- 左侧垂直大字"展示" -->
    <p class="home-display-layer__text home-display-layer__text--left"
       data-display-text-left>展示</p>

    <!-- 中间垂直"CRYSTALLIZE GALLERY"（在柱子上）-->
    <p class="home-display-layer__text home-display-layer__text--center"
       data-display-text-center>CRYSTALLIZE GALLERY</p>

    <!-- 右侧英文段落（水平）-->
    <p class="home-display-layer__text home-display-layer__text--right"
       data-display-text-right>英文文案...</p>
  </div>
</section>
```

### 3.2 CSS 关键设计（`home-display-layer.css`）

遵循 CLAUDE.md 规范：无 `<style>` 块，BEM 命名，颜色用 `var(--xxx)`，断点 `768px`。

```css
.home-display-layer {
  min-height: 100vh;
  position: relative;
  z-index: 2;
}

.home-display-layer__viewport {
  position: relative;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--card-bg);
  /* 柱子目标宽度，由 config 注入 CSS 变量 */
  --pillar-width: 18vw;
  --pillar-gap: 6vw;
}

/* 柱子：初始为 2px 细线，水平居中，GSAP 控制 scaleY/width */
.home-display-layer__pillar {
  position: absolute;
  left: 50%;
  top: 0;
  width: 2px;
  height: 100%;
  background: var(--deep-text);
  /* GSAP 初始: xPercent:-50, scaleY:0, transformOrigin:"bottom center" */
  will-change: transform, width;
}

/* 左侧"展示"：垂直，定位在柱子左侧 */
.home-display-layer__text--left {
  position: absolute;
  right: calc(50% + var(--pillar-width) / 2 + var(--pillar-gap));
  top: 50%;
  transform: translateY(-50%);
  writing-mode: vertical-rl;
  text-orientation: upright;
  color: var(--deep-text);
  font-size: clamp(3rem, 8vw, 6rem);
  font-weight: 900;
  /* GSAP 初始: xPercent:-200, autoAlpha:0 */
}

/* 中间"CRYSTALLIZE GALLERY"：垂直，在柱子上，反色 */
.home-display-layer__text--center {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  writing-mode: vertical-rl;
  text-orientation: upright;
  color: var(--card-bg);  /* 反色：柱子是 deep-text，文字用 card-bg */
  font-size: clamp(1.5rem, 3vw, 2.5rem);
  font-weight: 700;
  letter-spacing: 0.2em;
  /* GSAP 初始: autoAlpha:0 */
  z-index: 2;  /* 在柱子之上 */
}

/* 右侧英文：水平段落，定位在柱子右侧 */
.home-display-layer__text--right {
  position: absolute;
  left: calc(50% + var(--pillar-width) / 2 + var(--pillar-gap));
  top: 50%;
  transform: translateY(-50%);
  max-width: 24vw;
  color: var(--deep-text);
  font-size: clamp(0.875rem, 1.1vw, 1.125rem);
  line-height: 1.7;
  /* GSAP 初始: xPercent:200, autoAlpha:0 */
}

/* 移动端 & reduced-motion：隐藏，与百叶窗一致 */
@media (max-width: 768px), (prefers-reduced-motion: reduce) {
  .home-display-layer {
    display: none !important;
  }
}
```

### 3.3 文字配色逻辑

| 元素 | 颜色 | 对比对象 |
|---|---|---|
| 柱子 | `var(--deep-text)` | 视口背景 `var(--card-bg)` |
| 左"展示" | `var(--deep-text)` | 视口背景 |
| 中"CRYSTALLIZE GALLERY" | `var(--card-bg)`（反色） | 柱子（`deep-text`） |
| 右英文 | `var(--deep-text)` | 视口背景 |

light 模式：白底黑柱，左/右文字黑色，中间文字白色。dark 模式自动反转。

### 3.4 文字朝向

- "展示"和"CRYSTALLIZE GALLERY"用 `writing-mode: vertical-rl` + `text-orientation: upright`，字符正立从上往下排列
- 右侧英文保持水平段落，便于阅读，与两段垂直文字形成不对称视觉张力

## 四、GSAP 时间轴设计

### 4.1 时间轴总览

总时长 ~6.6s，映射到 `scrollDistance`（默认 4000px）的 scrub 滚动。7 个阶段：

| 阶段 | 时间轴位置 | 时长 | 动作 |
|---|---|---|---|
| Phase 1 线生长 | 0 → 1.0s | 1.0s | 柱子 `scaleY: 0 → 1`，`transformOrigin: "bottom center"`，`ease: "power2.out"` |
| Phase 2 柱扩展 | 1.0 → 2.2s | 1.2s | 柱子 `width: 2px → 18vw`，`ease: "power2.inOut"` |
| Phase 3 左右文字滑入 | 1.6 → 2.4s | 0.8s | 左 `xPercent: -200 → 0`，右 `xPercent: 200 → 0`，同步 `autoAlpha: 0 → 1`，`ease: "power2.out"` |
| Phase 4 中间文字渐入 | 2.2 → 2.8s | 0.6s | 中间 `autoAlpha: 0 → 1`（柱子全宽后开始），`ease: "power2.out"` |
| Phase 5 停留观赏 | 2.8 → 4.8s | 2.0s | 空时长，用户观赏 |
| Phase 6 文字渐出 | 4.8 → 5.4s | 0.6s | 三段文字 `autoAlpha: 1 → 0`，`ease: "power2.in"` |
| Phase 7 柱扩全屏 | 5.4 → 6.6s | 1.2s | 柱子 `width: 18vw → 100vw`，`ease: "power2.inOut"` |

### 4.2 关键时间点说明

- **Phase 3 起始 1.6s**：Phase 2 进行到 0.6s（1.2s 的一半），`power2.inOut` 中点约等于柱子半宽，此时触发左右文字滑入
- **Phase 4 起始 2.2s**：Phase 2 结束（柱子全宽），中间文字才开始渐入
- **Phase 3/4 重叠**：2.2-2.4s 期间左右文字仍在滑入，中间文字同时渐入，形成层次感
- **Phase 5 停留**：2.0s 空时长 ≈ 1212px 滚动距离（2.0/6.6 × 4000），给用户充分观赏

### 4.3 伪代码

```js
// src/components/layout/HomeDisplayLayer.astro <script>
const initHomeDisplayLayer = async (root) => {
  // 前置检查
  if (root.dataset.displayEnabled !== "true") return;
  if (!window.matchMedia("(min-width: 769px)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const viewport = root.querySelector("[data-display-viewport]");
  const pillar = root.querySelector("[data-display-pillar]");
  const textLeft = root.querySelector("[data-display-text-left]");
  const textCenter = root.querySelector("[data-display-text-center]");
  const textRight = root.querySelector("[data-display-text-right]");

  // 等 #content-wrapper.onload-animation 结束（避免 containing block 困住 fixed pin）
  await ensureNoContentWrapperContainingBlock();

  const { gsap } = await import("gsap");
  const { ScrollTrigger } = await import("gsap/ScrollTrigger");
  gsap.registerPlugin(ScrollTrigger);

  const config = root.dataset;
  const pillarFinalWidth = config.pillarFinalWidth; // "18vw"
  const scrollDistance = Number(config.scrollDistance);

  // 初始状态
  gsap.set(pillar, { xPercent: -50, scaleY: 0, transformOrigin: "bottom center" });
  gsap.set(textLeft, { xPercent: -200, autoAlpha: 0 });
  gsap.set(textRight, { xPercent: 200, autoAlpha: 0 });
  gsap.set(textCenter, { autoAlpha: 0 });

  const timeline = gsap.timeline({
    scrollTrigger: {
      trigger: viewport,
      start: "top top",
      end: () => `+=${getDisplayPinEndDistance(scrollDistance, window.innerHeight)}`,
      pin: true,
      scrub: true,
      anticipatePin: 1,
      preventOverlaps: "home-display-layer",
    },
  });

  // Phase 1: 线生长
  timeline.to(pillar, { scaleY: 1, duration: 1.0, ease: "power2.out" });

  // Phase 2: 柱扩展
  timeline.to(pillar, { width: pillarFinalWidth, duration: 1.2, ease: "power2.inOut" });

  // Phase 3: 左右文字滑入（柱子半宽时）
  timeline.to(textLeft, { xPercent: 0, autoAlpha: 1, duration: 0.8, ease: "power2.out" }, 1.6);
  timeline.to(textRight, { xPercent: 0, autoAlpha: 1, duration: 0.8, ease: "power2.out" }, 1.6);

  // Phase 4: 中间文字渐入（柱子全宽后）
  timeline.to(textCenter, { autoAlpha: 1, duration: 0.6, ease: "power2.out" }, 2.2);

  // Phase 5: 停留观赏（空时长）
  timeline.to({}, { duration: 2.0 }, 2.8);

  // Phase 6: 文字渐出
  timeline.to([textLeft, textRight, textCenter], { autoAlpha: 0, duration: 0.6, ease: "power2.in" }, 4.8);

  // Phase 7: 柱扩全屏
  timeline.to(pillar, { width: "100vw", duration: 1.2, ease: "power2.inOut" }, 5.4);

  ScrollTrigger.refresh();

  // 记录 cleanup 对象
  activeCleanup = {
    timeline,
    scrollTrigger: timeline.scrollTrigger,
    kill() {
      this.scrollTrigger?.kill();
      this.timeline?.kill();
    },
  };

  root.dataset.displayReady = "true";
};
```

### 4.4 工具函数（`home-display-layer.js`）

```js
export const DISPLAY_MIN_SCROLL_VIEWPORTS = 4;
export const MOBILE_REMOVAL_WIDTH = 768;
export const DESKTOP_MEDIA_QUERY = "(min-width: 769px)";

export function getDisplayPinEndDistance(configuredDistance, viewportHeight) {
  return Math.max(configuredDistance, DISPLAY_MIN_SCROLL_VIEWPORTS * viewportHeight);
}
```

## 五、生命周期与 Swup 兼容

遵循 CLAUDE.md 6.2 节规范：首选 `astro:page-load` 初始化，Swup 导航时清理。完全镜像 `HomePortfolioShutterLayer.astro` 的生命周期模式。

### 5.1 初始化流程

```js
const bootHomeDisplayLayer = () => {
  const root = document.querySelector("[data-display-layer]");
  if (!root) return;
  initHomeDisplayLayer(root);
};

// 立即执行一次（处理首次加载）
bootHomeDisplayLayer();

// Swup 页面切换后重新初始化
document.addEventListener("astro:page-load", bootHomeDisplayLayer);
```

### 5.2 `initHomeDisplayLayer` 内部流程

1. **前置检查**：`data-display-enabled === "true"` && 桌面端 (`min-width: 769px`) && 非 `prefers-reduced-motion`，否则标记 `data-display-ready = "disabled"` 并返回
2. **等待 containing block 解除**：复用百叶窗的 `ensureNoContentWrapperContainingBlock()` 逻辑——等 `#content-wrapper.onload-animation` 的 `animationend` 后移除该类并清掉 transform 残留
3. **动态加载 GSAP**：`await import("gsap")` + `await import("gsap/ScrollTrigger")`
4. **设置初始状态** + **创建 timeline**（见第四节）
5. **`ScrollTrigger.refresh()`**
6. **标记就绪**：`root.dataset.displayReady = "true"`

### 5.3 清理流程（Swup 导航时）

```js
const teardownDisplay = () => {
  const root = document.querySelector("[data-display-layer]");
  if (!root) return;

  if (activeCleanup) {
    activeCleanup.kill();
    activeCleanup = null;
  }

  // 清理内联样式，重置到初始状态
  const pillar = root.querySelector("[data-display-pillar]");
  const texts = root.querySelectorAll("[data-display-text-left], [data-display-text-center], [data-display-text-right]");
  if (pillar) gsap.set(pillar, { clearProps: "all" });
  if (texts.length) gsap.set(texts, { clearProps: "all" });

  root.dataset.displayReady = "";
};

document.addEventListener("swup:willReplaceContent", teardownDisplay);
```

### 5.4 Media Watchers（响应式）

```js
const setupMediaWatchers = () => {
  const desktopMQ = window.matchMedia("(min-width: 769px)");
  const reduceMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");

  desktopMQ.addEventListener("change", () => {
    teardownDisplay();
    bootHomeDisplayLayer();
  });

  reduceMotionMQ.addEventListener("change", () => {
    teardownDisplay();
    bootHomeDisplayLayer();
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (activeCleanup) ScrollTrigger.refresh();
    }, 150);
  });
};
```

### 5.5 与百叶窗层的协调

| 场景 | 处理 |
|---|---|
| 两个 pin 相邻 | 都用 `preventOverlaps` 分组名（`"home-display-layer"` / `"home-portfolio-shutter"`），ScrollTrigger 自动避免同时 pin |
| Swup 导航 | 两个组件各自监听 `swup:willReplaceContent` 独立清理，互不干扰 |
| `astro:page-load` | 两个组件各自重新初始化，顺序由 DOM 位置决定（展示层先初始化，百叶窗后初始化） |
| resize | 各自防抖 refresh，互不影响 |

## 六、配置与 HomeDataLayer 改动

### 6.1 配置结构（`homeConfig.ts` 新增 `displayLayer` 段）

```ts
displayLayer: {
  enabled: true,
  kicker: "展示",                          // 左侧垂直大字
  title: "CRYSTALLIZE GALLERY",            // 中间垂直字
  description: "Where fleeting visions crystallize into permanence — each frame a frozen breath of time, each work a memory hardened into light.",
  scrollDistance: 4000,                    // pin 滚动距离（px）
  pillarFinalWidth: "18vw",                // 柱子"正常"宽度
},
```

### 6.2 类型定义（`src/types/config.ts` 新增）

```ts
export interface HomeDisplayLayerConfig {
  enabled: boolean;
  kicker: string;
  title: string;
  description: string;
  scrollDistance: number;
  pillarFinalWidth: string;
}
```

### 6.3 配置导出

- `src/config/index.ts` 新增 `HomeDisplayLayerConfig` 类型的 re-export
- `homeConfig.ts` 中 `displayLayer` 段自动通过 `@/config` 导出

### 6.4 HomeDataLayer 改动

`src/components/layout/HomeDataLayer.astro`：

| 行号 | 改动 |
|---|---|
| 第 64 行 | 删除 `<h2 class="home-data-layer__title-matrix">能力矩阵</h2>` |
| 第 362-376 行 | 删除 `titleMatrix` 入场动画（`gsap.fromTo(titleMatrix, ...)` 段） |
| titleMatrix 变量声明 | 删除 `const titleMatrix = root.querySelector(".home-data-layer__title-matrix")` |

需检查 HomeDataLayer 对应样式文件中是否有 `.home-data-layer__title-matrix` 选择器，有则一并删除（实现阶段 grep 确认）。

不受影响的部分：
- `titleMain`（"站点数据"标题）保留
- DataMetricCard、data-band（CONTACT / SKILLS 轨道）保留
- `headingTl` 中 titleMain 的入场动画保留

### 6.5 英文文案

`description` 字段文案：

> *"Where fleeting visions crystallize into permanence — each frame a frozen breath of time, each work a memory hardened into light."*

语义与 "CRYSTALLIZE GALLERY" 呼应：转瞬即逝的幻象结晶为永恒——每一帧是时间的凝息，每一件作品是凝固成光的记忆。文案在 config 中可随时替换。

### 6.6 i18n 处理

展示层文字全部来自 config（`kicker` / `title` / `description`），**不走 i18n 系统**。理由：
- "展示" 和 "CRYSTALLIZE GALLERY" 是品牌/视觉标语，不随语言切换
- 英文 description 是设计性的，不翻译
- 与 `portfolioShutter` 配置一致（其 `kicker: "The End"` / `title: "愿你每一天..."` 也未走 i18n）

## 七、衔接百叶窗的过渡

展示层 pin 结束后（柱子已扩全屏 = 满屏 `var(--deep-text)` 纯色），pin 释放，用户继续滚动。百叶窗层（`margin-top: -100vh` 覆盖在展示层上）随即进入视口，其 ScrollTrigger pin 开始，5 个 panel 从满屏纯色上滑入。

两个 pin 通过 `preventOverlaps` 分组名避免重叠卡顿：
- 展示层：`preventOverlaps: "home-display-layer"`
- 百叶窗：`preventOverlaps: "home-portfolio-shutter"`（已有）

## 八、检查清单

按 CLAUDE.md 第十五节逐项核对：

- [x] 组件无 `<style>` 块，样式在 `src/styles/components/home-display-layer.css`
- [x] 新增样式文件在 `main.css` 按层级导入
- [x] 类名 BEM（`.home-display-layer__pillar` / `--left` / `--center` / `--right`）
- [x] 颜色用 `var(--deep-text)` / `var(--card-bg)`，无硬编码
- [x] 断点 `768px`，无魔法数字
- [x] Swup 容器外组件（展示层在 `home-data-stack` 内，与百叶窗同级）不依赖容器内 DOM
- [x] 页面初始化用 `astro:page-load`
- [x] 导航用 Swup（展示层不触发导航，无 `location.href`）
- [x] 支持 light / dark 主题（`var(--deep-text)` / `var(--card-bg)` 自动跟随）
- [x] 移动端 `display: none`，与百叶窗一致

## 九、实施顺序建议

1. 新增 `home-display-layer.js` 工具函数
2. 新增 `home-display-layer.css` 样式文件，在 `main.css` 导入
3. 新增 `HomeDisplayLayer.astro` 组件（DOM + 脚本）
4. 在 `types/config.ts` 新增类型，`homeConfig.ts` 新增配置段，`config/index.ts` 导出
5. 在 `index.astro` 挂载 `<HomeDisplayLayer />`
6. 修改 `HomeDataLayer.astro` 移除「能力矩阵」标题及动画
7. grep 并清理 `.home-data-layer__title-matrix` 残留样式
8. `pnpm dev` 联调，调整时间轴参数
9. `pnpm check` + `pnpm lint` + `pnpm build` 验证
