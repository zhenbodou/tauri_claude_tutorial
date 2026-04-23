# 第 20 章 日志、错误处理与崩溃上报

## 本章目标

- 用 `tracing` 打结构化日志，按级别滚动写入。
- 把 Rust 的 `panic` 捕获并落盘。
- 前端错误（未捕获的 Promise、render 错误）收拢到统一上报点。
- 为生产级 Tauri app 建立可运维的观测闭环。

## 一、`tracing`：结构化日志的现代选择

```toml
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "fmt", "json"] }
tracing-appender = "0.2"
```

初始化：

```rust
// src-tauri/src/core/log.rs
use std::path::Path;
use tracing_appender::rolling;
use tracing_subscriber::{fmt, EnvFilter, prelude::*};

pub fn init(log_dir: &Path) -> tracing_appender::non_blocking::WorkerGuard {
    std::fs::create_dir_all(log_dir).ok();
    let file_appender = rolling::daily(log_dir, "cloudtone.log");
    let (nb, guard) = tracing_appender::non_blocking(file_appender);

    let env = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,cloudtone=debug,sqlx=warn"));

    let file_layer = fmt::layer()
        .with_writer(nb)
        .with_ansi(false)
        .with_target(true)
        .with_thread_ids(false)
        .json();

    let stdout_layer = fmt::layer().with_writer(std::io::stdout);

    tracing_subscriber::registry()
        .with(env)
        .with(file_layer)
        .with(stdout_layer)
        .init();

    guard
}
```

> **注意** 返回 `WorkerGuard` 必须在 main 的生命周期里存活，否则日志 drop 掉。

`setup`：

```rust
.setup(|app| {
    let log_dir = app.path().app_log_dir()?;
    let guard = crate::core::log::init(&log_dir);
    app.manage(LogGuard(guard));   // 存进 State
    Ok(())
})

struct LogGuard(tracing_appender::non_blocking::WorkerGuard);
```

### 使用

```rust
use tracing::{info, warn, error, debug, trace, instrument};

#[instrument(skip(state))]
async fn play(state: tauri::State<'_, AppState>, song_id: i64) -> Result<(), AppError> {
    info!(song_id, "play requested");
    let mut p = state.player.lock().await;
    if let Err(e) = p.play(song_id).await {
        error!(error = %e, "play failed");
        return Err(e);
    }
    Ok(())
}
```

`#[instrument]` 会为函数自动建一个 span，日志里带上调用上下文。非常好用。

## 二、前端日志

### 用 `tauri-plugin-log`

```bash
pnpm tauri add log
```

```rust
.plugin(tauri_plugin_log::Builder::new()
    .target(tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: Some("front.log".into()) }))
    .level(log::LevelFilter::Info)
    .build())
```

前端：

```ts
import { info, warn, error, debug } from "@tauri-apps/plugin-log";
info("Hello");
error("Boom", { file: "App.tsx" });
```

和 Rust 日志写到同一目录，便于串联。

## 三、捕获 panic

默认 panic 会打印到 stderr，用户看不到。用 `std::panic::set_hook`：

```rust
pub fn install_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        tracing::error!(
            target: "panic",
            message = %info,
            location = ?info.location(),
            "Rust panic"
        );
    }));
}
```

`setup` 里第一个调用。

## 四、AppError 的上报

给 `AppError` 派生 `serde::Serialize`（第 11 章）之后，前端能拿到 `{kind, message}`。在前端统一包装 invoke：

```ts
// src/lib/ipc.ts
import { invoke as rawInvoke } from "@tauri-apps/api/core";
import { error as logError } from "@tauri-apps/plugin-log";

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await rawInvoke<T>(cmd, args);
  } catch (e) {
    logError(`invoke(${cmd}) failed: ${JSON.stringify(e)}`);
    throw e;
  }
}
```

搭配 React 错误边界：

```tsx
import { Component, ReactNode } from "react";
import { error as logError } from "@tauri-apps/plugin-log";

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error, info: unknown) {
    logError(`React error: ${err.message}\n${(info as any).componentStack}`);
  }
  render() {
    if (this.state.hasError) return <div className="p-8 text-red-400">出错了，请重启 CloudTone</div>;
    return this.props.children;
  }
}
```

全局未捕获错误：

```tsx
window.addEventListener("unhandledrejection", ev => {
  logError(`unhandledrejection: ${String(ev.reason)}`);
});
```

## 五、崩溃上报

生产 app 可选接入：

- 自建 HTTP 收集：最简单。命中 panic / ErrorBoundary 发 POST 到你的服务器。
- Sentry（`sentry-rust` + `@sentry/react`）：功能完备，付费。
- 本地 `crash/*.json`：先落盘，下次启动时带上报。

CloudTone 默认本地收集 + 用户同意后上报。**尊重用户隐私**，开源项目特别注意。

## 六、运维工具：命令行 tail 日志

设置页加一个 "打开日志目录" 按钮：

```ts
import { open } from "@tauri-apps/plugin-opener";
await open(await appLogDir());
```

工程师用户会感谢你。

## 七、日志级别分层建议

| 级别 | 场景 |
|------|------|
| `trace` | 音频 buffer 填充、每帧渲染（调试用） |
| `debug` | 一次 command 调用、DB 查询耗时 |
| `info` | 扫描开始/结束、模块初始化、用户动作 |
| `warn` | 可降级的错误（在线音源 fail 但已切备源） |
| `error` | 不可恢复、需要关注 |

生产默认 info，设置里提供「详细日志」开关。

## 常见陷阱

> **1. WorkerGuard 被 drop，日志消失**
>
> 返回值必须持久保存。

> **2. 日志文件过大**
>
> `tracing-appender` 只按日期滚动；大小限制用 `tracing-appender-rolling::RollingFileAppender` 2.x 或自己压缩归档。

> **3. panic hook 不生效**
>
> 注册要早。另外 `#[tokio::main]` 和 Tauri 初始化的先后顺序会影响。

> **4. 前端 log 卡 UI**
>
> `tauri-plugin-log` 自己在后台写。别在 hot render path 里狂 log。

## 本章小结

- `tracing` + `tauri-plugin-log` 是前后端日志标配。
- panic hook 让崩溃有迹可循。
- AppError + 错误边界让前端也可观测。

## 动手时刻

- [ ] 在 hello 项目里接入 tracing + tauri-plugin-log。
- [ ] 写一个 `raise_panic` 命令触发 panic，观察日志落盘。
- [ ] 前端故意写一个会抛异常的组件，用 ErrorBoundary 兜住。

第一部分完结。下一页，我们正式开始 CloudTone 项目的设计与实现。
