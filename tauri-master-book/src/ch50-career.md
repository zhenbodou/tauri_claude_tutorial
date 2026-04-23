# 第 50 章 面试准备与职业规划

## 本章目标

- 把你学到的落成可讲述的"作品叙事"。
- 准备 Tauri / Rust / React 高级岗常见考察点。
- 长期职业节奏。

## 一、作品叙事三段式

1. **问题定义**（30 秒）：  
   "CloudTone 是一个跨平台桌面音乐播放器。主要挑战是在单进程里同时处理高性能音频解码、SQLite 海量歌曲索引、三窗口 UI 同步。"
2. **关键决策**（1 分钟）：  
   "音频引擎采用 Actor 模式 + 专用 pump 线程，解耦 async 与 realtime；数据库用 FTS5 + 2-gram 搜中文；多窗口用 Tauri 单进程多 Webview 共享 AppState。"
3. **度量结果**（30 秒）：  
   "10 万首歌滚动保持 60fps；冷启动 1.1s；崩溃率 < 0.3%。"

练一个 2 分钟的版本、一个 10 分钟的版本。

## 二、作品可视化

- GitHub README：屏幕录制 + 架构图。
- 博客写 3 篇：
  - "我们为什么选 Tauri"
  - "写一个无 gc 延迟的 Rust 音频引擎"
  - "CloudTone 的插件沙箱设计"
- YouTube / 视频站：5 分钟 demo。

## 三、常见考察点

### Rust

- 所有权 / 借用 / 生命周期：讲出为什么 `self.audio` 在 `&mut self` 里不能直接 move。
- Send / Sync：tokio::spawn 的 future 必须 Send。
- Pin / async 状态机：简略能讲即可。
- 设计题：读写锁 vs Mutex；Channel vs 回调。

### React / 前端

- Reconciliation：为啥要 key。
- Hook 闭包陷阱：`useEffect` 读到过期状态的典型。
- 状态管理：Zustand / Redux / Query 分层。

### Tauri / 架构

- IPC 机制：Command vs Event vs Channel。
- 权限模型：Capabilities & Scope。
- 多窗口同步：state 在 Rust，事件广播。
- 打包签名：mac 公证全流程。

### 系统 / 性能

- 内存布局：ring buffer 为啥选 `HeapRb`。
- 线程模型：cpal callback + pump thread。
- I/O 优化：WAL、batch、mmap。

## 四、简历亮点写法

**弱：** "用 Tauri 实现了音乐播放器，实现了播放、歌单、歌词。"

**强：** "自研跨平台桌面音乐客户端 CloudTone：
- Rust 音频引擎：symphonia 解码 + cpal 输出 + HeapRb 零分配管线，稳定 96kHz 播放，P99 回调延迟 < 2ms。
- 多窗口单进程架构：3 个 Webview 共享 `AppState`，节省 200MB 内存对比 Electron 同类应用。
- 本地 + 在线搜索：SQLite FTS5 + 2-gram 分词，10 万首歌 p95 延迟 18ms。
- CI/CD：GitHub Actions 三平台矩阵构建，macOS 公证 + Windows 代码签名全流程自动化。"

## 五、项目贡献

- 给 Tauri 提一个 issue / PR（即使是文档）。
- 给 symphonia 报一个兼容性 bug。
- 社群（Discord）答 10 个问题。

这些经历是简历上的 "X-factor"，显示你不是只 copy paste。

## 六、学习节奏建议

- **3 个月**：做完 CloudTone 核心（Ch 21-35），能写简单 Tauri App。
- **6 个月**：完成完整 CloudTone（含更新、签名、E2E）、1 篇技术博客。
- **12 个月**：贡献过开源 PR、能独立排查任意 Tauri 线上问题、在团队里传帮带。

## 七、心态

- 过度准备面试 < 把项目做深。
- 做过真实 App 一次，顶 20 次八股。
- 持续输出 > 零散学习。

## 八、下一本书？

- 《Programming Rust, 2nd》—— 深化 Rust。
- 《Designing Data-Intensive Applications》—— 系统设计。
- 《High Performance Browser Networking》—— 理解 Web 栈。

## 九、给你的最后一句

> **完成重于完美，迭代胜过空想。** 
> 如果你已经把 CloudTone 做到能日常使用，你就已经站在了"高级候选人"的起跑线上。

---

**本书正文完。接下来是附录——FAQ、资源、源码索引。**
