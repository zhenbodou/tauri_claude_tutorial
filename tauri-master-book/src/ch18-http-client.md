# 第 18 章 HTTP 客户端与 API 调用（`reqwest` + `tokio`）

## 本章目标

- 在 Rust 侧用 `reqwest` 发 HTTP，并对前端暴露受控的网络能力。
- 了解 `tauri-plugin-http` 与直接用 `reqwest` 的差别。
- 打好 JSON 请求/响应、超时、重试、取消、代理、TLS 证书六大基本功。
- 设计 CloudTone 的网络层抽象。

## 一、两条网络路线

1. **前端直接用 `fetch`**：受 WebView CSP + capability 管控，允许发送请求到白名单域名。
2. **Rust 后端用 `reqwest`**：不受 CSP 限制，功能更强（代理、自定义 TLS、httpbin 低阶控制）。

**推荐做法**：第三方 API、爬虫、需要鉴权 token 的请求 —— Rust 侧做。简单的静态资源、CDN 拉图 —— 前端直连更省事。

## 二、Rust 侧 `reqwest`

```toml
# Cargo.toml
reqwest = { version = "0.12", features = ["json", "stream", "rustls-tls"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
anyhow = "1"
tokio = { version = "1", features = ["full"] }
```

### 基本 GET / POST

```rust
use reqwest::Client;

pub async fn search_songs(keyword: &str) -> anyhow::Result<Vec<Song>> {
    let client = Client::new();
    let res: ApiResp<Vec<Song>> = client
        .get("https://api.example.com/search")
        .query(&[("q", keyword)])
        .header("User-Agent", "CloudTone/0.1")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(res.data)
}

#[derive(serde::Deserialize)]
struct ApiResp<T> { code: i32, data: T }
```

### 复用 Client

`Client` 内部有连接池。**应该复用**，不要每次 new。放 `AppState`：

```rust
pub struct AppState {
    pub http: reqwest::Client,
    // ...
}

impl AppState {
    pub fn new(/*..*/) -> Self {
        let http = reqwest::Client::builder()
            .user_agent(concat!("CloudTone/", env!("CARGO_PKG_VERSION")))
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .unwrap();
        Self { http, /* .. */ }
    }
}
```

### POST JSON

```rust
let res = state.http.post(url)
    .json(&RequestBody { foo: "bar" })
    .send().await?
    .error_for_status()?;
```

### 流式下载

```rust
use futures_util::StreamExt;
use tokio::io::AsyncWriteExt;

let mut resp = state.http.get(url).send().await?.error_for_status()?;
let total = resp.content_length().unwrap_or(0);
let mut file = tokio::fs::File::create(path).await?;
let mut downloaded: u64 = 0;
while let Some(chunk) = resp.chunk().await? {
    file.write_all(&chunk).await?;
    downloaded += chunk.len() as u64;
    channel.send(DownloadEvent::Progress { transferred: downloaded, total })?;
}
```

### 取消

`reqwest` 本身不直接支持取消；用 `tokio::select!` + `tokio::sync::oneshot`：

```rust
let (cancel_tx, mut cancel_rx) = tokio::sync::oneshot::channel::<()>();

tokio::select! {
    _ = &mut cancel_rx => {
        tracing::info!("cancelled");
    }
    res = do_request() => {
        // 处理结果
    }
}
```

把 `cancel_tx` 存到 AppState 里，另一个 command 调用时 `.send(())`。

## 三、`tauri-plugin-http`

这个插件给前端一个「受 capability 控制的 fetch」：

```bash
pnpm tauri add http
```

```jsonc
{
  "permissions": [
    {
      "identifier": "http:default",
      "allow": [{ "url": "https://api.example.com/**" }]
    }
  ]
}
```

```ts
import { fetch } from "@tauri-apps/plugin-http";
const res = await fetch("https://api.example.com/songs");
```

这比直接浏览器 `fetch` 的好处：

- 绕过 CORS（真正到 Rust 层发请求）。
- capability 统一管控目标域名。
- 可以设置超时、代理。

## 四、为 CloudTone 设计网络层

