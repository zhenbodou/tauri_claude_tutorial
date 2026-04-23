# 第 23 章 设计系统与布局：仿网易云的三栏结构

## 本章目标

- 搭好 CloudTone 三栏主界面：侧栏 / 主区 / 歌词面板。
- 建立色板、字号、间距、圆角、阴影令牌，写成 Tailwind 主题扩展。
- 做出原生感的无边框窗口 + 自定义窗口控制按钮。

## 一、设计令牌 (Design Tokens)

设计令牌是一套"抽象变量"：你命名 `bg-surface-card` 而不是 `#17171a`。视觉统一，主题切换容易。

追加到 `tailwind.config.js`：

```js
theme: {
  extend: {
    colors: {
      brand: { 50: "#fff1f2", 500: "#ec4899", 600: "#db2777", 700: "#be185d" },
      surface: {
        bg: "#0f0f10",
        sidebar: "#0a0a0b",
        card: "#17171a",
        elevated: "#202024",
        hover: "rgba(255,255,255,0.05)",
        border: "rgba(255,255,255,0.06)",
      },
      text: {
        primary: "#e5e7eb",
        secondary: "#9ca3af",
        tertiary: "#6b7280",
      },
    },
    fontSize: {
      xxs: ["11px","14px"],
    },
    borderRadius: {
      xl: "14px",
    },
    boxShadow: {
      card: "0 4px 10px rgba(0,0,0,0.25)",
      pop: "0 10px 40px rgba(0,0,0,0.45)",
    },
  },
}
```

## 二、三栏 Shell

```
┌──────────────────────────────────────────────────────────────┐
│ TitleBar (h-10)                                              │
├─────────────┬────────────────────────────┬───────────────────┤
│  Sidebar    │   Main content (Outlet)    │   NowPlaying      │
│  w-60       │   flex-1                   │   w-80            │
│             │                            │   (可隐藏)         │
├─────────────┴────────────────────────────┴───────────────────┤
│ PlayerBar (h-20)                                             │
└──────────────────────────────────────────────────────────────┘
```

`src/app/AppShell.tsx`：

```tsx
import { Outlet } from "react-router-dom";
import { TitleBar } from "@/components/shell/TitleBar";
import { Sidebar } from "@/components/shell/Sidebar";
import { NowPlayingPanel } from "@/components/shell/NowPlayingPanel";
import { PlayerBar } from "@/components/player/PlayerBar";

export default function AppShell() {
  return (
    <div className="h-screen flex flex-col bg-surface-bg text-text-primary overflow-hidden">
      <TitleBar />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto scrollbar-thin">
          <Outlet />
        </main>
        <NowPlayingPanel />
      </div>
      <PlayerBar />
    </div>
  );
}
```

## 三、TitleBar：自定义窗口控制

```tsx
// src/components/shell/TitleBar.tsx
import { Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

function WinButton({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`h-10 w-10 inline-flex items-center justify-center hover:bg-white/5 ${danger ? "hover:bg-red-500/80" : ""}`}
    >{children}</button>
  );
}

export function TitleBar() {
  const win = getCurrentWindow();
  return (
    <div data-tauri-drag-region className="h-10 flex items-center select-none border-b border-surface-border bg-surface-bg">
      <div data-tauri-drag-region className="pl-4 text-sm font-medium">CloudTone</div>
      <div data-tauri-drag-region className="flex-1" />
      <WinButton onClick={() => win.minimize()}><Minus className="w-4 h-4" /></WinButton>
      <WinButton onClick={() => win.toggleMaximize()}><Square className="w-3.5 h-3.5" /></WinButton>
      <WinButton onClick={() => win.hide()} danger><X className="w-4 h-4" /></WinButton>
    </div>
  );
}
```

## 四、Sidebar

