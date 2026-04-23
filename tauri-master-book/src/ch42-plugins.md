# 第 42 章 插件系统设计

## 本章目标

- 区分"Tauri 官方插件"与"你的应用级插件"。
- CloudTone 的应用级插件架构：脚本（JS/WASM）或独立进程。
- 给出一个最小安全沙箱方案：WebWorker + Structured Clone 通信。

## 一、两种插件观

1. **Tauri Plugin**：用 Rust 写，编译进 App，深度访问系统。不适合第三方，因为需要重编。
2. **应用级插件**：运行时加载的脚本/配置，能力有限但可动态安装。

CloudTone 面向用户，取第 2 种。

## 二、插件规范

```
plugin-dir/
├── manifest.json
├── main.js
└── icon.png
```

```jsonc
{
  "id": "lyric-translator",
  "name": "歌词翻译",
  "version": "0.1.0",
  "permissions": ["network"],       // 可选权限
  "hooks": ["onSongLoad", "onLyrics"]
}
```

## 三、加载器

```rust
// core/plugins/mod.rs
use std::path::Path;

pub struct PluginMeta {
    pub id: String,
    pub name: String,
    pub path: std::path::PathBuf,
    pub permissions: Vec<String>,
    pub hooks: Vec<String>,
}

pub fn scan_plugins(dir: &Path) -> std::io::Result<Vec<PluginMeta>> {
    let mut out = vec![];
    if !dir.exists() { return Ok(out); }
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let mf = entry.path().join("manifest.json");
        if !mf.exists() { continue; }
        let raw = std::fs::read_to_string(&mf)?;
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) {
            out.push(PluginMeta {
                id: v["id"].as_str().unwrap_or("").into(),
                name: v["name"].as_str().unwrap_or("").into(),
                path: entry.path(),
                permissions: v["permissions"].as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default(),
                hooks: v["hooks"].as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default(),
            });
        }
    }
    Ok(out)
}
```

## 四、前端沙箱

把插件 `main.js` 丢进 Web Worker：它没有 DOM 和大部分 API，通信靠 `postMessage`。

```ts
// src/features/plugins/host.ts
export class PluginHost {
  private worker: Worker;
  constructor(private meta: PluginMeta) {
    const code = `
      importScripts("${meta.mainUrl}");
      self.onmessage = async (e) => {
        try {
          const fn = self[e.data.hook];
          if (typeof fn === "function") {
            const result = await fn(e.data.payload);
            self.postMessage({ id: e.data.id, result });
          }
        } catch (err) {
          self.postMessage({ id: e.data.id, error: String(err) });
        }
      };
    `;
    const blob = new Blob([code], { type: "application/javascript" });
    this.worker = new Worker(URL.createObjectURL(blob));
  }

  call<T>(hook: string, payload: any): Promise<T> {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        if (e.data.id !== id) return;
        this.worker.removeEventListener("message", handler);
        if (e.data.error) reject(new Error(e.data.error));
        else resolve(e.data.result);
      };
      this.worker.addEventListener("message", handler);
      this.worker.postMessage({ id, hook, payload });
    });
  }

  destroy() { this.worker.terminate(); }
}
```

## 五、注册 Hook

```ts
export class PluginRegistry {
  hosts = new Map<string, PluginHost>();

  async load(meta: PluginMeta) {
    this.hosts.set(meta.id, new PluginHost(meta));
  }

  async onSongLoad(song: Song) {
    for (const host of this.hosts.values()) {
      try { await host.call("onSongLoad", song); } catch (e) { console.warn(e); }
    }
  }
}
```

## 六、示例插件：歌词翻译

```js
// main.js (用户写的插件)
globalThis.onLyrics = async ({ lines, target }) => {
  const translated = await fetch("https://translate.example/api", {
    method: "POST",
    body: JSON.stringify({ lines: lines.map(l => l.text), target }),
  }).then(r => r.json());
  return lines.map((l, i) => ({ ...l, translated: translated[i] }));
};
```

CloudTone 主程序在加载歌词后调用：

```ts
const translated = await plugins.call("onLyrics", { lines, target: "zh-CN" });
setLyrics(translated);
```

## 七、权限与隔离

Worker 默认没有 fetch 限制，但你可以：

- 拦截 `fetch`：在注入的 bootstrap 脚本里覆盖 `globalThis.fetch` 为带白名单的版本。
- 只允许 `manifest.permissions` 声明的能力（如 `network`、`storage`）。
- 敏感 API（读文件、播放控制）由 Host 提供给 Worker，走 `postMessage` 显式授权。

```ts
// bootstrap.js
const allowNet = {{JSON.stringify(meta.permissions.includes("network"))}};
const origFetch = self.fetch;
self.fetch = allowNet ? origFetch : () => { throw new Error("No network permission"); };
```

## 八、生命周期

- 启动时扫描 `$APPDATA/cloudtone/plugins/` 并加载。
- 用户禁用时 `destroy()`。
- Hot reload：开发模式监听文件变化重建 Worker。

## 九、WASM 方案（进阶）

如需更强隔离，用 `wasmtime` 或 `wasmer`。插件导出 `onSongLoad(ptr, len)`，Host 在 Rust 层调用。学习成本高但更安全，适合给陌生开发者开放。

## 本章小结

- Web Worker 是前端插件最轻量的沙箱。
- Manifest 驱动权限能缩小攻击面。
- 插件系统让产品长期活跃，用户参与感强。

## 动手时刻

- [ ] 写一个 "onSongLoad" 插件，打印歌名到 console。
- [ ] 给插件加"禁用/启用"开关。

下一章：自动更新。
