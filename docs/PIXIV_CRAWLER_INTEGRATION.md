# PixivCrawler 相册集成

博客通过 `/album/crawler/` 提供本地素材采集台。它是相册的辅助工具，不是部署到公网的爬虫服务。

## 运行边界

- 本地 `pnpm dev` 会检测 `PixivCrawler/.venv` 和 `run_crawler.py`，检测成功后允许启动任务。
- Vercel、Cloudflare 和生产模式只返回“仅限本机”，不会启动 Python 子进程。
- 写操作只接受回环地址、同源请求和相册采集台专用请求头。
- UI 不接收 Cookie、Token、代理地址或任意输出路径。
- 子进程不会继承 Pixiv Cookie、博客管理员 Token、AI Key 和 GitHub Token。

## 支持的任务

- 安全关键词：`keyword`，固定使用 safe 模式。
- 日榜：`ranking`，支持指定日期。
- 画师：`user`，只接受数字 UID。

单次最多采集 30 张。任务输出固定写入：

```text
PixivCrawler/downloads/album-inbox/<job-id>/
```

同一时间只运行一个任务，可在采集台停止。运行日志保存在内存中，只向页面返回最后 24 KB。

## 发布流程

1. 在采集台下载到 `album-inbox`。
2. 人工核对作者、作品页和使用许可。
3. 为允许公开的素材制作私有授权清单。
4. 使用 `pnpm artwork:import -- --manifest <清单> --apply` 转换图片并更新公开目录。
5. 将图片加入 `src/content/album/01-04` 对应相册，再运行 `pnpm assets:check`。

采集完成不等于获得公开发布许可，因此系统不会自动把新下载图片写入相册或文章封面池。

## 文章封面

文章列表、详情横幅和分享海报统一使用 `01-eva`、`02-wuthering-waves`、`03-mushoku-tensei`、`04-fate` 的授权图片。文章按排序位置轮换四个相册，相册内按文章 slug 稳定选图，避免列表和详情封面不一致。
