# 第 12 章 前后端通信 2：Events（emit / listen）

## 本章目标

- 搞清 Events 和 Commands 的定位差异。
- 掌握 `emit`、`emit_to`、`listen`、`once`、`unlisten` 全家桶。
- 使用 Tauri 2 的 `Channel<T>` 做点对点的流式通信（比 `emit/listen` 更精准）。
- 在 CloudTone 的「播放进度」「下载进度」「扫描进度」三个场景中做出正确选型。

## 一、一张图看清两种通信

| 模式 | 方向 | 特点 | 适用 |
|------|------|------|------|
| `invoke` (Command) | JS → Rust → 返回值 | 请求-响应（Promise） | RPC 调用：play/pause/save |
| `emit` / `listen` (Event) | 任意 → 任意（广播） | 订阅-发布 | 跨窗口通知、进度广播 |
| `Channel<T>` | Rust → JS（点对点） | 持续流，单消费者 | 流式返回：下载进度、日志 tail |

## 二、Events 基本用法

### Rust 侧 emit

```rust
use tauri::Emitter;

#[tauri::command]
async fn hello_world(app: tauri::AppHandle) -> Result<(), ()> {
    app.emit("greeting", "Hello from Rust")?;  // 全局广播
    Ok(())
}
```

### Rust 侧只发给特定窗口

```rust
app.emit_to("main", "greeting", "Hello main window")?;
```

### Rust 侧发给当前窗口（在 command 里注入 Window）

```rust
#[tauri::command]
async fn refresh(window: tauri::Window) -> Result<(), ()> {
    window.emit("refreshed", ())?;
    Ok(())
}
```

### 前端 listen

```ts
import { listen, UnlistenFn } from "@tauri-apps/api/event";

const unlisten: UnlistenFn = await listen<string>("greeting", event => {
  console.log(event.payload);
});
// 组件卸载时调用
unlisten();
```

### 前端只监听一次

```ts
import { once } from "@tauri-apps/api/event";
await once<string>("app-ready", e => console.log(e.payload));
```

### 前端也可以 emit

```ts
import { emit } from "@tauri-apps/api/event";
await emit("frontend-event", { foo: 1 });
```

Rust 监听：

```rust
use tauri::Listener;

app.listen("frontend-event", |event| {
    let payload: Value = serde_json::from_str(event.payload()).unwrap();
    // ...
});
```

## 三、React Hook 封装

每次都写 useEffect + unlisten 太啰嗦。封一个：

```ts
// src/lib/hooks/useTauriEvent.ts
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";

export function useTauriEvent<T>(name: string, handler: (payload: T) => void) {
  const savedHandler = useRef(handler);
  savedHandler.current = handler;

  useEffect(() => {
    const p = listen<T>(name, e => savedHandler.current(e.payload));
    return () => { p.then(unlisten => unlisten()); };
  }, [name]);
}
```

使用：

```tsx
useTauriEvent<{ position: number }>("player:progress", ({ position }) => {
  setPosition(position);
});
```

## 四、事件命名约定

- 用领域前缀：`player:progress`、`library:scanned`、`download:state`。
- 进度类用 throttle：Rust 侧每 100ms 发一次就够了，别每帧发。
- 事件 payload 用 `#[serde(rename_all = "camelCase")]` 保持前端一致。

## 五、`Channel<T>`：流式点对点

`emit` 是广播。如果一个 UI 组件订阅了 `download:progress`，其他窗口也会收到。有时你只想针对**这一次调用**的调用者发进度。

Tauri 2 引入 `Channel<T>`：

### Rust 侧

```rust
use tauri::ipc::Channel;
use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
enum DownloadEvent {
    Started { url: String, total: u64 },
    Progress { transferred: u64, bps: u64 },
    Done { path: String },
    Failed { error: String },
}

#[tauri::command]
async fn download(url: String, channel: Channel<DownloadEvent>) -> Result<(), AppError> {
    channel.send(DownloadEvent::Started { url: url.clone(), total: 0 })?;
    // ... 分块写 & 发 Progress
    channel.send(DownloadEvent::Done { path: "/tmp/a".into() })?;
    Ok(())
}
```

### 前端

```ts
import { Channel, invoke } from "@tauri-apps/api/core";

type DownloadEvent =
  | { event: "started"; data: { url: string; total: number } }
  | { event: "progress"; data: { transferred: number; bps: number } }
  | { event: "done"; data: { path: string } }
  | { event: "failed"; data: { error: string } };

const ch = new Channel<DownloadEvent>();
ch.onmessage = msg => {
  switch (msg.event) {
    case "progress": setProgress(msg.data.transferred); break;
    case "done": toast.success("下载完成"); break;
    case "failed": toast.error(msg.data.error); break;
  }
};
await invoke("download", { url: "https://...", channel: ch });
```

对比 `emit/listen` 的优势：

- **点对点**：不会误广播到其他订阅者。
- **生命周期清晰**：命令结束就结束。
- **类型清晰**：通过 `serde(tag)` 联合枚举传递。

CloudTone 里「下载」「全库扫描」「导出」三大场景都用 `Channel`。「播放进度」因为是全局状态仍用 `emit`。

## 六、跨窗口通信

场景：主窗口按了「播放」，迷你播放器窗口也要同步 UI。

**最佳实践**：所有 player 状态放 Rust（一个 `AppState.player`），前端通过 `emit` 事件同步。

```rust
async fn on_player_state_change(app: &tauri::AppHandle, state: &PlayerState) {
    app.emit("player:state", state).ok();
}
```

两个窗口都 `listen("player:state")`，自然同步。

不要试图做「窗口 A 直接发消息给窗口 B」——两边走 Core 中转更清晰，也方便做 throttle 和去重。

## 七、性能注意

- **高频事件 throttle**：播放进度如果 1ms 发一次，前端 React 渲染 + JSON 序列化会拖慢整个 app。Rust 侧用 `tokio::time::interval(Duration::from_millis(100))`。
- **事件 payload 小**：别一次发几百 KB 的歌词 JSON；只发 id，前端自己 `invoke("get_lyrics", id)`。
- **unlisten 要做**：组件卸载不 unlisten 会泄露。

## 常见陷阱

> **1. `listen` 的返回值是 Promise**
>
> `const un = listen(...)` 得到的是 Promise，不是 unlisten 函数。要 `await`。

> **2. payload 发了带 BigInt / Date，前端炸**
>
> JSON 不支持。Rust 侧用 `i64` / ISO 字符串。

> **3. 多个实例同时 listen，卸载错**
>
> React 严格模式下 useEffect 跑两次，要确保每次都正确 cleanup。本章上面的 `useTauriEvent` 已处理。

> **4. Channel 在 command 结束后还发消息**
>
> 会被 drop 掉。要么保留 `Channel`（例如放到 State 里），要么改用 `emit`。

## 本章小结

- `invoke` = 请求/响应；`emit/listen` = 广播；`Channel` = 点对点流。
- 进度类场景 `Channel` 比 `emit` 更精准。
- 跨窗口用「Core 中转」最健壮。

## 动手时刻

- [ ] 在 hello 项目里写一个 `tick` 命令：Rust 每秒发一次 `"tick:time"` 事件带当前时间，前端显示。
- [ ] 写一个 `download` 命令用 `Channel` 模拟进度（用 `tokio::time::sleep` + 0..100 的循环）。
- [ ] 在 React 用上一章的 `useTauriEvent` hook。

下一章，Tauri 2 的权限核弹：Capabilities / ACL。
