# 音乐可视化界面调整计划

> 日期：2026-07-09
> 状态：已对齐，待实施
> 范围：音乐可视化页面 `src/pages/music.astro` 内的歌词、右侧工具/歌单、底部进度控制 UI

## 一、目标

在不改变 3D 可视化背景、相机、场景透视、背景遮罩氛围的前提下，调整音乐界面控制层：

1. 左侧歌词取消倾斜，保持垂直平面展示。
2. 右侧取消歌单倾斜，改为工具态/歌单态同区切换。
3. 删除现有底部整条工具栏。
4. 底部保留细线式进度条，进度条左右分别放上一首/下一首。
5. 整体保持无边框、无背景框，不引入卡片容器。

## 二、明确约束

- 不改 `ThreeScene.svelte` 中的 camera、OrbitControls、renderer、shader、terrain、fog 等 3D 场景逻辑。
- 不改 `.music-visualizer::before` 的整体背景遮罩和视觉氛围，除非实现进度条避让时发现必须微调层级。
- 不改 `perspective` 以外的 3D 背景视觉参数。
- 取消倾斜只针对歌词层和右侧面板自身的 `rotateY(...) rotateX(...) translateZ(...)`。
- 音乐播放状态管理继续复用 `window.__fireflyMusic`，不改 `MusicManager.astro`。
- 不采用 TDD。本次以构建、类型检查和浏览器视觉验收为主。

## 三、当前结构

涉及文件：

| 文件 | 当前职责 |
|---|---|
| `src/components/features/music-visualizer/MusicVisualizer.svelte` | 挂载 3D 场景、歌词层、控制层 |
| `src/components/features/music-visualizer/LyricsOverlay.svelte` | 左侧歌词 DOM 和歌词高亮 |
| `src/components/features/music-visualizer/VisualizerControls.svelte` | 底部控制栏、右侧歌单面板、播放控制 |
| `src/styles/pages/music-visualizer.css` | 音乐可视化页面全部布局样式 |

当前倾斜来源：

- `.music-visualizer__lyrics-stage` 使用 `transform: rotateY(18deg) rotateX(4deg) translateZ(-36px)`。
- `.music-visualizer__playlist-stage` 使用 `transform: rotateY(-18deg) rotateX(4deg) translateZ(-36px)`。
- 两侧容器有 `perspective`，保留或弱化均可；实现时优先保留容器 `perspective`，只移除 stage 的旋转和 Z 位移。

## 四、目标布局

### 4.1 左侧歌词

左侧歌词继续常驻，位置和宽度基本沿用当前桌面布局：

- 容器仍为 `.music-visualizer__lyrics`。
- 歌词时间线、当前句高亮、已唱歌词弱化保留。
- 只把歌词内容从倾斜透视改为垂直平面。
- 当前高亮行的字号和发光效果保留，避免视觉变化过大。

### 4.2 右侧区域

右侧区域从单一歌单浮层改为同区切换：

```
右侧面板
├── 工具态（默认）
│   ├── 圆形唱片封面
│   ├── hover 播放/暂停按钮
│   └── 歌单切换 / 循环 / 音量
└── 歌单态
    ├── 当前歌单列表
    └── 返回工具态按钮（复用歌单切换按钮）
```

交互规则：

- 默认显示工具态。
- 点击歌单按钮：工具态和歌单态切换。
- 歌单态点击歌曲：播放对应歌曲，并保持歌单态，方便连续选歌。
- 播放/暂停按钮只在唱片 hover/focus 时显现。
- 唱片播放时旋转，暂停时停止。

### 4.3 底部进度条

删除 `.music-visualizer__controls` 现有整条工具栏结构，改成独立底部进度控制：

```
[上一首]  当前时间  =======进度线=======  总时长  [下一首]
```

视觉规则：

- 不使用背景框、边框、毛玻璃卡片。
- 进度线采用当前主题的青蓝到暖色渐变。
- 进度条可点击跳转。
- 上一首/下一首为图标按钮，不使用文字。
- 时间弱显示，避免抢过歌词和唱片。

## 五、组件改动计划

### 5.1 `VisualizerControls.svelte`

状态保留：

- `currentTrack`
- `playlist`
- `currentIndex`
- `isPlaying`
- `volume`
- `isMuted`
- `playMode`
- `currentTimeStr`
- `durationStr`
- `progress`

新增/调整状态：

- `rightPanelMode: "tools" | "playlist"`，默认 `"tools"`。
- 保留现有 `togglePlaylist()`，但语义改成切换 `rightPanelMode`。
- `syncPlaylistScroll()` 只在歌单态打开后执行。

DOM 调整：

