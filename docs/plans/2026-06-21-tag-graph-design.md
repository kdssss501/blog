# 分类标签页标签关系图谱设计

> 本方案将分类标签页的标签层从卡片墙替换为 ECharts Graph 关系图。评审重点：标签共现算法是否满足“共同出现 2 次以上才连线”，以及节点弹窗的数据结构是否能支持分页文章列表。目标：不改分类层，仅改标签层。

## 背景

当前 `src/pages/categories.astro` 使用 `CategoryRose` 渲染分类层，使用 `TagCardWall` 渲染标签层。标签层只展示标签名称和文章数，不能表达标签之间的内容关联。

本次只修改标签层。分类层 `CategoryRose`、分类数据结构、分类 URL 规则保持不变。

参考样式为 ECharts 官方示例 `Graph Webkit Dep / WebKit 模块关系依赖图`。该示例使用 `series.type = "graph"`、`layout = "force"`、`roam = true`、`draggable = true` 表达模块依赖关系。

参考资料：

- [Apache ECharts Graph Webkit Dep 示例](https://echarts.apache.org/examples/en/editor.html?c=graph-webkit-dep)
- [graph-webkit-dep.ts 示例源码](https://echarts.apache.org/examples/examples/ts/graph-webkit-dep.ts)

## 目标

1. 标签层展示为关系图 graph，而不是卡片墙。
2. 图中显示全部标签节点，包括没有连线的孤立标签。
3. 两个标签在至少 2 篇文章中共同出现时生成连线。
4. 节点大小体现标签文章数。
5. 连线粗细或透明度体现标签共现次数。
6. 点击节点打开弹窗，不直接跳转。
7. 弹窗结构固定为：标题、文章总数、分割线、文章列表、分页控件。
8. 弹窗文章列表按发布时间倒序，每页显示 5 篇。

## 非目标

1. 不修改分类层 `CategoryRose`。
2. 不调整归档页标签筛选能力。
3. 不新增标签详情页。
4. 不把分类也纳入关系图。
5. 不在本次实现标签搜索、图谱导出、图谱布局持久化。

## 方案选择

| 方案 | 内容 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A | Astro 构建期预计算标签图谱数据，前端只渲染图表和弹窗 | 运行时计算少，数据结构清晰，便于测试 | 需要新增工具函数和组件 | 采用 |
| B | 改造现有 `TagBubble.astro` | 初始改动少 | 气泡图和关系图职责混合，维护成本增加 | 不采用 |
| C | 浏览器端计算共现关系 | 工具函数改动少 | 页面运行时计算增加，文章元数据暴露更多 | 不采用 |

选择 A。该方案符合 Astro 静态内容站点的现有数据流：内容层在构建期可用，页面组件接收结构化数据后渲染。

## 页面结构

`src/pages/categories.astro` 保持页面骨架不变，只替换标签层组件。

```astro
<CategoryRose categories={categories} />

<div class="categories-page__divider"></div>
<TagGraph graph={tagGraph} />
```

页面数据入口从 `getTagList()` 扩展为 `getTagGraphData()`。如果其他位置仍需要普通标签列表，保留 `getTagList()`。

[配图：标签图谱数据流与页面渲染关系]

## 数据结构

新增标签图谱数据类型，建议放在 `src/utils/content-utils.ts`。

```ts
export type TagGraphPost = {
  title: string;
  url: string;
  published: string;
};

export type TagGraphNode = {
  id: string;
  name: string;
  value: number;
  url: string;
  posts: TagGraphPost[];
};

export type TagGraphLink = {
  source: string;
  target: string;
  value: number;
};

export type TagGraphData = {
  nodes: TagGraphNode[];
  links: TagGraphLink[];
  threshold: number;
};
```

字段说明：

| 字段 | 来源 | 用途 |
|---|---|---|
| `node.id` | 标签名 trim 后的原始值 | ECharts 节点和边引用 |
| `node.name` | 标签展示名 | 图谱 label 和弹窗标题 |
| `node.value` | 包含该标签的文章数 | 节点尺寸计算 |
| `node.url` | `getTagUrl(tag)` | 弹窗内可提供“查看全部”入口 |
| `node.posts` | 该标签文章列表 | 弹窗列表和分页 |
| `link.value` | 两个标签共同出现的文章数 | 连线显示权重 |
| `threshold` | 固定值 `2` | 调试和后续配置化 |

## 共现算法

算法输入为 `getAllPosts()` 返回的文章集合。生产环境沿用现有规则：`draft: true` 的文章不参与统计；开发环境包含草稿，保持与当前 `getTagList()` 行为一致。

步骤：

1. 遍历文章，读取 `post.data.tags`。
2. 对单篇文章的标签执行 `trim()`，过滤空值，并使用 `Set` 去重，避免同一篇文章重复标签导致重复计数。
3. 为每个标签累计文章列表。
4. 对单篇文章内的标签集合生成无向组合 `(tagA, tagB)`。
5. 使用稳定 key 记录组合次数：按 `localeCompare` 排序后拼接。
6. 遍历组合计数，保留 `count >= 2` 的组合生成 `links`。
7. 节点按文章数降序输出；文章列表按 `published` 降序输出。
8. 边按共现次数降序输出。

伪代码：

```ts
for (const post of posts) {
  const tags = uniqueNormalizedTags(post.data.tags);

  for (const tag of tags) {
    tagMap[tag].posts.push(postMeta);
  }

  for (const [a, b] of tagPairs(tags)) {
    pairMap[stablePairKey(a, b)] += 1;
  }
}

links = pairMap
  .filter((pair) => pair.count >= 2)
  .map((pair) => ({ source: pair.a, target: pair.b, value: pair.count }));
```

复杂度：单篇文章有 `k` 个标签时，组合数量为 `k * (k - 1) / 2`。当前文章标签数量通常小于 10，该计算量可接受。

## 图谱渲染

新增 `src/components/widget/TagGraph.astro`。组件接收 `TagGraphData`，将图表数据序列化到 DOM `data-graph` 属性，由内联脚本初始化 ECharts。

ECharts 配置要点：

```js
series: [{
  type: "graph",
  layout: "force",
  roam: true,
  roamTrigger: "global",
  draggable: true,
  label: {
    show: true,
    position: "right",
    formatter: "{b}"
  },
  force: {
    edgeLength: [40, 140],
    repulsion: 120,
    gravity: 0.08,
    layoutAnimation: true
  },
  emphasis: {
    focus: "adjacency"
  },
  data: nodes,
  links: links
}]
```

显示规则：

| 对象 | 规则 |
|---|---|
| 节点尺寸 | 根据 `value` 映射到 18-72 px |
| 节点颜色 | 使用站点主题色和固定调色板，不使用单一色系 |
| 节点标签 | 默认展示标签名 |
| 连线宽度 | 根据 `link.value` 映射到 1-5 px |
| 连线透明度 | 共现次数越高透明度越高 |
| 孤立节点 | 保留展示，无连线 |

组件需复用现有 ECharts 生命周期模式：

1. 使用 `data-echarts-initialized` 防止重复初始化。
2. 监听 `resize` 执行 `chart.resize()`。
3. 使用 `MutationObserver` 响应暗色模式切换。
4. 在 `swup:willReplaceContent` 中移除监听器、断开 observer、`chart.dispose()`。
5. 同时监听首次加载和 `astro:page-load`。

## 弹窗交互

点击节点打开标签详情弹窗。点击边不打开弹窗，仅保留 tooltip 或邻接高亮。

弹窗结构：

```text
标签名
N 篇文章
----------------
最近几篇
1. 文章标题
2. 文章标题
3. 文章标题
4. 文章标题
5. 文章标题
<  1/3  >
```

交互规则：

| 操作 | 行为 |
|---|---|
| 点击节点 | 打开弹窗，页码重置为第 1 页 |
| 点击文章标题 | 跳转到文章详情页 |
| 点击关闭按钮 | 关闭弹窗 |
| 点击遮罩 | 关闭弹窗 |
| 按 `Escape` | 关闭弹窗 |
| 点击上一页/下一页 | 切换 5 篇文章分页 |
| 文章数 `<= 5` | 不显示分页控件 |

弹窗视觉参考用户提供截图：深色半透明背景、细边框、标题层、文章数层、分割线、列表和底部分页。浅色主题需提供可读样式。

## 样式调整

样式放在 `src/styles/pages/categories.css`，使用 `tag-graph` 前缀，避免影响侧边栏标签组件和归档页标签筛选。

新增主要 class：

```css
.tag-graph
.tag-graph__chart
.tag-graph-modal
.tag-graph-modal__panel
.tag-graph-modal__title
.tag-graph-modal__count
.tag-graph-modal__list
.tag-graph-modal__pager
```

尺寸要求：

| 视口 | 图谱高度 |
|---|---|
| `>= 1024px` | 620 px |
| `768-1023px` | 520 px |
| `< 768px` | 420 px |
| `< 480px` | 360 px |

弹窗在移动端宽度使用 `calc(100vw - 2rem)`，最大宽度 520 px。文章标题需要 `overflow-wrap: anywhere` 或等效规则，避免长标题溢出。

## 可访问性

1. 弹窗使用 `role="dialog"` 和 `aria-modal="true"`。
2. 关闭按钮有明确 `aria-label`。
3. 打开弹窗时将焦点移动到关闭按钮或弹窗容器。
4. 关闭弹窗后将焦点还给触发节点对应的图表容器。
5. 分页按钮禁用状态使用 `disabled`。

ECharts canvas 内部节点不是原生可聚焦元素。本次最低要求是鼠标和触摸可用；键盘逐节点导航不纳入本次范围。

## 测试计划

### 单元测试

为共现算法补充测试，覆盖以下场景：

1. 两个标签共同出现 1 次，不生成连线。
2. 两个标签共同出现 2 次，生成 1 条连线，`value = 2`。
3. 单篇文章内重复标签只计 1 次。
4. 没有连线的标签仍出现在 `nodes`。
5. 节点文章列表按发布时间倒序。

如果项目当前没有针对 `content-utils.ts` 的测试环境，至少新增纯函数并用脚本或轻量测试验证算法输出。

### 构建验证

执行：

```bash
pnpm type-check
pnpm build
```

验收项：

1. `/categories/` 页面构建成功。
2. 标签图谱显示全部标签节点。
3. 共现次数小于 2 的标签组合没有连线。
4. 点击节点弹出详情弹窗。
5. 弹窗分页每页显示 5 篇文章。
6. 暗色和浅色主题下文字、边框、连线可读。
7. Swup 页面切换后图表不会重复初始化。

## 风险

**P1 风险：标签数量增加导致图谱拥挤。**  
影响：标签超过 80 个时，移动端节点标签可能互相遮挡，图谱可读性下降。  
应对：保留全量节点；通过 `roam`、缩放、拖拽和较高 `repulsion` 缓解。若后续标签超过 120 个，再评估增加标签搜索或按文章数过滤。

**P1 风险：ECharts CDN 与 package 版本不一致。**  
影响：当前组件动态加载 `echarts@5.6.0`，`package.json` 中为 `echarts@6.1.0`。不同版本可能导致 `thumbnail` 或部分配置行为不一致。  
应对：本次优先沿用现有 CDN 加载方式，避免改变全站图表加载策略；不依赖 ECharts 6 专属配置。

**P2 风险：弹窗和图表事件重复绑定。**  
影响：Swup 多次导航后可能出现重复弹窗、重复 resize 或内存增长。  
应对：沿用 `data-echarts-initialized`、命名清理函数、`swup:willReplaceContent` 释放实例。

**P2 风险：标签名大小写导致重复节点。**  
影响：`ai` 和 `AI` 会显示为两个节点，关系被拆分。  
应对：本次保持当前 `getTagList()` 的大小写语义，不做合并。若后续需要归一化，应单独设计迁移规则，避免改变现有 URL 行为。

## 实施步骤

1. 在 `content-utils.ts` 增加 `getTagGraphData()` 和相关类型。
2. 新建 `TagGraph.astro`，实现图谱容器、弹窗 DOM、ECharts 初始化和事件处理。
3. 修改 `categories.astro`，将 `TagCardWall` 替换为 `TagGraph`。
4. 在 `categories.css` 增加 `tag-graph` 相关样式。
5. 添加共现算法测试或验证脚本。
6. 执行 `pnpm type-check` 和 `pnpm build`。

## 验收标准

1. 分类层视觉和行为不变。
2. 标签层不再显示卡片墙。
3. 所有标签均显示为图谱节点。
4. 只有共同出现次数 `>= 2` 的标签组合显示连线。
5. 点击任意标签节点打开弹窗。
6. 弹窗展示标签名、文章总数、分割线、文章列表。
7. 超过 5 篇文章时分页可用。
8. 页面切换和主题切换后图谱仍正常显示。
