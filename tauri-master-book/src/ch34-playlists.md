# 第 34 章 歌单 CRUD 与拖拽排序

## 本章目标

- 歌单的增删改查。
- 歌单内歌曲的顺序管理（`position` 字段）。
- 用 `@dnd-kit` 实现拖拽排序。
- 右键菜单：添加到歌单、从歌单移除。

## 一、Schema 回顾

```sql
CREATE TABLE playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cover_path TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE playlist_songs (
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, song_id)
);
CREATE INDEX idx_ps_order ON playlist_songs(playlist_id, position);
```

`position` 用整数浮点策略：插入 / 移动时给新位置一个介于前后 position 中点的值，避免全表重排。例如 10、20、30 之间插入就是 15、25。

## 二、Rust 查询层

```rust
// core/db/queries.rs
pub async fn create_playlist(pool: &SqlitePool, name: &str) -> sqlx::Result<i64> {
    sqlx::query_scalar::<_, i64>(
        "INSERT INTO playlists (name) VALUES (?) RETURNING id"
    ).bind(name).fetch_one(pool).await
}

pub async fn list_playlists(pool: &SqlitePool) -> sqlx::Result<Vec<Playlist>> {
    sqlx::query_as::<_, Playlist>(
        "SELECT p.id, p.name, p.cover_path,
                (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) AS song_count
         FROM playlists p ORDER BY p.created_at DESC"
    ).fetch_all(pool).await
}

pub async fn add_to_playlist(pool: &SqlitePool, pid: i64, sid: i64) -> sqlx::Result<()> {
    let max: Option<i64> = sqlx::query_scalar(
        "SELECT MAX(position) FROM playlist_songs WHERE playlist_id = ?"
    ).bind(pid).fetch_optional(pool).await?.flatten();
    let pos = max.unwrap_or(0) + 1000;
    sqlx::query("INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)")
        .bind(pid).bind(sid).bind(pos).execute(pool).await?;
    Ok(())
}

pub async fn move_in_playlist(pool: &SqlitePool, pid: i64, sid: i64, new_prev: Option<i64>, new_next: Option<i64>) -> sqlx::Result<()> {
    let prev_pos: i64 = match new_prev {
        Some(id) => sqlx::query_scalar("SELECT position FROM playlist_songs WHERE playlist_id = ? AND song_id = ?")
            .bind(pid).bind(id).fetch_one(pool).await?,
        None => 0,
    };
    let next_pos: i64 = match new_next {
        Some(id) => sqlx::query_scalar("SELECT position FROM playlist_songs WHERE playlist_id = ? AND song_id = ?")
            .bind(pid).bind(id).fetch_one(pool).await?,
        None => prev_pos + 2000,
    };
    let new_pos = (prev_pos + next_pos) / 2;
    // 冲突时 rebalance
    if (next_pos - prev_pos).abs() < 2 {
        rebalance(pool, pid).await?;
        return Ok(());
    }
    sqlx::query("UPDATE playlist_songs SET position = ? WHERE playlist_id = ? AND song_id = ?")
        .bind(new_pos).bind(pid).bind(sid).execute(pool).await?;
    Ok(())
}

async fn rebalance(pool: &SqlitePool, pid: i64) -> sqlx::Result<()> {
    let ids: Vec<i64> = sqlx::query_scalar(
        "SELECT song_id FROM playlist_songs WHERE playlist_id = ? ORDER BY position"
    ).bind(pid).fetch_all(pool).await?;
    let mut tx = pool.begin().await?;
    for (i, id) in ids.iter().enumerate() {
        sqlx::query("UPDATE playlist_songs SET position = ? WHERE playlist_id = ? AND song_id = ?")
            .bind(((i + 1) * 1000) as i64).bind(pid).bind(id).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}
```

## 三、命令

```rust
#[tauri::command] #[specta::specta]
pub async fn playlist_create(state: tauri::State<'_, AppState>, name: String) -> Result<i64, String> {
    queries::create_playlist(&state.db, &name).await.map_err(|e| e.to_string())
}

#[tauri::command] #[specta::specta]
pub async fn playlist_add(state: tauri::State<'_, AppState>, pid: i64, sid: i64) -> Result<(), String> {
    queries::add_to_playlist(&state.db, pid, sid).await.map_err(|e| e.to_string())
}

#[tauri::command] #[specta::specta]
pub async fn playlist_move(state: tauri::State<'_, AppState>, pid: i64, sid: i64, prev: Option<i64>, next: Option<i64>) -> Result<(), String> {
    queries::move_in_playlist(&state.db, pid, sid, prev, next).await.map_err(|e| e.to_string())
}
```

## 四、前端拖拽

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

```tsx
// src/app/playlist/PlaylistSongs.tsx
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { commands } from "@/lib/ipc";

export function PlaylistSongs({ playlistId, songs, refetch }: Props) {
  const [items, setItems] = useState(songs);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function onDragEnd(e: any) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex(s => s.id === active.id);
    const newIdx = items.findIndex(s => s.id === over.id);
    const next = arrayMove(items, oldIdx, newIdx);
    setItems(next);
    const prev = next[newIdx - 1]?.id ?? null;
    const after = next[newIdx + 1]?.id ?? null;
    await commands.playlistMove(playlistId, active.id, prev, after);
    refetch();
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map(s => s.id)} strategy={verticalListSortingStrategy}>
        {items.map((s, i) => <SortableRow key={s.id} song={s} index={i} />)}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ song, index }: { song: Song; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
         className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded">
      <span className="w-6 text-text-tertiary">{index + 1}</span>
      <div className="flex-1 truncate">{song.title}</div>
      <span className="text-text-secondary">{song.artist}</span>
    </div>
  );
}
```

## 五、右键菜单

Tauri 2.x 的 WebView 支持原生右键菜单，但最灵活还是用纯前端 `@radix-ui/react-context-menu`：

```tsx
import * as Ctx from "@radix-ui/react-context-menu";

<Ctx.Root>
  <Ctx.Trigger asChild>{children}</Ctx.Trigger>
  <Ctx.Portal>
    <Ctx.Content className="bg-surface-2 rounded p-1 shadow-xl">
      <Ctx.Item onClick={playNext}>下一首播放</Ctx.Item>
      <Ctx.Sub>
        <Ctx.SubTrigger>添加到歌单</Ctx.SubTrigger>
        <Ctx.SubContent>
          {playlists.map(p => <Ctx.Item key={p.id} onClick={() => addTo(p.id)}>{p.name}</Ctx.Item>)}
          <Ctx.Separator />
          <Ctx.Item onClick={createNew}>新建歌单…</Ctx.Item>
        </Ctx.SubContent>
      </Ctx.Sub>
      <Ctx.Item onClick={toggleLike}>{liked ? "取消喜欢" : "喜欢"}</Ctx.Item>
    </Ctx.Content>
  </Ctx.Portal>
</Ctx.Root>
```

## 本章小结

- 中点插入 + 偶尔 rebalance 是稳定高效的顺序方案。
- `@dnd-kit` 是 React 里拖拽体验最好的库。
- 右键菜单用 Radix 即可，跨平台一致。

## 动手时刻

- [ ] 新建一个"我的收藏"歌单，拖动排序。
- [ ] 右键歌曲 → 添加到歌单。

下一章：收藏、最近播放、每日推荐。
