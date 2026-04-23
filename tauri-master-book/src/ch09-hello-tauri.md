# 第 9 章 创建第一个 Tauri 应用（`create-tauri-app`）

## 本章目标

- 用 `create-tauri-app` 生成一个标准 Tauri 2 + React + TS + Vite + Tailwind 项目。
- 把项目跑起来，看见第一个带按钮的 UI。
- 知道每个生成文件的作用。

## 一、动手

打开终端：

```bash
pnpm create tauri-app@latest
```

交互式问答（按回车走过默认时注意）：

- Project name: `tauri-hello`
- Identifier: `dev.codecow.hello`
- Choose which language to use for your frontend: **TypeScript / JavaScript**
- Choose your package manager: **pnpm**
- Choose your UI template: **React**
- Choose your UI flavor: **TypeScript**

完成后：

```bash
cd tauri-hello
pnpm install
pnpm tauri dev
```

第一次 build 大概 3–10 分钟。结束后看到窗口：Welcome 页面 + 一个输入框 + 一个按钮。

## 二、生成的目录

```
tauri-hello/
├── src/                    # 前端 (React + Vite 入口)
│   ├── App.tsx             # 根组件
│   ├── main.tsx            # ReactDOM 挂载
│   ├── assets/
│   ├── App.css
│   └── styles.css
├── src-tauri/              # 后端 (Rust)
│   ├── src/
│   │   ├── main.rs         # main 函数
│   │   └── lib.rs          # 大部分业务代码（Tauri 2 起的新约定）
│   ├── capabilities/
│   │   └── default.json    # 权限声明
│   ├── icons/              # 应用图标
│   ├── tauri.conf.json     # Tauri 配置
│   ├── Cargo.toml
│   └── build.rs
├── index.html              # 前端 HTML 模板
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── vite.config.ts
```

### 关键文件逐个看

#### `src-tauri/tauri.conf.json`

```jsonc
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "tauri-hello",
  "version": "0.1.0",
  "identifier": "dev.codecow.hello",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build"
  },
  "app": {
    "windows": [
      { "title": "tauri-hello", "width": 800, "height": 600 }
    ],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"]
  }
}
```

- `beforeDevCommand`：在 `tauri dev` 启动后端之前先跑 `pnpm dev`，启动 Vite dev server。
- `devUrl`：Tauri 在 dev 模式去这个地址拉前端。
- `frontendDist`：发布模式下使用的前端产物目录。
- `app.windows`：启动时创建的窗口。
- `security.csp`：Content Security Policy。

#### `src-tauri/src/main.rs`

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri_hello_lib::run()
}
```

极简，把真正的逻辑委托给 `lib.rs`。这是 Tauri 2 模板的新约定（方便移动端共用代码）。

#### `src-tauri/src/lib.rs`

```rust
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

`#[tauri::command]` 注册一个命令，`invoke_handler` 把它挂到 IPC。

#### `src/App.tsx`

```tsx
import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <main className="container">
      <h1>Welcome to Tauri!</h1>
      <form onSubmit={e => { e.preventDefault(); greet(); }}>
        <input value={name} onChange={e => setName(e.currentTarget.value)} placeholder="Enter a name..." />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>
    </main>
  );
}

export default App;
```

## 三、开发流程是什么样

- `pnpm tauri dev` 起两个东西：Vite dev server（端口 1420）+ Rust 后端。
- 改前端：**热更新**，保存立刻刷新。
- 改 Rust：**重编译整个后端**，窗口自动重开。
- 构建产物：`pnpm tauri build`，产物在 `src-tauri/target/release/bundle/`。

## 四、加入 Tailwind

模板默认没有 Tailwind。我们一次性加上：

```bash
cd tauri-hello
pnpm add -D tailwindcss@3 postcss autoprefixer
pnpm exec tailwindcss init -p
```

编辑 `tailwind.config.js`：

```js
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: { extend: {} },
  plugins: [],
};
```

新建/覆盖 `src/index.css`：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; margin: 0; }
body { background: #0a0a0a; color: #e5e7eb; font-family: ui-sans-serif, system-ui; }
```

`src/main.tsx` 里 `import "./index.css";`。

删掉老的 `App.css`，把 `App.tsx` 改成：

```tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function App() {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  return (
    <main className="flex flex-col items-center justify-center h-full gap-4">
      <h1 className="text-3xl font-semibold">你好，Tauri</h1>
      <div className="flex gap-2">
        <input
          className="bg-zinc-800 rounded px-3 py-1 outline-none"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="输入你的名字"
        />
        <button
          className="bg-brand-500 hover:bg-brand-600 rounded px-4 py-1"
          onClick={async () => setMsg(await invoke<string>("greet", { name }))}
        >
          打招呼
        </button>
      </div>
      {msg && <p className="text-gray-400">{msg}</p>}
    </main>
  );
}
```

注意 `bg-brand-500` 需要我们在 tailwind.config 里加 brand 色（见第 6 章）。

## 五、常见陷阱

> **`pnpm tauri dev` 卡在 `Waiting for your frontend dev server`**
>
> 1420 端口被占用或 Vite 启动失败。先 `pnpm dev` 看错误。

> **Windows 上 `error: linker link.exe not found`**
>
> 第 2 章的 C++ Build Tools 没装全。

> **`invoke` 调用报 `Not allowed by ACL`**
>
> Capabilities 不对。第 13 章详述。

> **WebView 白屏**
>
> 常见于 Linux WebKitGTK。查 `RUST_LOG=tauri=debug pnpm tauri dev` 日志。或在 WebView 里按 F12（开发模式默认开 DevTools）。

## 本章小结

- `create-tauri-app` 一键生成项目。
- 前端 `src/`、后端 `src-tauri/`、配置 `tauri.conf.json`。
- 热更新（前端）+ 重编译（Rust）是基本开发节奏。

## 动手时刻

- [ ] 跑通 `pnpm tauri dev`。
- [ ] 加上 Tailwind，把 UI 改成中文。
- [ ] 在 `lib.rs` 加一个 `#[tauri::command] async fn now() -> String` 返回当前时间字符串，在前端显示。
- [ ] 打一个 release 包：`pnpm tauri build`，看看 bundle 目录里的安装包。

下一章，工程化目录规范。
