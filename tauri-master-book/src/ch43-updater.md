# 第 43 章 自动更新（`tauri-plugin-updater` + 签名）

## 本章目标

- 配置更新清单 `latest.json`。
- 生成更新签名（minisign / 内置 `tauri signer`）。
- 前端 UI：检查、下载、重启。
- 差分更新与渠道（stable/beta）。

## 一、安装插件

```bash
pnpm add @tauri-apps/plugin-updater
```

```toml
# Cargo.toml
tauri-plugin-updater = "2"
```

```rust
// lib.rs
.plugin(tauri_plugin_updater::Builder::new().build())
```

## 二、生成签名密钥对

```bash
pnpm tauri signer generate -w ~/.tauri/cloudtone.key
```

产出：

- `cloudtone.key`（私钥，**保密**）。
- `cloudtone.key.pub`（公钥，放 tauri.conf.json）。

```jsonc
"plugins": {
  "updater": {
    "active": true,
    "endpoints": [
      "https://releases.cloudtone.app/{{target}}/{{current_version}}/latest.json"
    ],
    "dialog": false,
    "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6..."
  }
}
```

`{{target}}` 示例：`darwin-aarch64`、`windows-x86_64-msvc`、`linux-x86_64`。

## 三、构建时签名

在 CI 上：

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat $SECRET_KEY_FILE)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$PASS"
pnpm tauri build
```

构建完成后目录里会多出 `.sig` 文件。`latest.json` 示例：

```json
{
  "version": "1.2.3",
  "pub_date": "2026-04-20T09:00:00Z",
  "notes": "修复崩溃；新增均衡器；性能优化。",
  "platforms": {
    "darwin-aarch64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6...",
      "url": "https://releases.cloudtone.app/darwin-aarch64/1.2.3/CloudTone.app.tar.gz"
    },
    "windows-x86_64-msvc": {
      "signature": "...",
      "url": "https://releases.cloudtone.app/windows-x86_64-msvc/1.2.3/CloudTone.msi.zip"
    }
  }
}
```

## 四、前端代码

```tsx
// src/features/updater/useUpdater.ts
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useState } from "react";

export function useUpdater() {
  const [state, setState] = useState<{ available?: boolean; version?: string; progress?: number; err?: string }>({});

  async function run() {
    try {
      const update = await check();
      if (!update) { setState({ available: false }); return; }
      setState({ available: true, version: update.version });
      await update.downloadAndInstall((event) => {
        if (event.event === "Progress") {
          setState(s => ({ ...s, progress: event.data.chunkLength }));
        }
      });
      await relaunch();
    } catch (e: any) { setState({ err: e.message }); }
  }
  return { ...state, run };
}
```

UI：

```tsx
export function UpdateNotice() {
  const { available, version, progress, err, run } = useUpdater();
  if (!available) return null;
  return (
    <div className="fixed bottom-4 right-4 bg-surface-2 p-4 rounded-xl shadow-xl w-72">
      <div className="font-semibold">发现新版本 v{version}</div>
      <button onClick={run} className="mt-2 px-3 py-1 bg-brand-500 rounded">立即更新</button>
      {progress !== undefined && <div className="mt-2 text-xs">下载中…</div>}
      {err && <div className="mt-2 text-xs text-red-400">{err}</div>}
    </div>
  );
}
```

## 五、静默与计划

- **启动 30s 后检查**：避免抢占用户首屏。
- **4 小时轮询**：用 `setInterval`。
- **失败降噪**：3 次失败后停一天。

```ts
useEffect(() => {
  const t1 = setTimeout(() => check(), 30_000);
  const t2 = setInterval(() => check(), 4 * 60 * 60 * 1000);
  return () => { clearTimeout(t1); clearInterval(t2); };
}, []);
```

## 六、多渠道

`endpoints` 支持多个，按渠道切换：

```jsonc
"endpoints": [
  "https://releases.cloudtone.app/{{channel}}/{{target}}/latest.json"
]
```

channel 可以从设置读，启动时拼入 URL（需要自己拦截 endpoint）。简单做法：两份 `latest.json` (`/stable/...` vs `/beta/...`)，用户切渠道时改配置文件。

## 七、差分更新

Tauri 默认下载整包。对大应用（100MB+），可以：

- 服务端提供 bsdiff 补丁。
- 客户端先下 patch，用 `bsdiff::patch` apply。

> 这是工程优化项，初版可以不做。

## 八、回滚与紧急停更

- 线上出问题，把 `latest.json` 改回旧版本即可（clients 检查会发现"已是最新"）。
- 紧急：用 feature flag 远程配置关闭某功能，而不是靠更新。

## 九、macOS 公证 & Windows 签名

自动更新要求安装包本身通过 OS 的签名校验：

- macOS：Apple Developer ID + notarytool 公证（第 46 章细讲）。
- Windows：用代码签名证书（EV 为佳）签 .msi / .exe。

没签名的更新在 Gatekeeper / SmartScreen 上会被拦。

## 本章小结

- Tauri updater + 签名 = 低成本实现安全更新。
- UI 要克制，不打断用户。
- 基础架构之上还有渠道、差分、回滚策略。

## 动手时刻

- [ ] 生成密钥对，发布 v0.1.0。
- [ ] 改版本号到 0.1.1，生成新包，验证客户端自动弹提示。

下一章：性能优化。
