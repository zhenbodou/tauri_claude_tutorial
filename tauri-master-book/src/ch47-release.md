# 第 47 章 发布、分发、监控与错误上报

## 本章目标

- 官网 / 下载页 / 发行说明工作流。
- 日志滚动、崩溃捕获、错误上报（Sentry）。
- 用户运营：反馈、问卷、应用内消息。
- 度量：埋点 + 隐私合规。

## 一、官网与下载页

- 用 Next.js / Astro 起一个静态站。
- 一个 `<DownloadButton>` 根据 UA 默认推荐平台。
- 展示最新 `latest.json` 的版本 + 发行说明。

```tsx
function DownloadBtn() {
  const p = detectPlatform(); // "mac-arm64" / "mac-x64" / "win" / "linux"
  return <a href={`/download/${p}`} className="btn-primary">下载 CloudTone</a>;
}
```

## 二、Sentry 接入

```bash
pnpm add @sentry/react
```

```ts
// src/main.tsx
import * as Sentry from "@sentry/react";
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 0.1,
  enabled: import.meta.env.PROD,
  release: `cloudtone@${import.meta.env.VITE_APP_VERSION}`,
});
```

Rust 侧：

```toml
sentry = { version = "0.34", default-features = false, features = ["rustls","backtrace","panic","contexts"] }
```

```rust
let _guard = sentry::init((std::env::var("SENTRY_DSN").ok(), sentry::ClientOptions {
    release: Some(env!("CARGO_PKG_VERSION").into()),
    environment: Some(if cfg!(debug_assertions) { "dev".into() } else { "prod".into() }),
    ..Default::default()
}));
std::panic::set_hook(Box::new(sentry::integrations::panic::panic_handler));
```

## 三、崩溃日志

除了 Sentry，本地也要留证据：

- `tracing_appender::rolling::daily` 写 `$APPDATA/cloudtone/logs/app.log.YYYY-MM-DD`。
- 保留最近 14 天。
- 提供"打开日志目录"按钮，方便用户反馈。

## 四、用户反馈

```tsx
<button onClick={() => openFeedback()}>反馈</button>

async function openFeedback() {
  const info = await commands.envSnapshot(); // 版本/OS/CPU
  open(`https://forms.cloudtone.app/feedback?v=${info.version}&os=${info.os}`);
}
```

如果走 GitHub Issues，用 Issue 模板预填 env：

```ts
const body = encodeURIComponent(`**版本**: ${v}\n**系统**: ${os}\n\n### 现象\n\n### 复现\n`);
open(`https://github.com/you/cloudtone/issues/new?template=bug.yml&body=${body}`);
```

## 五、度量埋点

- 只上报**非个人数据**：版本、OS、启动次数、崩溃次数、核心功能使用计数。
- 不上报：歌名、路径、文件哈希、用户输入。
- 首次启动显示同意弹窗；可在设置里关闭。

```ts
track("feature_used", { name: "equalizer" });
```

后端实现：Cloudflare Worker + D1，5 行代码搞定一个计数器；或用 Plausible / PostHog 自托管。

## 六、隐私政策 & GDPR

- 明确列出收集哪些数据、保留多久、如何删除。
- 提供"删除我的数据" 按钮 → 调 API。
- 欧盟用户需要 Cookie/Tracking consent。

## 七、应用内消息

- Rust 侧定时 (每日一次) 拉 `https://releases.cloudtone.app/messages.json`。
- 有新的 "公告" 时在 UI 顶部展示。
- 允许用户"不再显示"。

```json
[
  { "id": "2026-04-20-eq", "title": "新增均衡器", "url": "https://cloudtone.app/blog/eq", "expires": "2026-05-20" }
]
```

## 八、发版 checklist

- [ ] CHANGELOG 更新
- [ ] 版本号 bumpup（`Cargo.toml` / `package.json` / `tauri.conf.json`）
- [ ] 打 tag `v0.5.0`
- [ ] CI 构建 & 公证通过
- [ ] 官网下载页指到新版本
- [ ] Release note 发社群
- [ ] 24h 观察崩溃率 < 基线

## 九、监控面板

简单可做：

- GitHub Actions 每日聚合 Sentry 错误数、下载数、DAU，推 Slack。
- 关键指标：P0 崩溃率（< 0.5%），启动 TTI（< 1.5s），更新成功率（> 95%）。

## 本章小结

- 发布不是终点，而是开始。
- 用户感知到的质量 = 崩溃率 + 响应速度 + 反馈闭环。
- 监控和隐私同样重要，别越界收集。

## 动手时刻

- [ ] 集成 Sentry，手动抛异常，看上报。
- [ ] 写一个"关于"对话框，展示版本和日志目录。

## Part 2 结语

至此，CloudTone 实战部分完结。你已经构建了一个现实世界水准的跨平台桌面应用：音频引擎、多窗口、媒体中心、插件、签名更新、CI/CD、监控。

接下来 Part 3 聚焦"从能做到做得好"：架构观、性能极限、开源生态、职场准备。

下一章：源码阅读清单。
