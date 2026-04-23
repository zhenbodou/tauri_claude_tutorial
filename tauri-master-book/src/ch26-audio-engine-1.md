# 第 26 章 Rust 音频引擎 1：`symphonia` 解码 + `cpal` 输出

## 本章目标

- 理解音频解码 + 输出管线。
- 用 `symphonia` 解码 MP3/FLAC/AAC/OGG/WAV。
- 用 `cpal` 把 PCM 数据送到声卡。
- 做一个 Actor 模式的 `Player`，可接受 Play/Pause/Stop 命令。

## 一、管线总览

```
文件 → Symphonia::Reader → Decoder → AudioBuffer(f32)
                                        │
                                        ▼
                                   Rubato 重采样 (目标 44.1/48kHz)
                                        │
                                        ▼
                        Ring Buffer (producer / consumer)
                                        │
                                        ▼
                                   cpal Stream (实时输出)
```

## 二、核心数据结构

```rust
// src-tauri/src/core/audio/mod.rs
pub mod player;
pub mod decoder;
pub mod output;
pub mod queue;

pub use player::{Player, PlayerHandle};
```

### 消息定义

```rust
// src-tauri/src/core/audio/player.rs
use std::path::PathBuf;
use tokio::sync::{mpsc, oneshot, broadcast};

pub enum PlayerCmd {
    Load(PathBuf, oneshot::Sender<anyhow::Result<u64>>), // 返回总 duration ms
    Play,
    Pause,
    Stop,
    Seek(f64),            // seconds
    SetVolume(f32),
    Shutdown,
}

#[derive(Clone, Debug)]
pub enum PlayerEvent {
    State { playing: bool, position: f64, duration: f64 },
    Ended,
}

#[derive(Clone)]
pub struct PlayerHandle {
    cmd_tx: mpsc::Sender<PlayerCmd>,
    pub events: broadcast::Sender<PlayerEvent>,
}

impl PlayerHandle {
    pub async fn load(&self, path: PathBuf) -> anyhow::Result<u64> {
        let (tx, rx) = oneshot::channel();
        self.cmd_tx.send(PlayerCmd::Load(path, tx)).await?;
        rx.await?
    }
    pub async fn play(&self)  -> anyhow::Result<()> { self.cmd_tx.send(PlayerCmd::Play).await?; Ok(()) }
    pub async fn pause(&self) -> anyhow::Result<()> { self.cmd_tx.send(PlayerCmd::Pause).await?; Ok(()) }
    pub async fn stop(&self)  -> anyhow::Result<()> { self.cmd_tx.send(PlayerCmd::Stop).await?; Ok(()) }
    pub async fn seek(&self, pos: f64) -> anyhow::Result<()> { self.cmd_tx.send(PlayerCmd::Seek(pos)).await?; Ok(()) }
    pub async fn set_volume(&self, v: f32) -> anyhow::Result<()> { self.cmd_tx.send(PlayerCmd::SetVolume(v)).await?; Ok(()) }
}
```

### 启动 Actor

```rust
pub fn spawn_player() -> PlayerHandle {
    let (cmd_tx, mut cmd_rx) = mpsc::channel::<PlayerCmd>(32);
    let (ev_tx, _) = broadcast::channel::<PlayerEvent>(64);
    let ev = ev_tx.clone();

    std::thread::spawn(move || {
        let mut player = InnerPlayer::new(ev);
        // blocking thread，不跑 async runtime
        while let Some(cmd) = cmd_rx.blocking_recv() {
            if let Err(e) = player.handle(cmd) {
                tracing::error!("player error: {}", e);
            }
            if player.should_exit { break; }
        }
    });

    PlayerHandle { cmd_tx, events: ev_tx }
}
```

## 三、Decoder：用 Symphonia

