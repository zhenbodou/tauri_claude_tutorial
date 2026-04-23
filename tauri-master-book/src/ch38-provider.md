# 第 38 章 在线音源适配层（可插拔 Provider）

## 本章目标

- 定义统一的 `MusicProvider` trait。
- 实现一个示例 Provider（假数据 / demo）。
- Provider 注册表：多源并行搜索、降级策略。
- 遵守版权与服务条款。

> 本章不提供任何绕过 DRM 或盗版的具体接口。重点在**架构与工程实践**。

## 一、设计原则

- **异步**：所有方法 `async fn`。
- **可扩展**：Provider 只关心 "我能提供什么"，核心模块不感知具体来源。
- **降级**：某个 Provider 失败不影响整体。
- **并发限流**：每个 Provider 维护自己的限流器。

## 二、Trait 定义

```rust
// core/providers/mod.rs
use async_trait::async_trait;
use serde::Serialize;
use specta::Type;

#[derive(Serialize, Type, Debug, Clone)]
pub struct RemoteSong {
    pub provider: String,
    pub id: String,         // Provider 内唯一 id
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration_ms: i64,
    pub cover_url: Option<String>,
}

#[async_trait]
pub trait MusicProvider: Send + Sync {
    fn id(&self) -> &'static str;
    fn display_name(&self) -> &'static str;

    async fn search(&self, query: &str, limit: usize) -> anyhow::Result<Vec<RemoteSong>>;
    async fn fetch_lyrics(&self, song: &RemoteSong) -> anyhow::Result<Option<String>>;
    async fn fetch_cover(&self, song: &RemoteSong) -> anyhow::Result<Option<Vec<u8>>>;
    /// 返回可播放的 stream URL（你负责它的合法性）
    async fn stream_url(&self, song: &RemoteSong) -> anyhow::Result<String>;
}
```

## 三、Demo Provider

```rust
// core/providers/demo.rs
use super::*;

pub struct DemoProvider {
    client: reqwest::Client,
}

impl DemoProvider {
    pub fn new() -> Self {
        Self { client: reqwest::Client::builder().user_agent("CloudTone/1.0").build().unwrap() }
    }
}

#[async_trait]
impl MusicProvider for DemoProvider {
    fn id(&self) -> &'static str { "demo" }
    fn display_name(&self) -> &'static str { "示例音源" }

    async fn search(&self, q: &str, limit: usize) -> anyhow::Result<Vec<RemoteSong>> {
        let _ = q; let _ = limit;
        Ok(vec![RemoteSong {
            provider: "demo".into(),
            id: "1".into(),
            title: "Demo Song".into(),
            artist: "Demo Artist".into(),
            album: None,
            duration_ms: 180_000,
            cover_url: None,
        }])
    }
    async fn fetch_lyrics(&self, _: &RemoteSong) -> anyhow::Result<Option<String>> { Ok(None) }
    async fn fetch_cover(&self, _: &RemoteSong) -> anyhow::Result<Option<Vec<u8>>> { Ok(None) }
    async fn stream_url(&self, _: &RemoteSong) -> anyhow::Result<String> {
        Ok("https://example.com/demo.mp3".into())
    }
}
```

## 四、Registry

```rust
// core/providers/registry.rs
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct ProviderRegistry {
    providers: RwLock<Vec<Arc<dyn MusicProvider>>>,
}

impl ProviderRegistry {
    pub fn new() -> Self { Self { providers: RwLock::new(vec![]) } }
    pub async fn register(&self, p: Arc<dyn MusicProvider>) {
        self.providers.write().await.push(p);
    }
    pub async fn primary(&self) -> Option<Arc<dyn MusicProvider>> {
        self.providers.read().await.first().cloned()
    }

    /// 并发搜索，聚合结果；单个失败不影响整体。
    pub async fn search_all(&self, q: &str, limit: usize) -> Vec<RemoteSong> {
        let provs = self.providers.read().await.clone();
        let futs = provs.into_iter().map(|p| {
            let q = q.to_string();
            async move { p.search(&q, limit).await.unwrap_or_default() }
        });
        let results = futures::future::join_all(futs).await;
        let mut flat: Vec<RemoteSong> = results.into_iter().flatten().collect();
        // 简单去重：同 title+artist 合并
        flat.sort_by(|a, b| (a.title.to_lowercase(), a.artist.to_lowercase())
            .cmp(&(b.title.to_lowercase(), b.artist.to_lowercase())));
        flat.dedup_by(|a, b| a.title.eq_ignore_ascii_case(&b.title) && a.artist.eq_ignore_ascii_case(&b.artist));
        flat
    }
}
```

## 五、状态接入

`AppState` 追加字段：

```rust
pub struct AppState {
    pub db: SqlitePool,
    pub player: PlayerHandle,
    pub queue: Arc<Mutex<Queue>>,
    pub providers: Arc<ProviderRegistry>,
    // ...
}
```

`setup`：

```rust
let registry = ProviderRegistry::new();
registry.register(Arc::new(DemoProvider::new())).await;
```

## 六、搜索命令融合

```rust
#[tauri::command] #[specta::specta]
pub async fn search(state: tauri::State<'_, AppState>, q: String, include_online: bool) -> Result<SearchResult, String> {
    let local = search_local(&state.db, &q, 50).await.map_err(|e| e.to_string())?;
    let online = if include_online { state.providers.search_all(&q, 30).await } else { vec![] };
    Ok(SearchResult { local, online })
}
```

前端切 Tab：本地 / 在线。

## 七、缓存策略

- 搜索结果短缓存：TanStack Query `staleTime: 5min`。
- 封面：下载到 `$APPCACHE/covers/`，以 URL hash 为文件名。
- 歌词：`$APPCACHE/lyrics/<provider>/<id>.lrc`。
- 不缓存**音频流本身**（版权）。

## 八、错误反馈

Provider 错误统一 `tracing::warn!`，前端用 toast 展示非致命提示。

## 本章小结

- Trait + Registry 让"换音源"成为插件级操作。
- 并发搜索 + 去重 = 用户看到统一结果。
- 不要把法律风险留给用户：合规是第一原则。

## 动手时刻

- [ ] 注册 Demo Provider，搜索返回结果。
- [ ] 失败时显示 toast，而非崩溃。

下一章：下载管理与断点续传。
