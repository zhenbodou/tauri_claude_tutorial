# 第 21 章 产品设计与架构：CloudTone 的全貌

## 本章目标

- 明确 CloudTone 的产品定位、用户故事、核心流程。
- 画出系统架构图与模块边界。
- 敲定前后端职责划分、通信模式、数据流。
- 制定里程碑 + 每章交付物。

在动手写一行代码前，先花一章把设计讲透。工程能力里这一步最拉开差距。

## 一、产品定位

**一句话**：CloudTone 是一款仿「网易云音乐」风格、以本地音乐为核心、可插拔在线音源、面向重度听歌用户的跨平台桌面播放器。

**不做的事**：

- 不做 UGC 社区（评论、动态）。
- 不做复杂推荐算法（初版用"心动 FM"的简单策略）。
- 不做云端同步（本地优先，后期再考虑自建同步）。

**做到的事**：

- 本地音乐库完善管理（歌单、专辑、艺人、评分、收藏）。
- 在线音源以 Provider 形式可扩展（用户自行选择合规来源）。
- 媲美网易云的 UI 体验（深色主题、封面动画、歌词同步）。

## 二、用户故事 (User Stories)

> As a 重度听歌用户 I want 选择多个本地音乐目录自动导入 so that 打开 app 就能随点随播。
>
> As a 用户 I want 看到同步滚动的歌词 so that 不用切到手机。
>
> As a 用户 I want 按关键字搜索本地曲库 so that 快速找到某首歌。
>
> As a 用户 I want 建立自己的歌单，拖拽排序、删除、合并 so that 我的音乐库有序。
>
> As a 用户 I want 按 Ctrl+Alt+P 在任何窗口暂停/继续 so that 不用切回 CloudTone。
>
> As a 插件开发者 I want 写一个插件从 X 音源拉歌 so that 我不必 fork 整个项目。

## 三、模块划分

```
CloudTone
├── UI 层 (React)
│   ├── 页面：Home / Library / Playlist / Artist / Album / Search / Settings
│   ├── 组件：Player Bar / Sidebar / Now Playing / Lyrics Panel / Toasts
│   └── 子窗口：Mini Player / Lyric Overlay
├── 状态层 (Zustand + TanStack Query)
│   ├── playerStore: 当前播放歌曲、队列、模式、进度
│   ├── libraryStore: 选中过滤、视图模式
│   ├── uiStore: 主题、侧栏折叠、对话框
│   └── Query: 歌曲列表、歌单、搜索结果（由 Rust 提供）
├── IPC 层 (Tauri invoke / emit)
│   ├── 命令：player::*, library::*, playlist::*, settings::*, provider::*
│   ├── 事件：player:*, library:*, download:*, scan:*
│   └── Channel：scan 流、download 流
└── 核心层 (Rust)
    ├── Audio Engine  — symphonia 解码 + cpal 输出 + 自研队列
    ├── Library       — walkdir + lofty + SQLite 入库
    ├── Lyrics        — LRC 解析 + 时间匹配
    ├── Providers     — MusicProvider trait + 注册表
    ├── Downloader    — 并发下载 + 断点续传
    ├── EQ            — biquad filter 链
    └── DB            — sqlx + migration
```

## 四、架构示意

```
 ┌──────────────────────────┐
 │        UI (React)        │
 │  pages / components      │
 └───────────┬──────────────┘
             │ Hooks (Zustand / useQuery)
 ┌───────────▼──────────────┐
 │        State Store        │
 └───────────┬──────────────┘
             │ invoke / listen
 ┌───────────▼──────────────┐
 │       Tauri Bridge        │
 │   (Commands / Events)     │
 └───────────┬──────────────┘
             │
 ┌───────────▼──────────────┐     ┌──────────────────┐
 │     Core Services (Rust) │◄────┤  Audio Engine     │
 │  Library  Playlist  Lyrics│     │  cpal + symphonia │
 │  Providers Downloader EQ │     └──────────────────┘
 └───────────┬──────────────┘
             │
 ┌───────────▼──────────────┐
 │   SQLite (sqlx + WAL)     │
 └───────────────────────────┘
```

## 五、数据流（以"播放一首歌"为例）

1. 用户双击歌曲列表里的一首歌（UI）。
2. `usePlayerStore.getState().play(song)`（前端）。
3. Zustand 内部调用 `invoke("player_play", { songId })`。
4. Rust command 从 DB 拿到 `path`，`Audio Engine` 加载并解码。
5. `Audio Engine` 启动 cpal 输出 + 定时发出 `player:progress` 事件。
6. `player:state` 广播给所有窗口（主、迷你、桌面歌词）。
7. 前端根据事件刷新 UI。
8. DB 写入 `play_history`。

## 六、UI 草图（文字版）

```
┌──────────────────────────────────────────────────────────────┐
│ [≡] CloudTone          [搜索框]              [设置 账号]     │
├─────────────┬────────────────────────────┬───────────────────┤
│ 发现        │                            │                   │
│ 音乐馆      │                            │   [封面大图]       │
│ 每日推荐    │      中间主内容区           │                   │
│ ─────────  │   (歌单/歌曲列表/艺人)      │   歌词滚动        │
│ 我的音乐    │                            │                   │
│   收藏      │                            │                   │
│   歌单 ▸    │                            │                   │
│   最近播放   │                            │                   │
│ ─────────  │                            │                   │
│ 本地音乐    │                            │                   │
└─────────────┴────────────────────────────┴───────────────────┘
│ ◀◀  ▶ / ⏸  ▶▶   [00:12 ━━━━━━━ 03:45]  ♡ 🎚  🔀 📃  ♪    │
└──────────────────────────────────────────────────────────────┘
```

## 七、里程碑

| 里程碑 | 章节 | 产出 |
|--------|------|------|
| M0 骨架 | 22–25 | UI 框架 + 路由 + 状态 |
| M1 音频核心 | 26–27 | 能播放任意本地音频 |
| M2 音乐库 | 28–30 | 扫描、入库、队列 |
| M3 歌词 + 元数据 | 31–32 | 歌词同步、封面、自定义协议 |
| M4 搜索 + 歌单 | 33–35 | 本地搜索、歌单 CRUD |
| M5 桌面体验 | 36–37 | 迷你播放器、媒体控制 |
| M6 在线扩展 | 38–39 | Provider 架构、下载 |
| M7 进阶 | 40–42 | EQ、i18n、插件系统 |
| M8 发布 | 43–47 | 自动更新、测试、CI/CD、上架 |

## 八、非功能需求

- **冷启动**：< 1.5 秒到可用（主窗口渲染完）。
- **内存**：空闲 < 80MB；播放中 < 120MB。
- **稳定**：连续播放 12 小时不崩。
- **音频延迟**：按暂停/下一曲到发声 < 200ms。
- **兼容**：macOS 12+、Windows 10+、Ubuntu 22+。

后面的章节会用具体测试验证每一项。

## 本章小结

- 产品设计决定工程走向。CloudTone 的核心是"本地优先 + 可扩展"。
- 模块清晰划分，IPC 走 command + event。
- 里程碑明确，每一章都有交付物。

下一章，把项目真正搭起来。
