# 清译 · Clear Translate

Chrome / Edge 桌面端 Manifest V3 翻译扩展。当前基线是 **清译 V5 / 1.0.4**。

## 安装

1. 下载此仓库的 ZIP 并解压，或克隆仓库。
2. 打开 `chrome://extensions` 或 `edge://extensions`，开启开发者模式。
3. 加载已解压的扩展，选择仓库内的 **`extension/`** 文件夹。
4. 刷新网页。单击绿色“译”悬浮球翻译，再次单击恢复原文；悬停打开设置。

从旧版升级时可将新版 `extension/` 内容覆盖到原加载目录，重新加载扩展后刷新网页。不要同时启用两份清译。详细操作见 [安装与使用.txt](安装与使用.txt)。

## 功能与范围

- 自动识别外语并翻译为简体中文，保留原文；中文段落跳过。
- 正文内双语对照，滚动、新回复和动态内容跟译；字体、颜色、行高继承原页。
- 划词译文紧贴选区；悬浮球可拖动、隐藏，支持自动翻译外语网页。
- 菜单/按钮使用紧凑双语，过长标签通过悬停提示显示；支持二次弹框、popover、折叠区及 GitHub AnchoredOverlay。
- 输入提示文字可翻译，已填写的值保持原样。保留有身份标记的账号、作者和 GitHub 文件路径、当前分支。
- X 帖子、引用、链接摘要适配，中文化可读取的时间提示。
- 本地文字 PDF 原页与中文对照阅读；文件在本机解析，待译文字发送给所选服务。
- 已有字幕翻译为试用功能，支持 YouTube DOM 字幕及 YouTube/X 暴露的字幕轨道。

默认使用微软，可切换 Google 或腾讯消费级翻译入口，无需 API Key。免费服务可能限流、变化或误译；不承诺无限使用、高准确率或服务稳定性。腾讯使用逐段自动识别，部分语言可能不支持。本地 Translator API 模式目前仅英文，且取决于浏览器支持。

**未完成的验证和限制：**

- 公开 GitHub Code 菜单已实测；登录后的账号设置页主要通过对应结构回归，尚未直接实测。
- YouTube 实机播放遇到登录/机器人确认；公开 X 样例未暴露可读字幕。字幕轨道、时钟和 DOM 适配测试不能替代两平台完整验收。
- 不做无字幕语音识别或扫描 PDF OCR，不导出重新排版的译文 PDF。文字 PDF 当前最大 100 MB。
- 浏览器内部页、保护页、封闭 Shadow DOM 和跨域框架不能直接插入翻译；本仓库尚无手机/iOS 版。

## 开发与校验

开发环境建议 Node.js **22.13+**、Python **3.10+**。安装本扩展本身不需要 Node 或 Python。

```sh
npm ci --ignore-scripts --omit=optional
npm run check
npm test
python package-extension.py 清译_V5 --output-dir dist
```

打包输出为 `dist/清译_V5/` 和 `dist/清译_V5.zip`。同名目标已存在时脚本拒绝覆盖。原 Codex 工作区未指定 `--output-dir` 时仍沿用原 `outputs/` 位置；克隆仓库时请使用上面的显式参数。

```sh
npm run test:ui
```

UI 回归需要本机已有 Chromium，可用 `CLEAR_TRANSLATE_CHROMIUM` 指定可执行文件；不自动下载浏览器。测试在自建隔离 profile 中运行，数据留在忽略的 `work/` 目录，不使用个人浏览器资料。见 [tests/README.md](tests/README.md)。

GitHub CI 运行语法/入口检查、模块测试和打包。CI 不代表已完成登录网站、真实翻译网络或字幕平台验收。

## 工程约定

- `extension/` 是运行源码，`scripts/` 是检查入口，`tests/fixtures/` 是隔离回归页面。
- `package-extension.py` 从源码生成安装包，不手改生成物。
- `main` 的首次提交记录现有 V5 基线；此前版本没有真实 Git 历史，不补造历史提交。
- 后续修改使用独立、可审查的提交，不重写已发布的提交和标签。
- 本地浏览器 profile、依赖目录、凭据、截图和临时探测结果不提交。

项目代码暂未另行指定开源许可证；第三方组件保留各自许可证，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。公开仓库不等于另行授予代码使用许可。
