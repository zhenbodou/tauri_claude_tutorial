# 第 48 章 源码阅读清单：Tauri / Tokio / Symphonia / Rodio

## 本章目标

从"会用库"到"懂原理"。给出一份有序的源码阅读地图，每个项目说明**看什么、怎么看、收获什么**。

## 一、为什么要读源码

- Debug 时能直达根因，而不是猜。
- 写业务代码时更有品味（错误处理、API 设计）。
- 面试时能讲"我读过它的 XX 模块"远胜空谈。

## 二、阅读方法

1. **从 examples 入手**：官方示例是最精炼的入口。
2. **自底向上**：从最底层类型（`struct`、`enum`）开始，看字段和方法签名。
3. **画模块图**：模块 → 子模块 → 关键类型，用白板或 markdown。
4. **标"你会改"的位置**：想象自己要加一个功能，问"我得改哪里？"。
5. **带着问题读**：比如"Channel 怎么实现背压"，而不是通读。

## 三、Tauri

仓库：<https://github.com/tauri-apps/tauri>

建议路线：

- `crates/tauri/src/app.rs`：`App` / `Manager` 初始化链。
- `crates/tauri/src/ipc/`：命令 invoke 的解析、序列化。
- `crates/tauri/src/webview/mod.rs`：WebviewWindow 怎么 wrap wry。
- `crates/tauri/src/manager/event.rs`：emit / listen 实现，消息分发。
- `crates/tauri/src/protocol/`：内置和自定义 URI scheme 的匹配链。

关键问题：

- `#[tauri::command]` 宏展开成什么？（用 `cargo expand`）
- `State<'_, T>` 如何在 invoke 里注入？

## 四、Wry & Tao

仓库：<https://github.com/tauri-apps/wry>，<https://github.com/tauri-apps/tao>

- Wry = 跨平台 WebView。看 `src/webview2/` (Windows)、`src/wkwebview/` (macOS)、`src/webkit2gtk/` (Linux)。
- Tao = 跨平台窗口。和 `winit` 有分歧，专门服务 Tauri。

收获：理解三平台原生 WebView 的差异和统一抽象。

## 五、Tokio

仓库：<https://github.com/tokio-rs/tokio>

- `tokio/src/runtime/`：多线程调度器核心。
- `tokio/src/sync/mpsc/`：最常用的 channel。
- `tokio/src/io/util/`：`AsyncReadExt` 等扩展 trait。

建议：通读一次 `runtime::task::harness` 模块，理解 future 怎么被 poll。

## 六、Symphonia

仓库：<https://github.com/pdeljanov/Symphonia>

- `symphonia-core/src/formats/`：抽象 Format/Track/Packet。
- `symphonia-bundle-mp3/`：完整 mp3 解码路径。
- `examples/symphonia-play/`：最完整的参考播放器，值得逐行看。

收获：音频解码的完整管线——demux → decode → resample → output。

## 七、Rodio

仓库：<https://github.com/RustAudio/rodio>

- `src/source.rs`：`Source` trait 的组合器模式（像迭代器）。
- `src/sink.rs`：播放句柄，控制 play/pause/stop。
- `src/decoder/`：基于 symphonia / hound / lewton 等的解码包装。

收获：组合器式的 DSL 在音频场景的应用。

## 八、Sqlx

仓库：<https://github.com/launchbadge/sqlx>

- `sqlx-core/src/pool/`：连接池算法。
- `sqlx-sqlite/src/statement/`：语句缓存和执行。
- `sqlx-macros-core/src/query/`：编译期 SQL 检查。

收获：数据库驱动怎么在 async 世界里工作。

## 九、React（深入官方文档）

仓库：<https://github.com/facebook/react>

对前端新手，React 源码难度大。优先读官方文档的"内部工作原理"系列：Fiber、Hooks、Scheduler。源码浅尝即可，学会"怎么读"比"读完"重要。

## 十、Tanstack 系（Query、Router、Virtual）

风格统一且规模适中，是学习"库架构"的好例子：

- 状态机（`QueryObserver`）。
- 订阅/通知（`QueryClient.subscribe`）。
- SSR / Suspense 集成的关注点分离。

## 十一、Zustand

小到可以一下午读完整个核心（< 300 行）。理解"基于订阅的极小状态"是怎么做到的。

## 十二、一个六周计划

- 第 1 周：Tauri IPC 模块 + 事件分发。
- 第 2 周：Tokio runtime + mpsc。
- 第 3 周：Symphonia 例子 + 你自己的 audio engine 对比。
- 第 4 周：Sqlx 连接池 + 一次 query 的生命周期。
- 第 5 周：React Fiber 基础 + Scheduler。
- 第 6 周：Zustand + Tanstack Query 对比。

## 本章小结

- 读源码最好"有目的、分模块、带笔记"。
- 看完后写一篇 200 字总结，巩固记忆。
- 同一个库，做 CloudTone 进步一个阶段再来读，收获翻倍。

下一章：Tauri 的高级话题。
