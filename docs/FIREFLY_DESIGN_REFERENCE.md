# Firefly 主题设计参考

## 1. 概述
Firefly 是一款基于 Hexo 框架的现代化博客主题，原版为 Astro 项目。采用 OKLCH 色彩空间和 Material You 设计语言。

## 2. 色彩系统
- 使用 OKLCH 色彩空间，通过单一 --hue 变量（默认165）生成全站配色
- 亮色模式：
  - 页面背景: oklch(0.98 0.01 var(--hue))
  - 卡片背景: oklch(0.99 0.005 var(--hue))
  - 主色调: oklch(0.65 0.18 var(--hue))
  - 主文字: oklch(0.15 0.01 var(--hue))
  - 次要文字: oklch(0.35 0.01 var(--hue))
  - 分割线: oklch(0.85 0.01 var(--hue))
- 暗色模式：
  - 页面背景: oklch(0.08 0 0)
  - 主文字: oklch(0.90 0 0)
  - 主色调: oklch(0.85 0 0)

## 3. 布局结构
- 三栏网格布局：左侧栏(17.5rem) | 主内容区(1fr) | 右侧栏(17.5rem)
- 页面最大宽度：100rem
- 响应式断点：
  - 桌面端 (>=1024px)：三栏布局
  - 平板端 (768-1023px)：双栏布局，右侧栏隐藏
  - 移动端 (<768px)：单栏布局，侧栏隐藏

## 4. 卡片设计
- 圆角：--radius-large: 0.875rem
- 边框：1px solid var(--line-divider)
- 悬停效果：边框色变为主题色25%透明度
- 列表模式：水平卡片，封面图在右侧
- 网格模式：自适应列宽，最小320px

## 5. 侧边栏组件
### 左侧栏
- 个人资料卡片（头像、名称、简介、社交链接）
- 公告组件
- 音乐播放器
- 分类列表
- 标签云

### 右侧栏
- 站点统计（文章数、分类数、标签数、总字数）
- 站点信息（构建平台、博客版本、许可协议）
- 日历组件
- 文章目录（TOC）

## 6. 导航栏
- 粘性定位（sticky）
- 高度：3.5rem
- 支持透明模式和模糊效果
- Logo + 标题 + 菜单项

## 7. 字体
- 正文字体：Roboto, ui-sans-serif, system-ui, sans-serif
- 等宽字体：Fira Code, ui-monospace, monospace
- 图标：Material Symbols Outlined

## 8. 动效
- 过渡时长：--duration-fast: 0.15s, --duration-medium: 0.3s
- 樱花飘落特效
- 打字机效果
- 波浪效果
- 卡片悬停动画

## 9. Material You 设计令牌
- --md-sys-color-primary-container: oklch(0.88 0.08 var(--hue))
- --md-sys-color-on-primary-container: oklch(0.25 0.06 var(--hue))
- --md-sys-color-surface-variant: oklch(0.93 0.02 var(--hue))
- --md-shape-corner-full: 12px
- --md-shape-corner-large: 14px

## 10. 文章卡片结构
```html
<article class="post-card-item card-base">
  <div class="post-card-cover">封面图</div>
  <div class="post-card-content">
    <h2 class="post-card-title">标题</h2>
    <div class="post-card-meta">日期 | 分类</div>
    <p class="post-card-excerpt">摘要</p>
    <div class="post-card-footer">标签 | 阅读时间</div>
  </div>
</article>
```

## 11. 与当前项目的差异
- 当前项目使用中性灰阶（无色相），Firefly使用hue-based色彩
- 当前项目为单栏布局，Firefly为三栏布局
- 当前项目页面宽度64rem，Firefly为100rem
- 需要恢复OKLCH色彩空间中的chroma值