```rust
// src-tauri/src/core/audio/decoder.rs
use std::fs::File;
use symphonia::core::{
    audio::{AudioBufferRef, SignalSpec},
    codecs::{Decoder as _, DecoderOptions},
    formats::{FormatOptions, FormatReader, SeekMode, SeekTo},
    io::MediaSourceStream,
    meta::MetadataOptions,
    probe::Hint,
    units::Time,
};

pub struct Decoder {
    reader: Box<dyn FormatReader>,
    decoder: Box<dyn symphonia::core::codecs::Decoder>,
    track_id: u32,
    pub spec: SignalSpec,
    pub total_frames: Option<u64>,
    pub sample_rate: u32,
    pub channels: usize,
}

impl Decoder {
    pub fn open(path: &std::path::Path) -> anyhow::Result<Self> {
        let file = File::open(path)?;
        let mss = MediaSourceStream::new(Box::new(file), Default::default());
        let mut hint = Hint::new();
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) { hint.with_extension(ext); }

        let probed = symphonia::default::get_probe().format(
            &hint, mss, &FormatOptions::default(), &MetadataOptions::default()
        )?;
        let reader = probed.format;
        let track = reader.default_track().ok_or_else(|| anyhow::anyhow!("no default track"))?;
        let sample_rate = track.codec_params.sample_rate.unwrap_or(44100);
        let channels = track.codec_params.channels.map(|c| c.count()).unwrap_or(2);
        let total_frames = track.codec_params.n_frames;
        let decoder = symphonia::default::get_codecs().make(&track.codec_params, &DecoderOptions::default())?;

        Ok(Self {
            reader, decoder, track_id: track.id,
            spec: SignalSpec::new(sample_rate, track.codec_params.channels.unwrap_or(symphonia::core::audio::Channels::FRONT_LEFT | symphonia::core::audio::Channels::FRONT_RIGHT)),
            total_frames, sample_rate, channels,
        })
    }

    pub fn next_packet(&mut self) -> anyhow::Result<Option<Vec<f32>>> {
        loop {
            let packet = match self.reader.next_packet() {
                Ok(p) => p,
                Err(symphonia::core::errors::Error::IoError(e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(None),
                Err(e) => return Err(e.into()),
            };
            if packet.track_id() != self.track_id { continue; }

            let decoded = self.decoder.decode(&packet)?;
            let mut interleaved = Vec::with_capacity(decoded.frames() * self.channels);
            copy_to_interleaved(&decoded, &mut interleaved);
            return Ok(Some(interleaved));
        }
    }

    pub fn seek(&mut self, secs: f64) -> anyhow::Result<()> {
        let time = Time::from(secs);
        self.reader.seek(SeekMode::Accurate, SeekTo::Time { time, track_id: Some(self.track_id) })?;
        Ok(())
    }
}

fn copy_to_interleaved(buf: &AudioBufferRef<'_>, out: &mut Vec<f32>) {
    use symphonia::core::audio::Signal;
    match buf {
        AudioBufferRef::F32(b) => {
            let planes = b.planes();
            let planes = planes.planes();
            let frames = b.frames();
            let ch = planes.len();
            for i in 0..frames { for c in 0..ch { out.push(planes[c][i]); } }
        }
        _ => {
            // 实际要处理 U8/S16/S32/F64。Symphonia 自带 convert。这里演示 F32。
            let mut tmp = buf.make_equivalent::<f32>();
            buf.convert(&mut tmp);
            let planes = tmp.planes();
            let planes = planes.planes();
            let frames = tmp.frames();
            let ch = planes.len();
            for i in 0..frames { for c in 0..ch { out.push(planes[c][i]); } }
        }
    }
}
```

## 四、Output：cpal Stream + Ring Buffer

```rust
// src-tauri/src/core/audio/output.rs
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, StreamConfig};
use ringbuf::{HeapRb, HeapConsumer, HeapProducer};
use std::sync::{Arc, Mutex};

pub struct Output {
    _stream: cpal::Stream,
    pub producer: HeapProducer<f32>,
    pub config: StreamConfig,
    pub channels: u16,
}

pub fn make_output(channels: u16, target_rate: u32, volume: Arc<Mutex<f32>>) -> anyhow::Result<Output> {
    let host = cpal::default_host();
    let device = host.default_output_device().ok_or_else(|| anyhow::anyhow!("no output device"))?;

    let config: StreamConfig = cpal::StreamConfig {
        channels,
        sample_rate: cpal::SampleRate(target_rate),
        buffer_size: cpal::BufferSize::Default,
    };

    let rb = HeapRb::<f32>::new(target_rate as usize * channels as usize); // 1s buffer
    let (producer, mut consumer) = rb.split();

    let stream = device.build_output_stream(
        &config,
        move |out: &mut [f32], _| {
            let vol = *volume.lock().unwrap();
            for v in out.iter_mut() {
                *v = consumer.pop().unwrap_or(0.0) * vol;
            }
        },
        |err| tracing::error!("cpal stream error: {}", err),
        None,
    )?;
    stream.play()?;

    Ok(Output { _stream: stream, producer, config, channels })
}
```

## 五、InnerPlayer：串起 Decoder 和 Output

