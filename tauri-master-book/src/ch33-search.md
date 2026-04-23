# 第 33 章 搜索：本地全文索引与在线搜索

## 本章目标

- 用 SQLite FTS5 做本地搜索（标题 / 艺人 / 专辑）。
- 处理中文分词：2-gram。
- 前端搜索框：防抖、键盘快捷键、结果分组。
- 融合在线 Provider 搜索结果。

## 一、FTS5 回顾

第 19 章已建：

```sql
CREATE VIRTUAL TABLE songs_fts USING fts5(
    title, artist, album, content='', tokenize='unicode61'
);
```

`unicode61` 对英文、拉丁字母很好，但对中文"无助"——它只能整行匹配。方案：**自己做 2-gram**（把 "起风了" → "起风 风了"）。

## 二、触发器保持同步

```sql
CREATE TRIGGER songs_ai AFTER INSERT ON songs BEGIN
    INSERT INTO songs_fts(rowid, title, artist, album)
    VALUES (new.id,
            gram2(new.title),
            gram2((SELECT name FROM artists WHERE id = new.artist_id)),
            gram2((SELECT title FROM albums WHERE id = new.album_id)));
END;
```

`gram2` 不是 SQLite 内置函数，要通过 `sqlx` 注册自定义函数，或者**在 Rust 层构造好字符串再 insert**（更简单）。CloudTone 选后者：

```rust
pub fn gram2(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    if chars.len() <= 1 { return s.to_string(); }
    let mut out = String::new();
    for w in chars.windows(2) {
        out.push(w[0]); out.push(w[1]); out.push(' ');
    }
    out.push_str(s); // 也保留原词，便于英文匹配
    out
}
```

## 三、重建索引

```rust
// core/db/search.rs
pub async fn rebuild_fts(pool: &SqlitePool) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM songs_fts").execute(pool).await?;
    let rows = sqlx::query_as::<_, (i64, String, Option<String>, Option<String>)>(
        "SELECT s.id, s.title, a.name, al.title
         FROM songs s LEFT JOIN artists a ON s.artist_id = a.id
         LEFT JOIN albums al ON s.album_id = al.id"
    ).fetch_all(pool).await?;
    for (id, t, ar, al) in rows {
        sqlx::query("INSERT INTO songs_fts(rowid, title, artist, album) VALUES (?, ?, ?, ?)")
            .bind(id)
            .bind(gram2(&t))
            .bind(ar.as_deref().map(gram2).unwrap_or_default())
            .bind(al.as_deref().map(gram2).unwrap_or_default())
            .execute(pool).await?;
    }
    Ok(())
}
```

## 四、查询

```rust
pub async fn search_local(pool: &SqlitePool, q: &str, limit: i64) -> sqlx::Result<Vec<Song>> {
    let q_gram = gram2(q);
    sqlx::query_as::<_, Song>(
        "SELECT s.id, s.title, a.name AS artist, al.title AS album, s.artist_id, s.album_id,
                s.path, s.duration_ms, s.track_no,
                EXISTS(SELECT 1 FROM favorites WHERE song_id = s.id) AS liked, al.cover_path
         FROM songs_fts f
         JOIN songs s ON s.id = f.rowid
         LEFT JOIN artists a ON s.artist_id = a.id
         LEFT JOIN albums al ON s.album_id = al.id
         WHERE songs_fts MATCH ?
         ORDER BY rank LIMIT ?"
    ).bind(q_gram).bind(limit).fetch_all(pool).await
}
```

FTS5 的 `rank` 是 bm25 相关度，越小越相关（注意是"越小越好"）。

## 五、命令 & 前端 Hook

```rust
#[tauri::command] #[specta::specta]
pub async fn search(state: tauri::State<'_, AppState>, q: String) -> Result<SearchResult, String> {
    let q = q.trim().to_string();
    if q.is_empty() { return Ok(SearchResult::default()); }
    let local = search_local(&state.db, &q, 50).await.map_err(|e| e.to_string())?;
    Ok(SearchResult { local, online: vec![] })
}
```

```ts
// src/features/search/useSearch.ts
import { useQuery } from "@tanstack/react-query";
import { commands } from "@/lib/ipc";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export function useSearch(q: string) {
  const debounced = useDebouncedValue(q, 200);
  return useQuery({
    queryKey: ["search", debounced],
    queryFn: () => commands.search(debounced),
    enabled: debounced.length > 0,
  });
}
```

`useDebouncedValue` 自己写（第 44 章展开）：

```ts
import { useEffect, useState } from "react";
export function useDebouncedValue<T>(v: T, ms = 200) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}
```

## 六、UI

```tsx
// src/components/shell/SearchOverlay.tsx
import { useHotkeys } from "@/hooks/useHotkeys";
import { useState } from "react";
import { useSearch } from "@/features/search/useSearch";

export function SearchOverlay() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data } = useSearch(q);

  useHotkeys("mod+k", () => setOpen(true));
  useHotkeys("escape", () => setOpen(false), { enabled: open });

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-24" onClick={() => setOpen(false)}>
      <div className="w-[620px] bg-surface-2 rounded-xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)}
               placeholder="搜索歌曲、专辑、艺人"
               className="w-full px-4 py-3 bg-transparent border-b border-white/10 outline-none" />
        <div className="max-h-96 overflow-y-auto">
          {data?.local.map(s => (
            <SongRow key={s.id} song={s} onClick={() => { playSong(s.id); setOpen(false); }} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

## 七、在线 Provider（预留）

第 38 章会实现 Provider 接口：

```rust
#[async_trait::async_trait]
pub trait MusicProvider: Send + Sync {
    async fn search(&self, q: &str) -> anyhow::Result<Vec<SongMeta>>;
    async fn fetch_lyrics(&self, song: &Song) -> anyhow::Result<String>;
    async fn fetch_cover(&self, song: &Song) -> anyhow::Result<Vec<u8>>;
}
```

`search` 命令可并发调用本地 + 若干 provider，`tokio::join!`，合并去重后返回。

## 八、高亮匹配片段

前端渲染时，把 query 的每个字符拆成 `<mark>` 包裹。简化版：

```tsx
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const re = new RegExp(q.split("").map(escape).join(".*?"), "i");
  const m = text.match(re);
  if (!m) return <>{text}</>;
  const i = text.indexOf(m[0]);
  return <>{text.slice(0, i)}<mark className="bg-brand-500/40">{m[0]}</mark>{text.slice(i + m[0].length)}</>;
}
```

## 本章小结

- FTS5 + 2-gram 是中文小数据量下最省心的方案。
- 搜索体验的关键：快捷键、防抖、结果分组。
- 本地优先、在线补足，体验一致。

## 动手时刻

- [ ] 扫描 500 首后搜一个关键词，验证耗时。
- [ ] Cmd+K 打开搜索弹窗，Enter 播放第一条。

下一章：歌单与拖拽排序。
