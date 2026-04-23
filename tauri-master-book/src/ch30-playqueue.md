# 第 30 章 播放队列、随机、循环、记忆播放

## 本章目标

- 让播放队列成为一等公民。
- 实现四种模式：顺序、列表循环、单曲循环、随机。
- 做"上次播放位置记忆"。

## 一、队列位于前后端哪一端

两派：

- **纯前端**：Zustand store 存队列，Rust 只知道当前歌。好处：灵活；坏处：多窗口同步要 emit。
- **后端同步**：Rust 维护队列，前端 subscribe。好处：多窗口一致；坏处：IPC 频繁。

CloudTone 采用**后端主导 + 事件广播**。

## 二、Rust Queue

```rust
// src-tauri/src/core/audio/queue.rs
use rand::seq::SliceRandom;

#[derive(Clone, Copy, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum PlayMode { Sequence, ListLoop, SingleLoop, Shuffle }

pub struct Queue {
    pub items: Vec<i64>,     // song ids
    pub index: usize,
    pub mode: PlayMode,
    shuffle_history: Vec<usize>,
}

impl Queue {
    pub fn replace(&mut self, songs: Vec<i64>, start_id: Option<i64>) {
        self.items = songs;
        self.index = start_id.and_then(|id| self.items.iter().position(|&x| x == id)).unwrap_or(0);
    }
    pub fn current(&self) -> Option<i64> { self.items.get(self.index).copied() }
    pub fn next(&mut self) -> Option<i64> {
        if self.items.is_empty() { return None; }
        match self.mode {
            PlayMode::SingleLoop => self.current(),
            PlayMode::Shuffle => {
                let mut rng = rand::thread_rng();
                let idxs: Vec<_> = (0..self.items.len()).filter(|i| *i != self.index).collect();
                self.shuffle_history.push(self.index);
                self.index = *idxs.choose(&mut rng).unwrap_or(&self.index);
                self.current()
            }
            PlayMode::Sequence => {
                if self.index + 1 < self.items.len() { self.index += 1; self.current() } else { None }
            }
            PlayMode::ListLoop => {
                self.index = (self.index + 1) % self.items.len();
                self.current()
            }
        }
    }
    pub fn prev(&mut self) -> Option<i64> {
        if self.items.is_empty() { return None; }
        if self.mode == PlayMode::Shuffle {
            if let Some(last) = self.shuffle_history.pop() { self.index = last; }
        } else if self.index > 0 { self.index -= 1; }
        else if self.mode == PlayMode::ListLoop { self.index = self.items.len() - 1; }
        self.current()
    }
}
```

## 三、Player 接入 Queue

把 Queue 放到 InnerPlayer，或者同级 AppState 里。Command：

```rust
#[tauri::command] #[specta::specta]
pub async fn queue_set(state: tauri::State<'_, AppState>, ids: Vec<i64>, start_id: Option<i64>) -> Result<(), String> {
    let mut q = state.queue.lock().await;
    q.replace(ids, start_id);
    if let Some(id) = q.current() {
        drop(q);
        player_play_internal(state, id).await?;
    }
    Ok(())
}

#[tauri::command] #[specta::specta]
pub async fn queue_next(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut q = state.queue.lock().await;
    if let Some(id) = q.next() { drop(q); player_play_internal(state, id).await?; }
    Ok(())
}

#[tauri::command] #[specta::specta]
pub async fn queue_set_mode(state: tauri::State<'_, AppState>, mode: PlayMode) -> Result<(), String> {
    state.queue.lock().await.mode = mode; Ok(())
}
```

当播放 `Ended` 事件到来，后端自动调用 `queue_next_internal` 并 emit。

## 四、记忆播放

启动时从 DB `kv` 表读上次状态：

```sql
kv:
  last_song_id  -> "42"
  last_position -> "123.4"
  last_mode     -> "shuffle"
```

`setup` 里：

```rust
let last = sqlx::query_scalar::<_, String>("SELECT value FROM kv WHERE key = 'last_song_id'").fetch_optional(&pool).await.ok().flatten();
// 根据 last 加载并 pause
```

播放每 10 秒把当前 `position` 写回 `kv`，下次启动时 `seek` 到上次位置。

## 五、UI：队列面板

```tsx
// NowPlayingPanel.tsx 加 Queue Tab
const { queue, index } = usePlayer();

<div>
  {queue.map((song, i) => (
    <div key={song.id} className={cn("p-2 rounded flex items-center gap-2", i === index && "bg-white/10")}>
      <span className="w-5 text-text-tertiary">{i + 1}</span>
      <div className="flex-1 truncate">{song.title}</div>
      <span className="text-text-secondary text-xs">{song.artist}</span>
    </div>
  ))}
</div>
```

拖拽排序：用 `@dnd-kit/core`。第 34 章详讲。

## 本章小结

- Queue 主导在 Rust，一致性强。
- 四种模式覆盖常见场景。
- 记忆位置让回归用户零成本继续。

## 动手时刻

- [ ] 实现 `queue_set` / `queue_next`，UI 按钮触发。
- [ ] 切到随机模式，试试手感。

下一章：歌词。
