# 附录 C 完整代码索引（CloudTone 骨架）

本附录给出 CloudTone 项目的完整目录结构与每个关键文件的入口注释。

## 目录结构

```
cloudtone/
├── Cargo.toml
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── index.html
├── mini.html
├── lyric.html
├── README.md
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── scripts/
│   ├── compose-latest-json.js
│   └── gen-bindings.mjs
├── public/
│   ├── fonts/
│   └── icons/
├── src/                                # 前端 (React + TS)
│   ├── main.tsx                         # 主窗口入口
│   ├── mini/
│   │   ├── main.tsx
│   │   └── MiniApp.tsx
│   ├── lyric/
│   │   ├── main.tsx
│   │   └── LyricOverlay.tsx
│   ├── app/
│   │   ├── router.tsx
│   │   ├── home/HomePage.tsx
│   │   ├── library/LibraryPage.tsx
│   │   ├── playlist/PlaylistPage.tsx
│   │   ├── search/SearchPage.tsx
│   │   ├── lyrics/LyricsPage.tsx
│   │   ├── downloads/DownloadsPage.tsx
│   │   └── settings/SettingsPage.tsx
│   ├── components/
│   │   ├── shell/Shell.tsx
│   │   ├── shell/Sidebar.tsx
│   │   ├── shell/PlayerBar.tsx
│   │   ├── shell/TitleBar.tsx
│   │   ├── shell/NowPlayingPanel.tsx
│   │   ├── shell/SearchOverlay.tsx
│   │   ├── SongList.tsx
│   │   ├── SongRow.tsx
│   │   ├── LikeButton.tsx
│   │   ├── ContextMenu.tsx
│   │   └── ui/            (shadcn)
│   ├── features/
│   │   ├── player/player.ts             # Zustand store
│   │   ├── player/usePlayerSync.ts
│   │   ├── library/queries.ts
│   │   ├── search/useSearch.ts
│   │   ├── lyrics/useLyrics.ts
│   │   ├── playlists/queries.ts
│   │   ├── download/useDownloads.ts
│   │   ├── equalizer/useEq.ts
│   │   ├── plugins/host.ts
│   │   └── updater/useUpdater.ts
│   ├── hooks/
│   │   ├── useDebouncedValue.ts
│   │   ├── useHotkeys.ts
│   │   └── useMediaEvents.ts
│   ├── lib/
│   │   ├── ipc.ts                       # specta 自动生成
│   │   ├── cn.ts
│   │   ├── fmt.ts                       # 时间/大小格式化
│   │   └── types.ts
│   ├── i18n/
│   │   ├── index.ts
│   │   └── locales/
│   ├── styles/
│   │   ├── index.css
│   │   └── tokens.css
│   └── test/
│       ├── setup.ts
│       └── *.test.tsx
└── src-tauri/                         # Rust 后端
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── build.rs
    ├── icons/
    ├── capabilities/
    │   ├── default.json
    │   ├── mini.json
    │   └── lyric.json
    ├── migrations/
    │   ├── 20260115_init.sql
    │   └── 20260201_addons.sql
    ├── entitlements.plist
    └── src/
        ├── main.rs
        ├── lib.rs
        ├── state.rs                    # AppState
        ├── error.rs                    # AppError
        ├── cmds/
        │   ├── mod.rs
        │   ├── library.rs
        │   ├── player.rs
        │   ├── queue.rs
        │   ├── playlist.rs
        │   ├── search.rs
        │   ├── lyrics.rs
        │   ├── download.rs
        │   ├── eq.rs
        │   ├── settings.rs
        │   ├── plugins.rs
        │   └── updater.rs
        ├── core/
        │   ├── mod.rs
        │   ├── audio/
        │   │   ├── mod.rs
        │   │   ├── decoder.rs
        │   │   ├── output.rs
        │   │   ├── player.rs
        │   │   ├── queue.rs
        │   │   ├── fader.rs
        │   │   ├── media_controls.rs
        │   │   └── dsp/
        │   │       ├── biquad.rs
        │   │       └── equalizer.rs
        │   ├── library/
        │   │   ├── mod.rs
        │   │   ├── scanner.rs
        │   │   ├── importer.rs
        │   │   └── manager.rs
        │   ├── db/
        │   │   ├── mod.rs
        │   │   ├── migrations.rs
        │   │   ├── models.rs
        │   │   ├── queries.rs
        │   │   └── search.rs
        │   ├── lyrics/mod.rs
        │   ├── providers/
        │   │   ├── mod.rs
        │   │   ├── demo.rs
        │   │   └── registry.rs
        │   ├── download/mod.rs
        │   ├── plugins/mod.rs
        │   ├── protocol/
        │   │   ├── mod.rs
        │   │   └── cover.rs
        │   └── window/
        │       ├── mod.rs
        │       ├── main.rs
        │       ├── mini.rs
        │       └── lyric.rs
        └── tests/
            ├── db_test.rs
            └── fixtures/
```

