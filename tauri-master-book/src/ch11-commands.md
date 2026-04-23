# 第 11 章 前后端通信 1：Commands（invoke）

## 本章目标

- 把 `#[tauri::command]` 的所有签名玩熟。
- 掌握参数、返回值、错误、窗口与 AppHandle 注入。
- 学会给前端生成类型安全的 invoke 包装（`tauri-specta`）。
- 踩完「命名大小写」、「参数序列化」、「错误结构化」三大坑。

## 一、Command 的 5 种常用签名

```rust
// 1. 同步无参
#[tauri::command]
fn ping() -> String { "pong".into() }

// 2. 异步带参
#[tauri::command]
async fn add(a: i64, b: i64) -> i64 { a + b }

// 3. 带错误
#[tauri::command]
async fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 { Err("div by zero".into()) } else { Ok(a / b) }
}

// 4. 注入 AppHandle / Window / State
#[tauri::command]
async fn play(
    app: tauri::AppHandle,
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
    song_id: i64,
) -> Result<(), AppError> {
    state.player().play(song_id).await?;
    app.emit("song-changed", song_id).ok();
    Ok(())
}

// 5. 结构化参数
#[derive(serde::Deserialize)]
struct ScanRequest { root: String, recursive: bool }

#[tauri::command]
async fn scan(req: ScanRequest) -> Result<usize, AppError> { /* ... */ }
```

前端调用：

```ts
import { invoke } from "@tauri-apps/api/core";

await invoke("ping");                                // "pong"
await invoke("add", { a: 1, b: 2 });                 // 3
await invoke("divide", { a: 6, b: 0 });              // 抛异常
await invoke("play", { songId: 123 });               // songId 自动映射 song_id
await invoke("scan", { req: { root: "/music", recursive: true } });
```

## 二、命名大小写：Rust snake_case ↔ JS camelCase

Tauri **自动**把 `song_id` 映射到 `songId`（前端传 camelCase，后端接 snake_case）。这是 Tauri 2 的默认行为，由 `rename_all="camelCase"` 在宏层面实现。

两边约定清晰：

- 命令名：Rust `fn play` → 前端 `invoke("play")`。
- 参数名：Rust `song_id` → 前端 `songId`。
- 如果 Rust 侧字段就叫 `songId`（不推荐），前端也传 `songId`。

## 三、返回值的序列化

返回值必须实现 `serde::Serialize`。CloudTone 里的常用返回类型：

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub added: usize,
    pub updated: usize,
    pub skipped: usize,
    pub duration_ms: u64,
}
```

前端得到：

```ts
interface ScanResult { added: number; updated: number; skipped: number; durationMs: number; }
```

### 大字节流

返回几十 MB 的字节数组用 JSON 会把主线程卡住。两个办法：

- `#[tauri::command]` 返回 `Vec<u8>`——Tauri 会走 binary channel，前端拿 `ArrayBuffer`。
- 或者用 `Channel<T>` 做流式返回（见第 12 章）。

## 四、错误处理：结构化 AppError

直接 `Result<T, String>` 对调试不友好。推荐：

```rust
// src-tauri/src/error.rs
use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("db: {0}")]
    Db(#[from] sqlx::Error),
    #[error("audio: {0}")]
    Audio(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("{0}")]
    Other(String),
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        #[derive(Serialize)]
        struct Repr<'a> { kind: &'a str, message: String }
        let repr = match self {
            AppError::Io(e) => Repr { kind: "io", message: e.to_string() },
            AppError::Db(e) => Repr { kind: "db", message: e.to_string() },
            AppError::Audio(m) => Repr { kind: "audio", message: m.clone() },
            AppError::NotFound(m) => Repr { kind: "notFound", message: m.clone() },
            AppError::Other(m) => Repr { kind: "other", message: m.clone() },
        };
        repr.serialize(s)
    }
}
```

前端：

```ts
try {
  await invoke("play", { songId });
} catch (e) {
  // e 是 { kind: "audio", message: "..." } 或 string
  if (typeof e === "object" && e !== null && "kind" in e) {
    const err = e as { kind: string; message: string };
    toast.error(`[${err.kind}] ${err.message}`);
  } else {
    toast.error(String(e));
  }
}
```

## 五、State 注入与并发

