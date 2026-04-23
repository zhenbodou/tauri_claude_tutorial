# 第 28 章 本地音乐库扫描与元数据（`lofty` / `walkdir`）

## 本章目标

- 扫描用户选定目录，读取音频文件元数据。
- 用 `lofty` 抽取标题、艺人、专辑、时长、封面。
- 通过 `Channel<ScanEvent>` 把进度流式发给前端。
- 写入数据库 + 封面存到 `$APPCACHE/covers/`。

## 一、模块结构

```
src-tauri/src/core/library/
├── mod.rs
├── scanner.rs       # 目录遍历 + 元数据提取
├── importer.rs      # 入库逻辑
└── manager.rs       # 外部门面
```

## 二、Scanner

```rust
// scanner.rs
use std::path::{Path, PathBuf};
use lofty::{Accessor, AudioFile, ItemKey, TaggedFileExt};
use walkdir::WalkDir;

pub const AUDIO_EXT: [&str; 8] = ["mp3","flac","m4a","wav","ogg","aac","aiff","ape"];

#[derive(Debug, Clone)]
pub struct RawTrack {
    pub path: PathBuf,
    pub title: String,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub track_no: Option<u32>,
    pub disc_no: Option<u32>,
    pub year: Option<u32>,
    pub duration_ms: u64,
    pub bitrate: u32,
    pub sample_rate: u32,
    pub format: String,
    pub file_size: u64,
    pub cover_bytes: Option<Vec<u8>>,
    pub cover_mime: Option<String>,
}

pub fn list_audio(root: &Path) -> Vec<PathBuf> {
    WalkDir::new(root).into_iter().filter_map(Result::ok)
        .filter(|e| e.file_type().is_file())
        .filter(|e| e.path().extension().and_then(|s| s.to_str())
            .map(|s| AUDIO_EXT.contains(&s.to_lowercase().as_str())).unwrap_or(false))
        .map(|e| e.into_path()).collect()
}

pub fn read_tags(path: &Path) -> anyhow::Result<RawTrack> {
    let tagged = lofty::read_from_path(path)?;
    let props = tagged.properties();
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());

    let title = tag.and_then(|t| t.title().map(|c| c.to_string()))
        .unwrap_or_else(|| path.file_stem().and_then(|s| s.to_str()).unwrap_or("Unknown").to_string());
    let artist = tag.and_then(|t| t.artist().map(|c| c.to_string()));
    let album = tag.and_then(|t| t.album().map(|c| c.to_string()));
    let track_no = tag.and_then(|t| t.track());
    let disc_no = tag.and_then(|t| t.disk());
    let year = tag.and_then(|t| t.year());

    let (cover_bytes, cover_mime) = tag.and_then(|t| t.pictures().first())
        .map(|p| (Some(p.data().to_vec()), Some(p.mime_type().map(|m| m.to_string()).unwrap_or_default())))
        .unwrap_or((None, None));

    let size = std::fs::metadata(path)?.len();

    Ok(RawTrack {
        path: path.to_path_buf(),
        title, artist, album, track_no, disc_no, year,
        duration_ms: props.duration().as_millis() as u64,
        bitrate: props.audio_bitrate().unwrap_or(0),
        sample_rate: props.sample_rate().unwrap_or(0),
        format: path.extension().and_then(|e| e.to_str()).unwrap_or("").to_string(),
        file_size: size,
        cover_bytes, cover_mime,
    })
}
```

## 三、Importer：入库

```rust
// importer.rs
use sqlx::{SqlitePool, Transaction, Sqlite};
use std::path::PathBuf;
use super::scanner::RawTrack;

pub async fn upsert_artist(tx: &mut Transaction<'_, Sqlite>, name: &str) -> sqlx::Result<i64> {
    sqlx::query_scalar::<_, i64>(
        "INSERT INTO artists (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING id"
    ).bind(name).fetch_one(&mut **tx).await
}

pub async fn upsert_album(tx: &mut Transaction<'_, Sqlite>, title: &str, artist_id: i64, year: Option<u32>) -> sqlx::Result<i64> {
    sqlx::query_scalar::<_, i64>(
        "INSERT INTO albums (title, artist_id, year) VALUES (?, ?, ?)
         ON CONFLICT(title, artist_id) DO UPDATE SET year=COALESCE(albums.year, excluded.year) RETURNING id"
    ).bind(title).bind(artist_id).bind(year.map(|y| y as i64)).fetch_one(&mut **tx).await
}

pub async fn insert_song(tx: &mut Transaction<'_, Sqlite>, r: &RawTrack, artist_id: Option<i64>, album_id: Option<i64>, hash: String, cover_path: Option<PathBuf>) -> sqlx::Result<i64> {
    sqlx::query_scalar::<_, i64>(
        "INSERT INTO songs (title, artist_id, album_id, path, duration_ms, track_no, disc_no, file_size, file_hash, format, bitrate, sample_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
           title=excluded.title, artist_id=excluded.artist_id, album_id=excluded.album_id,
           duration_ms=excluded.duration_ms, bitrate=excluded.bitrate, sample_rate=excluded.sample_rate
         RETURNING id"
    )
    .bind(&r.title).bind(artist_id).bind(album_id)
    .bind(r.path.to_string_lossy())
    .bind(r.duration_ms as i64)
    .bind(r.track_no.map(|t| t as i64))
    .bind(r.disc_no.map(|t| t as i64))
    .bind(r.file_size as i64)
    .bind(hash).bind(&r.format)
    .bind(r.bitrate as i64).bind(r.sample_rate as i64)
    .fetch_one(&mut **tx).await
}

pub async fn save_cover(cache_dir: &std::path::Path, hash: &str, bytes: &[u8], mime: Option<&str>) -> anyhow::Result<PathBuf> {
    let ext = match mime {
        Some("image/png") => "png", Some("image/webp") => "webp", _ => "jpg",
    };
    let path = cache_dir.join(format!("{}.{}", hash, ext));
    if !path.exists() { tokio::fs::write(&path, bytes).await?; }
    Ok(path)
}
```