## 关键入口文件

### `src-tauri/src/lib.rs`

```rust
use tauri_specta::Builder;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = Builder::<tauri::Wry>::new()
        .commands(tauri_specta::collect_commands![
            cmds::library::library_scan,
            cmds::library::library_list_songs,
            cmds::library::library_toggle_favorite,
            cmds::player::player_play,
            cmds::player::player_pause,
            cmds::player::player_toggle,
            cmds::player::player_seek,
            cmds::player::player_set_volume,
            cmds::queue::queue_set,
            cmds::queue::queue_next,
            cmds::queue::queue_prev,
            cmds::queue::queue_set_mode,
            cmds::playlist::playlist_create,
            cmds::playlist::playlist_list,
            cmds::playlist::playlist_add,
            cmds::playlist::playlist_remove,
            cmds::playlist::playlist_move,
            cmds::search::search,
            cmds::lyrics::lyrics_load,
            cmds::download::download_start,
            cmds::download::download_cancel,
            cmds::eq::eq_set,
            cmds::eq::eq_preset,
            cmds::settings::settings_get,
            cmds::settings::settings_set,
            cmds::plugins::plugins_list,
        ]);

    #[cfg(debug_assertions)]
    builder.export(specta_typescript::Typescript::default(), "../src/lib/ipc.ts").unwrap();

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, _, _| { /* focus main */ }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            state::setup(app)?;
            core::window::main::configure(app)?;
            core::protocol::cover::register(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### `src-tauri/src/main.rs`

```rust
fn main() { cloudtone::run(); }
```

### `src/main.tsx`

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import "./styles/index.css";
import "./i18n";

const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

## 一页 Cheatsheet

| 要做…… | 翻到第几章 |
| --- | --- |
| 注册一个命令 | 第 11 章 |
| 发事件 / 监听 | 第 12 章 |
| 多窗口 | 第 14、36 章 |
| 全局快捷键 | 第 15 章 |
| 读写文件 | 第 17 章 |
| 调 HTTP | 第 18 章 |
| SQLite | 第 19、29 章 |
| 音频引擎 | 第 26、27 章 |
| 扫描音乐库 | 第 28 章 |
| 搜索 | 第 33 章 |
| 自定义协议 | 第 32 章 |
| 媒体键 | 第 37 章 |
| 自动更新 | 第 43 章 |
| CI/CD | 第 46 章 |
| 发布 | 第 47 章 |

## 完结

本书到此结束。感谢一路同行。你现在手里有：

- 一本完整的 Tauri 2.x + 现代前端 + Rust 生产工程指南。
- 一个可日常使用的桌面音乐播放器 CloudTone。
- 面试 Tauri / 桌面应用高级岗所需的叙事和深度。

祝你快速拿到心仪 offer，或者把 CloudTone 做成下一个现象级开源项目。
