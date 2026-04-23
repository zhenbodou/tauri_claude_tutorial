# 第 22 章 搭建项目骨架（Vite + React + Tauri 2 + Tailwind）

## 本章目标

- 创建 `cloudtone` 项目目录。
- 集成 Tailwind、shadcn/ui、`tauri-specta` 类型自动生成。
- 配置路径别名、ESLint、Prettier。
- 跑起 Hello CloudTone。

## 一、创建项目

```bash
pnpm create tauri-app@latest cloudtone
# 选 pnpm, React, TypeScript
cd cloudtone
pnpm install
```

按第 10 章的目录规范整理：

```bash
mkdir -p src/{app,components/ui,components/player,features,lib,types}
mkdir -p src-tauri/{capabilities,migrations}
mkdir -p src-tauri/src/{cmds,core,core/audio,core/library,core/lyrics,core/providers,core/db}
```

## 二、依赖

```bash
pnpm add react-router-dom zustand @tanstack/react-query lucide-react
pnpm add clsx tailwind-merge
pnpm add -D tailwindcss@3 postcss autoprefixer
pnpm add -D @types/node vite-plugin-svgr
pnpm exec tailwindcss init -p
```

shadcn/ui（可选但推荐）：

```bash
pnpm dlx shadcn@latest init
# 选 "default"，"slate"
pnpm dlx shadcn@latest add button dialog dropdown-menu slider tooltip input
```

## 三、Tailwind 配置

`tailwind.config.js`：

```js
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 500: "#ec4899", 600: "#db2777" },
        surface: {
          bg: "#0f0f10",
          card: "#17171a",
          elevated: "#202024",
          border: "rgba(255,255,255,0.06)",
        },
      },
      fontFamily: {
        sans: ["Inter", "PingFang SC", "Microsoft YaHei", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
```

`src/index.css`：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; margin: 0; }
body { background: #0a0a0a; color: #e5e7eb; -webkit-font-smoothing: antialiased; }
.scrollbar-thin::-webkit-scrollbar { width: 8px; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
```

## 四、Vite 配置

`vite.config.ts`：

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

## 五、基础 Rust 后端

`src-tauri/Cargo.toml` 加依赖：

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
tauri-plugin-opener = "2"
tauri-plugin-log = "2"
tauri-plugin-global-shortcut = "2"
tauri-plugin-single-instance = "2"
tauri-plugin-notification = "2"
tauri-plugin-http = "2"
tauri-plugin-sql = { version = "2", features = ["sqlite"] }

serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
async-trait = "0.1"
thiserror = "1"
anyhow = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter","fmt","json"] }
tracing-appender = "0.2"

sqlx = { version = "0.8", features = ["runtime-tokio","sqlite","macros","migrate","chrono"] }
reqwest = { version = "0.12", features = ["json","stream","rustls-tls"] }
url = "2"
urlencoding = "2"
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["v4","serde"] }
dirs = "5"
walkdir = "2"
notify = "6"

# 音频
symphonia = { version = "0.5", features = ["all"] }
cpal = "0.15"
rubato = "0.15"      # 采样率转换
lofty = "0.21"       # 元数据

specta = { version = "2.0.0-rc", features = ["serde","derive"] }
tauri-specta = { version = "=2.0.0-rc", features = ["derive","typescript"] }
specta-typescript = "0.0.7"
```

### `src-tauri/src/lib.rs` 初版

```rust
mod cmds;
mod core;
mod error;
mod events;
mod state;

use tauri::Manager;
use tauri_specta::{collect_commands, Builder};

use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let specta = Builder::<tauri::Wry>::new().commands(collect_commands![
        cmds::misc::ping,
    ]);

    #[cfg(debug_assertions)]
    specta.export(
        specta_typescript::Typescript::default(),
        "../src/lib/ipc.ts",
    ).expect("failed to export TS bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") { let _ = w.show(); let _ = w.set_focus(); }
        }))
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            let db_path = app.path().app_data_dir()?.join("cloudtone.sqlite");
            let pool = tauri::async_runtime::block_on(core::db::open_db(&db_path))?;
            app.manage(AppState::new(pool));
            Ok(())
        })
        .invoke_handler(specta.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

`cmds/misc.rs`：

```rust
#[tauri::command]
#[specta::specta]
pub async fn ping() -> &'static str { "pong" }
```

`cmds/mod.rs`：

```rust
pub mod misc;
```

## 六、tauri.conf.json

```jsonc
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "CloudTone",
  "version": "0.1.0",
  "identifier": "dev.codecow.cloudtone",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "CloudTone",
        "width": 1200,
        "height": 780,
        "minWidth": 960,
        "minHeight": 600,
        "center": true,
        "decorations": false,
        "transparent": false,
        "resizable": true,
        "titleBarStyle": "Overlay"
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' data: https: http: asset: custom:; media-src 'self' asset: custom: https: http:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ipc: http: https:"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png","icons/128x128.png","icons/icon.icns","icons/icon.ico"],
    "category": "Music",
    "shortDescription": "CloudTone 音乐播放器",
    "longDescription": "跨平台本地音乐播放器",
    "fileAssociations": [
      { "ext": ["mp3","flac","m4a","wav","ogg","aac","aiff","ape"], "name": "CloudTone Audio", "role": "Viewer" }
    ]
  }
}
```

## 七、Capability

`src-tauri/capabilities/default.json`：

```jsonc
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:event:default",
    "core:window:default",
    "core:path:default",
    "core:webview:default",
    "log:default",
    "dialog:default",
    "notification:default",
    "opener:default",
    "global-shortcut:default",
    "sql:default",
    "http:default",
    "fs:default",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "$APPDATA/cloudtone/**" }]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [{ "path": "$APPDATA/cloudtone/**" }]
    },
    {
      "identifier": "fs:allow-exists",
      "allow": [{ "path": "$MUSIC/**" }, { "path": "$HOME/**" }]
    }
  ]
}
```

## 八、最小化 React App

`src/main.tsx`：

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "@/router";
import "./index.css";

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 5000 } } });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

`src/router.tsx`（骨架）：

```tsx
import { createBrowserRouter } from "react-router-dom";
import AppShell from "@/app/AppShell";
import HomePage from "@/app/home/HomePage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
    ],
  },
]);
```

`src/app/AppShell.tsx`：

```tsx
import { Outlet } from "react-router-dom";

