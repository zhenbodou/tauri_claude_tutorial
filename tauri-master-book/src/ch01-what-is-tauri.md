# 第 1 章 Tauri 是什么，和 Electron 有什么区别

## 本章目标

- 用一句话、一段话、一整章分别回答「什么是 Tauri」。
- 说清 Tauri 与 Electron、NW.js、Wails、Neutralino、React Native for Desktop 的本质差异。
- 理解 Tauri 「系统 WebView + Rust 后端」这个核心设计带来的好处和代价。

## 一句话、一段话

**一句话**：Tauri 是一个用 **Rust 写后端**、**系统自带的 WebView 渲染前端**的跨平台桌面应用开发框架。

**一段话**：Tauri 把桌面应用拆成两部分——一个原生二进制（Rust 编译出来的主程序，负责窗口、文件、系统 API、IPC），以及一个在系统 WebView 里运行的网页（用任何你喜欢的前端框架写 UI）。它用操作系统自带的 WebView（macOS 的 WKWebView、Windows 的 WebView2、Linux 的 WebKitGTK）取代 Electron 那样打包一整个 Chromium，从而把安装包体积从 150MB 砍到 5–10MB，把内存从 200MB 砍到 40–80MB。

## 为什么不直接用 Electron

Electron 把整个 Chromium + Node.js 打包进了你的应用。一个「Hello World」就是 150MB 起步，运行时占 200MB+ 内存。对于大公司的 IM、编辑器类应用，这个成本可以接受；但对越来越多的创业公司、小型桌面工具、以及面向低配机器的产品，这个代价就很重。

Tauri 的取舍：

- **不打包 Chromium**：复用操作系统自带的 WebView 组件。
- **不打包 Node.js**：后端用 Rust，编译成一个静态二进制。
- **默认安全**：所有前端能调用的系统 API 必须通过**显式声明的 Capabilities**。

代价是什么？

- **WebView 不一致**：Windows 是 Chromium 内核（WebView2）、macOS 是 Safari 内核（WebKit）、Linux 是 WebKitGTK。你会遇到三个系统行为不一样的情况，比如 macOS 对某些 CSS 属性支持滞后。
- **不能在前端跑 Node.js**：没有 `require('fs')`，没有 npm 里那些依赖 Node runtime 的包。所有「原生」能力要走 Rust。

## 与其他方案的横向对比

下面这张表对几家主流跨平台桌面方案做了对比（2026 年初的生态情况）：

| 方案 | 后端 | 前端渲染 | 安装包大小 | 内存占用 | 成熟度 | 适合谁 |
|------|------|----------|-----------|----------|--------|--------|
| Electron | Node.js | 打包 Chromium | 80–200MB | 150–400MB | ★★★★★ | 预算充足的大型应用 |
| Tauri 2.x | Rust | 系统 WebView | 3–10MB | 40–100MB | ★★★★ | 性能敏感、预算有限、追求安全 |
| Wails | Go | 系统 WebView | 5–15MB | 40–100MB | ★★★ | Go 工程师团队 |
| NW.js | Node.js | 打包 Chromium | 80–200MB | 150–400MB | ★★★ | 老项目，新项目少用 |
| Neutralino | C++ | 系统 WebView | 1–3MB | 20–60MB | ★★ | 纯轻量小工具 |
| Flutter Desktop | Dart | 自绘 Skia | 30–60MB | 60–150MB | ★★★ | 已有 Flutter 团队 |
| React Native for Desktop | JS 桥接 | 原生控件 | 40–80MB | 80–200MB | ★★★ | Windows 10/11 原生风 |

**结论**：在 2026 年，如果你要做一款新的跨平台桌面应用，且对性能和安装体积敏感，Tauri 和 Flutter Desktop 是并列的两个主流选择。Tauri 胜在 Web 生态的易用，Flutter 胜在一次绘制跨平台一致。招聘端看，**Tauri 岗位需求从 2024 年起增速最快**。

## Tauri 的三大核心技术点

贯穿本书的学习主线，实质上就是下面三件事：

1. **IPC（Inter-Process Communication）**：前端和 Rust 后端怎么通信？答案是 `invoke`（前→后调命令）和 `emit/listen`（事件总线）。第 11、12 章会讲透。
2. **Capabilities / ACL**：前端不能为所欲为地调用 Rust——必须在 `capabilities/*.json` 里声明哪些窗口、哪些命令可以用。这是 Tauri 2.x 的核心安全机制。第 13 章专门讲。
3. **WebView Runtime**：前端跑在系统 WebView 里，这意味着：
   - 没有 `window.require`、没有 Node API；
   - 可以 `fetch` 网络，但受 CSP 和权限双重约束；
   - 部分浏览器 API 在不同系统的 WebView 里表现不同。

## 一个最小的 Tauri 应用长什么样

代码暂且不用敲，先混个眼熟：

```rust
// src-tauri/src/main.rs
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
```

```tsx
// src/App.tsx
import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';

export default function App() {
  const [msg, setMsg] = useState('');
  return (
    <main>
      <button onClick={async () => setMsg(await invoke('greet', { name: 'Tauri' }))}>
        打招呼
      </button>
      <p>{msg}</p>
    </main>
  );
}
```

点一下按钮，JS 通过 `invoke` 跨进程调用 Rust 的 `greet`，后者返回字符串，前端拿到显示。这就是 Tauri 开发的基本节奏。

## 常见误解

> **误解 1：Tauri 只适合做小工具。**
>
> 不对。1Password、Spacedrive、Cap、Warp Desktop 客户端、DeepL、Remotion 等都已在用 Tauri。

> **误解 2：因为用系统 WebView，兼容性会很惨。**
>
> WebView2（Windows）和 WKWebView（macOS）都是 Chromium/WebKit 的现代版本，支持 ES2022+。唯一需要注意的是 Linux 的 WebKitGTK 版本受发行版管理，老 Ubuntu 用户会遇到坑——这也是后面第 46 章会讲到的。

> **误解 3：Rust 很难，不适合入门。**
>
> 对 Tauri 开发来说，你不需要精通 Rust 所有权。大部分业务代码是 `async fn`、`serde` 结构体、`sqlx::query!` 这一类「现代 Rust」，和你写 TypeScript 的体感非常接近。真正卡你的是**并发和生命周期**——所以第 16 章是重点。

## 本章小结

- Tauri = **Rust 主进程 + 系统 WebView + 显式权限**。
- 它不是 Electron 的「精简版」，而是一个重新设计的、安全优先、性能优先的框架。
- 代价：WebView 不一致、前端不能用 Node 生态。
- 收益：小、快、更安全。

## 动手时刻

现在还不用写代码，先花 10 分钟做一件事：

> 打开你现在用的 3–5 款桌面应用，用任务管理器看看它们各自占用多少内存。然后去它们官网或 GitHub 看看用的是 Electron、Tauri、原生还是别的。记下来。

这个练习会让你对「为什么要关心性能」有一个本能的体感，远比我讲十页有用。

下一章，我们真正动手——把 Rust、Node、Tauri CLI 一口气装好。