```rust
// player.rs 续
use super::{decoder::Decoder, output::{make_output, Output}};
use tokio::sync::broadcast;
use std::sync::{Arc, Mutex};
use std::time::{Instant, Duration};

pub struct InnerPlayer {
    ev: broadcast::Sender<PlayerEvent>,
    decoder: Option<Decoder>,
    output: Option<Output>,
    volume: Arc<Mutex<f32>>,
    duration_sec: f64,
    position_sec: f64,
    playing: bool,
    pub should_exit: bool,
    last_tick: Instant,
}

impl InnerPlayer {
    pub fn new(ev: broadcast::Sender<PlayerEvent>) -> Self {
        Self {
            ev, decoder: None, output: None,
            volume: Arc::new(Mutex::new(1.0)),
            duration_sec: 0.0, position_sec: 0.0,
            playing: false, should_exit: false,
            last_tick: Instant::now(),
        }
    }

    pub fn handle(&mut self, cmd: PlayerCmd) -> anyhow::Result<()> {
        match cmd {
            PlayerCmd::Load(path, rx) => {
                let dec = Decoder::open(&path);
                match dec {
                    Ok(d) => {
                        self.duration_sec = d.total_frames.map(|f| f as f64 / d.sample_rate as f64).unwrap_or(0.0);
                        self.position_sec = 0.0;
                        let out = make_output(d.channels as u16, d.sample_rate, self.volume.clone())?;
                        self.decoder = Some(d); self.output = Some(out);
                        let ms = (self.duration_sec * 1000.0) as u64;
                        let _ = rx.send(Ok(ms));
                    }
                    Err(e) => { let _ = rx.send(Err(e)); }
                }
            }
            PlayerCmd::Play => { self.playing = true; }
            PlayerCmd::Pause => { self.playing = false; }
            PlayerCmd::Stop => { self.playing = false; self.decoder = None; self.output = None; self.position_sec = 0.0; }
            PlayerCmd::Seek(s) => { if let Some(d) = &mut self.decoder { d.seek(s)?; self.position_sec = s; } }
            PlayerCmd::SetVolume(v) => { *self.volume.lock().unwrap() = v.clamp(0.0, 1.5); }
            PlayerCmd::Shutdown => { self.should_exit = true; }
        }
        self.pump()?;
        Ok(())
    }

    fn pump(&mut self) -> anyhow::Result<()> {
        let (Some(dec), Some(out)) = (self.decoder.as_mut(), self.output.as_mut()) else { return Ok(()); };
        if !self.playing { return Ok(()); }

        // 把几帧 decoded samples 推到 producer，直到 buffer 满
        while out.producer.free_len() > 8192 {
            match dec.next_packet()? {
                Some(samples) => {
                    for &s in &samples { out.producer.push(s).ok(); }
                    self.position_sec += samples.len() as f64 / (dec.sample_rate as f64 * dec.channels as f64);
                }
                None => {
                    self.playing = false;
                    let _ = self.ev.send(PlayerEvent::Ended);
                    return Ok(());
                }
            }
        }

        // 每 100ms 发一次状态
        if self.last_tick.elapsed() >= Duration::from_millis(100) {
            self.last_tick = Instant::now();
            let _ = self.ev.send(PlayerEvent::State {
                playing: self.playing,
                position: self.position_sec,
                duration: self.duration_sec,
            });
        }
        Ok(())
    }
}
```

**注意**：生产版的 pump 要跑在独立循环里（下一章我们会把"持续喂数据"改成 watchdog 线程）。

## 六、暴露到 Command

```rust
// src-tauri/src/cmds/player.rs
use crate::state::AppState;

#[tauri::command]
#[specta::specta]
pub async fn player_play(state: tauri::State<'_, AppState>, song_id: i64) -> Result<(), String> {
    let song = state.library.read().await.get_by_id(song_id).map_err(|e| e.to_string())?;
    state.player.load(song.path.into()).await.map_err(|e| e.to_string())?;
    state.player.play().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command] #[specta::specta]
pub async fn player_pause(state: tauri::State<'_, AppState>) -> Result<(), String> { state.player.pause().await.map_err(|e| e.to_string()) }

#[tauri::command] #[specta::specta]
pub async fn player_resume(state: tauri::State<'_, AppState>) -> Result<(), String> { state.player.play().await.map_err(|e| e.to_string()) }

#[tauri::command] #[specta::specta]
pub async fn player_seek(state: tauri::State<'_, AppState>, pos: f64) -> Result<(), String> { state.player.seek(pos).await.map_err(|e| e.to_string()) }

#[tauri::command] #[specta::specta]
pub async fn player_set_volume(state: tauri::State<'_, AppState>, v: f32) -> Result<(), String> { state.player.set_volume(v).await.map_err(|e| e.to_string()) }
```

## 七、事件透传到前端

在 `setup` 里：

```rust
let mut rx = state.player.events.subscribe();
let app_handle = app.handle().clone();
tokio::spawn(async move {
    while let Ok(ev) = rx.recv().await {
        match ev {
            PlayerEvent::State { playing, position, duration } => {
                app_handle.emit("player:progress", serde_json::json!({ "position": position, "duration": duration })).ok();
                app_handle.emit("player:state", serde_json::json!({ "playing": playing })).ok();
            }
            PlayerEvent::Ended => { app_handle.emit("player:ended", ()).ok(); }
        }
    }
});
```

## 本章小结

- Actor + mpsc 让 Player 解耦。
- Symphonia 解码统一各格式。
- cpal + ring buffer 实现低延迟输出。

## 动手时刻

- [ ] 把上述代码接入项目。
- [ ] 用一首本地 MP3 测试：手动调用 `player_play` 传 songId，监听 `player:progress`。

下一章：完善 seek / 淡入淡出 / 无缝切歌。
