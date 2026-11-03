# 第三方组件

- **PDF.js / pdfjs-dist 6.4.299**：Mozilla PDF.js 项目，https://github.com/mozilla/pdf.js 。本仓库保留当前交付使用的 legacy 构建，位于 `extension/vendor/pdfjs/`；主许可证见该目录的 `LICENSE`。
- PDF.js 随附的字体、CMap、WASM 等资源的许可文件保留在各自子目录内，使用时一并遵守这些许可。
- 开发依赖的许可由其各自 npm 包提供，具体版本由 `package-lock.json` 锁定。开发工具不会放入浏览器安装包。

本次仓库初始化没有重新授权第三方组件，也没有为项目自身新增开源许可。
