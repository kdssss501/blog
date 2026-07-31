# 插图资源规范

## 允许来源

- 站长原创或明确拥有再发布权的图片。
- 画师书面授权用于本站展示的作品。
- 官方明确许可转载的宣传素材。

Pixiv 仅作为原作来源和署名链接，不作为匿名爬取图库。不得绕过登录、防盗链或访问限制，不得把未知许可的原图提交到仓库或对象存储。主题匹配不能替代作者授权。

## 主题优先级

插图优先围绕鸣潮、命运王座、EVA、Re:Zero、无职转生。主题只用于内容筛选，不代表作品版权许可。

## Frontmatter

使用外部插图时填写：

```yaml
image: /assets/illustrations/example.webp
imageAttribution:
  artist: 画师名称
  sourceUrl: https://www.pixiv.net/artworks/00000000
  license: 画师授权用于本站展示
  permission: artist-authorized
  theme: 鸣潮
```

`permission` 只允许 `artist-authorized`、`official-license`、`self-owned`。`image` 必须指向仓库中的授权副本或允许热链的非 Pixiv 地址；任何 `pixiv.net`、`pximg.net` 图片热链都会被内容 schema 阻止构建。

## Pixiv 授权导入流程

1. 记录 Pixiv 作品 ID、画师名和原作页，并取得允许在本博客展示与缓存副本的明确授权。
2. 通过画师允许的下载方式取得文件，不使用 Cookie、Token 或绕过访问控制的爬虫。
3. 在仓库外建立私有授权清单，授权证明只写站长档案引用，不提交聊天截图、邮件或本地绝对路径。
4. 先运行 `pnpm artwork:import -- --manifest <清单路径>` 检查；确认输出后增加 `--apply`。工具只读取已经合法取得的本地文件，不登录或抓取 Pixiv。
5. 工具会去除元数据、限制最长边为 2560px、转换为 WebP，并写入 `public/assets/illustrations/<theme>/`。公开 `catalog.json` 只保留署名、许可、尺寸和文件摘要。
6. 将工具输出的 `image` 和 `imageAttribution` 写入文章 Frontmatter。
7. 运行 `pnpm assets:check`、`pnpm check` 和 `pnpm build`；孤立文件、缺失文件、摘要变化、缺少字段或 Pixiv 热链都会失败。

私有授权清单格式：

```json
{
  "version": 1,
  "items": [
    {
      "artworkId": "00000000",
      "page": 0,
      "artist": "画师名称",
      "sourceUrl": "https://www.pixiv.net/artworks/00000000",
      "license": "画师授权用于本站展示",
      "permission": "artist-authorized",
      "theme": "鸣潮",
      "alt": "插图中可见内容的简短描述",
      "sourceFile": "C:/private/00000000.png",
      "permissionEvidence": "站长私有档案中的授权记录编号"
    }
  ]
}
```

仓库忽略 `.artwork-import*.json`，但仍建议把授权清单和证明保存在仓库外。`permissionEvidence` 只是强制站长确认已经留档，不会写入公开目录。

在画师授权与具体作品清单提供前，鸣潮、命运王座、EVA、Re:Zero、无职转生只作为选图优先级，不自动下载作品。
