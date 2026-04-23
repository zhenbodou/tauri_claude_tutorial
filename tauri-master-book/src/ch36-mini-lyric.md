# 第 36 章 迷你播放器、桌面歌词悬浮窗

## 本章目标

- 新建第二个 WebviewWindow：mini-player，340×140，透明+无边框。
- 新建第三个窗口：lyric-overlay，透明、置顶、所有工作区可见。
- 窗口间通信：事件广播 + 共享 `AppState`。

## 一、窗口配置

`tauri.conf.json` 的 `app.windows` 可以声明多个，但更灵活的是在 Rust 里 `WebviewWindowBuilder` 按需建。

```rust
// core/window/mini.rs
use tauri::{WebviewWindowBuilder, WebviewUrl, AppHandle};

pub fn open_mini(app: &AppHandle) -> tauri::Result<()> {
    if let Some(w) = app.get_webview_window("mini") { w.set_focus()?; return Ok(()); }
    let win = WebviewWindowBuilder::new(app, "mini", WebviewUrl::App("mini.html".into()))
        .title("CloudTone Mini")
        .inner_size(340.0, 140.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .resizable(false)
        .shadow(false)
        .skip_taskbar(true)
        .build()?;
    // 让迷你窗口默认右下角
    if let Some(monitor) = win.current_monitor()? {
        let size = monitor.size();
        win.set_position(tauri::PhysicalPosition::new(
            (size.width as i32) - 360,
            (size.height as i32) - 180,
        ))?;
    }
    Ok(())
}

pub fn open_lyric(app: &AppHandle) -> tauri::Result<()> {
    if let Some(w) = app.get_webview_window("lyric") { w.set_focus()?; return Ok(()); }
    WebviewWindowBuilder::new(app, "lyric", WebviewUrl::App("lyric.html".into()))
        .title("桌面歌词")
        .inner_size(1000.0, 120.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .position(100.0, 50.0)
        .build()?;
    Ok(())
}
```

## 二、Vite 多入口

`vite.config.ts`：

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        mini: resolve(__dirname, "mini.html"),
        lyric: resolve(__dirname, "lyric.html"),
      },
    },
  },
});
```

根目录新增 `mini.html` / `lyric.html`，各自引用不同的 entry TSX：

```html
<!-- mini.html -->
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Mini</title></head>
<body><div id="root"></div><script type="module" src="/src/mini/main.tsx"></script></body></html>
```

```tsx
// src/mini/main.tsx
import ReactDOM from "react-dom/client";
import "../index.css";
import { MiniApp } from "./MiniApp";
ReactDOM.createRoot(document.getElementById("root")!).render(<MiniApp />);
```

## 三、迷你播放器 UI

```tsx
// src/mini/MiniApp.tsx
import { usePlayerSync, usePlayer } from "@/features/player/player";

export function MiniApp() {
  usePlayerSync();
  const { currentSong, isPlaying, toggle, next, prev } = usePlayer();
  return (
    <div data-tauri-drag-region
         className="h-screen w-screen bg-[rgba(20,20,30,0.85)] backdrop-blur-xl rounded-xl p-3 flex items-center gap-3 text-white">
      <img src={`cover://${currentSong?.fileHash ?? 'fallback'}`} className="w-14 h-14 rounded-lg" />
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{currentSong?.title ?? "未在播放"}</div>
        <div className="truncate text-text-secondary text-xs">{currentSong?.artist}</div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={prev}><SkipBack size={18} /></button>
        <button onClick={toggle}>{isPlaying ? <Pause size={22} /> : <Play size={22} />}</button>
        <button onClick={next}><SkipForward size={18} /></button>
      </div>
    </div>
  );
}
```

`data-tauri-drag-region` 是 Tauri 的拖动提示：任何设置了它的元素，用户拖动窗口就能移动。

## 四、让所有窗口共享播放状态

播放器后端通过 `broadcast::Sender<PlayerEvent>` 发事件，Tauri 层做桥接：

```rust
// setup 里
let handle = app.handle().clone();
let mut rx = player.subscribe();
tokio::spawn(async move {
    while let Ok(ev) = rx.recv().await {
        let _ = handle.emit("player:event", &ev);
    }
});
```

前端 (所有窗口) 用同一个 `usePlayerSync` 监听 `player:event` 即可，无需区分窗口。

## 五、歌词悬浮窗

`lyric.html` 只渲染一行/两行歌词：

```tsx
export function LyricOverlay() {
  usePlayerSync();
  const { currentSong, progressSec } = usePlayer();
  const { data: lines = [] } = useLyrics(currentSong?.id);
  const line = useMemo(() => findActive(lines, progressSec * 1000), [lines, progressSec]);
  const next = lines[Math.max(line + 1, 0)];
  return (
    <div data-tauri-drag-region
         className="h-screen w-screen flex flex-col items-center justify-center text-center select-none">
      <div className="text-4xl font-bold text-white drop-shadow-lg">{lines[line]?.text}</div>
      <div className="text-xl text-white/60 mt-1">{next?.text}</div>
    </div>
  );
}
```

## 六、点击穿透（仅桌面歌词）

用户希望鼠标穿透歌词悬浮窗。Tauri 2.x：

```rust
if let Some(w) = app.get_webview_window("lyric") {
    w.set_ignore_cursor_events(true)?;
}
```

进入"锁定模式"时开启，前端切换状态时调用 command。

## 七、托盘菜单控制

在 Tray 里加入：

```rust
Submenu::with_items(app, "窗口", true, &[
    &MenuItem::with_id(app, "open_mini", "打开迷你播放器", true, None::<&str>)?,
    &MenuItem::with_id(app, "open_lyric", "打开桌面歌词", true, None::<&str>)?,
])?
```

## 本章小结

- Tauri 多窗口是它对 Electron 的一大优势：单进程多 WebView，资源共享。
- 透明 + 无边框 + always_on_top + 拖动区域 = 漂亮的悬浮窗。
- 状态靠后端事件广播保持同步。

## 动手时刻

- [ ] 打开迷你播放器，拖到屏幕角落。
- [ ] 打开桌面歌词，切换穿透模式。

下一章：全局媒体键与系统媒体中心。
