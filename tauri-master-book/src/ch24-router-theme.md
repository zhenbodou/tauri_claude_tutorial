# 第 24 章 路由、主题、暗色模式

## 本章目标

- 补齐 CloudTone 全部页面的路由映射。
- 实现主题切换（light / dark / system），持久化到本地。
- 做出平滑的页面过渡动画（可选）。

## 一、路由表

```tsx
// src/router.tsx
import { createBrowserRouter } from "react-router-dom";
import AppShell from "@/app/AppShell";
import HomePage from "@/app/home/HomePage";
import LibraryPage from "@/app/library/LibraryPage";
import RecommendPage from "@/app/recommend/RecommendPage";
import PlaylistsPage from "@/app/playlists/PlaylistsPage";
import PlaylistDetail from "@/app/playlists/PlaylistDetail";
import FavoritesPage from "@/app/favorites/FavoritesPage";
import RecentPage from "@/app/recent/RecentPage";
import SearchPage from "@/app/search/SearchPage";
import ArtistPage from "@/app/artist/ArtistPage";
import AlbumPage from "@/app/album/AlbumPage";
import SettingsPage from "@/app/settings/SettingsPage";

export const router = createBrowserRouter([
  {
    path: "/", element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "recommend", element: <RecommendPage /> },
      { path: "library", element: <LibraryPage /> },
      { path: "playlists", element: <PlaylistsPage /> },
      { path: "playlists/:id", element: <PlaylistDetail /> },
      { path: "favorites", element: <FavoritesPage /> },
      { path: "recent", element: <RecentPage /> },
      { path: "search", element: <SearchPage /> },
      { path: "artists/:id", element: <ArtistPage /> },
      { path: "albums/:id", element: <AlbumPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
```

每个页面组件先占位（一个 `<div>页面名</div>`），后面章节填内容。

## 二、主题切换

`src/features/ui/themeStore.ts`：

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

interface ThemeStore {
  theme: Theme;
  effective: "light" | "dark";
  setTheme: (t: Theme) => void;
  _syncSystem: () => void;
}

const media = matchMedia("(prefers-color-scheme: dark)");

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "dark",
      effective: "dark",
      setTheme: t => {
        set({ theme: t });
        get()._syncSystem();
      },
      _syncSystem: () => {
        const t = get().theme;
        const effective = t === "system" ? (media.matches ? "dark" : "light") : t;
        document.documentElement.classList.toggle("dark", effective === "dark");
        document.documentElement.classList.toggle("light", effective === "light");
        set({ effective });
      },
    }),
    { name: "cloudtone.theme", onRehydrateStorage: () => (s) => s?._syncSystem() },
  ),
);

media.addEventListener("change", () => useThemeStore.getState()._syncSystem());
```

在 `main.tsx` 初始化：

```tsx
import { useThemeStore } from "@/features/ui/themeStore";
useThemeStore.getState()._syncSystem();
```

## 三、设置页切换主题

```tsx
// src/app/settings/SettingsPage.tsx
import { useThemeStore } from "@/features/ui/themeStore";

export default function SettingsPage() {
  const { theme, setTheme } = useThemeStore();
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">设置</h1>
      <section>
        <h2 className="text-sm text-text-secondary mb-2">外观</h2>
        <div className="flex gap-2">
          {(["light","dark","system"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`px-4 py-2 rounded border ${theme === t ? "bg-brand-500 border-brand-500" : "border-surface-border hover:bg-surface-hover"}`}
            >{t === "light" ? "浅色" : t === "dark" ? "深色" : "跟随系统"}</button>
          ))}
        </div>
      </section>
    </div>
  );
}
```

## 四、浅色主题

Tailwind 默认 `dark:` 前缀切换。写组件时，默认样式为浅色，`dark:` 覆盖为深色：

```tsx
<div className="bg-white text-black dark:bg-surface-bg dark:text-text-primary">
```

CloudTone 主题以深色为主，浅色作为次要，细节要重新设计（色差、阴影、边框），第 32 章整理主题系统。

## 五、页面过渡

轻量实现：用 React Router 的 `useLocation` + Tailwind transition：

```tsx
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

function FadeRoute({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const [show, setShow] = useState(true);
  useEffect(() => {
    setShow(false);
    const t = setTimeout(() => setShow(true), 80);
    return () => clearTimeout(t);
  }, [loc.pathname]);
  return <div className={`transition-opacity duration-150 ${show ? "opacity-100" : "opacity-0"}`}>{children}</div>;
}
```

在 `AppShell` 的 `<Outlet>` 外包一层。生产环境追求高级可以用 framer-motion。

## 本章小结

路由和主题搭好。CloudTone 现在已经是一个可以「假装」可用的 app 框架。

## 动手时刻

- [ ] 切换主题并刷新，验证持久化。
- [ ] 每个路由都加一个占位组件。
- [ ] 在 Sidebar 显示当前活动路由的高亮。

下一章：状态管理全貌。
