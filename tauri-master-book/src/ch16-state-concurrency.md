# 第 16 章 状态管理与并发：`State` + `async` + `Mutex`

## 本章目标

- 设计 Tauri 应用的全局 `AppState` 结构。
- 搞清 `std::sync::Mutex` 和 `tokio::sync::Mutex` 在 Tauri 里的取舍。
- 用 `watch` / `broadcast` channel 做「内部事件总线」。
- 避免最常见的死锁与 `!Send` 编译报错。

## 一、`AppState` 该长什么样

CloudTone 的全局状态集：

```rust
// src-tauri/src/state.rs
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock, broadcast};
use sqlx::SqlitePool;

use crate::core::{
    audio::Player,
    library::LibraryManager,
    providers::ProviderRegistry,
    settings::Settings,
};

pub struct AppState {
    pub db: SqlitePool,
    pub player: Arc<Mutex<Player>>,
    pub library: Arc<RwLock<LibraryManager>>,
    pub providers: Arc<ProviderRegistry>,
    pub settings: Arc<RwLock<Settings>>,
    pub events: broadcast::Sender<InternalEvent>,
}

#[derive(Clone, Debug)]
pub enum InternalEvent {
    PlayerStarted { song_id: i64 },
    PlayerPaused,
    PlayerResumed,
    PlayerStopped,
    PositionChanged(f64),
    LibraryUpdated,
    SettingsChanged,
}

impl AppState {
    pub async fn new(db: SqlitePool) -> Self {
        let (tx, _) = broadcast::channel(64);
        Self {
            db,
            player: Arc::new(Mutex::new(Player::new(tx.clone()))),
            library: Arc::new(RwLock::new(LibraryManager::new())),
            providers: Arc::new(ProviderRegistry::default()),
            settings: Arc::new(RwLock::new(Settings::load().await)),
            events: tx,
        }
    }
}
```

**要点**：

1. **外面不要再套 `Arc`**：Tauri 自己 `manage(state)` 时会包一层，内部字段用 `Arc<Mutex>` 就够。
2. **读多写少用 `RwLock`**：settings、library 都是。
3. **内部事件 broadcast**：audio 线程往里发，其它模块可以订阅。

## 二、`std::sync::Mutex` vs `tokio::sync::Mutex`

| | `std::sync::Mutex` | `tokio::sync::Mutex` |
|---|---|---|
| MutexGuard 是 Send | ❌（在 Linux/Windows 上） | ✅ |
| 阻塞调用者线程 | ✅ 会 park OS 线程 | ❌ 跑协程 |
| 锁持有期间能 `.await` | ❌（guard 不 Send） | ✅ |
| 性能 | 无抢占时极快 | 略慢 |
| 适用 | 只在同步代码里短暂加锁 | 需要跨 `.await` 持锁 |

**口诀**：

- 如果你的锁只保护一小段**非 async** 代码，用 `std::sync::Mutex`（更快）。
- 如果你需要在持锁期间做 I/O、调 command、`.await`，用 `tokio::sync::Mutex`。

**踩坑**：下面这段编译不过：

```rust
let mut p = state.player.lock().unwrap();  // std::sync
// p 持有 MutexGuard(!Send)
something.await;   // ❌ future not Send
```

换 `tokio::sync::Mutex::lock().await` 即可。

## 三、避免死锁

Rust 的锁不是魔法——依然会死锁。典型场景：

```rust
let mut p = state.player.lock().await;   // 锁 player
let mut l = state.library.write().await; // 再锁 library
// 另一个任务先锁 library，再试图锁 player → 死锁
```

**规则**：

1. **固定加锁顺序**。全局约定 `player > library > settings`。
2. **锁作用域尽量小**。别在锁里调用可能阻塞的东西。
3. **别在持锁时 emit 事件**（emit 可能同步触发监听者）。改用 broadcast channel 解耦。

## 四、`watch` 和 `broadcast`：解耦事件流

### `tokio::sync::broadcast`

1 生产者，多消费者。每个消费者有自己的 queue。

```rust
let (tx, _) = broadcast::channel::<InternalEvent>(64);

// 生产者
tx.send(InternalEvent::PlayerPaused).ok();

// 消费者 1
let mut rx = tx.subscribe();
tokio::spawn(async move {
    while let Ok(ev) = rx.recv().await {
        match ev { InternalEvent::PlayerPaused => {...}, _ => {} }
    }
});
```

CloudTone 用它把 Audio 线程的事件广播给 Command 层、Library 层、Recent 历史记录等。

