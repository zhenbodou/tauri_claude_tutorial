# 第 25 章 状态管理：Zustand + TanStack Query

## 本章目标

- 明确 Zustand 管"客户端状态"、TanStack Query 管"服务端状态"的分工。
- 建立 playerStore、libraryStore、uiStore 的骨架。
- 封装统一的 invoke 调用习惯。

## 一、两分法

| 状态种类 | 例子 | 工具 |
|---------|------|------|
| 客户端状态 | 当前主题、侧栏折叠、modal 开关、播放器状态 | **Zustand** |
| 服务端状态 | 歌曲列表、歌单数据、搜索结果 | **TanStack Query** |

Zustand 负责保存 + 订阅；Query 负责"从 Rust 拉数据 + 缓存 + 失效"。

## 二、PlayerStore（核心）

```ts
// src/features/player/playerStore.ts
import { create } from "zustand";
import { commands } from "@/lib/ipc";
import type { Song } from "@/types/song";

type PlayMode = "sequence" | "list-loop" | "single-loop" | "shuffle";

interface PlayerState {
  current?: Song;
  queue: Song[];
  index: number;
  playing: boolean;
  position: number; // seconds
  duration: number;
  volume: number;
  mode: PlayMode;

  playSong: (song: Song, queue?: Song[]) => Promise<void>;
  toggle: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (pos: number) => Promise<void>;
  setVolume: (v: number) => Promise<void>;
  setMode: (m: PlayMode) => void;

  _onProgress: (p: number, d: number) => void;
  _onStateChange: (playing: boolean) => void;
}

export const usePlayer = create<PlayerState>((set, get) => ({
  queue: [], index: -1, playing: false, position: 0, duration: 0, volume: 1,
  mode: "sequence",

  async playSong(song, queue) {
    const q = queue ?? [song];
    const idx = q.findIndex(s => s.id === song.id);
    set({ current: song, queue: q, index: idx });
    await commands.playerPlay(song.id);
  },

  async toggle() {
    if (get().playing) await commands.playerPause();
    else await commands.playerResume();
  },

  async next() {
    const { queue, index, mode } = get();
    if (queue.length === 0) return;
    let nextIdx = index + 1;
    if (mode === "shuffle") nextIdx = Math.floor(Math.random() * queue.length);
    if (nextIdx >= queue.length) nextIdx = mode === "list-loop" ? 0 : queue.length - 1;
    await get().playSong(queue[nextIdx], queue);
  },

  async prev() {
    const { queue, index } = get();
    const prevIdx = index <= 0 ? queue.length - 1 : index - 1;
    if (queue[prevIdx]) await get().playSong(queue[prevIdx], queue);
  },

  async seek(pos) {
    set({ position: pos });
    await commands.playerSeek(pos);
  },

  async setVolume(v) {
    set({ volume: v });
    await commands.playerSetVolume(v);
  },

  setMode(m) { set({ mode: m }); },

  _onProgress(p, d) { set({ position: p, duration: d }); },
  _onStateChange(playing) { set({ playing }); },
}));
```

## 三、连接后端事件

```tsx
// src/features/player/usePlayerSync.ts
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { usePlayer } from "./playerStore";

export function usePlayerSync() {
  useEffect(() => {
    const un1 = listen<{ position: number; duration: number }>("player:progress", e => {
      usePlayer.getState()._onProgress(e.payload.position, e.payload.duration);
    });
    const un2 = listen<{ playing: boolean }>("player:state", e => {
      usePlayer.getState()._onStateChange(e.payload.playing);
    });
    const un3 = listen<number>("player:ended", () => { usePlayer.getState().next(); });
    return () => { un1.then(f => f()); un2.then(f => f()); un3.then(f => f()); };
  }, []);
}
```

在 `AppShell` 里调用 `usePlayerSync()`。

## 四、Query：列歌曲

```ts
// src/features/library/useSongs.ts
import { useQuery } from "@tanstack/react-query";
import { commands } from "@/lib/ipc";

export function useSongs(args: { q?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["songs", args],
    queryFn: () => commands.librarySearch(args.q ?? "", args.limit ?? 200, args.offset ?? 0),
    staleTime: 10 * 1000,
  });
}
```

配合列表页：

```tsx
export default function LibraryPage() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useSongs({ q });
  return (
    <div className="p-6">
      <input value={q} onChange={e => setQ(e.target.value)} />
      {isLoading ? <div>加载中</div> : <SongList songs={data ?? []} />}
    </div>
  );
}
```

## 五、UI Store

```ts
export const useUI = create<{
  sidebarCollapsed: boolean;
  nowPlayingOpen: boolean;
  toggleSidebar: () => void;
  toggleNowPlaying: () => void;
}>((set) => ({
  sidebarCollapsed: false,
  nowPlayingOpen: true,
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleNowPlaying: () => set(s => ({ nowPlayingOpen: !s.nowPlayingOpen })),
}));
```

## 六、失效缓存

写操作后使相关 Query 失效：

```ts
const qc = useQueryClient();
await commands.playlistCreate(name);
qc.invalidateQueries({ queryKey: ["playlists"] });
```

## 本章小结

- Zustand 轻量，适合客户端 UI 状态。
- Query 做远端缓存，减少重复 invoke。
- 把副作用放到 Rust，前端只显示。

## 动手时刻

- [ ] 把 `usePlayer` 接入 `PlayerBar` 组件，按钮真能 toggle。
- [ ] 列表页用 useQuery 拉 songs。

下一章：Audio Engine 第一弹。
