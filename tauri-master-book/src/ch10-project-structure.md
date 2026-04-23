# 第 10 章 项目工程化与目录规范

## 本章目标

- 把 `tauri-hello` 扩展成一个「能支撑上千行代码」的工程结构。
- 敲定前端 / 后端目录分层。
- 配置 ESLint、Prettier、路径别名 `@/...`。
- 介绍 Cargo workspace 的用法（为 CloudTone 的多 crate 结构铺路）。

## 一、最终要长成这样

后面 CloudTone 的目录大致是：

```
cloudtone/
├── src/                            # 前端
│   ├── app/                        # 页面层（路由对应）
│   │   ├── home/
│   │   ├── library/
│   │   ├── playlist/
│   │   └── settings/
│   ├── components/                 # 可复用 UI
│   │   ├── ui/                     # shadcn/ui 生成
│   │   └── player/
│   ├── features/                   # 业务切片（Zustand store + hooks）
│   │   ├── player/
│   │   ├── library/
│   │   ├── lyrics/
│   │   └── download/
│   ├── lib/                        # 工具/封装（cn、invoke wrappers）
│   ├── types/                      # TS 类型
│   ├── main.tsx
│   ├── router.tsx
│   └── index.css
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── cmds/                   # 按领域拆分的 command 模块
│   │   │   ├── mod.rs
│   │   │   ├── player.rs
│   │   │   ├── library.rs
│   │   │   └── settings.rs
│   │   ├── core/                   # 业务核心（与 Tauri 解耦）
│   │   │   ├── mod.rs
│   │   │   ├── audio/              # 音频引擎
│   │   │   ├── library/
│   │   │   ├── lyrics/
│   │   │   ├── db/
│   │   │   └── providers/
│   │   ├── state.rs                # 全局 AppState
│   │   ├── error.rs                # 统一错误
│   │   └── events.rs               # 事件定义
│   ├── capabilities/
│   ├── migrations/                 # SQL 迁移
│   ├── tauri.conf.json
│   ├── Cargo.toml
│   └── build.rs
├── packages/                       # 前端共享包（可选）
│   └── cloudtone-ipc/              # 前后端共享类型自动生成
├── .vscode/
├── .github/workflows/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

本章先按这个骨架改造出一个空壳，CloudTone 每一章在上面加砖加瓦。

## 二、Vite 路径别名

`src/` 下目录深了，`../../../../` 很难看。

`vite.config.ts`：

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  server: { port: 1420, strictPort: true },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

`tsconfig.json` 里同步：

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noImplicitReturns": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

使用：

```tsx
import { cn } from "@/lib/cn";
import { usePlayer } from "@/features/player/store";
```

## 三、ESLint + Prettier

```bash
pnpm add -D eslint @eslint/js typescript-eslint eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-refresh prettier eslint-config-prettier
```

`eslint.config.js`（flat config）：

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  prettier,
];
```

`.prettierrc.json`：

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "printWidth": 100,
  "trailingComma": "all"
}
```

`.vscode/settings.json`：

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

## 四、后端模块分层

避开「所有 command 堆一起」的坑。拆成：

**`src-tauri/src/lib.rs`** —— 入口，只做注册：

```rust
mod cmds;
mod core;
mod error;
mod events;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .setup(|app| {
            // 初始化数据库、扫描库等
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmds::player::play,
            cmds::player::pause,
            cmds::library::scan,
            cmds::settings::get_all,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**`src-tauri/src/cmds/mod.rs`**：

```rust
pub mod player;
pub mod library;
pub mod settings;
```

**`src-tauri/src/cmds/player.rs`**（示意）：

```rust
use crate::{state::AppState, error::AppError};
use serde::Serialize;

#[derive(Serialize)]
pub struct PlayerStatus { pub playing: bool, pub position: f64 }

#[tauri::command]
pub async fn play(state: tauri::State<'_, AppState>, song_id: i64) -> Result<(), AppError> {
    state.player().play(song_id).await
}

#[tauri::command]
pub async fn pause(state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    state.player().pause().await
}
```

**核心原则：command 层薄，业务逻辑放 `core/`**。等到写测试时你就会感谢自己。

## 五、Cargo workspace（可选，但推荐）

当 Rust 代码超过 3000 行，建议拆子 crate。`src-tauri/Cargo.toml` 改成 workspace：

```toml
[workspace]
members = [".", "crates/audio", "crates/library", "crates/providers"]

[package]
name = "cloudtone"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = [] }
audio = { path = "crates/audio" }
library = { path = "crates/library" }
providers = { path = "crates/providers" }
# ...
```

然后 `src-tauri/crates/audio/` 独立成 crate。好处：

- `audio` 可以脱离 Tauri 单独测（只跑 `cargo test -p audio`）。
- 编译缓存粒度更细。
- 概念清晰：`audio::Player` 是「音频引擎」，不是「Tauri 命令」。

不强制，但 CloudTone 第 26 章会演示这么拆。

## 六、前后端共享类型

手写两遍 TS 类型和 Rust struct 是万恶之源。两种方案：

1. **`ts-rs`**：在 Rust 里派生 `TS`，`cargo test` 时导出 `.ts`。
2. **`specta` / `tauri-specta`**：为 Tauri 定制的方案，能自动生成类型安全的前端 `invoke` 包装。

CloudTone 采用 `tauri-specta`（2026 年社区主流）。第 22 章集成时详解。

## 七、提交规范与 Husky

可选，但生产项目建议配：

```bash
pnpm add -D husky lint-staged
pnpm husky init
```

`.husky/pre-commit`：

```
pnpm lint-staged
```

`package.json`：

```json
"lint-staged": {
  "src/**/*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "src-tauri/src/**/*.rs": ["rustfmt"]
}
```

## 常见陷阱

> **别名 `@/` 在 Rust 侧报错**：别名是前端的事。Rust 侧用 `crate::`、`super::`。

> **改了 `tsconfig.json` 后 IDE 不生效**：VS Code 需要 `TypeScript: Restart TS Server`。

> **Rust 模块私有访问**：默认模块 item 是私有的。跨模块调用需要 `pub`。

## 本章小结

- 分层清晰的前后端目录是可持续开发的前提。
- 路径别名、ESLint、Prettier 不是花架子——团队协作必需。
- command 层薄，业务放 `core/`。

## 动手时刻

把你第 9 章生成的项目按本章结构改造：

- 加 `@/` 路径别名并生效。
- 把 `greet` 命令挪到 `cmds/hello.rs`。
- 在 `lib.rs` 里只做注册。

下一章，正式讲 `invoke` 和 `#[tauri::command]` 的深水区。
