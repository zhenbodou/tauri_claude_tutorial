# 第 7 章 Rust 关键点速览（面向 Tauri）

## 本章目标

- 你已经比较熟练 Rust。本章只复习**最影响 Tauri 开发**的几个点。
- 把 `async`、`Send + Sync`、`tokio::spawn`、`Mutex`/`RwLock`、`Arc`、`trait object` 这套组合拳梳清楚。
- 介绍 `serde`、`thiserror`、`anyhow` 三个在 Tauri 中几乎必装的 crate。

## 一、Tauri 的 Rust 口味

Tauri 2.x 的核心默认用 **异步 Rust**。`#[tauri::command]` 可以是同步 `fn`，也可以是 `async fn`。生产项目里大多数是 async——因为你会读文件、查数据库、调 HTTP。

所以我们必须对下面这套东西非常熟：

1. `async / .await` 和 `tokio` 运行时。
2. `Send + Sync`、`Arc<Mutex<_>>`、`RwLock`、跨线程/跨 await 共享状态。
3. 错误建模：`thiserror` 定义枚举 error，`anyhow` 做 bubble up，向前端序列化成字符串。
4. `serde` 把结构体与 JSON 互转。
5. trait object `Box<dyn Trait>` 和对象安全。

## 二、`async` 与 `tokio`

Tauri 内置 `tokio` 运行时。你直接写：

```rust
#[tauri::command]
async fn fetch_lyrics(song_id: i64) -> Result<String, String> {
    let res = reqwest::get(format!("https://lyric.api/{}", song_id))
        .await
        .map_err(|e| e.to_string())?;
    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}
```

**要点**：

- `async fn` 返回一个 `Future`，直到被 `.await` 才运行。
- 运行时默认就绪。你可以在函数体里 `tokio::spawn(async move { ... })` 起后台任务。
- `#[tauri::command]` 里的 `async fn` 会在 Tauri 的 worker 上执行，不阻塞 UI 线程——这是性能的关键。

### `spawn` vs `spawn_blocking`

- I/O 密集、协程友好的工作：`tokio::spawn`。
- CPU 密集或调用了阻塞 C 库（比如 `rodio`、某些解码器内部有阻塞 I/O）：`tokio::task::spawn_blocking`，避免把 tokio worker 卡住。

```rust
let result = tokio::task::spawn_blocking(move || decode_entire_mp3(&path))
    .await
    .unwrap();
```

## 三、`Send + Sync` 这两个 trait 你必须吃透

在 Tauri 里：

- Tauri `State<T>` 要求 `T: Send + Sync + 'static`。
- `tokio::spawn` 里闭包要求 `Send + 'static`。
- `async fn` 的返回 Future 是不是 `Send`，取决于它捕获的所有变量是否 `Send`。

最常见的报错：

```
future cannot be sent between threads safely
within `...`, the trait `Send` is not implemented for `...`
```

大部分情况是：你在 `.await` 跨点之间持有了一个不可 `Send` 的东西（典型：`std::sync::MutexGuard`）。解决：

- 把 `std::sync::Mutex` 换成 `tokio::sync::Mutex`（它的 `MutexGuard` 是 `Send`）。
- 或者在 `.await` 之前把 guard `drop` 掉。

### `Arc<Mutex<T>>` 的正确姿势

Tauri 里共享状态常用：

```rust
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct AppState {
    pub player: Arc<Mutex<AudioPlayer>>,
}

#[tauri::command]
async fn play(state: tauri::State<'_, AppState>, id: i64) -> Result<(), String> {
    let mut p = state.player.lock().await;  // await 这里，合法
    p.play(id).map_err(|e| e.to_string())?;
    Ok(())
}
```

要点：

- **State 本身不要再包 Mutex**，而是内部字段包。`State<AppState>` 克隆的是 `Arc`。
- **读多写少用 `RwLock`**。

### `Arc<RwLock<T>>`

```rust
use tokio::sync::RwLock;

let libs: Arc<RwLock<Library>> = ...;
let r = libs.read().await;  // 多读并行
let mut w = libs.write().await; // 写独占
```

## 四、错误处理：`thiserror` + `anyhow`

在业务库（被别人调用）里定义具体错误枚举：

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum LibraryError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("db: {0}")]
    Db(#[from] sqlx::Error),
    #[error("unsupported format: {0}")]
    UnsupportedFormat(String),
}

pub type Result<T> = std::result::Result<T, LibraryError>;
```

在上层（二进制或 command 层）用 `anyhow`：

```rust
pub async fn import_folder(path: &str) -> anyhow::Result<usize> {
    let songs = scan(path)?;          // From 转换自动实现
    for s in &songs { save(s).await?; }
    Ok(songs.len())
}
```

### Tauri command 里返回什么

`#[tauri::command]` 的返回值必须能 serde。标准模式是：

```rust
#[tauri::command]
async fn import(path: String) -> Result<usize, String> {
    do_import(&path).await.map_err(|e| e.to_string())
}
```

前端拿到一个字符串 error，调用方 try/catch 或 TanStack Query 处理。

我们在 CloudTone 里会包装一个更漂亮的 `AppError` 枚举，并实现 `serde::Serialize`，让前端拿到结构化错误（第 20 章）。

## 五、`serde`：JSON 世界的通行证

