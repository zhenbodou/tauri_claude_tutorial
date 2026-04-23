# 第 27 章 Rust 音频引擎 2：播放控制、seek、音量、淡入淡出

## 本章目标

- 完善 seek 行为（跳转时清空缓冲避免杂音）。
- 实现音量渐变 / 淡入淡出。
- 实现无缝切歌（gapless playback）。
- 加入后台独立喂数据线程。

## 一、独立喂数据线程

第 26 章的 `pump` 是 command-triggered 的。但 cpal 是实时消费，需要持续喂。改用独立线程：

```rust
pub fn spawn_player() -> PlayerHandle {
    let (cmd_tx, mut cmd_rx) = mpsc::channel::<PlayerCmd>(32);
    let (ev_tx, _) = broadcast::channel::<PlayerEvent>(64);

    let ev_c = ev_tx.clone();
    std::thread::spawn(move || {
        let mut p = InnerPlayer::new(ev_c);
        loop {
            // 非阻塞处理命令
            while let Ok(cmd) = cmd_rx.try_recv() {
                p.handle_cmd(cmd).ok();
                if p.should_exit { return; }
            }
            // 喂数据
            p.pump_once();
            // 每 10ms tick
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    });

    PlayerHandle { cmd_tx, events: ev_tx }
}
```

## 二、精确 Seek

Symphonia 的 seek 是按 packet 对齐的。跳转后 producer 里还有旧样本 → 杂音。

```rust
PlayerCmd::Seek(s) => {
    if let (Some(d), Some(out)) = (self.decoder.as_mut(), self.output.as_mut()) {
        d.seek(s)?;
        self.position_sec = s;
        // 清空 ring buffer
        while out.producer.pop().is_some() {}
    }
}
```

因为 producer 的 pop 是一次一个 sample，上面需要在 `cpal` 的 consumer 侧清。改法：用 `HeapRb::clear` 或者把 producer 侧加个 flag "正在 seek"，consumer 侧读到 flag 就静音若干毫秒。

完整工业做法是换 `HeapRb` 为支持 reset 的 buffer（或者直接重建 output）。

## 三、淡入淡出 (Fade)

避免 pause/resume 的"咔哒"声：

```rust
struct Fader {
    target: f32,      // 目标音量
    current: f32,
    step: f32,        // 每帧递增
}

impl Fader {
    fn tick(&mut self, samples: &mut [f32]) {
        for s in samples.iter_mut() {
            if (self.current - self.target).abs() > f32::EPSILON {
                self.current += (self.target - self.current).signum() * self.step.min((self.target - self.current).abs());
            }
            *s *= self.current;
        }
    }
}
```

把 Fader 的 `tick` 放到 cpal callback 里：

```rust
let fader = Arc::new(Mutex::new(Fader { target: 1.0, current: 0.0, step: 0.01 }));
// cpal callback
|out: &mut [f32], _| {
    for v in out.iter_mut() { *v = consumer.pop().unwrap_or(0.0); }
    fader.lock().unwrap().tick(out);
}
```

Pause 时 `target = 0`，Resume 时 `target = volume`。几百 ms 内听不见突变。

## 四、无缝切歌（Gapless）

传统做法：当前歌快结束时（差 500ms），预加载下一首解码到 secondary buffer，在最后一帧对齐后无缝切换 producer 源。

CloudTone 简化版：

1. 当前歌 "position >= duration - 0.5" 时，emit `PlayerEvent::NearEnd`。
2. 前端决定下一首并 `invoke("player_preload", nextId)`。
3. Rust 预加载第二个 decoder + buffer。
4. 当前 decoder 结束，切换。

```rust
PlayerCmd::Preload(path) => { self.next_decoder = Some(Decoder::open(&path)?); }

fn pump_once(&mut self) {
    if let Some(dec) = self.decoder.as_mut() {
        if dec.next_packet().ok().flatten().is_none() {
            if let Some(n) = self.next_decoder.take() {
                self.decoder = Some(n);
                self.position_sec = 0.0;
                // 不发 Ended，而是发 TrackChanged
                let _ = self.ev.send(PlayerEvent::TrackChanged);
                return;
            }
            self.playing = false;
            let _ = self.ev.send(PlayerEvent::Ended);
        }
    }
}
```

## 五、ReplayGain / 响度归一化（可选）

音乐文件的响度差异大。`lofty` 读 ID3 的 `REPLAYGAIN_TRACK_GAIN` 和 `REPLAYGAIN_TRACK_PEAK`，换算为线性系数喂给 Fader。CloudTone 设置里可开关「响度统一」。

```rust
let gain_db: f32 = meta.get("REPLAYGAIN_TRACK_GAIN").and_then(|s| s.strip_suffix(" dB").unwrap_or(s).parse().ok()).unwrap_or(0.0);
let linear = 10f32.powf(gain_db / 20.0);
fader.lock().unwrap().target *= linear;
```

## 六、对前端暴露设置

```rust
#[tauri::command] #[specta::specta]
pub async fn player_set_fade_ms(state: tauri::State<'_, AppState>, ms: u32) -> Result<(), String> { /*...*/ Ok(()) }

#[tauri::command] #[specta::specta]
pub async fn player_set_gapless(state: tauri::State<'_, AppState>, on: bool) -> Result<(), String> { /*...*/ Ok(()) }
```

## 七、前端：seek 滑块

```tsx
// src/components/player/PlayerBar.tsx
import * as Slider from "@radix-ui/react-slider";
import { usePlayer } from "@/features/player/playerStore";

function ProgressSlider() {
  const { position, duration, seek } = usePlayer();
  const [dragging, setDragging] = useState(false);
  const [local, setLocal] = useState(0);
  const value = dragging ? local : position;
  return (
    <Slider.Root
      value={[value]}
      max={duration || 1}
      step={0.1}
      onValueChange={v => { setDragging(true); setLocal(v[0]); }}
      onValueCommit={v => { setDragging(false); seek(v[0]); }}
      className="flex items-center w-full h-4"
    >
      <Slider.Track className="bg-white/10 h-1 rounded w-full"><Slider.Range className="bg-brand-500 h-1 rounded" /></Slider.Track>
      <Slider.Thumb className="block w-3 h-3 rounded-full bg-white" />
    </Slider.Root>
  );
}
```

## 本章小结

- 独立线程保证 cpal 持续有数据。
- Fade/gapless 让播放体验接近商业软件。
- 前端滑块只管 UX，真逻辑在 Rust。

## 动手时刻

- [ ] 接入 Fader，快速暂停/继续没有咔哒声。
- [ ] 写一个两首歌队列测 gapless，应该听不到空隙。
- [ ] 手动 seek 验证不爆音。

下一章：本地音乐库扫描。
