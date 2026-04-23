# 附录 B 资源汇总

## 官方文档

- Tauri 2.0: <https://tauri.app/>
- Rust Book: <https://doc.rust-lang.org/book/>
- Tokio Tutorial: <https://tokio.rs/tokio/tutorial>
- React Docs (新版): <https://react.dev/>
- TypeScript Handbook: <https://www.typescriptlang.org/docs/handbook/>
- Tailwind CSS: <https://tailwindcss.com/docs>

## 关键 Crate

| 领域 | Crate | 用途 |
| --- | --- | --- |
| 异步 | tokio | async runtime |
| HTTP | reqwest | 客户端 |
| 数据库 | sqlx | SQLite/Postgres/MySQL 异步驱动 |
| 音频解码 | symphonia | mp3/flac/aac/ogg |
| 音频输出 | cpal | 跨平台音频 I/O |
| 元数据 | lofty | ID3/FLAC/Vorbis |
| 哈希 | blake3 | 文件指纹 |
| 目录遍历 | walkdir | 递归扫描 |
| 文件监听 | notify / notify-debouncer-full | 库变化实时同步 |
| 日志 | tracing / tracing-subscriber | 结构化日志 |
| 错误 | thiserror / anyhow | 错误定义与组合 |
| 序列化 | serde / serde_json | JSON / 其他格式 |
| 重采样 | rubato | 音频采样率转换 |
| 系统媒体 | souvlaki | mac/win/linux 媒体中心 |

## Tauri 插件（Tauri 2）

- `tauri-plugin-fs`
- `tauri-plugin-http`
- `tauri-plugin-sql`
- `tauri-plugin-log`
- `tauri-plugin-dialog`
- `tauri-plugin-global-shortcut`
- `tauri-plugin-single-instance`
- `tauri-plugin-updater`
- `tauri-plugin-notification`
- `tauri-plugin-shell`
- `tauri-plugin-window-state`

## 前端库

| 类别 | 库 |
| --- | --- |
| UI | shadcn/ui, Radix, Headless UI |
| 状态 | Zustand, Jotai, Valtio |
| 数据 | TanStack Query / Router / Virtual / Table |
| 表单 | React Hook Form, Zod |
| 路由 | React Router, TanStack Router |
| 图标 | lucide-react |
| 动画 | framer-motion |
| 拖拽 | @dnd-kit |
| i18n | react-i18next |
| 测试 | Vitest, Testing Library, Playwright |

## 社群与交流

- Tauri Discord: <https://discord.com/invite/tauri>
- Tauri GitHub Discussions: <https://github.com/tauri-apps/tauri/discussions>
- Rust 中文社区: <https://rustcc.cn/>
- Awesome Tauri: <https://github.com/tauri-apps/awesome-tauri>

## 学习项目推荐

- `tauri-apps/create-tauri-app`：官方模板
- `tauri-apps/plugins-workspace`：看插件源码学 API
- 开源 Tauri App：OrchidApp、Pot、Spacedrive、Astral、Rerun

## 书籍

- 《Programming Rust, 2nd》
- 《Rust for Rustaceans》
- 《Designing Data-Intensive Applications》
- 《High Performance Browser Networking》
- 《The Pragmatic Programmer》

## 博客 / YouTube

- tauri.app/blog
- Logan Smith (Rust)
- Let's Get Rusty
- Theo (fullstack views)
- Fireship (fast overviews)

## 工具

- [cargo-expand](https://github.com/dtolnay/cargo-expand)：看宏展开
- [cargo-bloat](https://github.com/RazrFalcon/cargo-bloat)：分析二进制体积
- [cargo-watch](https://github.com/watchexec/cargo-watch)
- [sccache](https://github.com/mozilla/sccache)
- [vite-bundle-visualizer](https://github.com/btd/rollup-plugin-visualizer)
- [hyperfine](https://github.com/sharkdp/hyperfine)：基准测试
