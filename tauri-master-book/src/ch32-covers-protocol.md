# 第 32 章 专辑封面、缓存与 `custom://` 协议

## 本章目标

- 注册 `cover://<hash>` 协议，让前端 `<img>` 直接渲染 cache 里的封面。
- 明白 Tauri 2.x 注册自定义协议的两种方式。
- 处理缩略图、懒加载、CSP 白名单。

## 一、为什么要 custom 协议

前端 `<img src="...">` 只能走：

- `http://` / `https://`：需要 CORS。
- `data:...`：base64 过大。
- `asset://` / Tauri 内置：只能访问打包进去的资源。
- 本地绝对路径：**不安全且会被 CSP 拒绝**。

所以我们**自定义** `cover://<song_or_hash>`，Rust 侧读磁盘返回字节，前端直接 `src="cover://abc123"`。

## 二、注册 URI Scheme

```rust
// src-tauri/src/lib.rs
use tauri::{http::Response, Manager};

tauri::Builder::default()
    // ... plugins, setup
    .register_uri_scheme_protocol("cover", |app, req| {
        let handle = app.clone();
        let uri = req.uri().clone();
        tauri::async_runtime::block_on(async move {
            let path = serve_cover(&handle, &uri).await;
            match path {
                Ok((bytes, mime)) => Response::builder()
                    .status(200)
                    .header("Content-Type", mime)
                    .header("Access-Control-Allow-Origin", "*")
                    .body(bytes).unwrap(),
                Err(_) => Response::builder().status(404).body(Vec::new()).unwrap(),
            }
        })
    })
```

`serve_cover`：

```rust
async fn serve_cover(app: &tauri::AppHandle, uri: &tauri::http::Uri) -> anyhow::Result<(Vec<u8>, &'static str)> {
    // cover://fallback 或 cover://<hash>
    let host = uri.host().unwrap_or("fallback");
    if host == "fallback" {
        return Ok((include_bytes!("../../icons/placeholder-cover.png").to_vec(), "image/png"));
    }
    let cache = app.path().app_cache_dir()?.join("covers");
    for ext in ["jpg","png","webp"] {
        let p = cache.join(format!("{}.{}", host, ext));
        if p.exists() {
            let bytes = tokio::fs::read(&p).await?;
            let mime = match ext { "png" => "image/png", "webp" => "image/webp", _ => "image/jpeg" };
            return Ok((bytes, mime));
        }
    }
    anyhow::bail!("not found")
}
```

## 三、CSP 修改

`tauri.conf.json` 的 `security.csp`：

```jsonc
"csp": "default-src 'self'; img-src 'self' data: blob: cover: https: http: asset:; media-src 'self' asset: cover: https: http:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ipc: http: https:"
```

`img-src` 和 `media-src` 中加入 `cover:` scheme。

## 四、前端用法

```tsx
<img src={`cover://${song.fileHash}`} className="w-12 h-12 rounded" />
<img src="cover://fallback" />
```

简单、快速、零 IPC。

## 五、缩略图生成（可选优化）

大封面（2000×2000 JPG）每次加载可能 500KB+。生成 128×128 缩略图：

```rust
use image::imageops::FilterType;

pub async fn ensure_thumb(cache: &Path, hash: &str) -> anyhow::Result<()> {
    let src = cache.join(format!("{}.jpg", hash));
    let thumb = cache.join(format!("{}-thumb.webp", hash));
    if thumb.exists() { return Ok(()); }
    let img = image::open(&src)?;
    let small = img.resize(128, 128, FilterType::Triangle);
    small.save_with_format(&thumb, image::ImageFormat::WebP)?;
    Ok(())
}
```

协议中按 host 前缀判断：`cover://thumb/abc123`。

## 六、懒加载 & 并发限制

列表一屏可能有几十张封面。浏览器 `loading="lazy"` + IntersectionObserver 控制。Rust 侧对 `serve_cover` 用 semaphore 限流。

```tsx
<img loading="lazy" src={`cover://${song.fileHash}`} />
```

## 七、另一个坑：本地音频文件能不能也用协议？

能。原理一样：注册 `track://` 协议，返回 audio/mp3 bytes。但大文件推荐走 **`asset://`**（Tauri 内置，支持 Range 请求），或者前端只做列表，实际播放在 Rust 完成（CloudTone 即如此）。

## 本章小结

- `register_uri_scheme_protocol` 是 Tauri 最强大的扩展点之一。
- CSP 必须同步更新。
- 封面缓存 + 协议 = 前端零成本显示。

## 动手时刻

- [ ] 实现 `cover://` 协议。
- [ ] Library 页每一行显示真实封面。
- [ ] 切换到深色/浅色主题，fallback 封面也跟着换。

下一章：搜索。
