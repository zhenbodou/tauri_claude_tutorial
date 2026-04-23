# 第 29 章 数据库 Schema：歌曲 / 专辑 / 艺人 / 歌单 / 播放历史

## 本章目标

- 完善 schema：补上 favorites、settings、metadata 索引。
- 给出常用查询：按专辑聚合、最近添加、热度榜、搜索联接。
- 封装 Rust 查询层 `core::db::queries`。

## 一、补完 schema

在第 19 章的基础上追加：

```sql
-- 20260201_addons.sql
CREATE TABLE IF NOT EXISTS favorites (
    song_id INTEGER PRIMARY KEY REFERENCES songs(id) ON DELETE CASCADE,
    added_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS library_roots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_history_song ON play_history(song_id);
CREATE INDEX IF NOT EXISTS idx_history_played_at ON play_history(played_at DESC);
```

## 二、DTO

```rust
// src-tauri/src/core/db/models.rs
use serde::Serialize;
use specta::Type;

#[derive(Serialize, Type, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Song {
    pub id: i64,
    pub title: String,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub artist_id: Option<i64>,
    pub album_id: Option<i64>,
    pub path: String,
    pub duration_ms: i64,
    pub track_no: Option<i64>,
    pub liked: bool,
    pub cover_path: Option<String>,
}

#[derive(Serialize, Type, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Album {
    pub id: i64,
    pub title: String,
    pub artist: String,
    pub year: Option<i64>,
    pub cover_path: Option<String>,
    pub song_count: i64,
}
```

## 三、查询

```rust
// src-tauri/src/core/db/queries.rs
use sqlx::SqlitePool;
use super::models::*;

pub async fn list_songs(pool: &SqlitePool, limit: i64, offset: i64) -> sqlx::Result<Vec<Song>> {
    sqlx::query_as::<_, Song>(
        "SELECT s.id, s.title, a.name AS artist, al.title AS album,
                s.artist_id, s.album_id, s.path, s.duration_ms, s.track_no,
                EXISTS(SELECT 1 FROM favorites f WHERE f.song_id = s.id) AS liked,
                al.cover_path
         FROM songs s
         LEFT JOIN artists a ON s.artist_id = a.id
         LEFT JOIN albums al ON s.album_id = al.id
         ORDER BY s.added_at DESC LIMIT ? OFFSET ?"
    ).bind(limit).bind(offset).fetch_all(pool).await
}

pub async fn list_albums(pool: &SqlitePool) -> sqlx::Result<Vec<Album>> {
    sqlx::query_as::<_, Album>(
        "SELECT al.id, al.title, COALESCE(a.name, '未知艺人') AS artist,
                al.year, al.cover_path,
                (SELECT COUNT(*) FROM songs s WHERE s.album_id = al.id) AS song_count
         FROM albums al LEFT JOIN artists a ON al.artist_id = a.id
         ORDER BY al.title"
    ).fetch_all(pool).await
}

pub async fn toggle_favorite(pool: &SqlitePool, song_id: i64) -> sqlx::Result<bool> {
    let exists: Option<i64> = sqlx::query_scalar("SELECT 1 FROM favorites WHERE song_id = ?").bind(song_id).fetch_optional(pool).await?;
    if exists.is_some() {
        sqlx::query("DELETE FROM favorites WHERE song_id = ?").bind(song_id).execute(pool).await?;
        Ok(false)
    } else {
        sqlx::query("INSERT INTO favorites (song_id) VALUES (?)").bind(song_id).execute(pool).await?;
        Ok(true)
    }
}

pub async fn record_play(pool: &SqlitePool, song_id: i64, ms: u64) -> sqlx::Result<()> {
    sqlx::query("INSERT INTO play_history (song_id, duration_played_ms) VALUES (?, ?)")
        .bind(song_id).bind(ms as i64).execute(pool).await?;
    Ok(())
}

pub async fn top_played(pool: &SqlitePool, limit: i64) -> sqlx::Result<Vec<(i64, i64)>> {
    sqlx::query_as::<_, (i64, i64)>(
        "SELECT song_id, COUNT(*) AS c FROM play_history GROUP BY song_id ORDER BY c DESC LIMIT ?"
    ).bind(limit).fetch_all(pool).await
}
```

## 四、暴露命令

```rust
// cmds/library.rs
#[tauri::command] #[specta::specta]
pub async fn library_list_songs(state: tauri::State<'_, AppState>, limit: i64, offset: i64) -> Result<Vec<Song>, String> {
    queries::list_songs(&state.db, limit, offset).await.map_err(|e| e.to_string())
}

#[tauri::command] #[specta::specta]
pub async fn library_toggle_favorite(state: tauri::State<'_, AppState>, song_id: i64) -> Result<bool, String> {
    queries::toggle_favorite(&state.db, song_id).await.map_err(|e| e.to_string())
}
```

## 五、前端调用

```ts
// src/features/library/queries.ts
import { useQuery } from "@tanstack/react-query";
import { commands } from "@/lib/ipc";

export function useLibrarySongs(limit = 200, offset = 0) {
  return useQuery({
    queryKey: ["library","songs", limit, offset],
    queryFn: () => commands.libraryListSongs(limit, offset),
  });
}
```

## 本章小结

- 查询层集中管理，避免 SQL 散落。
- 列表页高效联表一次拿全。
- 收藏、播放统计等都有专用索引。

## 动手时刻

- [ ] 在 Library 页展示扫描结果。
- [ ] 心形按钮切换收藏，立即反映在 UI。

下一章：播放队列与各种循环模式。