```tsx
// src/components/shell/Sidebar.tsx
import { NavLink } from "react-router-dom";
import { Home, Music, ListMusic, Heart, Clock, Settings } from "lucide-react";
import { cn } from "@/lib/cn";

const sections = [
  { title: "推荐", items: [
    { to: "/", label: "发现", icon: Home },
    { to: "/recommend", label: "每日推荐", icon: Music },
  ]},
  { title: "我的", items: [
    { to: "/library", label: "本地音乐", icon: Music },
    { to: "/playlists", label: "歌单", icon: ListMusic },
    { to: "/favorites", label: "收藏", icon: Heart },
    { to: "/recent", label: "最近播放", icon: Clock },
  ]},
  { title: "其他", items: [
    { to: "/settings", label: "设置", icon: Settings },
  ]},
];

export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 bg-surface-sidebar border-r border-surface-border py-3 overflow-y-auto scrollbar-thin">
      {sections.map(sec => (
        <div key={sec.title} className="mb-4">
          <div className="px-4 py-2 text-xxs uppercase tracking-wide text-text-tertiary">{sec.title}</div>
          <ul className="space-y-0.5 px-2">
            {sec.items.map(it => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  end={it.to === "/"}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-2 rounded text-sm",
                    "hover:bg-surface-hover",
                    isActive && "bg-white/10 text-white font-medium",
                  )}
                >
                  <it.icon className="w-4 h-4" />
                  {it.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}
```

## 五、NowPlayingPanel（骨架）

```tsx
// src/components/shell/NowPlayingPanel.tsx
export function NowPlayingPanel() {
  return (
    <aside className="w-80 shrink-0 border-l border-surface-border p-5 bg-surface-bg overflow-y-auto scrollbar-thin">
      <div className="aspect-square rounded-lg bg-surface-card" />
      <h2 className="mt-4 text-lg font-semibold">（未播放）</h2>
      <p className="text-sm text-text-secondary">选一首歌开始</p>
      <div className="mt-6 text-sm text-text-secondary leading-7">
        歌词区（下一章接入）
      </div>
    </aside>
  );
}
```

## 六、PlayerBar（占位）

```tsx
// src/components/player/PlayerBar.tsx
import { Play, SkipForward, SkipBack, Volume2 } from "lucide-react";

export function PlayerBar() {
  return (
    <div className="h-20 border-t border-surface-border bg-surface-bg flex items-center px-4 gap-4">
      <div className="flex items-center gap-3 w-72">
        <div className="w-12 h-12 bg-surface-card rounded" />
        <div className="min-w-0">
          <div className="text-sm truncate">（未播放）</div>
          <div className="text-xs text-text-secondary truncate">—</div>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center gap-2">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-surface-hover rounded"><SkipBack className="w-4 h-4" /></button>
          <button className="p-3 bg-white text-black rounded-full"><Play className="w-5 h-5" /></button>
          <button className="p-2 hover:bg-surface-hover rounded"><SkipForward className="w-4 h-4" /></button>
        </div>
        <div className="w-full max-w-2xl flex items-center gap-2">
          <span className="text-xs text-text-secondary">00:00</span>
          <div className="flex-1 h-1 bg-white/10 rounded">
            <div className="h-1 bg-brand-500 rounded" style={{ width: "0%" }} />
          </div>
          <span className="text-xs text-text-secondary">00:00</span>
        </div>
      </div>
      <div className="w-72 flex justify-end items-center gap-3">
        <Volume2 className="w-4 h-4 text-text-secondary" />
        <div className="w-24 h-1 bg-white/10 rounded"><div className="h-1 bg-white/40 rounded w-1/2" /></div>
      </div>
    </div>
  );
}
```

## 七、窗口无边框 + 圆角

macOS 无装饰窗可以自然圆角。Windows 11 系统自带圆角（需启用）。Linux 需要自己加 `border-radius` 到 `body`。我们在 `index.css` 里加：

```css
body {
  border-radius: 12px;
  overflow: hidden;
}
```

## 八、首页内容（占位）

```tsx
// src/app/home/HomePage.tsx
export default function HomePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">发现</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square bg-surface-card rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

## 本章小结

三栏布局、标题栏、侧栏、播放条、右侧面板已经搭好。本章的 UI 还没有逻辑，但骨架稳了。

## 动手时刻

- [ ] 让侧栏点击能切换路由（先添加空白 `LibraryPage` 等）。
- [ ] 窗口 hide/close 后如何呼出？试着用第 14 章的托盘。
- [ ] 放一张你喜欢的封面到 `public/cover.jpg`，在 NowPlayingPanel 显示它。

下一章：路由、主题、暗色模式。
