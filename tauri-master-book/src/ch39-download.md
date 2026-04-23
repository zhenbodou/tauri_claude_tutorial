# 第 39 章 下载管理、断点续传、缓存策略

## 本章目标

- 设计一个任务式下载队列（可暂停、恢复、取消）。
- 断点续传：用 HTTP Range 头。
- 进度推送：Channel。
- 下载目录、并发上限、失败重试。

## 一、数据模型

```rust
// core/download/mod.rs
use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct DownloadTask {
    pub id: String,
    pub url: String,
    pub target: PathBuf,
    pub total: u64,
    pub downloaded: u64,
    pub status: Status,
}

#[derive(Clone, Debug, Copy, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum Status { Pending, Downloading, Paused, Done, Failed }
```

## 二、下载器核心

```rust
use futures::StreamExt;
use reqwest::header::{RANGE, CONTENT_LENGTH};
use tokio::io::AsyncWriteExt;
use tokio::fs::OpenOptions;

pub async fn download_with_resume(client: &reqwest::Client, task: &mut DownloadTask, mut on_progress: impl FnMut(u64, u64)) -> anyhow::Result<()> {
    // 目标文件已有多少字节
    let already = if task.target.exists() {
        tokio::fs::metadata(&task.target).await?.len()
    } else { 0 };
    task.downloaded = already;

    let mut req = client.get(&task.url);
    if already > 0 {
        req = req.header(RANGE, format!("bytes={}-", already));
    }
    let resp = req.send().await?.error_for_status()?;

    // total = 已有 + Content-Length
    if let Some(len) = resp.headers().get(CONTENT_LENGTH).and_then(|v| v.to_str().ok()).and_then(|s| s.parse::<u64>().ok()) {
        task.total = already + len;
    }

    let mut file = OpenOptions::new().create(true).append(true).open(&task.target).await?;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk).await?;
        task.downloaded += chunk.len() as u64;
        on_progress(task.downloaded, task.total);
    }
    file.flush().await?;
    task.status = Status::Done;
    Ok(())
}
```

## 三、任务管理器

```rust
use tokio::sync::{Mutex, Semaphore};
use dashmap::DashMap;
use std::sync::Arc;
use tauri::ipc::Channel;

#[derive(Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum DownloadEvent {
    Progress { id: String, done: u64, total: u64 },
    Done { id: String, path: String },
    Failed { id: String, error: String },
}

pub struct DownloadManager {
    pub tasks: DashMap<String, Arc<Mutex<DownloadTask>>>,
    pub client: reqwest::Client,
    pub sem: Arc<Semaphore>,
}

impl DownloadManager {
    pub fn new(parallel: usize) -> Self {
        Self {
            tasks: DashMap::new(),
            client: reqwest::Client::new(),
            sem: Arc::new(Semaphore::new(parallel)),
        }
    }

    pub async fn start(self: Arc<Self>, task: DownloadTask, ch: Channel<DownloadEvent>) {
        let id = task.id.clone();
        let task = Arc::new(Mutex::new(task));
        self.tasks.insert(id.clone(), task.clone());

        let sem = self.sem.clone();
        let client = self.client.clone();
        tokio::spawn(async move {
            let _permit = sem.acquire_owned().await.unwrap();
            let mut t = task.lock().await;
            t.status = Status::Downloading;
            let id2 = id.clone();
            let ch_clone = ch.clone();
            let res = download_with_resume(&client, &mut t, |d, total| {
                let _ = ch_clone.send(DownloadEvent::Progress { id: id2.clone(), done: d, total });
            }).await;
            match res {
                Ok(()) => { let _ = ch.send(DownloadEvent::Done { id, path: t.target.to_string_lossy().into() }); }
                Err(e) => { t.status = Status::Failed; let _ = ch.send(DownloadEvent::Failed { id, error: e.to_string() }); }
            }
        });
    }

    pub async fn pause(&self, _id: &str) { /* 简化：关闭 HTTP 请求; 状态标记 */ }
    pub async fn cancel(&self, id: &str) {
        if let Some((_, t)) = self.tasks.remove(id) {
            let tt = t.lock().await;
            let _ = tokio::fs::remove_file(&tt.target).await;
        }
    }
}
```

> `pause` 的严谨实现：持有一个 `CancellationToken`（`tokio-util::sync::CancellationToken`），任务内部每次写 chunk 前检查；`pause` 触发 cancel，下次 `resume` 时重新调度。

## 四、命令

```rust
#[tauri::command] #[specta::specta]
pub async fn download_start(state: tauri::State<'_, AppState>, id: String, url: String, target: String, ch: Channel<DownloadEvent>) -> Result<(), String> {
    let task = DownloadTask {
        id, url, target: target.into(), total: 0, downloaded: 0, status: Status::Pending,
    };
    state.downloader.clone().start(task, ch).await;
    Ok(())
}

#[tauri::command] #[specta::specta]
pub async fn download_cancel(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    state.downloader.cancel(&id).await;
    Ok(())
}
```

## 五、前端 UI

```tsx
export function DownloadPanel() {
  const [tasks, setTasks] = useState<Map<string, Task>>(new Map());
  useEffect(() => {
    // 监听全局事件（每次 download_start 用不同 Channel 更好）
  }, []);

  async function addDownload(song: RemoteSong) {
    const ch = new Channel<DownloadEvent>();
    ch.onmessage = (e) => {
      if (e.event === "progress") {
        setTasks(prev => new Map(prev).set(e.data.id, { ...prev.get(e.data.id)!, done: e.data.done, total: e.data.total }));
      }
      if (e.event === "done") { toast.success("下载完成"); }
    };
    const url = await commands.providerStreamUrl(song.provider, song.id);
    await commands.downloadStart(song.id, url, `~/Music/CloudTone/${song.title}.mp3`, ch);
  }
  return <div>...</div>;
}
```

## 六、目录与命名

- 默认目录：`$HOME/Music/CloudTone/`（用户可在设置里改）。
- 文件名：`{artist} - {title}.{ext}`，非法字符替换为 `_`。
- 冲突：如存在同名，加 `(2)`、`(3)`。

```rust
pub fn sanitize(s: &str) -> String {
    s.chars().map(|c| match c { '/'|'\\'|':'|'*'|'?'|'"'|'<'|'>'|'|' => '_', _ => c }).collect()
}
```

## 七、缓存淘汰

`$APPCACHE/stream/` 用 LRU：

```rust
pub fn evict_cache(dir: &Path, max_size_mb: u64) -> std::io::Result<()> {
    let mut files: Vec<_> = std::fs::read_dir(dir)?
        .filter_map(Result::ok)
        .map(|e| (e.path(), e.metadata().unwrap().modified().unwrap(), e.metadata().unwrap().len()))
        .collect();
    files.sort_by_key(|(_, m, _)| *m); // 旧的优先删
    let total: u64 = files.iter().map(|(_, _, s)| s).sum();
    let mut over = total.saturating_sub(max_size_mb * 1024 * 1024);
    for (p, _, s) in files {
        if over == 0 { break; }
        let _ = std::fs::remove_file(&p);
        over = over.saturating_sub(s);
    }
    Ok(())
}
```

## 本章小结

- Range 请求 + append 写入 = 断点续传。
- 信号量控制并发，避免把带宽打满。
- 用 CancellationToken 做暂停 / 取消。

## 动手时刻

- [ ] 下载一首 demo mp3，中途断网看恢复。
- [ ] 同时下载 5 首，限制并发 2，观察排队。

下一章：均衡器（EQ）与音效处理。