- 删除现有底部大控制栏中的曲目信息、播放按钮组、音量组布局。
- 新增 `.music-visualizer__bottom-progress`，承载上一首、进度条、下一首。
- 新增 `.music-visualizer__side-panel`，承载工具态和歌单态。
- 将原 `<aside id="music-visualizer-playlist-panel">` 改为右侧面板内的歌单态内容，不再独立作为倾斜浮层。

保留方法：

- `togglePlay`
- `playNext`
- `playPrev`
- `cycleMode`
- `toggleMute`
- `onVolumeClick`
- `onProgressClick`
- `playTrack`
- `syncState`

### 5.2 `LyricsOverlay.svelte`

原则上不改组件逻辑，只在必要时补充 aria 或 class：

- 歌词数据同步逻辑保持不变。
- 高亮偏移逻辑保持不变。
- 若 CSS 改名需要，才做最小 DOM class 调整。

### 5.3 `music-visualizer.css`

主要 CSS 调整：

- `.music-visualizer__lyrics-stage`：移除 `rotateY/rotateX/translateZ`，保留相对定位、padding、时间线变量。
- `.music-visualizer__playlist-stage`：移除 `rotateY/rotateX/translateZ`，并改为右侧面板内部布局。
- 删除或停用 `.music-visualizer__controls` 的底部卡片样式。
- 新增唱片、工具按钮、右侧面板、底部进度条样式。
- 移动端样式跟随新 DOM 重写，避免旧底部控制栏规则残留。

## 六、CSS 类名草案

新增类名：

- `.music-visualizer__side-panel`
- `.music-visualizer__tools-panel`
- `.music-visualizer__record`
- `.music-visualizer__record-image`
- `.music-visualizer__record-placeholder`
- `.music-visualizer__record-overlay`
- `.music-visualizer__tool-row`
- `.music-visualizer__playlist-view`
- `.music-visualizer__bottom-progress`
- `.music-visualizer__bottom-progress-track`
- `.music-visualizer__bottom-progress-fill`

复用类名：

- `.music-visualizer__btn`
- `.music-visualizer__playlist-list`
- `.music-visualizer__playlist-item`
- `.music-visualizer__playlist-item--active`
- `.music-visualizer__playlist-cover`
- `.music-visualizer__playlist-meta`

## 七、响应式计划

桌面端 `min-width: 769px`：

- 左侧歌词保持左中位置。
- 右侧面板固定在右中位置。
- 底部进度条固定在底部安全区上方。

移动端 `max-width: 768px`：

- 歌词继续作为主体，取消倾斜。
- 右侧面板改为右下或下方紧凑工具区。
- 歌单态作为底部上浮列表，但仍避免明显背景框；必要时只使用轻微暗色渐变提升可读性。
- 音量条隐藏，只保留静音按钮。
- 底部进度条宽度收窄，按钮不挤压时间文本。

## 八、验收清单

- [ ] 左侧歌词不再倾斜，歌词流仍正常跟随当前播放行。
- [ ] 右侧歌单不再倾斜，工具态/歌单态可切换。
- [ ] 3D 背景、相机视角、地形动效不变。
- [ ] 现有底部工具栏消失。
- [ ] 底部只保留进度条，左右分别是上一首和下一首。
- [ ] 唱片封面播放时旋转，暂停时停止。
- [ ] 唱片 hover/focus 时显示播放/暂停按钮。
- [ ] 循环模式按钮可在列表循环、单曲循环、随机之间切换。
- [ ] 音量按钮和音量条可用，移动端不挤压布局。
- [ ] 歌单当前播放项高亮，点击歌曲可播放。
- [ ] 桌面和移动端无文本重叠、按钮重叠、进度条溢出。
- [ ] 无新增边框卡片或明显背景框。

## 九、验证方式

不使用 TDD。实施完成后使用以下验证：

1. `pnpm check`
2. `pnpm build`
3. 本地启动页面，检查 `/music/`
4. 浏览器桌面视口截图检查：歌词垂直、右侧工具/歌单、底部进度条
5. 浏览器移动视口截图检查：无重叠、按钮可点、歌词可读

## 十、实施顺序

1. 改造 `VisualizerControls.svelte` DOM：先拆出右侧面板和底部进度条。
2. 接入右侧 `tools/playlist` 切换状态。
3. 调整播放、循环、音量、歌单按钮事件绑定，确保复用原方法。
4. 修改 `music-visualizer.css`：先取消左右 stage 倾斜，再添加新面板和进度条样式。
5. 清理旧底部工具栏、旧歌单浮层相关样式。
6. 调整移动端媒体查询。
7. 运行构建检查和浏览器视觉验收。