### `tokio::sync::watch`

1 生产者，多消费者，但只保留**最新值**。适合「当前播放进度」这种。

```rust
let (tx, rx) = watch::channel(0.0f64);

// 播放线程
tx.send(1.23).ok();

// UI 订阅
let mut rx = rx.clone();
tokio::spawn(async move {
    while rx.changed().await.is_ok() {
        let v = *rx.borrow();
        // ...
    }
});
```

## 五、把后台工作留给 `tokio::spawn`

Tauri command 是跑在 tokio runtime 上的。但**别把长任务直接塞进 command**，前端会等死。

正确姿势：

```rust
#[tauri::command]
async fn start_scan(app: tauri::AppHandle, state: tauri::State<'_, AppState>, path: String) -> Result<(), AppError> {
    let lib = state.library.clone();
    let h = app.clone();
    tokio::spawn(async move {
        let result = lib.write().await.scan_folder(&path, |progress| {
            h.emit("scan:progress", progress).ok();
        }).await;
        h.emit("scan:done", result.map_err(|e| e.to_string())).ok();
    });
    Ok(())
}
```

立刻返回，让前端自由。用事件推进度。

## 六、CPU 密集任务：`spawn_blocking` 和 Rayon

音频 FFT、封面图解码这些，不走 tokio scheduler：

```rust
let handle = tokio::task::spawn_blocking(move || {
    // 同步的 CPU 密集
    compute_fft(buf)
});
let result = handle.await.unwrap();
```

大规模并行（全库扫描）可以用 `rayon`：

```rust
use rayon::prelude::*;

let metas: Vec<_> = paths.par_iter()
    .filter_map(|p| read_metadata(p).ok())
    .collect();
```

**不要**在 tokio async 里直接 `par_iter` 长时间运行——它会吃 tokio worker 线程。要么 `spawn_blocking` 包住，要么起独立 rayon thread pool。

## 七、让状态跨 `#[tauri::command]` 可变

三种常见模式：

### 模式 A：`Arc<Mutex<T>>`

```rust
pub struct AppState { pub counter: Arc<Mutex<i64>> }

#[tauri::command]
async fn inc(state: tauri::State<'_, AppState>) -> i64 {
    let mut c = state.counter.lock().await;
    *c += 1;
    *c
}
```

### 模式 B：内部可变性 Actor 模式

对 `Player` 这种有自己线程的模块，更好的方式是让它跑一个 tokio 任务，外部只通过 mpsc 通道给它发命令：

```rust
pub struct PlayerHandle {
    tx: tokio::sync::mpsc::Sender<PlayerCmd>,
}

enum PlayerCmd {
    Play(i64),
    Pause,
    Seek(f64),
}

// 外部调用
player_handle.tx.send(PlayerCmd::Play(id)).await?;
```

内部只有一个消费者，锁都不要。Actor 模式是生产项目里最推荐的。第 26 章详细讲。

### 模式 C：`OnceCell` 延迟初始化

```rust
use once_cell::sync::OnceCell;
static DB: OnceCell<SqlitePool> = OnceCell::new();
```

小心：全局静态和 `#[tauri::command]` 的 State 注入可以混用，但**能用 State 就用 State**，不要乱用全局。

## 常见陷阱

> **1. `future cannot be sent between threads safely`**
>
> 锁 guard 跨 await。换 `tokio::sync::Mutex` 或提前 drop。

> **2. `State<'_, T>` 里 `T` 不是 `Send + Sync + 'static`**
>
> 检查字段：有没有 `Rc`、`RefCell`、原生指针。

> **3. 两个 command 加锁顺序不同，死锁**
>
> 文档化锁顺序，或者改 Actor 模式。

> **4. 频繁加锁导致性能下降**
>
> 读多写少用 RwLock；热点数据放 `DashMap`。

## 本章小结

- `AppState` = 应用的神经中枢，用 `Arc<Mutex/RwLock>` 或 Actor 模式。
- 跨 await 持锁必须 `tokio::sync::Mutex`。
- `broadcast` / `watch` / `mpsc` 是解耦神器。
- Long task 要 `spawn` + 事件反馈。

## 动手时刻

在 hello 项目里：

- [ ] 加一个 `counter: Arc<Mutex<i64>>` 到 AppState，前端点按钮 `inc`。
- [ ] 加一个 `start_long_task` 命令，用 `spawn` + 事件发 0..10 的进度。
- [ ] 尝试不用 `spawn`，直接在 command 里 sleep(5s)，观察前端冻结。

下一章，文件系统与路径。
