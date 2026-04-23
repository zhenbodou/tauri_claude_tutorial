# 第 15 章 全局快捷键与单实例

## 本章目标

- 用 `tauri-plugin-global-shortcut` 注册系统级快捷键。
- 用 `tauri-plugin-single-instance` 保证只有一个实例运行。
- 设计 CloudTone 的默认快捷键表并做冲突处理。

## 一、全局快捷键（系统级）

"全局" 意味着 app 在后台也能响应。比如用户按 `Media Play/Pause` 键，CloudTone 应该切歌——即使当前焦点在浏览器。

### 安装插件

```bash
pnpm tauri add global-shortcut
```

等价于手动：

```toml
# src-tauri/Cargo.toml
tauri-plugin-global-shortcut = "2"
```

```rust
// src-tauri/src/lib.rs
.plugin(tauri_plugin_global_shortcut::Builder::new().build())
```

**capability**（默认可开）：`"global-shortcut:default"`。

### 注册快捷键

```rust
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState, Code, Modifiers};

.setup(|app| {
    let short = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyP);
    app.global_shortcut().on_shortcut(short, move |app, _sc, event| {
        if event.state == ShortcutState::Pressed {
            app.emit("shortcut:toggle-play", ()).ok();
        }
    })?;
    Ok(())
})
```

或者传字符串：

```rust
app.global_shortcut().on_shortcut("CommandOrControl+Alt+P", |app, _, _| {
    app.emit("shortcut:toggle-play", ()).ok();
})?;
```

### 前端动态注册

```ts
import { register, unregister, isRegistered } from "@tauri-apps/plugin-global-shortcut";

await register("CommandOrControl+Shift+F", () => {
  invoke("focus_search");
});

// 解绑
await unregister("CommandOrControl+Shift+F");
```

### CloudTone 默认快捷键表

| 功能 | macOS | Win/Linux |
|------|-------|-----------|
| 播放/暂停 | `Cmd+Alt+P` | `Ctrl+Alt+P` |
| 下一曲 | `Cmd+Alt+Right` | `Ctrl+Alt+Right` |
| 上一曲 | `Cmd+Alt+Left` | `Ctrl+Alt+Left` |
| 音量+ | `Cmd+Alt+Up` | `Ctrl+Alt+Up` |
| 音量- | `Cmd+Alt+Down` | `Ctrl+Alt+Down` |
| 显示/隐藏主窗口 | `Cmd+Alt+Space` | `Ctrl+Alt+Space` |
| 切换桌面歌词 | `Cmd+Alt+L` | `Ctrl+Alt+L` |
| 快速搜索 | `Cmd+Alt+F` | `Ctrl+Alt+F` |

快捷键要可被用户自定义，第 47 章讲配置页。

### 冲突与异常

某些快捷键已被系统或其他 app 占用。注册会返回错误。良好做法：

1. 尝试注册，失败就记日志。
2. 在设置页列出 "冲突"，让用户改键。
3. 支持 Media Keys（`MediaPlayPause`, `MediaNextTrack`, `MediaPrevTrack`），但 macOS 需要特殊权限（见第 37 章）。

## 二、单实例（Single Instance）

用户双击图标两次，通常你希望只激活已有窗口，而不是再开一个 app。

### 安装

```bash
pnpm tauri add single-instance
```

```rust
// 注意：必须是第一个 plugin
.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
    println!("another instance launched with {:?}, cwd {}", argv, cwd);
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
    // 如果 argv 里有音频文件路径，就当作"打开"
    for arg in argv.iter().skip(1) {
        app.emit("app:open-file", arg).ok();
    }
}))
```

### 双击音频文件启动

在 `tauri.conf.json` 里声明文件关联：

```jsonc
"bundle": {
  "fileAssociations": [
    {
      "ext": ["mp3", "flac", "m4a", "wav", "ogg"],
      "name": "CloudTone Audio",
      "role": "Editor"
    }
  ]
}
```

macOS 会把拖拽/双击的文件通过 `argv[1]` 传给已运行实例——上面的回调处理它。

## 三、快捷键 × 单实例 × 托盘 合流示例

```rust
.setup(|app| {
    // 1. 托盘
    setup_tray(app.handle())?;

    // 2. 全局快捷键
    let h = app.handle().clone();
    app.global_shortcut().on_shortcut("CommandOrControl+Alt+P", move |_, _, e| {
        if e.state == ShortcutState::Pressed {
            h.emit("shortcut:toggle-play", ()).ok();
        }
    })?;

    Ok(())
})
```

前端：

```ts
useTauriEvent("shortcut:toggle-play", () => {
  usePlayerStore.getState().toggle();
});
```

## 常见陷阱

> **1. macOS 上媒体键没触发**
>
> macOS 的 F7/F8/F9 是系统键，需要在系统设置 → 键盘 → 快捷键里把 "Use F1, F2 as function keys" 打开，或者你申请 Accessibility 权限（见第 37 章）。

> **2. `single-instance` 插件没装或注册顺序错**
>
> 必须是**第一个** plugin，否则不生效。

> **3. 动态注册快捷键后 app 重启失效**
>
> 动态注册不会持久化。把用户设置存 DB/config，启动时再注册。

> **4. Linux 上全局快捷键不触发**
>
> Wayland 目前不提供全局键盘 hook。Tauri 可能通过 X11 / portal 工作。发行版差异较大，测 Ubuntu/Fedora 两套。

## 本章小结

- 全局快捷键 + 单实例 = 合格的桌面应用体验。
- Tauri 2 插件化让这些能力按需启用。
- CloudTone 默认快捷键表要易用、不冲突、可自定义。

## 动手时刻

在 hello 项目里：

- [ ] 加 `global-shortcut` 插件，绑 `Ctrl+Alt+P` 触发事件，前端 toast 一下。
- [ ] 加 `single-instance`，验证双击 exe 只激活现有窗口。
- [ ] 在 fileAssociations 里加 `.mp3`，试试双击能否传到 argv。

下一章，State 并发：`Arc<Mutex>` 的正确打开方式。
