# 第 14 章 窗口、菜单与系统托盘

## 本章目标

- 动态创建、关闭、定位、隐藏窗口。
- 做一个跨平台的「最小化到托盘」行为。
- 搭建原生菜单（macOS 应用菜单、Windows/Linux 右键菜单）。

## 一、窗口 API

### 从 config 创建（静态）

`tauri.conf.json`：

```jsonc
"app": {
  "windows": [
    {
      "label": "main",
      "title": "CloudTone",
      "width": 1200, "height": 780, "minWidth": 960, "minHeight": 600,
      "center": true, "decorations": true, "resizable": true,
      "titleBarStyle": "Overlay"
    }
  ]
}
```

`label` 是窗口唯一 ID，代码里通过它拿到窗口实例。

### 运行时创建（动态）

```rust
use tauri::{WebviewUrl, WebviewWindowBuilder};

fn open_mini_player(app: &tauri::AppHandle) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, "mini", WebviewUrl::App("mini.html".into()))
        .title("CloudTone Mini")
        .inner_size(340.0, 140.0)
        .always_on_top(true)
        .decorations(false)
        .skip_taskbar(true)
        .transparent(true)
        .build()?;
    Ok(())
}
```

常用选项：

- `inner_size` / `min_inner_size` / `max_inner_size`
- `position(x, y)` / `center()`
- `decorations(false)` 去掉系统边框
- `transparent(true)` 透明窗
- `always_on_top(true)` 置顶
- `skip_taskbar(true)` 不在任务栏显示
- `visible(false)` 创建时先不显示

### 获取已有窗口

```rust
use tauri::Manager;

let main = app.get_webview_window("main").unwrap();
main.hide()?;
main.show()?;
main.set_focus()?;
main.set_title("新标题")?;
main.set_size(tauri::PhysicalSize::new(800, 600))?;
```

前端调用：

```ts
import { getCurrentWindow } from "@tauri-apps/api/window";
const win = getCurrentWindow();
await win.setTitle("Hello");
await win.minimize();
```

### 拖拽区域（Drag Region）

无边框窗口需要你自己指定哪里可以拖：

```tsx
<div data-tauri-drag-region className="h-10 bg-zinc-900 flex items-center px-3">
  CloudTone
</div>
```

CSS 层面可用 `app-region: drag;`，但 Tauri 推荐用 `data-tauri-drag-region` 属性，兼容好。

## 二、窗口事件

```rust
use tauri::WindowEvent;

window.on_window_event(move |ev| match ev {
    WindowEvent::CloseRequested { api, .. } => {
        api.prevent_close();
        window_clone.hide().ok();  // 改为隐藏
    }
    WindowEvent::Focused(true) => { /* ... */ }
    _ => {}
});
```

CloudTone 的 "关闭即隐藏到托盘" 就靠 `prevent_close` + 托盘菜单呼出。

前端：

```ts
import { getCurrentWindow } from "@tauri-apps/api/window";
const unlisten = await getCurrentWindow().onResized(e => console.log(e.payload));
```

## 三、系统托盘（System Tray）

Tauri 2.x 托盘是一等公民。示例：

```rust
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, MenuBuilder},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    Manager,
};

fn setup_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "显示主界面", true, None::<&str>)?;
    let play = MenuItem::with_id(app, "play", "播放/暂停", true, Some("Space"))?;
    let next = MenuItem::with_id(app, "next", "下一首", true, None::<&str>)?;
    let prev = MenuItem::with_id(app, "prev", "上一首", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(app, &[&show, &sep, &prev, &play, &next, &sep, &quit])?;

    TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().cloned().unwrap())
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => { let _ = app.get_webview_window("main").unwrap().show(); }
            "play" => { app.emit("player:toggle", ()).ok(); }
            "next" => { app.emit("player:next", ()).ok(); }
            "prev" => { app.emit("player:prev", ()).ok(); }
            "quit" => { app.exit(0); }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show(); let _ = w.set_focus();
                }
            }
        })
        .build(app)?;
    Ok(())
}
```

在 `setup` 里调用：

```rust
.setup(|app| {
    setup_tray(app.handle())?;
    Ok(())
})
```

> **Linux 提示**：托盘图标需要桌面环境支持 StatusNotifierItem。GNOME 需要装 `AppIndicator` 扩展，KDE/Ubuntu 默认 ok。

## 四、窗口菜单（macOS 顶部菜单栏 / 菜单键）

```rust
use tauri::menu::{MenuBuilder, SubmenuBuilder};

fn build_menu(app: &tauri::AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let app_menu = SubmenuBuilder::new(app, "CloudTone")
        .about(Some(Default::default()))
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let file_menu = SubmenuBuilder::new(app, "文件")
        .text("new-playlist", "新建歌单")
        .text("import", "导入音乐...")
        .separator()
        .close_window()
        .build()?;

    let menu = MenuBuilder::new(app).items(&[&app_menu, &file_menu]).build()?;
    Ok(menu)
}

// setup 时
let menu = build_menu(app.handle())?;
app.set_menu(menu)?;
```

菜单事件绑定：

```rust
.on_menu_event(|app, event| {
    match event.id.as_ref() {
        "new-playlist" => app.emit("ui:new-playlist", ()).ok(),
        "import" => app.emit("ui:import", ()).ok(),
        _ => None,
    };
})
```

## 五、右键上下文菜单（前端自实现）

原生 ContextMenu 目前 Tauri 只在桌面有限支持。推荐前端用 Radix/shadcn 的 ContextMenu 组件，体验更一致。除非你确实需要系统菜单（比如 macOS 的 Emoji & Symbols），那再考虑原生。

## 六、多窗口协作：CloudTone 的三窗口布局

```
main           (1200x780)
mini-player    (340x140, always_on_top, transparent)
lyric-overlay  (全屏宽, 固定高, always_on_top, ignore_cursor_events)
```

`lyric-overlay` 有个难点：**鼠标穿透**。让它不挡住后面的 UI：

```rust
lyric_window.set_ignore_cursor_events(true)?;
```

再加个 "显示/隐藏桌面歌词" 快捷键（下一章讲）。

## 常见陷阱

> **1. `hide()` 后 `show()` 不显示**
>
> macOS 有时需要先 `set_focus()` 或 `show` 后等一帧。Linux 上 hide 真正关闭子渲染进程，show 会重新创建。

> **2. 无边框窗口在 macOS 有黑边**
>
> `titleBarStyle: "Overlay"` + `hiddenTitle: true` 组合可达 native macOS 风格。

> **3. 托盘点击没反应**
>
> Linux 下左键可能被发行版当成弹菜单。右键弹菜单是最稳的行为。

> **4. 前端 `getCurrentWindow()` 拿到了别的窗口**
>
> 每个窗口的 `getCurrentWindow` 都返回自己的实例，但 `Window.getByLabel("main")` 可能跨窗口。注意心智模型。

## 本章小结

- 窗口 = `WebviewWindow`，可以 config 也可以 runtime 创建。
- 托盘 + 菜单靠 `tray` / `menu` 模块。
- CloudTone 规划三个窗口：主、迷你、桌面歌词。

## 动手时刻

在 hello 项目里：

- [ ] 点击关闭按钮不退出，而是隐藏到托盘。
- [ ] 托盘右键菜单「显示主界面」「退出」。
- [ ] 新建一个无边框、置顶、透明的 `mini` 窗口。

下一章，全局快捷键与单实例。