```rust
// src-tauri/src/core/providers/netease.rs
use crate::core::providers::MusicProvider;

pub struct NeteaseProvider {
    http: reqwest::Client,
    base: String,
}

#[async_trait::async_trait]
impl MusicProvider for NeteaseProvider {
    fn name(&self) -> &'static str { "netease" }

    async fn search(&self, kw: &str) -> anyhow::Result<Vec<Song>> {
        let url = format!("{}/search?keywords={}", self.base, urlencoding::encode(kw));
        Ok(self.http.get(url).send().await?.error_for_status()?.json().await?)
    }

    async fn stream_url(&self, song_id: &str) -> anyhow::Result<String> {
        // 一般拿到临时签名 URL
        // ...
        Ok("https://...".into())
    }
}
```

Provider 抽象 + 注册表：

```rust
pub struct ProviderRegistry {
    pub inner: dashmap::DashMap<String, Box<dyn MusicProvider + Send + Sync>>,
}

impl ProviderRegistry {
    pub fn get(&self, name: &str) -> Option<&dyn MusicProvider> {
        self.inner.get(name).map(|r| r.value().as_ref())
    }
}
```

第 38 章我们会实际写两个 provider（网易 + 可插拔空壳）。本书不讨论具体商用 API 的使用合规问题——**请使用公开可用、符合你所在地区法律的 API**。

## 五、错误处理

统一把 `reqwest::Error` 映射到 `AppError::Network(String)`。避免把 reqwest 的内部类型泄露到前端。

```rust
#[derive(Debug, thiserror::Error)]
pub enum NetworkError {
    #[error("timeout")]
    Timeout,
    #[error("non-2xx: {0}")]
    Status(u16),
    #[error("decode: {0}")]
    Decode(String),
    #[error("other: {0}")]
    Other(String),
}

impl From<reqwest::Error> for NetworkError {
    fn from(e: reqwest::Error) -> Self {
        if e.is_timeout() { Self::Timeout }
        else if let Some(s) = e.status() { Self::Status(s.as_u16()) }
        else if e.is_decode() { Self::Decode(e.to_string()) }
        else { Self::Other(e.to_string()) }
    }
}
```

## 六、TLS / 代理 / 证书

- `rustls-tls` 是纯 Rust 实现，**强烈推荐**（macOS/Windows/Linux 统一行为）。
- `native-tls` 依赖系统库，有时老系统上闹别扭。
- 代理：`Client::builder().proxy(reqwest::Proxy::all("http://127.0.0.1:7890")?)`。
- 自签证书：`Client::builder().add_root_certificate(cert)`。

## 七、限流与重试

简单的指数退避：

```rust
use tokio::time::{sleep, Duration};

async fn get_with_retry(client: &Client, url: &str) -> anyhow::Result<String> {
    let mut delay = 500;
    for attempt in 1..=4 {
        match client.get(url).send().await.and_then(|r| r.error_for_status()) {
            Ok(r) => return Ok(r.text().await?),
            Err(e) if attempt == 4 => return Err(e.into()),
            Err(_) => { sleep(Duration::from_millis(delay)).await; delay *= 2; }
        }
    }
    unreachable!()
}
```

批量请求限流用 `tokio::sync::Semaphore`：

```rust
let sem = Arc::new(Semaphore::new(4));
for url in urls {
    let p = sem.clone().acquire_owned().await.unwrap();
    tokio::spawn(async move {
        let _p = p;
        fetch(url).await
    });
}
```

## 常见陷阱

> **1. WebView `fetch` 遇到 CORS**
>
> 有些 API 不允许浏览器直连。走 Rust。

> **2. `reqwest` 在 macOS release build 卡死**
>
> 偶见 native-tls 和 macOS 15 兼容问题。换 `rustls-tls` 99% 解决。

> **3. `json()` 解析大响应内存爆**
>
> 用 `.chunk()` 流式处理，或者 `serde_json::from_reader` 接 `.bytes_stream()`。

> **4. 响应编码不是 UTF-8**
>
> `reqwest::Response::text_with_charset(encoding)` 手动指定。

## 本章小结

- `reqwest` + `rustls-tls` 是 Tauri 后端网络的黄金组合。
- 前端能用 `tauri-plugin-http` 就用，绕 CORS，统一管控。
- Provider 抽象让第三方音源可插拔。

## 动手时刻

在 hello 项目里：

- [ ] 写一个 `fetch_ip` 命令，请求 `https://api.ipify.org?format=json`，返回 IP。
- [ ] 前端按钮触发，显示 IP。
- [ ] 给 capability 里加 `http:default` 和 scope。

下一章，SQLite + `sqlx`。
