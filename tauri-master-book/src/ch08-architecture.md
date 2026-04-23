# 第 8 章 Tauri 架构解剖：三进程模型与 WebView

## 本章目标

- 看清楚一个 Tauri 应用跑起来之后，内存里到底发生了什么。
- 理解「Core 进程、WebView 进程、Isolation 进程」三者的职责与通信。
- 明白「IPC Bridge」这个词在 Tauri 里指什么。

## 一、一眼看懂的结构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Tauri 应用 (OS 进程 1)                   │
│                                                             │
│   ┌──────────────────────────────────────────────────────┐  │
│   │   Core 进程 (Rust 主进程)                             │  │
│   │   - tauri::Builder                                  │  │
│   │   - Commands 注册表                                  │  │
│   │   - Window Manager / Menu / Tray                   │  │
│   │   - Tokio runtime                                   │  │
│   │   - 业务代码 (DB / 音频 / 网络)                        │  │
│   └──────────────────────────────────────────────────────┘  │
│                        ↑  ↓  IPC                             │
│   ┌──────────────────────────────────────────────────────┐  │
│   │   WebView 进程 (系统组件)                             │  │
│   │   - WKWebView / WebView2 / WebKitGTK               │  │
│   │   - 加载你的 React UI                                │  │
│   │   - @tauri-apps/api: invoke / listen                │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                             │
│   (可选) Isolation 进程 — 运行中介层 JS，加固 IPC 安全        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- **Core 进程**：你的 Rust 二进制本身。这里跑 tokio、你的业务代码、你的 Command 注册表。
- **WebView 进程**：操作系统的 WebView 组件。它是**不同的进程**（macOS 上你能在 Activity Monitor 看到 `YourApp Helper (Renderer)`）。
- **IPC Bridge**：把前端 `invoke('x', {...})` 和后端 `#[tauri::command] fn x(...)` 接起来的那根"电话线"。

## 二、Core 进程：`tauri::Builder` 到底做了什么

一个 Tauri 应用的入口长这样：

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::default())
        .setup(|app| { /* 启动钩子 */ Ok(()) })
        .invoke_handler(tauri::generate_handler![greet, play, pause])
        .on_window_event(|window, event| { /* 窗口事件 */ })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

过程拆解：

1. `tauri::generate_context!()` 读取 `tauri.conf.json` + 资源文件，编译期嵌入到二进制。
2. `Builder` 构造出 `App`，启动一个 tokio runtime。
3. 根据 `tauri.conf.json` 的 `windows` 数组创建 WebView 窗口。每个窗口会向系统申请 WebView 实例。
4. `setup` 闭包只在第一次启动时跑一次，适合初始化数据库、注册托盘等。
5. 事件循环启动。主线程负责窗口和托盘事件；业务逻辑跑在 tokio 线程池上。

### Plugins

Tauri 2.x 把很多原本内置的能力（文件系统、对话框、通知、HTTP、SQL 等）拆成了独立 crate `tauri-plugin-*`。好处是：

- 不用的功能不编译，二进制更小。
- 你可以**写自己的插件**（第 42 章会演示）。

## 三、WebView 进程：前端跑在哪里

你的 `index.html` 和 `dist/assets/*.js` 会通过 Tauri 的内嵌 HTTP server（开发时）或 `tauri://` 协议（生产时）加载进 WebView。

有几件事必须清楚：

- 前端**不是跑在 Node.js 里**。`require`、`process`、`__dirname` 都没有。
- `localStorage`、`IndexedDB`、`fetch` 都是 WebView 自带的，可以用。但 `fetch` 调用外部域名要受 CSP 管控。
- `window.__TAURI__` 是 Tauri 注入的全局对象，`@tauri-apps/api` 底层就是调它。

### 多窗口

Tauri 可以开多个窗口。每个窗口是**独立的 WebView 实例**，它们之间不共享内存，但可以通过 Core 的事件总线通信。

CloudTone 会开至少 3 个窗口：主窗口、迷你播放器、桌面歌词。第 14、36 章会写。

## 四、IPC Bridge：invoke 到底走哪条路

前端：

```ts
import { invoke } from "@tauri-apps/api/core";
const res = await invoke<number>("add", { a: 1, b: 2 });
```

发生了什么：

1. `invoke` 通过 WebView 的原生桥（iOS 的 `WKScriptMessageHandler`、Windows 的 `postMessage` 给 WebView2、Linux 的 `webkit_user_content_manager`）把消息 `{ cmd: "add", args: { a:1, b:2 } }` 送到 Core。
2. Core 在注册表里找到 `add`，反序列化参数。
3. 调用 `fn add(a: i64, b: i64) -> i64`。
4. 返回值序列化，走反向通道回到 WebView。
5. 前端 `Promise` 解析。

IPC 有两种传输路径：

- **默认 JSON 序列化**（`@tauri-apps/api/core` 的 `invoke`）：适合小数据。
- **Raw binary channel**（`Channel`、`InvokeResponseBody::Raw`）：传大二进制，比如音频波形、封面图流。

第 11 章写 `invoke` 的细节，第 12 章写 `Channel` 做流式通信。

## 五、Isolation 进程（可选）

Tauri 2 引入 **Isolation Pattern**：在 WebView 和 Core 之间插一层 JS「中介」，用来做权限校验、过滤、日志。前端发给 Core 的所有消息先经过 Isolation 脚本。

对小应用可以不用；对面向不可信插件的应用（比如 CloudTone 插件系统）很有价值。第 13、42 章会提到。

## 六、和 Electron 的架构对比

| 方面 | Electron | Tauri |
|------|----------|-------|
| 主进程 | Node.js | Rust |
| 渲染进程 | 打包 Chromium | 系统 WebView |
| IPC | `ipcRenderer.invoke` / `ipcMain.handle` | `invoke` + `#[tauri::command]` |
| 权限 | 默认全开 | 默认拒绝，显式 Capabilities |
| 本地模块 | Node Native Modules (C++ N-API) | Rust crates |
| 包大小 | 150MB+ | 5–10MB |

## 七、读源码小贴士（为第 48 章预热）

Tauri 核心仓库结构：

- `crates/tauri/` — 对外 crate，`Builder`、`Manager`。
- `crates/tauri-runtime/` — 运行时 trait 抽象。
- `crates/tauri-runtime-wry/` — 基于 `wry` 的默认实现（WebView 适配）。
- `crates/tauri-utils/` — 工具。
- `crates/tauri-macros/` — `#[command]`、`generate_handler!` 等宏实现。

你写 `#[tauri::command]` 的时候，宏在编译期生成了一段反序列化 + 调用的胶水。第 48 章我们会打开 `cargo expand` 看。

## 常见陷阱

> **以为 WebView 和 Core 是同一进程**：它们在大多数系统上不是。在 WebView 里跑死循环不会冻住 Core；但 Core 调用 WebView 的方法会跨 IPC。

> **以为前端能直接 `require('fs')`**：没有 Node，请走 `#[tauri::command]` 或者 `tauri-plugin-fs` 提供的桥接。

## 本章小结

- Core + WebView + (可选) Isolation = Tauri 的三进程模型。
- `invoke` / `emit` / `listen` = IPC 三板斧。
- 架构决定了你做性能和安全取舍的思路。

## 动手时刻

打开第 2 章跑通的 smoke-test 应用，在 Activity Monitor / 任务管理器里找到它的所有进程，记下 PID。你会看到**至少两个**进程。

下一章：真正创建第一个带业务意义的 Tauri 应用。
