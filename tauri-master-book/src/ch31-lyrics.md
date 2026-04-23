# 第 31 章 歌词：LRC 解析与滚动同步

## 本章目标

- 写一个纯 Rust 的 LRC 解析器。
- 按播放进度定位当前行。
- 前端实现"居中、平滑滚动、高亮当前行"。

## 一、LRC 格式速览

```
[ti:起风了]
[ar:买辣椒也用券]
[al:起风了]
[00:12.30]我曾将青春翻涌成她
[00:17.45]也曾指尖弹出盛夏
```

时间格式 `[mm:ss.xx]`，一个时间可以跟多行（同词多时间戳）。

## 二、Rust 解析器

```rust
// src-tauri/src/core/lyrics/mod.rs
use serde::Serialize;
use specta::Type;

#[derive(Serialize, Type, Clone, Debug)]
pub struct LyricLine {
    pub ts_ms: i64,
    pub text: String,
}

pub fn parse(raw: &str) -> Vec<LyricLine> {
    let mut out = Vec::new();
    for line in raw.lines() {
        let line = line.trim_start_matches('\u{feff}').trim();
        if line.is_empty() { continue; }

        // 提取所有前缀 [..]
        let mut rest = line;
        let mut stamps: Vec<i64> = Vec::new();
        while rest.starts_with('[') {
            if let Some(end) = rest.find(']') {
                let body = &rest[1..end];
                if let Some(ms) = parse_ts(body) { stamps.push(ms); }
                rest = rest[end+1..].trim();
            } else { break; }
        }
        if stamps.is_empty() { continue; }
        for ts in stamps {
            out.push(LyricLine { ts_ms: ts, text: rest.to_string() });
        }
    }
    out.sort_by_key(|l| l.ts_ms);
    out
}

fn parse_ts(s: &str) -> Option<i64> {
    // "mm:ss.xx" or "mm:ss.xxx"
    let (mm, rest) = s.split_once(':')?;
    let m: i64 = mm.parse().ok()?;
    let (ss, ms) = rest.split_once('.').unwrap_or((rest, "0"));
    let s: i64 = ss.parse().ok()?;
    let ms_len = ms.len();
    let ms: i64 = ms.parse().ok()?;
    let ms = match ms_len { 1 => ms * 100, 2 => ms * 10, 3 => ms, _ => return None };
    Some(m * 60000 + s * 1000 + ms)
}
```

单元测试：

```rust
#[test]
fn basic() {
    let s = "[00:12.30]hello\n[01:05.000]world";
    let r = parse(s);
    assert_eq!(r[0].ts_ms, 12_300);
    assert_eq!(r[1].ts_ms, 65_000);
}
```

## 三、歌词来源策略

1. 同名 .lrc（`/music/起风了.lrc`）。
2. ID3 里的 USLT（不同步）或 SYLT（同步）。
3. 在线音源 Provider（第 38 章）。

```rust
pub async fn load_lyrics_for_song(pool: &SqlitePool, providers: &ProviderRegistry, song_id: i64) -> anyhow::Result<Vec<LyricLine>> {
    let song = queries::get_song(pool, song_id).await?;
    // 1. 同名文件
    let lrc_path = std::path::Path::new(&song.path).with_extension("lrc");
    if lrc_path.exists() {
        let raw = tokio::fs::read_to_string(lrc_path).await?;
        return Ok(parse(&raw));
    }
    // 2. ID3（lofty tag USLT）
    if let Ok(tag) = lofty::read_from_path(&song.path) {
        if let Some(t) = tag.primary_tag() {
            for item in t.items() {
                if matches!(item.key(), lofty::ItemKey::Lyrics) {
                    if let Some(val) = item.value().text() {
                        let p = parse(val);
                        if !p.is_empty() { return Ok(p); }
                    }
                }
            }
        }
    }
    // 3. 在线
    if let Some(provider) = providers.primary() {
        if let Ok(raw) = provider.fetch_lyrics(&song).await {
            return Ok(parse(&raw));
        }
    }
    Ok(vec![])
}
```

## 四、当前行定位

```rust
pub fn find_line(lines: &[LyricLine], pos_ms: i64) -> Option<usize> {
    let mut lo = 0i32; let mut hi = lines.len() as i32 - 1;
    let mut ans = None;
    while lo <= hi {
        let mid = ((lo + hi) / 2) as usize;
        if lines[mid].ts_ms <= pos_ms { ans = Some(mid); lo = mid as i32 + 1; }
        else { hi = mid as i32 - 1; }
    }
    ans
}
```

前端拿到完整 lines 后，随着 `player:progress` 事件本地计算当前行（省去 IPC 频次）。

## 五、前端渲染

```tsx
// src/components/shell/LyricsView.tsx
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

interface Line { tsMs: number; text: string; }

export function LyricsView({ lines, positionSec }: { lines: Line[]; positionSec: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const posMs = positionSec * 1000;
  const active = findActive(lines, posMs);

  useEffect(() => {
    if (active < 0) return;
    const el = containerRef.current?.querySelector<HTMLDivElement>(`[data-line="${active}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [active]);

  return (
    <div ref={containerRef} className="h-full overflow-y-auto scrollbar-none space-y-3 py-16 text-center">
      {lines.map((l, i) => (
        <div key={i} data-line={i} className={cn(
          "transition-all duration-300",
          i === active ? "text-white text-base scale-105" : "text-text-tertiary text-sm",
        )}>{l.text}</div>
      ))}
    </div>
  );
}

function findActive(lines: Line[], posMs: number) {
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].tsMs <= posMs) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}
```

## 六、加载歌词 Hook

```ts
export function useLyrics(songId?: number) {
  return useQuery({
    queryKey: ["lyrics", songId],
    queryFn: () => songId ? commands.lyricsLoad(songId) : Promise.resolve([]),
    enabled: !!songId,
    staleTime: Infinity,
  });
}
```

## 本章小结

- LRC 解析器不复杂，掌握细节稳。
- 歌词定位前端做，效率最高。
- 平滑滚动 + 高亮大幅提升体验。

## 动手时刻

- [ ] 准备一首歌 + 同名 .lrc，验证加载。
- [ ] 拖动进度条测试高亮行立即跟随。

下一章：封面、缓存与自定义 `custom://` 协议。