## 四、Manager & 命令

```rust
// manager.rs
use super::{scanner, importer};
use sqlx::SqlitePool;
use std::path::PathBuf;
use tauri::ipc::Channel;
use serde::Serialize;

#[derive(Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum ScanEvent {
    Started { total: usize },
    Progress { done: usize, current: String },
    Done { added: usize, updated: usize, skipped: usize, ms: u64 },
    Failed { error: String },
}

pub async fn scan_folder(pool: &SqlitePool, cache_dir: &std::path::Path, root: PathBuf, ch: Channel<ScanEvent>) -> anyhow::Result<()> {
    let start = std::time::Instant::now();
    let paths = scanner::list_audio(&root);
    ch.send(ScanEvent::Started { total: paths.len() })?;

    let (mut added, mut updated, mut skipped) = (0, 0, 0);
    for (i, p) in paths.iter().enumerate() {
        ch.send(ScanEvent::Progress { done: i, current: p.to_string_lossy().to_string() })?;
        match scanner::read_tags(p) {
            Ok(raw) => {
                let mut tx = pool.begin().await?;
                let artist_id = if let Some(a) = &raw.artist {
                    Some(importer::upsert_artist(&mut tx, a).await?)
                } else { None };
                let album_id = if let (Some(al), Some(aid)) = (&raw.album, artist_id) {
                    Some(importer::upsert_album(&mut tx, al, aid, raw.year).await?)
                } else { None };
                let hash = blake3::hash(&std::fs::read(p)?).to_hex().to_string();
                let cover_path = if let Some(b) = &raw.cover_bytes {
                    Some(importer::save_cover(cache_dir, &hash, b, raw.cover_mime.as_deref()).await?)
                } else { None };
                let _id = importer::insert_song(&mut tx, &raw, artist_id, album_id, hash, cover_path).await?;
                tx.commit().await?;
                added += 1;
            }
            Err(e) => { tracing::warn!("skip {}: {}", p.display(), e); skipped += 1; }
        }
    }

    ch.send(ScanEvent::Done { added, updated, skipped, ms: start.elapsed().as_millis() as u64 })?;
    Ok(())
}
```

## 五、Command

```rust
// cmds/library.rs
use crate::{state::AppState, core::library::manager};

#[tauri::command] #[specta::specta]
pub async fn library_scan(app: tauri::AppHandle, state: tauri::State<'_, AppState>, root: String, channel: tauri::ipc::Channel<manager::ScanEvent>) -> Result<(), String> {
    let pool = state.db.clone();
    let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("covers");
    std::fs::create_dir_all(&cache).ok();
    tokio::spawn(async move {
        if let Err(e) = manager::scan_folder(&pool, &cache, root.into(), channel.clone()).await {
            let _ = channel.send(manager::ScanEvent::Failed { error: e.to_string() });
        }
    });
    Ok(())
}
```

## 六、前端调用

```tsx
// src/app/library/LibraryPage.tsx
import { Channel } from "@tauri-apps/api/core";
import { commands } from "@/lib/ipc";
import { open } from "@tauri-apps/plugin-dialog";

function ImportButton() {
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  async function importFolder() {
    const picked = await open({ directory: true });
    if (!picked) return;
    const ch = new Channel();
    ch.onmessage = (msg: any) => {
      if (msg.event === "started") setProgress({ done: 0, total: msg.data.total });
      if (msg.event === "progress") setProgress(p => ({ ...p, done: msg.data.done }));
      if (msg.event === "done") toast.success(`扫描完成：新增 ${msg.data.added}`);
    };
    await commands.libraryScan(picked as string, ch);
  }
  return (
    <div>
      <button onClick={importFolder} className="px-4 py-2 bg-brand-500 rounded">导入音乐文件夹</button>
      {progress.total > 0 && <div>{progress.done}/{progress.total}</div>}
    </div>
  );
}
```

## 七、实时监听变化

```rust
use notify_debouncer_full::{new_debouncer, notify::*};
use std::time::Duration;

pub fn watch_library(root: PathBuf, pool: SqlitePool, app: tauri::AppHandle) {
    let mut debouncer = new_debouncer(Duration::from_secs(3), None, move |res| {
        // 收到 change 后重新扫描对应子目录
    }).unwrap();
    debouncer.watcher().watch(&root, RecursiveMode::Recursive).ok();
    // 把 debouncer 放 state 里防止 drop
}
```

## 本章小结

扫描 + 元数据 + 入库 + 前端进度串完。CloudTone 现在已经能识别你整个音乐目录。

## 动手时刻

- [ ] 导入一个 500+ 首的目录，观察进度。
- [ ] 让 `read_tags` 失败的歌也进入库（占位 title = 文件名）。

下一章：数据库 Schema 与查询层细化。
