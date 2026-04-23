# 第 19 章 数据库持久化：SQLite + `sqlx` + 迁移

## 本章目标

- 在 Tauri 项目里集成 SQLite + `sqlx`。
- 写迁移脚本，随应用启动自动执行。
- 掌握 `sqlx::query!`、`query_as!`、连接池、事务、FTS5。
- 为 CloudTone 设计一张完整的数据库 schema。

## 一、为什么 SQLite

- 零服务：随 app 发布。
- 文件数据库：方便备份、跨机迁移。
- 支持 FTS5 全文搜索（CloudTone 本地搜索的底层）。
- 支持触发器、视图、JSON1。

客户端库里 `sqlx` 是首选：async 原生、编译期 SQL 检查。

## 二、依赖

```toml
# Cargo.toml
sqlx = { version = "0.8", features = [
    "runtime-tokio",
    "sqlite",
    "macros",
    "migrate",
    "chrono"
]}
```

## 三、初始化与迁移

`src-tauri/migrations/20260101_init.sql`：

```sql
CREATE TABLE IF NOT EXISTS artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    year INTEGER,
    cover_path TEXT,
    UNIQUE(title, artist_id)
);

CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist_id INTEGER REFERENCES artists(id),
    album_id INTEGER REFERENCES albums(id),
    path TEXT NOT NULL UNIQUE,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    track_no INTEGER,
    disc_no INTEGER,
    file_size INTEGER NOT NULL DEFAULT 0,
    file_hash TEXT NOT NULL,
    format TEXT NOT NULL,
    bitrate INTEGER NOT NULL DEFAULT 0,
    sample_rate INTEGER NOT NULL DEFAULT 0,
    added_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    liked INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist_id);
CREATE INDEX IF NOT EXISTS idx_songs_album ON songs(album_id);

-- 全文搜索
CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts USING fts5(
    title, artist, album,
    content='',
    tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS playlist_songs (
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, song_id)
);

CREATE TABLE IF NOT EXISTS play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id INTEGER NOT NULL REFERENCES songs(id),
    played_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    duration_played_ms INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
```

### Rust 侧启动

```rust
// src-tauri/src/core/db.rs
use sqlx::{sqlite::{SqlitePoolOptions, SqliteConnectOptions}, SqlitePool};
use std::path::Path;

pub async fn open_db(path: &Path) -> anyhow::Result<SqlitePool> {
    if let Some(parent) = path.parent() { tokio::fs::create_dir_all(parent).await.ok(); }
    let opts = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new().max_connections(8).connect_with(opts).await?;
    // 内置迁移
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}
```

在 `setup` 里调用：

```rust
.setup(|app| {
    let db_path = app.path().app_data_dir()?.join("cloudtone.sqlite");
    let pool = tauri::async_runtime::block_on(open_db(&db_path))?;
    app.manage(AppState::new(pool));
    Ok(())
})
```

**WAL 模式** 非常重要：并发读不阻塞写，写不阻塞读。

## 四、查询

### `query!`：编译期校验

```rust
let row = sqlx::query!(
    "SELECT title, duration_ms FROM songs WHERE id = ?",
    id
).fetch_one(&pool).await?;
println!("{} {}", row.title, row.duration_ms);
```

这需要 `DATABASE_URL` 在编译期指向一个真实 DB。CI 麻烦。**推荐用 `query_as` + struct**：

### `query_as!`：结构体映射

```rust
#[derive(sqlx::FromRow)]
pub struct SongRow {
    pub id: i64,
    pub title: String,
    pub artist: Option<String>,
    pub duration_ms: i64,
    pub path: String,
}

pub async fn list_recent(pool: &SqlitePool, limit: i64) -> sqlx::Result<Vec<SongRow>> {
    sqlx::query_as::<_, SongRow>(
        "SELECT s.id, s.title, a.name AS artist, s.duration_ms, s.path
         FROM songs s LEFT JOIN artists a ON s.artist_id = a.id
         ORDER BY s.added_at DESC LIMIT ?"
    )
    .bind(limit)
    .fetch_all(pool)
    .await
}
```

### 事务

