# 第 35 章 收藏、最近播放、每日推荐

## 本章目标

- 把"喜欢"做成一等公民：心形按钮、单独页面。
- 最近播放：24 小时、7 天、30 天切换。
- 每日推荐：基于播放历史的"离线算法"。

## 一、喜欢 / 收藏

```rust
pub async fn liked_songs(pool: &SqlitePool) -> sqlx::Result<Vec<Song>> {
    sqlx::query_as::<_, Song>(
        "SELECT s.id, s.title, a.name AS artist, al.title AS album, s.artist_id, s.album_id,
                s.path, s.duration_ms, s.track_no, 1 AS liked, al.cover_path
         FROM favorites f JOIN songs s ON s.id = f.song_id
         LEFT JOIN artists a ON s.artist_id = a.id
         LEFT JOIN albums al ON s.album_id = al.id
         ORDER BY f.added_at DESC"
    ).fetch_all(pool).await
}
```

前端：

```tsx
export function LikeButton({ song }: { song: Song }) {
  const qc = useQueryClient();
  const mutate = useMutation({
    mutationFn: () => commands.libraryToggleFavorite(song.id),
    onSuccess: () => qc.invalidateQueries(["library"]),
  });
  return (
    <button onClick={() => mutate.mutate()} className={cn("transition-colors",
      song.liked ? "text-brand-500" : "text-text-tertiary hover:text-white")}>
      <Heart fill={song.liked ? "currentColor" : "none"} />
    </button>
  );
}
```

## 二、最近播放

```rust
pub async fn recent_played(pool: &SqlitePool, hours: i64, limit: i64) -> sqlx::Result<Vec<Song>> {
    sqlx::query_as::<_, Song>(
        "SELECT DISTINCT s.id, s.title, a.name AS artist, al.title AS album, s.artist_id, s.album_id,
                s.path, s.duration_ms, s.track_no,
                EXISTS(SELECT 1 FROM favorites WHERE song_id = s.id) AS liked, al.cover_path
         FROM play_history h
         JOIN songs s ON s.id = h.song_id
         LEFT JOIN artists a ON s.artist_id = a.id
         LEFT JOIN albums al ON s.album_id = al.id
         WHERE h.played_at > strftime('%s','now') - ? * 3600
         ORDER BY h.played_at DESC LIMIT ?"
    ).bind(hours).bind(limit).fetch_all(pool).await
}
```

UI 用 `Tabs`：

```tsx
<Tabs defaultValue="24">
  <TabsList><TabsTrigger value="24">24 小时</TabsTrigger><TabsTrigger value="168">7 天</TabsTrigger><TabsTrigger value="720">30 天</TabsTrigger></TabsList>
  <TabsContent value="24"><RecentList hours={24} /></TabsContent>
  ...
</Tabs>
```

## 三、每日推荐：离线算法

完整推荐系统需要向量化、ANN。离线一个够用的版本：**从你听过的歌中挑喜欢度高的 → 找同艺人 / 同专辑的未听 → 打分排序**。

```rust
pub async fn daily_recommend(pool: &SqlitePool, limit: i64) -> sqlx::Result<Vec<Song>> {
    // 1. 候选：同艺人/同专辑且最近 30 天未播放
    sqlx::query_as::<_, Song>(r#"
        WITH loved AS (
          SELECT s.artist_id, s.album_id
          FROM play_history h JOIN songs s ON s.id = h.song_id
          GROUP BY s.id
          HAVING COUNT(*) >= 3 OR EXISTS(SELECT 1 FROM favorites WHERE song_id = s.id)
        ),
        unheard AS (
          SELECT id FROM songs
          WHERE id NOT IN (
            SELECT DISTINCT song_id FROM play_history
            WHERE played_at > strftime('%s','now') - 30 * 86400
          )
        )
        SELECT s.id, s.title, a.name AS artist, al.title AS album, s.artist_id, s.album_id,
               s.path, s.duration_ms, s.track_no,
               EXISTS(SELECT 1 FROM favorites WHERE song_id = s.id) AS liked, al.cover_path
        FROM songs s
        LEFT JOIN artists a ON s.artist_id = a.id
        LEFT JOIN albums al ON s.album_id = al.id
        WHERE s.id IN unheard
          AND (s.artist_id IN (SELECT artist_id FROM loved)
               OR s.album_id IN (SELECT album_id FROM loved))
        ORDER BY RANDOM() LIMIT ?
    "#).bind(limit).fetch_all(pool).await
}
```

为确保"每日"不变，种子用日期：

```rust
use chrono::Local;
let seed = Local::now().format("%Y%m%d").to_string().parse::<u64>().unwrap();
```

然后用 `rand_chacha::ChaCha8Rng::seed_from_u64(seed)` 打乱候选，取前 20。

## 四、首页 "每日三十首"

```tsx
export function HomePage() {
  const daily = useQuery(["daily"], () => commands.homeDaily(30));
  const recent = useQuery(["recent", 24], () => commands.homeRecent(24, 20));
  return (
    <div className="grid grid-cols-2 gap-6">
      <Section title="每日推荐" songs={daily.data} />
      <Section title="最近播放" songs={recent.data} />
    </div>
  );
}
```

## 五、播放计数精细化

`play_history` 粒度 = 一次完整播放。但很多人会切歌。改进：

- 记录 `duration_played_ms`（已在 schema）。
- 只把 `duration_played_ms >= 30s 或 >= 50% 时长` 视作"一次播放"。
- 查询时 `WHERE duration_played_ms >= MIN(30000, duration_ms / 2)`。

## 本章小结

- 收藏 / 最近播放 / 推荐是用户黏性的核心。
- 简单规则的离线推荐也很好用，先跑起来再换复杂算法。
- 日期种子让"每日"有仪式感。

## 动手时刻

- [ ] 首页展示"每日推荐"卡片，点播放。
- [ ] 最近播放切换时间范围。

下一章：迷你播放器与桌面歌词悬浮窗。
