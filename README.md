# 从零到高级：Tauri 2.x 工程实战

> 用 Rust + React 打造 CloudTone 音乐播放器，系统掌握 Tauri 2.x 跨平台桌面开发。

[![Deploy mdBook](https://github.com/zhenbodou/tauri_claude_tutorial/actions/workflows/deploy.yml/badge.svg)](https://github.com/zhenbodou/tauri_claude_tutorial/actions/workflows/deploy.yml)

## 在线阅读

**👉 [https://zhenbodou.github.io/tauri_claude_tutorial/](https://zhenbodou.github.io/tauri_claude_tutorial/)**

## 关于本书

- **目标读者**：熟悉 Rust、零前端基础，想系统学习 Tauri 2.x 的工程师
- **贯穿项目**：**CloudTone 云音** —— 跨平台桌面音乐播放器
- **技术栈**：Tauri 2.x + Rust + React 18 + TypeScript + Tailwind CSS
- **篇幅**：共 50 章 + 3 个附录，约 30 万字，全中文
- **深度**：覆盖 Tauri 核心、音频解码、数据库、插件系统、自动更新、CI/CD、签名公证等生产级话题

## 仓库结构

```
tauri_tutorial/
├── tauri-master-book/       # mdbook 源码（书）
│   ├── book.toml
│   └── src/
│       ├── SUMMARY.md
│       ├── ch01-...md
│       └── ...
├── cloudtone-starter/       # CloudTone 项目脚手架（代码）
│   ├── package.json
│   ├── src/                 # React 前端
│   └── src-tauri/           # Rust 后端
└── .github/workflows/
    └── deploy.yml           # GitHub Actions：自动构建并部署到 Pages
```

## 本地构建本书

```bash
# 1. 安装 mdBook
cargo install mdbook
# 或者下载预编译二进制：https://github.com/rust-lang/mdBook/releases

# 2. 进入书目录
cd tauri-master-book

# 3. 本地预览（热更新，默认 http://localhost:3000）
mdbook serve --open

# 4. 构建静态 HTML，输出到 tauri-master-book/book/
mdbook build
```

## 本地运行 CloudTone 脚手架

```bash
cd cloudtone-starter
pnpm install
pnpm tauri dev
```

需要先按照 [Tauri 官方指南](https://tauri.app/start/prerequisites/) 安装 Rust toolchain 与系统依赖。

## 内容大纲

- **第零部分** 准备启程（Ch 1–7）：Tauri 全貌、环境搭建、前端三件套（HTML/CSS、JS/TS、React、Tailwind）、Rust 在 Tauri 场景下的要点
- **第一部分** Tauri 核心（Ch 8–20）：架构、Commands、Events、State、Capabilities/ACL、插件、WebView、窗口、菜单、托盘、Sidecar、IPC 性能、tauri-specta
- **第二部分** CloudTone 实战（Ch 21–47）：项目架构、数据库、音频播放、搜索、歌单、mini-player、媒体键、下载、均衡器、i18n、插件系统、自动更新、性能、测试、CI/CD、监控
- **第三部分** 迈向高级（Ch 48–50）：源码阅读路线、进阶话题、职业路径
- **附录** A. 快速参考 / B. 故障排查 / C. CloudTone 代码索引

## 许可证

本书采用 CC BY-NC-SA 4.0 协议；示例代码采用 MIT 协议。
