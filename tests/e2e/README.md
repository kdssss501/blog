# 端到端测试

该目录保存基于 Playwright 的浏览器回归脚本。所有脚本都从项目根目录执行，例如：

```bash
node tests/e2e/test-swup-navigation.mjs
```

新增测试应覆盖可观察行为，不要依赖构建产物中的哈希文件名。测试截图和临时报告不应提交到仓库。

`routes-smoke.mjs` 默认检查主要公开路由、横向溢出、浏览器运行时错误，以及桌面/移动应用壳的搜索与显示工具入口。可通过 `E2E_BASE_URL` 指向预览服务器，通过 `PLAYWRIGHT_BROWSER` 指定浏览器可执行文件。

`visual-smoke.mjs` 保存桌面/移动应用壳和音乐画布截图，并对 Three.js 画布执行非空像素检查。截图默认写入已忽略的 `test-results/visual`，可通过 `E2E_VISUAL_DIR` 更改。
