# 第 17 章 文件系统、路径与应用数据目录

## 本章目标

- 理解 Tauri 里「应用数据目录」的 7 种预定义位置。
- 学会跨平台地构造路径，避免硬编码。
- 用 `tauri-plugin-fs` 给前端开放受控文件访问。
- 用 `tokio::fs` / `std::fs` / `walkdir` 在 Rust 侧做扫描与读写。

## 一、跨平台目录是大坑的缩影

同一个「应用配置」在三个系统下的真实位置：

- macOS: `~/Library/Application Support/dev.codecow.cloudtone/`
- Windows: `C:\Users\<user>\AppData\Roaming\dev.codecow.cloudtone\`
- Linux: `~/.config/dev.codecow.cloudtone/`

人肉拼路径是灾难。Tauri 提供了统一 API。

## 二、Tauri 预定义目录

| 变量 | 用途 | 示例 (macOS) |
|------|------|--------------|
| `$APPDATA` | 应用数据（跨端唯一的） | `~/Library/Application Support/<id>` |
| `$APPCONFIG` | 配置 | 同上 |
| `$APPLOCALDATA` | 本机数据 | `~/Library/Application Support/<id>` |
| `$APPCACHE` | 缓存 | `~/Library/Caches/<id>` |
| `$APPLOG` | 日志 | `~/Library/Logs/<id>` |
| `$HOME` | 家目录 | `~` |
| `$DESKTOP` / `$DOWNLOAD` / `$DOCUMENT` / `$MUSIC` / `$PICTURE` | 用户目录 | — |

### Rust 侧

```rust
use tauri::{AppHandle, Manager};

let app_data: PathBuf = app.path().app_data_dir()?;
let cache_dir: PathBuf = app.path().app_cache_dir()?;
let music: PathBuf = app.path().audio_dir()?;  // 用户音乐目录
```

### 前端

```ts
import { appDataDir, audioDir } from "@tauri-apps/api/path";
const appData = await appDataDir();
const music = await audioDir();
```

## 三、`tauri-plugin-fs`：受控文件访问

Tauri 2 不再让前端任意读写磁盘。必须通过 `fs` 插件 + capability 里声明 scope。

### 装插件

```bash
pnpm tauri add fs
```

### Capability

```jsonc
{
  "identifier": "main",
  "windows": ["main"],
  "permissions": [
    "fs:default",
    { "identifier": "fs:allow-read-text-file", "allow": [{ "path": "$APPDATA/cloudtone/**" }] },
    { "identifier": "fs:allow-write-text-file", "allow": [{ "path": "$APPDATA/cloudtone/**" }] },
    { "identifier": "fs:allow-exists", "allow": [{ "path": "$MUSIC/**" }] }
  ]
}
```

### 前端 API

```ts
import { readTextFile, writeTextFile, exists, BaseDirectory } from "@tauri-apps/plugin-fs";

const text = await readTextFile("cloudtone/config.json", { baseDir: BaseDirectory.AppData });
await writeTextFile("cloudtone/config.json", JSON.stringify(cfg), { baseDir: BaseDirectory.AppData });
```

**原则**：

- 大部分文件操作应该在 Rust 里做，让前端只操心 UI。
- 只有非常小、非常明确的场景才让前端直接 `readTextFile`。

## 四、Rust 侧读写 & 扫描

### 读写 JSON 配置

```rust
use tokio::fs;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Default)]
pub struct Settings { pub volume: f32, pub theme: String }

pub async fn load_settings(app: &tauri::AppHandle) -> anyhow::Result<Settings> {
    let path = app.path().app_data_dir()?.join("settings.json");
    if !path.exists() { return Ok(Settings::default()); }
    let s = fs::read_to_string(&path).await?;
    Ok(serde_json::from_str(&s)?)
}

pub async fn save_settings(app: &tauri::AppHandle, s: &Settings) -> anyhow::Result<()> {
    let dir = app.path().app_data_dir()?;
    fs::create_dir_all(&dir).await?;
    fs::write(dir.join("settings.json"), serde_json::to_vec_pretty(s)?).await?;
    Ok(())
}
```

### 递归扫描音乐目录

```rust
use walkdir::WalkDir;

pub fn find_audio_files(root: &std::path::Path) -> Vec<std::path::PathBuf> {
    const EXT: [&str; 8] = ["mp3","flac","m4a","wav","ogg","aac","aiff","ape"];
    WalkDir::new(root)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file())
        .filter(|e| e.path().extension()
            .and_then(|s| s.to_str())
            .map(|s| EXT.contains(&s.to_lowercase().as_str()))
            .unwrap_or(false))
        .map(|e| e.into_path())
        .collect()
}
```

### 流式读取

大文件要避免 `read()` 一把梭。用 `tokio::io::AsyncReadExt`：

```rust
use tokio::fs::File;
use tokio::io::AsyncReadExt;

let mut f = File::open(path).await?;
let mut buf = vec![0u8; 64 * 1024];
loop {
    let n = f.read(&mut buf).await?;
    if n == 0 { break; }
    // 处理 buf[..n]
}
```

## 五、拖拽文件进窗口

前端监听：

```ts
import { getCurrentWebview } from "@tauri-apps/api/webview";
const unlisten = await getCurrentWebview().onDragDropEvent(async e => {
  if (e.payload.type === "drop") {
    for (const path of e.payload.paths) {
      await invoke("library_import_files", { paths: [path] });
    }
  }
});
```

得到的 `path` 是本机绝对路径。注意 capability 允许后端处理即可，前端只传递字符串。

## 六、通知文件变化：`notify` crate

CloudTone 的「音乐库自动刷新」依赖监听目录变化。

```toml
notify = "6"
```

```rust
use notify::{Watcher, RecursiveMode, RecommendedWatcher, Config};

let (tx, mut rx) = tokio::sync::mpsc::channel(16);
let mut watcher = RecommendedWatcher::new(move |res| {
    let _ = tx.blocking_send(res);
}, Config::default())?;
watcher.watch(root, RecursiveMode::Recursive)?;

while let Some(Ok(event)) = rx.recv().await {
    // 按事件类型决定是否重新扫描
}
```

第 28 章完整接入。

## 七、跨平台路径

- 不要硬编码 `/`，用 `PathBuf::join`。
- 不要假设 UTF-8，Rust `OsStr` 才是真相。大部分场景 `path.to_string_lossy()` 足矣。
- Windows 的 `\\?\...` 长路径前缀在某些 API 下会闹。`dunce::canonicalize` 消除之。

## 常见陷阱

> **1. 前端 `readTextFile` 报 `forbidden path`**
>
> capability 里没声明 scope 或路径越界。

> **2. 中文路径在 Windows 上打不开**
>
> 99% 是编码问题。统一 UTF-8。`fs::read` 用 `PathBuf` 别用字符串拼。

> **3. `app_data_dir()` 返回 None**
>
> 在某些 Linux headless 环境可能失败。设置 `XDG_DATA_HOME` 或提前 `fs::create_dir_all`。

> **4. `notify` 热更风暴**
>
> 保存一个文件可能触发多次事件。用 debounce：`notify-debouncer-full`。

## 本章小结

- Tauri `path` API 让跨平台路径变简单。
- `fs` 插件前端侧受 scope 管控。
- 真正的重活放 Rust，前端只传路径或调用命令。

## 动手时刻

- [ ] 在 hello 项目里写一个 `list_music` 命令，返回 `$MUSIC` 下的全部音频文件路径。
- [ ] 前端展示列表。
- [ ] 加 `notify` watcher，音乐目录变化时前端 toast。

下一章，HTTP 客户端与 API 调用。
