# 第 44 章 性能优化：虚拟列表、懒加载、包体积

## 本章目标

- 10 万条歌曲不卡：虚拟列表（`@tanstack/react-virtual`）。
- 图片懒加载与并发限流。
- 减小打包体积：代码分割、依赖剃刀。
- Rust 侧 SQL 优化、索引、预取。

## 一、虚拟列表

```bash
pnpm add @tanstack/react-virtual
```

```tsx
// src/components/SongList.tsx
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

export function SongList({ songs }: { songs: Song[] }) {
  const parent = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: songs.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 56,
    overscan: 8,
  });
  return (
    <div ref={parent} className="h-full overflow-y-auto">
      <div style={{ height: v.getTotalSize(), position: "relative" }}>
        {v.getVirtualItems().map(item => {
          const song = songs[item.index];
          return (
            <div key={song.id} style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${item.start}px)`, height: item.size }}>
              <SongRow song={song} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

## 二、图片懒加载

```tsx
<img src={`cover://${hash}`} loading="lazy" decoding="async" />
```

配合 Rust 侧 `tokio::sync::Semaphore(8)` 限制同时读磁盘的协议处理并发。

## 三、减小包体积

### 3.1 React 侧

```ts
// 动态 import
const LyricsPage = lazy(() => import("./pages/LyricsPage"));
```

Vite 会自动 chunk split。`vite-bundle-visualizer` 分析体积。

### 3.2 Tailwind

`content` 配置精准：

```js
content: ["./index.html","./src/**/*.{ts,tsx}"]
```

JIT 自动删除未使用类。

### 3.3 Rust 侧

- `Cargo.toml` release：

```toml
[profile.release]
opt-level = "z"
lto = "fat"
codegen-units = 1
strip = true
panic = "abort"
```

- 剔除多余 feature：`reqwest = { version = "0.12", default-features = false, features = ["rustls-tls","json","stream"] }`
- 用 `cargo bloat --release --crates` 看占比。

### 3.4 WebView 资源

Tauri 打包会把前端静态文件嵌入。`vite build` 后 `dist/` 的图片要手动压缩（`@squoosh/cli`）。

## 四、首屏加速

- **启动态**：backdrop 组件渲染 skeleton，数据并发请求。
- **预热**：Rust 侧 `setup` 里 warm up SQLite（`PRAGMA optimize`），并发打开第一页数据的 query。
- **去隐式渲染**：`React.memo` 包裹 SongRow，list 内 key 稳定。

## 五、SQL 与 DB

- 在 EXPLAIN QUERY PLAN 看有无 scan。
- 加合适索引：`idx_songs_added_at DESC`、`idx_play_history_played_at DESC`。
- 用分页 (`LIMIT/OFFSET`) 或 keyset：

```sql
SELECT * FROM songs WHERE added_at < ? ORDER BY added_at DESC LIMIT 200
```

- `PRAGMA journal_mode = WAL;`、`synchronous = NORMAL`。

## 六、音频解码的"瘦身"

默认把 symphonia 全家桶拉进来。只启用需要的编解码器：

```toml
symphonia = { version = "0.5", default-features = false, features = ["mp3","flac","aac","alac","ogg","vorbis","wav"] }
```

## 七、前端动画

- 只给 `transform` / `opacity` 加 `transition`，避免触发 layout。
- 列表滚动避免 box-shadow 与 filter。
- `will-change: transform` 仅给确认会动的元素。

## 八、内存

- 用 `weak` 封面缓存：前端 Map 长度限 200。
- Rust 侧大数据（扫描结果）分批写库，避免一次 `Vec<Song>` 20 万条。

## 九、观测

```rust
tracing::info!(target: "perf", took_ms = %elapsed.as_millis(), "library_list_songs");
```

前端用 `console.time` + Tauri 事件记录。定期导出 metrics，第 47 章接上报。

## 本章小结

- 虚拟列表、懒加载、bundle 分析是前端性能三板斧。
- Rust release profile 调好，二进制小到可以接受。
- 端到端度量，数据驱动优化。

## 动手时刻

- [ ] 扫 10 万首歌，滚动顺滑。
- [ ] 首屏 1 秒内可交互。

下一章：测试。