```rust
let mut tx = pool.begin().await?;
sqlx::query("INSERT INTO artists (name) VALUES (?)").bind(name).execute(&mut *tx).await?;
let artist_id = tx.last_insert_rowid();
sqlx::query("INSERT INTO albums (title, artist_id) VALUES (?, ?)")
    .bind(album).bind(artist_id).execute(&mut *tx).await?;
tx.commit().await?;
```

## 五、upsert：「不存在则插入」

```sql
INSERT INTO artists (name) VALUES (?)
ON CONFLICT(name) DO UPDATE SET name=excluded.name
RETURNING id
```

Rust：

```rust
let id: i64 = sqlx::query_scalar(
    "INSERT INTO artists (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING id"
).bind(name).fetch_one(&mut *tx).await?;
```

## 六、FTS5 全文搜索（中英文友好）

配合触发器维护：

```sql
CREATE TRIGGER songs_ai AFTER INSERT ON songs BEGIN
  INSERT INTO songs_fts(rowid, title, artist, album)
    VALUES (new.id, new.title,
            (SELECT name FROM artists WHERE id = new.artist_id),
            (SELECT title FROM albums WHERE id = new.album_id));
END;

CREATE TRIGGER songs_ad AFTER DELETE ON songs BEGIN
  DELETE FROM songs_fts WHERE rowid = old.id;
END;

CREATE TRIGGER songs_au AFTER UPDATE ON songs BEGIN
  UPDATE songs_fts SET title = new.title WHERE rowid = new.id;
END;
```

查询：

```rust
let rows = sqlx::query_as::<_, SongRow>(
    "SELECT s.id, s.title, a.name AS artist, s.duration_ms, s.path
     FROM songs_fts fts JOIN songs s ON s.id = fts.rowid
     LEFT JOIN artists a ON s.artist_id = a.id
     WHERE songs_fts MATCH ? ORDER BY rank LIMIT 50"
)
.bind(format!("{}*", keyword))  // 前缀匹配
.fetch_all(&pool).await?;
```

中文分词：FTS5 默认 `unicode61` 对中文只能按字拆分。如果需要词级分词，可以：

- 集成 jieba（`sqlite3_jieba` 动态库），打包复杂。
- 简化方案：前端/Rust 做 N-gram 预处理再存进 FTS。CloudTone 用 2-gram。

## 七、`tauri-plugin-sql`：在前端直接读 DB？

插件提供了前端直接执行 SQL 的能力：

```bash
pnpm tauri add sql
```

```ts
import Database from "@tauri-apps/plugin-sql";
const db = await Database.load("sqlite:cloudtone.sqlite");
const rows = await db.select<SongRow[]>("SELECT * FROM songs LIMIT 50");
```

**不推荐** 在大项目里用。原因：

- SQL 在前端泄露表结构；权限控制细粒度难。
- 难写类型安全；绕过业务校验。

CloudTone 一律走 Rust command + `sqlx`。

## 八、备份与迁移升级

- 用户升级 app 时，`sqlx::migrate!` 会自动执行新文件。
- 破坏性 schema 变更走 "拷贝 + 新建 + 迁移数据"。
- 定期导出 `VACUUM INTO` 备份到用户 `$APPDATA/cloudtone/backup/`。

## 常见陷阱

> **1. `migrate!` 宏找不到 migrations 目录**
>
> `migrate!("./migrations")` 的路径相对 `src-tauri/`。

> **2. DB 文件锁**
>
> 忘了 WAL + 其他进程打开 DB。要关 GUI 工具再调试。

> **3. `i64` / `number` 精度**
>
> 前端拿 `duration_ms` 是 number。上限 9e15 远超够。

> **4. 并发写冲突**
>
> 多 writer 要用 `BEGIN IMMEDIATE` 或重试。CloudTone 写入大都串行化到单一 task。

## 本章小结

- SQLite + `sqlx` + WAL + 迁移 = Tauri 本地持久化黄金组合。
- FTS5 支撑搜索。
- 前端不要直接读 DB。

## 动手时刻

- [ ] 在 hello 项目里接入 sqlite，建一张 `notes(id, text)` 表。
- [ ] 写 4 个 command：`add_note` / `list_notes` / `delete_note` / `update_note`。
- [ ] 前端做一个简单 notes 页面，验证 CRUD。

下一章，日志 & 错误处理 & 崩溃上报。
