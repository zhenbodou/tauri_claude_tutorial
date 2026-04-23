# 第 49 章 高级话题：Sidecar / 嵌入 Python / 原生菜单 / Webview 注入

## 本章目标

- Sidecar：把第三方可执行文件打进 App。
- Embedded Python：在 Tauri 里嵌入 Python 解释器（PyO3）。
- 原生菜单栏深入：动态菜单、快捷键、响应式。
- 向 WebView 注入 JS：做调试工具 / 注入脚本。

## 一、Sidecar

场景：需要调用某个 CLI（ffmpeg、yt-dlp、whisper.cpp）。

`tauri.conf.json`：

```jsonc
"bundle": {
  "externalBin": ["bin/ffmpeg"]
}
```

Tauri CLI 会在构建时按平台复制 `bin/ffmpeg-x86_64-apple-darwin` 等变体。

运行时：

```rust
use tauri_plugin_shell::ShellExt;

let output = app.shell()
    .sidecar("ffmpeg")?
    .args(["-i", input, output_path])
    .output()
    .await?;
```

Capability 里要允许：

```json
{ "identifier": "shell:allow-execute",
  "allow": [{ "name": "ffmpeg", "sidecar": true, "args": true }] }
```

### 流式输出

```rust
let (mut rx, _child) = app.shell().sidecar("ffmpeg")?.args(args).spawn()?;
while let Some(ev) = rx.recv().await {
    match ev {
        CommandEvent::Stdout(line) => app.emit("ffmpeg:line", line)?,
        CommandEvent::Terminated(t) => app.emit("ffmpeg:exit", t.code)?,
        _ => {}
    }
}
```

## 二、嵌入 Python

偶尔需要调 Python 生态（比如 `librosa` 分析波形）。有两条路：

### 2.1 sidecar `python` 子进程

简单直接，跨平台成本低。把一个 PyInstaller 打包后的可执行文件作为 sidecar。

### 2.2 PyO3 嵌入

```toml
pyo3 = { version = "0.22", features = ["auto-initialize"] }
```

```rust
use pyo3::prelude::*;

pub fn analyze_bpm(path: &str) -> anyhow::Result<f64> {
    Python::with_gil(|py| {
        let librosa = py.import_bound("librosa")?;
        let (y, sr): (PyObject, f64) = librosa.call_method1("load", (path,))?.extract()?;
        let bpm: f64 = librosa.call_method1("beat.beat_track", (y,))?.get_item(0)?.extract()?;
        Ok(bpm)
    })
}
```

注意：

- 发布时你得分发 Python 解释器（用 `python-build-standalone`），成本显著。
- macOS 的 Hardened Runtime + Python dylib 的签名头疼。

> 一般建议优先 sidecar，除非真的需要高频调用。

## 三、原生菜单进阶

### 动态菜单项

```rust
let recent = state.recent_files.lock().await.clone();
let mut builder = Submenu::builder(app, "文件");
for path in recent {
    builder = builder.item(&MenuItem::with_id(app, format!("recent:{}", path), path, true, None::<&str>)?);
}
let menu = builder.build()?;
app.set_menu(menu)?;
```

菜单事件统一处理：

```rust
app.on_menu_event(|app, ev| {
    let id = ev.id().as_ref();
    if id.starts_with("recent:") {
        let path = id.trim_start_matches("recent:");
        let _ = app.emit("open_file", path);
    }
});
```

### 响应当前状态（Checkable）

播放模式菜单打勾：

```rust
let shuffle = CheckMenuItem::with_id(app, "shuffle", "随机", true, mode == Shuffle, None::<&str>)?;
```

## 四、向 WebView 注入 JS

```rust
if let Some(w) = app.get_webview_window("main") {
    w.eval("window.__APP_BUILD__ = 'nightly';")?;
}
```

高级：注入一个调试面板：

```rust
w.eval(include_str!("../assets/devtools.js"))?;
```

你甚至可以 hook `console.log` 上报到 Rust。

## 五、开发时打开 DevTools

```rust
#[cfg(debug_assertions)]
if let Some(w) = app.get_webview_window("main") { w.open_devtools(); }
```

## 六、自定义 WebView 设置

- `initialization_script`：在所有页面加载前跑。
- `user_agent`：设定 UA。
- `transparent`：透明窗口。
- `accept_first_mouse`：macOS 首次点击不被吃掉。

```rust
WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
    .initialization_script("window.__TAURI_BRIDGE__ = true;")
    .user_agent("CloudTone/1.0")
    .build()?;
```

## 七、与 OS 深度集成

- **macOS Dock 菜单**：`TrayIconBuilder` + `MenuBuilder` + `set_dock_menu`。
- **Windows Jump List**：通过 `webview2`/`windows-rs` 原生 API。
- **Linux 通知**：`tauri-plugin-notification`，MPRIS（第 37 章）。

## 八、性能剖析

- macOS Instruments：附加到 `cloudtone` 进程，profile CPU、内存。
- Windows Performance Analyzer：ETW 跟踪。
- 前端：Chrome DevTools（`--remote-debugging-port=9222` 附加）。

## 本章小结

- Sidecar 比嵌入解释器简单得多。
- 原生菜单是桌面感的关键，动态 + Checkable 提升体验。
- 注入脚本是强力工具，慎用但必备。

下一章：求职与职业规划。
