# 目录

[前言：为什么写这本书](./preface.md)
[学习路线图与如何使用本书](./roadmap.md)

---

# 第零部分 · 准备启程

- [第 1 章 Tauri 是什么，和 Electron 有什么区别](./ch01-what-is-tauri.md)
- [第 2 章 开发环境全套搭建（Rust / Node / Tauri CLI / VS Code）](./ch02-setup.md)
- [第 3 章 零基础前端速成：HTML / CSS 核心](./ch03-html-css.md)
- [第 4 章 零基础前端速成：JavaScript + TypeScript](./ch04-js-ts.md)
- [第 5 章 React 入门：组件、状态、Hooks、事件](./ch05-react.md)
- [第 6 章 Tailwind CSS 工程化用法](./ch06-tailwind.md)
- [第 7 章 Rust 关键点速览（面向 Tauri）](./ch07-rust-essentials.md)

# 第一部分 · Tauri 核心

- [第 8 章 Tauri 架构解剖：三进程模型与 WebView](./ch08-architecture.md)
- [第 9 章 创建第一个 Tauri 应用（`create-tauri-app`）](./ch09-hello-tauri.md)
- [第 10 章 项目工程化与目录规范](./ch10-project-structure.md)
- [第 11 章 前后端通信 1：Commands（invoke）](./ch11-commands.md)
- [第 12 章 前后端通信 2：Events（emit / listen）](./ch12-events.md)
- [第 13 章 Tauri 2.x 权限与能力系统（Capabilities/ACL）](./ch13-capabilities.md)
- [第 14 章 窗口、菜单与系统托盘](./ch14-window-menu-tray.md)
- [第 15 章 全局快捷键与单实例](./ch15-shortcuts-single-instance.md)
- [第 16 章 状态管理与并发：`State` + `async` + `Mutex`](./ch16-state-concurrency.md)
- [第 17 章 文件系统、路径与应用数据目录](./ch17-fs-path.md)
- [第 18 章 HTTP 客户端与 API 调用（`reqwest` + `tokio`）](./ch18-http-client.md)
- [第 19 章 数据库持久化：SQLite + `sqlx` + 迁移](./ch19-sqlite-sqlx.md)
- [第 20 章 日志、错误处理与崩溃上报](./ch20-logging-error.md)

# 第二部分 · CloudTone 项目实战

- [第 21 章 产品设计与架构:CloudTone 的全貌](./ch21-product-design.md)
- [第 22 章 搭建项目骨架（Vite + React + Tauri 2 + Tailwind）](./ch22-bootstrap-project.md)
- [第 23 章 设计系统与布局：仿网易云的三栏结构](./ch23-layout-design-system.md)
- [第 24 章 路由、主题、暗色模式](./ch24-router-theme.md)
- [第 25 章 状态管理：Zustand + TanStack Query](./ch25-zustand-query.md)
- [第 26 章 Rust 音频引擎 1：`symphonia` 解码 + `cpal` 输出](./ch26-audio-engine-1.md)
- [第 27 章 Rust 音频引擎 2：播放控制、seek、音量、淡入淡出](./ch27-audio-engine-2.md)
- [第 28 章 本地音乐库扫描与元数据（`lofty` / `walkdir`）](./ch28-library-scan.md)
- [第 29 章 数据库 Schema：歌曲 / 专辑 / 艺人 / 歌单 / 播放历史](./ch29-db-schema.md)
- [第 30 章 播放队列、随机、循环、记忆播放](./ch30-playqueue.md)
- [第 31 章 歌词：LRC 解析与滚动同步](./ch31-lyrics.md)
- [第 32 章 专辑封面、缓存与 `custom://` 协议](./ch32-covers-protocol.md)
- [第 33 章 搜索：本地全文索引与在线搜索](./ch33-search.md)
- [第 34 章 歌单 CRUD 与拖拽排序](./ch34-playlists.md)
- [第 35 章 收藏、最近播放、每日推荐](./ch35-favorites.md)
- [第 36 章 迷你播放器、桌面歌词悬浮窗](./ch36-mini-lyric.md)
- [第 37 章 全局媒体键与 OS 媒体中心集成](./ch37-media-keys.md)
- [第 38 章 在线音源适配层（可插拔 Provider）](./ch38-provider.md)
- [第 39 章 下载管理、断点续传、缓存策略](./ch39-download.md)
- [第 40 章 均衡器（EQ）与音效处理](./ch40-equalizer.md)
- [第 41 章 国际化 i18n 与字体加载](./ch41-i18n.md)
- [第 42 章 插件系统设计（动态加载自定义 Provider）](./ch42-plugins.md)
- [第 43 章 自动更新（`tauri-plugin-updater` + 签名）](./ch43-updater.md)
- [第 44 章 性能优化：虚拟列表、懒加载、包体积](./ch44-performance.md)
- [第 45 章 测试：Rust 单测 + React 组件测试 + E2E](./ch45-testing.md)
- [第 46 章 CI/CD 多平台打包与代码签名（macOS/Win/Linux）](./ch46-cicd.md)
- [第 47 章 发布、分发、监控与错误上报](./ch47-release.md)

# 第三部分 · 迈向高级

- [第 48 章 源码阅读清单：Tauri / Tokio / Symphonia / Rodio](./ch48-reading.md)
- [第 49 章 高级话题：Sidecar / 嵌入 Python / 原生菜单 / Webview 注入](./ch49-advanced.md)
- [第 50 章 面试准备与职业规划](./ch50-career.md)

---

[附录 A · 常见问题 FAQ](./appendix-a-faq.md)
[附录 B · 推荐资源与社区](./appendix-b-resources.md)
[附录 C · CloudTone 项目完整代码索引](./appendix-c-code-index.md)
