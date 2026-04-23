# 第 40 章 均衡器（EQ）与音效处理

## 本章目标

- 实现多段 biquad 峰值/低架/高架滤波器。
- 把 EQ 插入到解码流之后、混响之前。
- UI：10 段 ±12dB 滑块 + 预设（流行 / 摇滚 / 人声）。
- 可选：压缩、限幅（Limiter）、立体声增强。

## 一、Biquad 滤波器

Biquad 是音频 DSP 的工作马。一段 RBJ Cookbook 的实现：

```rust
// core/audio/dsp/biquad.rs
pub struct Biquad {
    b0: f32, b1: f32, b2: f32, a1: f32, a2: f32,
    z1: f32, z2: f32,
}

impl Biquad {
    pub fn peaking(fs: f32, f0: f32, q: f32, gain_db: f32) -> Self {
        let a = 10f32.powf(gain_db / 40.0);
        let w0 = 2.0 * std::f32::consts::PI * f0 / fs;
        let alpha = w0.sin() / (2.0 * q);
        let b0 = 1.0 + alpha * a;
        let b1 = -2.0 * w0.cos();
        let b2 = 1.0 - alpha * a;
        let a0 = 1.0 + alpha / a;
        let a1 = -2.0 * w0.cos();
        let a2 = 1.0 - alpha / a;
        Self { b0: b0/a0, b1: b1/a0, b2: b2/a0, a1: a1/a0, a2: a2/a0, z1: 0.0, z2: 0.0 }
    }

    pub fn process(&mut self, x: f32) -> f32 {
        let y = self.b0 * x + self.z1;
        self.z1 = self.b1 * x - self.a1 * y + self.z2;
        self.z2 = self.b2 * x - self.a2 * y;
        y
    }

    pub fn reset(&mut self) { self.z1 = 0.0; self.z2 = 0.0; }
}
```

## 二、EQ Graph

```rust
pub struct Equalizer {
    bands: Vec<(f32, Biquad, Biquad)>, // (freq, left, right)
    enabled: bool,
    fs: f32,
}

impl Equalizer {
    pub const DEFAULT_BANDS: [f32; 10] = [31.0, 62.0, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0, 16000.0];

    pub fn new(fs: f32) -> Self {
        let bands = Self::DEFAULT_BANDS.iter()
            .map(|&f| (f, Biquad::peaking(fs, f, 1.0, 0.0), Biquad::peaking(fs, f, 1.0, 0.0)))
            .collect();
        Self { bands, enabled: false, fs }
    }

    pub fn set_gains(&mut self, gains_db: &[f32]) {
        assert_eq!(gains_db.len(), self.bands.len());
        let fs = self.fs;
        for (i, &g) in gains_db.iter().enumerate() {
            let f = self.bands[i].0;
            self.bands[i].1 = Biquad::peaking(fs, f, 1.0, g);
            self.bands[i].2 = Biquad::peaking(fs, f, 1.0, g);
        }
    }

    pub fn process(&mut self, buf: &mut [f32]) {
        if !self.enabled { return; }
        // 立体声交错 L R L R
        for frame in buf.chunks_exact_mut(2) {
            let (l, r) = (frame[0], frame[1]);
            let mut yl = l; let mut yr = r;
            for (_, bl, br) in self.bands.iter_mut() {
                yl = bl.process(yl);
                yr = br.process(yr);
            }
            frame[0] = yl; frame[1] = yr;
        }
    }
}
```

## 三、挂到播放链

在 decoder 输出后、发给 output 前：

```rust
if let Some(eq) = self.eq.as_mut() {
    eq.process(&mut samples);
}
self.output.write(&samples);
```

EQ 线程安全：包 `Arc<Mutex<Equalizer>>`，或者让 pump 线程独占、通过 `PlayerCmd::SetEq(Vec<f32>)` 更新。

## 四、预设

```rust
pub fn preset(name: &str) -> Vec<f32> {
    match name {
        "flat"    => vec![0.0; 10],
        "rock"    => vec![5.0, 3.0, -1.0, -2.0, -1.0, 1.0, 2.0, 4.0, 5.0, 6.0],
        "pop"     => vec![-1.0, -1.0, 0.0, 2.0, 3.0, 3.0, 1.0, 0.0, -1.0, -2.0],
        "vocal"   => vec![-3.0, -2.0, -1.0, 1.0, 3.0, 4.0, 3.0, 2.0, 1.0, 0.0],
        "bass"    => vec![6.0, 5.0, 4.0, 2.0, 1.0, 0.0, -1.0, -2.0, -2.0, -2.0],
        _         => vec![0.0; 10],
    }
}
```

## 五、Limiter 防削波

EQ 加到 +12dB 可能削波（clip）。加一个软限幅：

```rust
pub fn limiter(samples: &mut [f32], threshold: f32) {
    for s in samples {
        if *s > threshold { *s = threshold + (*s - threshold).tanh() * (1.0 - threshold); }
        else if *s < -threshold { *s = -threshold + (*s + threshold).tanh() * (1.0 - threshold); }
    }
}
```

## 六、前端 UI

```tsx
const BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export function EqPanel() {
  const [gains, setGains] = useState<number[]>(Array(10).fill(0));
  const [enabled, setEnabled] = useState(false);

  useEffect(() => { commands.eqSet(gains, enabled); }, [gains, enabled]);

  function loadPreset(name: string) {
    commands.eqPreset(name).then(setGains);
  }

  return (
    <div className="p-4 bg-surface-1 rounded-lg">
      <div className="flex justify-between mb-3">
        <Switch checked={enabled} onChange={setEnabled} label="启用 EQ" />
        <Select onChange={loadPreset} options={["flat","rock","pop","vocal","bass"]} />
      </div>
      <div className="flex gap-2 items-end h-40">
        {BANDS.map((f, i) => (
          <div key={f} className="flex flex-col items-center gap-1 flex-1">
            <input type="range" min={-12} max={12} step={0.5} value={gains[i]} orient="vertical"
                   onChange={e => {
                     const v = Number(e.target.value);
                     setGains(prev => prev.map((g, j) => j === i ? v : g));
                   }}
                   className="h-32" />
            <span className="text-xs text-text-tertiary">{f >= 1000 ? `${f/1000}k` : f}</span>
            <span className="text-xs">{gains[i] > 0 ? "+" : ""}{gains[i].toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 七、性能与细节

- 切歌时 EQ `reset()` 防止残余滤波。
- 采样率变化时重新创建 Biquad。
- EQ 应作用在**重采样后**（output 的 fs），否则预设不对。

## 本章小结

- Biquad 一段干净实现 → 搭 10 段 EQ。
- 预设覆盖 80% 需求，专业用户可自定义。
- Limiter 不是可选：有 EQ 就得有它。

## 动手时刻

- [ ] 拉高低频 +6dB，听人声和鼓的变化。
- [ ] 选"摇滚"预设，对比关闭 EQ 的效果。

下一章：国际化 i18n 与字体加载。