export default function AppShell() {
  return (
    <div className="h-screen flex flex-col bg-surface-bg text-gray-100">
      <div data-tauri-drag-region className="h-10 flex items-center px-3 border-b border-white/5">
        CloudTone
      </div>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
      <div className="h-20 border-t border-white/5 flex items-center px-4">
        (播放控制条 - 下一章实现)
      </div>
    </div>
  );
}
```

`src/app/home/HomePage.tsx`：

```tsx
import { useEffect, useState } from "react";
import { commands } from "@/lib/ipc";

export default function HomePage() {
  const [pong, setPong] = useState("");
  useEffect(() => { commands.ping().then(setPong); }, []);
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">欢迎使用 CloudTone</h1>
      <p className="text-gray-400">后端应答：{pong || "..."}</p>
    </div>
  );
}
```

## 九、跑起来

```bash
pnpm tauri dev
```

等几分钟，一个窗口亮起：上面显示 "欢迎使用 CloudTone"，下面显示 "后端应答：pong"。

---

## 常见陷阱

> **1. `ipc.ts` 生成失败**
>
> 检查 `tauri-specta` 版本和 `specta-typescript` 匹配。Builder 的 `export` 调用必须在 `tauri::Builder` 之前。

> **2. `AppShell` 的 Drag Region 整个屏幕都能拖**
>
> 给其他组件 `data-tauri-drag-region={false}` 或 `class="!region-no-drag"`。

## 本章小结

骨架已立。后面每一章都在此之上增量。本章交付的目录就是 CloudTone 的"钢筋"。

## 动手时刻

- [ ] 跑通 `pnpm tauri dev`。
- [ ] 看到欢迎界面 + pong。
- [ ] `src/lib/ipc.ts` 被自动生成。
- [ ] 打一个 dev build：`pnpm tauri build --debug`。

下一章，设计系统与三栏布局。