```rust
#[tauri::command]
async fn set_volume(state: tauri::State<'_, AppState>, volume: f32) -> Result<(), AppError> {
    let mut player = state.player.lock().await;
    player.set_volume(volume);
    Ok(())
}
```

注意点：

- `State<'_, T>` 的生命周期由宏自动填。**不要手写 `'a`**。
- 同一个 State 会被多次并发调用。确保里面的同步原语正确（第 7 章）。

## 六、类型安全的前端包装：`tauri-specta`

默认 `invoke<T>(cmd, args)` 里 `T` 靠你手写。大项目两边签名很容易对不上。

**方案**：引入 `specta` + `tauri-specta`，自动把 Rust command 导出成 TS 函数。

`Cargo.toml`：

```toml
[dependencies]
specta = { version = "2.0.0-rc", features = ["serde", "derive"] }
tauri-specta = { version = "=2.0.0-rc", features = ["derive", "typescript"] }
```

在 command 上同时加 `#[specta::specta]`：

```rust
#[tauri::command]
#[specta::specta]
async fn add(a: i64, b: i64) -> i64 { a + b }
```

导出 TS：

```rust
use tauri_specta::{collect_commands, Builder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let specta = Builder::<tauri::Wry>::new().commands(collect_commands![add, play, pause]);
    #[cfg(debug_assertions)]
    specta.export(
        specta_typescript::Typescript::default(),
        "../src/lib/ipc.ts",
    ).expect("export TS");

    tauri::Builder::default()
        .invoke_handler(specta.invoke_handler())
        .run(tauri::generate_context!())
        .unwrap();
}
```

`pnpm tauri dev` 一跑，`src/lib/ipc.ts` 自动生成：

```ts
// ipc.ts (auto-generated)
export const commands = {
  async add(a: number, b: number): Promise<number> { return invoke("add", { a, b }); },
  async play(songId: number): Promise<void> { return invoke("play", { songId }); },
  // ...
};
```

前端直接 `commands.add(1,2)` —— 改 Rust 签名编译器立刻报错。这是 CloudTone 生产级项目的标配。

## 七、`invoke` 的小魔法

### 取消

Tauri 2 的 `invoke` 目前不原生支持取消——但你可以通过 Channel + `AbortController` 模拟。

### 超时

封一个工具：

```ts
export async function invokeWithTimeout<T>(cmd: string, args: any, ms = 10000): Promise<T> {
  return Promise.race([
    invoke<T>(cmd, args),
    new Promise<T>((_, r) => setTimeout(() => r(new Error("timeout")), ms)),
  ]);
}
```

### 进度反馈

对长任务（扫库、下载），用 Events 或 Channel 往前端推进度，`invoke` 只负责启停。

## 常见陷阱

> **1. 前端 `invoke("play", { song_id: 1 })`，后端收不到**
>
> 用 camelCase：`{ songId: 1 }`。

> **2. `Result<(), AppError>` 在 JS 里的 resolved value 是 `null`**
>
> `()` 会被序列化成 `null`。前端判空用 `=== null` 或忽略返回值。

> **3. 返回很大的 `Vec<u8>`，内存爆**
>
> 流式用 Channel；或者落盘后返回 path，前端用 `asset://` 协议读。

> **4. 命令没注册：`Command x not found`**
>
> 忘记写到 `generate_handler![...]`。

> **5. `State<'_, T>` 里的 `T` 没 `Send + Sync`**
>
> Rust 会大段报错。常见原因：T 里放了 `Rc`、`RefCell`；改成 `Arc<Mutex<_>>`。

## 本章小结

- `#[tauri::command]` 是前后端桥梁。
- `camelCase` / `snake_case` 自动转换。
- `AppError` + `serde::Serialize` 让错误结构化。
- `tauri-specta` 让前端类型安全，是生产级项目必备。

## 动手时刻

在你的 hello 项目里：

- [ ] 加一个 `get_system_info` 命令返回结构体 `{ os: String, arch: String, memory_mb: u64 }`，前端展示。
- [ ] 让它带上错误路径（模拟 NotFound），前端 toast 显示。
- [ ] 接入 `tauri-specta`，生成 `ipc.ts` 后在前端用。

下一章，讲 Events：事件总线、订阅取消、与 Channel 的关系。
