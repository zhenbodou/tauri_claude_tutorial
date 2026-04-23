# 第 37 章 全局媒体键与 OS 媒体中心

## 本章目标

- 响应全局媒体键（▶︎ ⏸ ⏭ ⏮ ⏹），哪怕你在别的应用里。
- 接入各平台的"当前播放"系统：
  - macOS: `MediaPlayer.framework`（Now Playing / Touch Bar）。
  - Windows: SMTC（System Media Transport Controls）。
  - Linux: MPRIS via D-Bus。

一个库覆盖三平台：[`souvlaki`](https://crates.io/crates/souvlaki)。

## 一、依赖

```toml
# Cargo.toml
souvlaki = "0.7"
raw-window-handle = "0.6"
```

## 二、初始化 MediaControls

```rust
// core/audio/media_controls.rs
use souvlaki::{MediaControls, MediaMetadata, MediaPlayback, MediaPosition, PlatformConfig};
use std::time::Duration;

pub struct OsMedia {
    controls: MediaControls,
}

impl OsMedia {
    pub fn new(app: &tauri::AppHandle) -> anyhow::Result<Self> {
        // Windows 需要 HWND
        #[cfg(target_os = "windows")]
        let hwnd = {
            use raw_window_handle::{HasWindowHandle, RawWindowHandle};
            let win = app.get_webview_window("main").unwrap();
            let handle = win.window_handle()?;
            match handle.as_raw() {
                RawWindowHandle::Win32(h) => Some(h.hwnd.get() as _),
                _ => None,
            }
        };
        #[cfg(not(target_os = "windows"))]
        let hwnd = None;

        let config = PlatformConfig {
            dbus_name: "com.cloudtone.player",
            display_name: "CloudTone",
            hwnd,
        };
        let controls = MediaControls::new(config)?;
        Ok(Self { controls })
    }

    pub fn attach(&mut self, tx: tokio::sync::mpsc::Sender<PlayerCmd>) -> anyhow::Result<()> {
        use souvlaki::MediaControlEvent as E;
        self.controls.attach(move |ev| {
            let tx = tx.clone();
            tokio::spawn(async move {
                let cmd = match ev {
                    E::Play => Some(PlayerCmd::Play),
                    E::Pause => Some(PlayerCmd::Pause),
                    E::Toggle => Some(PlayerCmd::Toggle),
                    E::Next => Some(PlayerCmd::Next),
                    E::Previous => Some(PlayerCmd::Prev),
                    E::Stop => Some(PlayerCmd::Stop),
                    E::SetPosition(MediaPosition(d)) => Some(PlayerCmd::Seek(d.as_secs_f64())),
                    _ => None,
                };
                if let Some(c) = cmd { let _ = tx.send(c).await; }
            });
        })?;
        Ok(())
    }

    pub fn update_song(&mut self, title: &str, artist: &str, album: &str, cover_url: Option<&str>, duration: Duration) {
        let _ = self.controls.set_metadata(MediaMetadata {
            title: Some(title),
            artist: Some(artist),
            album: Some(album),
            cover_url,
            duration: Some(duration),
        });
    }

    pub fn update_state(&mut self, playing: bool, progress: Duration) {
        let mp = if playing { MediaPlayback::Playing { progress: Some(MediaPosition(progress)) } }
                 else       { MediaPlayback::Paused  { progress: Some(MediaPosition(progress)) } };
        let _ = self.controls.set_playback(mp);
    }
}
```

## 三、集成到 Player

```rust
// InnerPlayer 有 Option<OsMedia>
impl InnerPlayer {
    pub async fn init_os_media(&mut self, app: &tauri::AppHandle, tx: mpsc::Sender<PlayerCmd>) -> anyhow::Result<()> {
        let mut media = OsMedia::new(app)?;
        media.attach(tx)?;
        self.os_media = Some(media);
        Ok(())
    }
}
```

播放状态变化时同步：

```rust
// 每次 Load 成功
if let Some(m) = &mut self.os_media {
    m.update_song(&song.title, song.artist.as_deref().unwrap_or(""), song.album.as_deref().unwrap_or(""),
                  cover_url.as_deref(), Duration::from_millis(song.duration_ms as u64));
}
// 每秒
if let Some(m) = &mut self.os_media {
    m.update_state(self.playing, Duration::from_secs_f64(self.progress));
}
```

## 四、媒体键快捷键（回退方案）

有些 Linux 桌面环境不转发媒体键到 MPRIS。用 `tauri-plugin-global-shortcut` 注册：

```rust
use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};

app.global_shortcut().on_shortcut("MediaPlayPause", |app, _, state| {
    if state.state() == ShortcutState::Pressed {
        let _ = app.emit("media:toggle", ());
    }
}).ok();

app.global_shortcut().on_shortcut("MediaTrackNext", |app, _, _| {
    let _ = app.emit("media:next", ());
}).ok();
```

## 五、封面在系统卡片里显示

macOS / Windows 的 Now Playing 需要一个 URL 或本地路径：

- 本地：`file:///path/to/cover.jpg`
- 网络：`https://.../cover.jpg`

通常先写到 `$APPCACHE/covers/<hash>.jpg`，用 `file://` 传入：

```rust
let cover_url = cache_dir.join(format!("{}.jpg", hash));
let url_str = url::Url::from_file_path(&cover_url).unwrap().to_string();
```

## 六、权限说明

macOS：App 首次调用 MediaPlayer 需要"媒体与 Apple Music"权限，系统会自动弹出。签名后才能稳定生效，调试期常见"显示不出来"，第 47 章打包签名后解决。

Windows：SMTC 只在 UWP / 签名桌面应用里保证稳定，未签名的 dev build 偶尔不出现。

## 本章小结

- `souvlaki` 统一了三平台的媒体中心 API。
- 保持 `update_state` / `update_song` 与真实播放状态同步至关重要。
- 签名之后功能更稳定。

## 动手时刻

- [ ] macOS 上打开控制中心，看到 CloudTone 歌曲信息。
- [ ] 按笔记本键盘的 F8（播放/暂停），切换播放。

下一章：在线音源的可插拔 Provider 架构。