```rust
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Song {
    pub id: i64,
    pub title: String,
    pub artist: String,
    pub duration_ms: i64,
    pub liked: bool,
}
```

`#[serde(rename_all = "camelCase")]` 让后端 snake_case 字段自动转为前端惯用的 camelCase，TS 类型对上。

### 嵌套与可选

```rust
#[derive(Serialize, Deserialize)]
struct Playlist {
    id: i64,
    name: String,
    description: Option<String>,   // 可选字段 -> TS: string | null
    songs: Vec<Song>,
}
```

### 枚举序列化

默认 Rust 枚举序列化成 `{"TypeA": ...}`，对前端不友好。常用改写：

```rust
#[derive(Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
enum Message {
    PlaybackProgress { position: f64, duration: f64 },
    SongChanged(Song),
}
// 输出：{"type":"playbackProgress","data":{"position":1.2,"duration":200}}
```

## 六、trait object 与 Provider 模式

CloudTone 里「在线音源 Provider」就是 trait object：

```rust
#[async_trait::async_trait]
pub trait MusicProvider: Send + Sync {
    fn name(&self) -> &'static str;
    async fn search(&self, keyword: &str) -> anyhow::Result<Vec<Song>>;
    async fn stream_url(&self, song_id: &str) -> anyhow::Result<String>;
}

pub struct ProviderRegistry {
    providers: Vec<Box<dyn MusicProvider>>,
}
```

要点：

- `async` trait 需要 `async-trait` crate（Rust 1.75 起支持原生 async fn in trait，但库生态还在过渡，Tauri 项目建议继续用 `async-trait`）。
- trait 要**对象安全**：方法里别用泛型、别带 `Self: Sized`。

## 七、Tauri 专属：`tauri::command` 签名速查

```rust
// 无参
#[tauri::command]
fn ping() -> String { "pong".into() }

// 按名传参（前端：invoke("greet", { name: "a" })）
#[tauri::command]
async fn greet(name: String) -> String { format!("hi {}", name) }

// 注入 AppHandle
#[tauri::command]
async fn open_window(app: tauri::AppHandle) { /* ... */ }

// 注入窗口
#[tauri::command]
async fn resize(window: tauri::Window) { window.set_fullscreen(true).unwrap(); }

// 注入 State
#[tauri::command]
async fn get_songs(state: tauri::State<'_, AppState>) -> Vec<Song> { ... }

// 混合
#[tauri::command]
async fn play(app: tauri::AppHandle, state: tauri::State<'_, AppState>, id: i64) -> Result<(), String> { ... }
```

**注意**：

- `State<'_, T>` 里的 `'_` 来自 Tauri 的宏生成，别手写生命周期。
- 命令签名里参数顺序**无关紧要**，Tauri 按类型注入。
- 传原生 `u64` 的极大值会在 JS 里丢精度（见第 4 章陷阱）。

## 八、你必须装的 Rust 速查表

下面这些 crate 在 Tauri 项目里出现频率最高：

| crate | 用途 |
|-------|------|
| `serde` + `serde_json` | 序列化 |
| `thiserror` | 定义错误枚举 |
| `anyhow` | 上层错误传递 |
| `async-trait` | async trait |
| `tokio` | 异步运行时 |
| `tracing` + `tracing-subscriber` | 结构化日志 |
| `reqwest` | HTTP 客户端 |
| `sqlx` | SQLite/MySQL 异步访问 |
| `url` | URL 构造 |
| `once_cell` | 全局 lazy static |
| `uuid` | 唯一 ID |
| `chrono` / `time` | 时间处理 |
| `dirs` / `directories` | 跨平台目录 |
| `lofty` | 音频元数据读取 |
| `symphonia` | 音频解码 |
| `cpal` | 音频输出 |
| `walkdir` | 目录遍历 |

第 22 章以后我们会一个个用到。

## 常见陷阱

> **1. 在 Tauri command 里用 `std::sync::Mutex` 跨 `.await`，编译不过**
>
> 换 `tokio::sync::Mutex`。

> **2. 闭包 move 了 non-Send 的数据到 `tokio::spawn`**
>
> 常见于 `Rc`、`RefCell`、原生指针。改成 `Arc<Mutex<_>>`。

> **3. `async fn` in trait 抛 `dyn-compatible` 错误**
>
> 用 `#[async_trait]`。

> **4. 数字精度丢失**
>
> 前后端统一约定：DB id 用 `i64`，前端拿到是 `number`。不要用 `u64`。

> **5. Tauri State 更新找不到新值**
>
> State 是 `&T`，不是 `&mut T`。内部用 `Mutex/RwLock` 可变。

## 本章小结

- `async + tokio + Arc<Mutex>` 是 Tauri 后端的基本调味品。
- `serde` 接通前后端类型。
- `thiserror` + `anyhow` 是错误处理的双子星。
- trait object 搭 Provider 扩展点。

## 动手时刻

不用写代码，脑中回答：

1. 为什么 Tauri State 里要包 `Mutex`？
2. `std::sync::Mutex` 和 `tokio::sync::Mutex` 在 Tauri 里怎么选？
3. `#[tauri::command] async fn f(state: tauri::State<'_, S>)` 的生命周期从哪里来？

答对进入下一部分：**Tauri 核心**。
