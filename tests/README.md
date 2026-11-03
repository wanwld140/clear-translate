# 回归测试范围

- `npm test`：当前 13 项实际模块测试，覆盖三源请求/解析、批量映射、取消/限流、日期、文字体系判断和 PDF 文本分段。
- `npm run check`：检查项目/扩展版本、运行入口文件和源码 JS 语法。
- `npm run test:ui`：使用已安装的 Chromium，在隔离扩展环境和虚拟 GitHub 页面中检查菜单边界、原文本节点/点击、二次 dialog、popover、details、placeholder、恢复及关闭后的迟到结果。

UI 测试不连接翻译服务，使用翻译响应替身。它不证明译文准确率、真实 GitHub 登录态或视频平台可用性。CI 当前只运行模块/语法/打包检查，未运行此浏览器回归。

可用 `CLEAR_TRANSLATE_CHROMIUM` 指定本机 Chromium/Chrome 可执行文件；测试不改个人浏览器设置，不自动下载浏览器。隔离 profile 留在被 Git 忽略的 `work/ui-regression-*`，测试结束关闭浏览器；不要将这些资料提交到仓库。

`fixtures/` 中另含 X 正文与通用隐藏内容的结构页面。它们用于隔离的浏览器路由；直接用本地 URL 预览时，不会触发 GitHub/X 的站点专用逻辑。HTML fixture 不等于对应站点的实机验收。
