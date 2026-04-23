# 第 6 章 Tailwind CSS 工程化用法（从零到精通）

## 本章目标

学完这一章，你应该能够：

- 说清 Tailwind 的设计哲学、与 BEM / CSS Modules / CSS-in-JS 的差别，以及它在什么项目里会拖后腿。
- 掌握 Tailwind 工具类的**完整分类**（而不是背 50 个类），遇到新需求能直接查官方 ref 写出来。
- 配置并定制 `tailwind.config.ts`：设计 token（颜色/字号/间距/圆角/字体）、暗色模式、扩展 theme、写自定义 plugin。
- 熟练使用断点、伪类、`group` / `peer`、data-* 变体、`@container`、arbitrary values / arbitrary variants。
- 组织 `@layer` / `@apply`，知道什么时候写 utility、什么时候抽 component class。
- 配合 `clsx` + `tailwind-merge` 写条件样式，和 class-variance-authority (cva) 写多变体组件。
- 和 shadcn/ui、lucide-react、Radix UI 的集成方式。
- 理解 Tailwind v3 与 v4（Oxide 引擎 + CSS-first 配置）的核心差异，能从 v3 平滑过渡到 v4。
- 避开动态类名、`min-w-0`、`dark:` 对比度、`content` 路径等高发陷阱。

这一章的篇幅远不止「50 个常用类」。它是让你从「会用 Tailwind 糊页面」升级到「能主导团队 Tailwind 规范」的那一跃。

---

## 一、Tailwind 到底是什么：三句话讲清楚

第一句：**Tailwind 是一组预生成的 CSS utility class**。它把 `padding: 8px` 做成 `.p-2`，把 `display: flex` 做成 `.flex`。每个类只做一件事，叫 **atomic / utility class**。

第二句：**Tailwind 的核心价值不是这些类，而是它的设计系统**。它把常用 CSS 值离散化成有限的 scale：间距用 4px 步进（`p-1 = 4px`、`p-2 = 8px`、`p-4 = 16px`），颜色按 50/100/200/.../950 分成 11 级，字号有 12 档（`text-xs`...`text-9xl`）。这套 scale 让你在不思考的情况下做出「看起来不会丑」的页面。

第三句：**Tailwind 通过扫描源码的 JIT 编译器，只打包你用到的类**。所以你写了 `text-red-500`，这个类才会出现在最终 CSS 里；你没写 `text-red-600`，它就不存在。最终 CSS 常常只有 10–20 KB（gzip 后 4–8 KB）。

### 1.1 与其他 CSS 方案对比

```
传统写法（BEM）：
  .song-card { ... }
  .song-card__title { ... }
  .song-card--active { ... }

  ✅ 语义清晰
  ❌ 起名累死
  ❌ 样式散落在 .css 文件里，看组件要两个文件来回跳
  ❌ 删除组件时 CSS 常常忘删

CSS Modules：
  import s from "./SongCard.module.css";
  <div className={s.card}>

  ✅ 自动 scope，不污染
  ❌ 还是要起名
  ❌ 样式与结构在不同文件

CSS-in-JS（styled-components / emotion）：
  const Card = styled.div`padding: 16px; ...`

  ✅ 动态样式天然支持
  ❌ 运行时开销（emotion v10 以后好一些）
  ❌ SSR / 流式渲染复杂
  ❌ 现在明显退潮

Tailwind：
  <div className="p-4 rounded-lg bg-zinc-900">

  ✅ 不用起名
  ✅ 样式与结构在同一行
  ✅ JIT 之后 CSS 体积极小
  ✅ 设计 token 统一
  ❌ className 字符串长
  ❌ 初学者要背映射表
  ❌ 动态值不能用字符串拼接（见陷阱）
```

CloudTone 体量（中等前端 + Electron 式桌面应用），Tailwind 的 ROI 极高；它也是 Tauri / shadcn / Next.js 生态的事实标准。

### 1.2 什么时候 Tailwind 不合适

- **原型极重的图形设计**（比如 Figma 导出的像素级 landing page）：任意 px / 不规则布局很多时，你会写一堆 `[15px]`、`[357px]`，体验不如直接写 CSS。
- **SSR 流式渲染 + 极端 TTI 需求**：Tailwind 本身很轻，但 atomic class 会让 HTML 变大（`<div class="flex items-center gap-3 ...">`），Gzip 后差别通常可忽略，但极限场景要测。
- **长期维护的大型设计系统**：Tailwind 可以做，但你最后会抽出一层「Box / Stack / Text」语义组件，这时和用 token + styled-system 差别不大。

CloudTone 不在上述范围内，我们直接用 Tailwind。

---

## 二、工具类按「CSS 属性分类」全景记忆法

背 50 个类迟早会忘。正确的做法是按 **CSS 属性分类** 记住 Tailwind 的命名规则，然后遇到需求直接查。以下是 CloudTone 前 3000 行代码涉及到的完整分类。

### 2.1 Layout

| 类别 | 类 | 作用 |
| --- | --- | --- |
| display | `block` `inline` `inline-block` `flex` `inline-flex` `grid` `inline-grid` `hidden` `contents` | `display: ...` |
| position | `static` `relative` `absolute` `fixed` `sticky` | `position: ...` |
| inset | `inset-0` `inset-x-0` `top-0` `left-4` `-top-2` `top-[12px]` | 定位偏移 |
| z-index | `z-0` `z-10` `z-20` `z-30` `z-40` `z-50` `z-[100]` | 层级 |
| float | `float-left` `float-right` `float-none` | 极少用 |
| overflow | `overflow-auto` `overflow-hidden` `overflow-scroll` `overflow-x-auto` `overflow-y-hidden` | 溢出 |
| overscroll | `overscroll-contain` `overscroll-none` | 阻止边缘联动滚动 |
| object-fit | `object-contain` `object-cover` `object-fill` `object-none` | `<img>` 填充方式 |
| isolation | `isolate` | 创建独立 stacking context |
| aspect-ratio | `aspect-square` `aspect-video` `aspect-[16/9]` | 固定宽高比 |
| columns | `columns-2` `columns-3` | 多列布局，少用 |

### 2.2 Flexbox

```
容器：
  flex-row / flex-row-reverse / flex-col / flex-col-reverse
  flex-wrap / flex-nowrap / flex-wrap-reverse
  items-start / items-center / items-end / items-baseline / items-stretch
  justify-start / justify-center / justify-end / justify-between / justify-around / justify-evenly
  content-start / content-center / ...              （多行 align-content）
  gap-0 / gap-1 / gap-2 / gap-4 / gap-6 / gap-x-2 / gap-y-4

子项：
  flex-1 / flex-auto / flex-initial / flex-none
  grow / grow-0 / shrink / shrink-0
  basis-0 / basis-1/2 / basis-full / basis-[200px]
  order-1 / order-2 / order-first / order-last
  self-start / self-center / self-end / self-stretch
```

### 2.3 Grid

```
容器：
  grid-cols-1 / grid-cols-2 / ... / grid-cols-12
  grid-cols-[200px_1fr] / grid-cols-[repeat(auto-fill,minmax(180px,1fr))]
  grid-rows-3 / grid-rows-[auto_1fr_auto]
  grid-flow-row / grid-flow-col / grid-flow-dense

子项：
  col-span-2 / col-span-full / col-start-2 / col-end-4
  row-span-2 / row-start-1

其他：
  grid-cols-subgrid（Tailwind v3.4+）
```

### 2.4 Spacing（padding / margin / space / gap）

```
padding: p-0 p-px p-0.5 p-1 p-2 p-3 p-4 p-6 p-8 p-10 p-12 p-16 ...
         px-4 py-2 pt-2 pr-4 pb-2 pl-4 ps-4 pe-4 （ps/pe 是 RTL-aware 逻辑属性）

margin: m-auto mx-auto my-4 -mx-2（负值）mt-[3px]（任意值）

space:  space-x-2 space-y-4  → 给子元素之间加间距，等价于 sibling margin
         .parent > * + * { margin-left: 0.5rem }

gap:    gap-2 gap-x-2 gap-y-4  → flex/grid 专用
```

经验：flex/grid 容器用 `gap-*`；不是 flex/grid 的父容器用 `space-*`。

### 2.5 Sizing

```
width:   w-0 w-px w-1 w-2 w-full w-screen w-fit w-min w-max w-1/2 w-1/3 w-1/4 w-[240px]
height:  h-full h-screen h-dvh h-svh h-lvh h-fit h-[calc(100vh-56px)]
min-w:   min-w-0 min-w-full min-w-max
max-w:   max-w-xs max-w-sm max-w-md max-w-lg max-w-xl max-w-2xl ... max-w-7xl max-w-screen-lg max-w-prose
min-h / max-h: 类似
size:    size-8  （= w-8 h-8，Tailwind v3.4+）
```

`dvh / svh / lvh` 是 CSS 新单位，用于移动端适配地址栏动态伸缩。

### 2.6 Typography

```
font-size:        text-xs text-sm text-base text-lg text-xl text-2xl text-3xl text-4xl text-5xl text-6xl text-7xl text-8xl text-9xl text-[15px]
font-weight:      font-thin font-light font-normal font-medium font-semibold font-bold font-extrabold font-black
font-family:      font-sans font-serif font-mono font-[Inter]
letter-spacing:   tracking-tighter tracking-tight tracking-normal tracking-wide tracking-wider
line-height:      leading-none leading-tight leading-snug leading-normal leading-relaxed leading-loose leading-[1.8]
color:            text-white text-black text-transparent text-zinc-500 text-pink-500/80
alignment:        text-left text-center text-right text-justify text-start text-end
decoration:       underline line-through no-underline decoration-2 decoration-pink-500 underline-offset-2
text-transform:   uppercase lowercase capitalize normal-case
text-overflow:    truncate text-ellipsis text-clip
line-clamp:       line-clamp-1 line-clamp-2 line-clamp-3 line-clamp-none   （多行省略）
white-space:      whitespace-nowrap whitespace-pre whitespace-pre-wrap
word-break:       break-normal break-words break-all
text-wrap:        text-wrap text-nowrap text-balance text-pretty   （CSS 新属性）
font-variant-numeric: tabular-nums proportional-nums   （数字等宽）
```

### 2.7 Backgrounds

```
color:           bg-zinc-900 bg-white/10 bg-transparent bg-current bg-inherit
gradient:        bg-gradient-to-r bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500
                 from-[10%] via-[40%] to-[90%]
image:           bg-[url('/cover.jpg')]
repeat/size/pos: bg-no-repeat bg-cover bg-contain bg-center bg-fixed bg-top
blend-mode:      bg-blend-multiply bg-blend-overlay
```

### 2.8 Borders / Radius / Outline / Ring

```
border-width:   border border-2 border-4 border-t border-x border-b-0 border-y-2
border-style:   border-solid border-dashed border-dotted border-none
border-color:   border-zinc-700 border-pink-500/50
divide:         divide-x divide-y divide-zinc-700   （给多个子元素加分隔线）

border-radius:  rounded-none rounded-sm rounded rounded-md rounded-lg rounded-xl rounded-2xl rounded-full
                rounded-t-lg rounded-tl-lg rounded-[20px]

outline:        outline-none outline-1 outline-pink-500 outline-offset-2
ring:           ring ring-2 ring-pink-500/50 ring-offset-2 ring-offset-black   （focus 常用）
```

`ring-*` 是 Tailwind 独有的抽象，它基于 `box-shadow` 实现，不占据布局空间、能叠加。`:focus-visible:ring-2` 是 accessibility 首选写法。

### 2.9 Effects / Filters

```
opacity:         opacity-0 opacity-50 opacity-100 opacity-[0.35]
shadow:          shadow shadow-sm shadow-md shadow-lg shadow-xl shadow-2xl shadow-inner shadow-pink-500/30
mix-blend-mode:  mix-blend-multiply mix-blend-screen mix-blend-overlay

filter:          blur-sm blur blur-md blur-lg  brightness-50 brightness-110 contrast-125 grayscale invert sepia saturate-150 hue-rotate-15
backdrop:        backdrop-blur backdrop-blur-md backdrop-brightness-75 backdrop-saturate-150
```

`backdrop-blur-*` 是做毛玻璃效果（macOS / Apple Music 风格）的关键。CloudTone 的侧边栏和 mini-player 大量使用。

### 2.10 Transforms / Transitions / Animations

```
transform:    (v3 里不需要加 transform，直接写下面这些就够)
translate:    translate-x-1 translate-y-1 -translate-x-1/2 translate-x-[200px]
rotate:       rotate-45 -rotate-12 rotate-[17deg]
scale:        scale-75 scale-95 scale-100 scale-110 hover:scale-105
skew:         skew-x-3
origin:       origin-center origin-top-left origin-[0_0]

transition:   transition transition-all transition-colors transition-opacity transition-transform
duration:     duration-75 duration-150 duration-200 duration-300 duration-500 duration-700 duration-1000
timing:       ease-linear ease-in ease-out ease-in-out
delay:        delay-100 delay-500

animation:    animate-none animate-spin animate-ping animate-pulse animate-bounce
              animate-[pulse_2s_ease-in-out_infinite]
```

### 2.11 Interactivity

```
cursor:        cursor-pointer cursor-not-allowed cursor-grab cursor-wait cursor-text
user-select:   select-none select-text select-all
pointer-events: pointer-events-none pointer-events-auto
resize:        resize resize-y resize-none
touch-action:  touch-none touch-pan-y   （拖拽时关键）
accent-color:  accent-pink-500          （form 控件着色）
caret-color:   caret-pink-500
scroll:        scroll-smooth scroll-auto snap-x snap-mandatory snap-center
```

### 2.12 Forms

Tailwind 默认对表单只做轻量样式。`@tailwindcss/forms` plugin 把 `<input>` 等重置成合理默认样式后再用工具类覆盖。

### 2.13 SVG / 可访问性

```
fill / stroke:  fill-current fill-pink-500 stroke-white stroke-2
sr-only / not-sr-only:    视觉隐藏但屏幕阅读器可读
appearance-none:          去掉原生 UI 外观
```

### 2.14 查询类别的心理映射

遇到新需求时，我的脑内检索顺序大致是：

1. 「这是什么 CSS 属性？」
2. 「Tailwind 叫什么前缀？」（通常属性名省略元音或缩写：padding → p-、margin → m-、background → bg-、border → border-、text color → text-、overflow → overflow-）
3. 「scale 上的哪个级别？」

查 [tailwindcss.com/docs](https://tailwindcss.com/docs) 永远比背表快。VS Code 的 Tailwind IntelliSense 插件会在你打字时补全。

---

## 三、状态变体（variants）与响应式

### 3.1 伪类变体

```
hover:           hover:bg-white/10
focus:           focus:outline-none focus-visible:ring-2
active:          active:scale-95
disabled:        disabled:opacity-50
visited:         visited:text-purple-500
focus-within:    focus-within:bg-white/5     （任意子元素获得焦点时）
first / last:    first:pt-0 last:border-b-0
odd / even:      odd:bg-white/5 even:bg-white/10
empty:           empty:hidden
placeholder:     placeholder:text-zinc-400
read-only:       read-only:bg-zinc-800
```

### 3.2 结构变体：group / peer

**group** 让父元素状态影响子元素：

```tsx
<div className="group">
  <img src={cover} />
  <button className="opacity-0 group-hover:opacity-100 transition-opacity">
    播放
  </button>
</div>
```

多个 group 嵌套用「命名 group」：

```tsx
<div className="group/card">
  <div className="group/title">
    <span className="group-hover/card:text-pink-500 group-hover/title:underline">
      ...
    </span>
  </div>
</div>
```

**peer** 是「兄弟状态」：

```tsx
<input className="peer" />
<label className="peer-focus:text-pink-500 peer-invalid:text-red-500">
  用户名
</label>
```

CloudTone 的歌曲卡片、表单错误提示大量使用 group / peer。

### 3.3 data-* 变体（Tailwind v3.2+）

```tsx
<div
  data-state="open"
  className="data-[state=open]:bg-white/10 data-[state=closed]:opacity-0"
/>
```

这是 Radix UI / shadcn/ui 接入 Tailwind 的关键机制——Radix 把组件状态写成 `data-state="open"`，我们直接用变体响应。

### 3.4 aria-* 变体

```tsx
<button
  aria-busy="true"
  className="aria-busy:opacity-50 aria-disabled:cursor-not-allowed"
/>
```

### 3.5 响应式断点

默认断点（mobile-first）：

```
sm:  ≥ 640px
md:  ≥ 768px
lg:  ≥ 1024px
xl:  ≥ 1280px
2xl: ≥ 1536px
```

**Tailwind 的响应式是 min-width**，所以基础样式写移动端，`md:`、`lg:` 逐级覆盖：

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
```

断点也可以写成 `max-*`（Tailwind v3.2+ 的 max-width variant）或任意值：

```tsx
<div className="text-base md:text-lg max-md:text-sm min-[900px]:text-xl" />
```

CloudTone 是桌面应用，窗口可以任意改变大小，所以还是要用响应式，且配合 `@container` 做组件级响应式。

### 3.6 dark mode

在 `tailwind.config.ts` 里：

```ts
darkMode: "class",   // 或 "media"，或 ["class", ".dark"]
```

- `"media"`：跟随系统 `prefers-color-scheme`，不可切换。
- `"class"`：给根元素加 `.dark` 类才启用 dark。CloudTone 用这个方案。

使用：

```tsx
<div className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100" />
```

切换逻辑：

```ts
document.documentElement.classList.toggle("dark", prefersDark);
```

> CloudTone 实际上是「永远 dark」的音乐播放器，所以我们不用切换逻辑，直接在 `<html>` 上加 `class="dark"`，但样式仍然写 `dark:` 前缀，方便将来加「浅色主题皮肤」。

### 3.7 自定义变体

`tailwind.config.ts` 里：

```ts
import plugin from "tailwindcss/plugin";

export default {
  // ...
  plugins: [
    plugin(({ addVariant }) => {
      addVariant("hocus", ["&:hover", "&:focus"]);
      addVariant("parent-open", ':merge(.parent)[data-state="open"] &');
    }),
  ],
};
```

`hocus:` 一次覆盖 hover 与 focus。

### 3.8 arbitrary variants（v3.1+）

变体里的选择器也可以任意写：

```tsx
<div className="[&>p]:mt-4 [&:nth-child(3)]:bg-white/5 [@supports(color:oklch(0_0_0))]:bg-[oklch(0.2_0_0)]" />
```

- `[&>p]:mt-4`：所有直接子 `<p>` 加 margin-top。
- `[@media(prefers-reduced-motion)]:animate-none`：媒体查询。
- `[@supports(...)]:...`：feature query。

---

## 四、配置 `tailwind.config.ts`

### 4.1 基础文件

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";
import typography from "@tailwindcss/typography";
import containerQueries from "@tailwindcss/container-queries";
import animate from "tailwindcss-animate";   // shadcn/ui 官方推荐

export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  darkMode: ["class"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      colors: {
        // 语义色（推荐用 CSS 变量 + HSL，见 4.3）
        brand: {
          50: "#fff1f2",
          500: "#ec4899",
          600: "#db2777",
        },
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "PingFang SC",
          "Microsoft YaHei",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"],
      },
      fontSize: {
        // 覆盖默认字号，如果你有自己的 scale
      },
      spacing: {
        // "sidebar": "240px",  // 自定义命名间距
      },
      borderRadius: {
        xl: "var(--radius)",          // 动态圆角
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "spin-slow": "spin 4s linear infinite",
      },
    },
  },
  plugins: [forms, typography, containerQueries, animate],
} satisfies Config;
```

几个要点：

- 用 `satisfies Config` 而不是 `: Config`，保留字面量类型，同时做类型检查。
- `content` 扫描路径错了，就会出现「类存在但不生效」。记住把 `.html` 和所有源码扩展名都写进去。
- `theme.extend` 是增加 token；直接写 `theme.colors = {}` 会覆盖整个调色板，新手常踩。

### 4.2 content 扫描细节

Tailwind 是纯静态扫描：它会用正则从源文件里把可能是 class 的字符串提取出来。这就意味着：

```tsx
// ✅ 能被扫出来
<div className="bg-pink-500" />

// ❌ 扫不到
const color = "pink";
<div className={`bg-${color}-500`} />

// ✅ 扫到 bg-pink-500 和 bg-green-500
const map = { red: "bg-red-500", green: "bg-green-500" };
<div className={map[color]} />

// ✅ 安全的命中列表（safelist）
// tailwind.config.ts:
safelist: ["bg-red-500", "bg-green-500", { pattern: /bg-(red|green)-\d+/ }],
```

### 4.3 设计 token：CSS 变量 + HSL 方案（shadcn/ui 风格）

硬编码颜色值的问题：换主题要改 300 个 `dark:` 前缀。现代做法是：

**`src/styles/index.css`：**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* 浅色：CloudTone 其实没用，只是留口子 */
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --primary: 330 81% 60%;
    --primary-foreground: 0 0% 100%;
    --radius: 0.75rem;
  }
  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --primary: 330 81% 60%;
    --primary-foreground: 0 0% 100%;
  }
}
```

**`tailwind.config.ts` 里**：

```ts
colors: {
  background: "hsl(var(--background) / <alpha-value>)",
  primary: "hsl(var(--primary) / <alpha-value>)",
  // ...
}
```

使用：

```tsx
<div className="bg-background text-foreground" />
<button className="bg-primary text-primary-foreground hover:bg-primary/90" />
```

切换主题时只需要改 `<html>` 上的 `.dark` 类，所有颜色自动变。

> 为什么用 HSL 而不是 `#rrggbb`：因为 Tailwind 的 `<alpha-value>` 只对 `hsl()` / `rgb()` 纯数字形式起作用。v4 支持更现代的 color-mix、oklch。

### 4.4 写自定义 plugin

官方约定：用 `tailwindcss/plugin` 导出函数：

```ts
import plugin from "tailwindcss/plugin";

const scrollbarPlugin = plugin(({ addUtilities, matchUtilities, theme }) => {
  // 1. 静态工具类
  addUtilities({
    ".scrollbar-none": {
      "scrollbar-width": "none",
      "&::-webkit-scrollbar": { display: "none" },
    },
  });

  // 2. 动态工具类
  matchUtilities(
    {
      "scrollbar-color": (value) => ({
        "scrollbar-color": `${value} transparent`,
      }),
    },
    { values: theme("colors") },
  );
});

export default {
  // ...
  plugins: [scrollbarPlugin],
};
```

现在你可以写：

```tsx
<div className="scrollbar-none" />
<div className="scrollbar-color-pink-500" />
```

CloudTone 里我们写过 `scrollbar-slim`、`drag-region`（Tauri 自定义标题栏拖拽区域）、`text-gradient` 等几个专用 plugin。

---

## 五、`@layer` 与 `@apply`：什么时候该、什么时候不该

Tailwind 生成的 CSS 分三层：

```
@tailwind base;       → Preflight（reset）+ @layer base { }
@tailwind components; → @layer components { }  组件类
@tailwind utilities;  → @layer utilities { }   工具类
```

优先级：**utilities > components > base**，这样你写 `className="btn bg-red-500"` 时 `bg-red-500` 一定赢过 `.btn` 里的底色。

### 5.1 `@apply`：把工具类「打包」成一个 class

```css
@layer components {
  .btn {
    @apply inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors;
    @apply bg-primary text-primary-foreground hover:bg-primary/90;
    @apply disabled:opacity-50 disabled:cursor-not-allowed;
  }
}
```

使用：`<button class="btn">`。

**什么时候该用 `@apply`：**

- 需要在 **非 JSX 环境**（纯 HTML、Markdown、第三方组件的插槽 className）里复用。
- 设计系统确定的「原子组件」（Button、Input 等）需要一个名字。
- 和其他 CSS 框架（Radix, tauri-plugin-window-state 的默认皮肤）整合时。

**什么时候不该：**

- 你本来写 React / Vue / Svelte，组件就是 class 复用的单位，`<Button variant="primary" />` 永远比 `.btn` 更好。
- 复杂状态逻辑（active / disabled / loading 变体）写在 CSS 里会炸，不如用 `cva`（见 6.3）。

CloudTone 的经验：**90% 的代码用 utility，10% 的基础组件偶尔用 `@apply`**（比如 `.drag-region`、`.no-drag`、Markdown 正文样式）。

### 5.2 `@layer base` 全局样式

```css
@layer base {
  html {
    font-feature-settings: "cv11", "ss01";   /* Inter 字体的数字形态 */
  }
  html, body, #root {
    height: 100%;
  }
  body {
    @apply bg-background text-foreground font-sans antialiased;
    -webkit-font-smoothing: antialiased;
  }
  ::selection {
    @apply bg-primary/30 text-foreground;
  }
  /* 自定义滚动条 */
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { @apply bg-white/10 rounded; }
  ::-webkit-scrollbar-thumb:hover { @apply bg-white/20; }
}
```

### 5.3 `@layer utilities` 自定义工具类

```css
@layer utilities {
  .text-gradient {
    @apply bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent;
  }
  .drag-region {
    -webkit-app-region: drag;
  }
  .no-drag {
    -webkit-app-region: no-drag;
  }
}
```

`drag-region` 是 Tauri 自定义标题栏的关键：用 `<div class="drag-region h-10 w-full" />` 做可拖拽区域，按钮用 `no-drag` 排除。

---

## 六、条件样式与变体组件

### 6.1 `clsx` + `tailwind-merge`

```ts
// src/lib/cn.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- `clsx` 处理「条件拼接」：`clsx("a", false && "b", ["c", "d"], { e: isOn })`。
- `tailwind-merge` 处理「冲突合并」：`cn("p-2", "p-4") === "p-4"`。

为什么要 `tailwind-merge`：在「基类 + 覆盖」场景里，单纯 clsx 会留下两个互相冲突的 class，浏览器按书写顺序取后者；但如果覆盖类是 `@apply` 生成或顺序先于基类，会翻车。`tailwind-merge` 认识 Tailwind 语义，自动去掉前者。

### 6.2 一个典型的 Button 组件（无变体）

```tsx
import { cn } from "@/lib/cn";
import { forwardRef, ButtonHTMLAttributes } from "react";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
      "bg-primary text-primary-foreground hover:bg-primary/90",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      "transition-colors",
      className,   // ← 让调用者可覆盖
    )}
    {...props}
  />
));
Button.displayName = "Button";
```

### 6.3 class-variance-authority (cva)：多变体

真实项目的 Button 有 `variant` (primary/ghost/outline/destructive)、`size` (sm/md/lg/icon)、`fullWidth` 等维度。手写 if/else 快速失控。用 `cva`：

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  // 基础
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        ghost:   "hover:bg-white/5",
        outline: "border border-white/10 bg-transparent hover:bg-white/5",
        destructive: "bg-red-500 text-white hover:bg-red-600",
      },
      size: {
        sm:  "h-8 px-3 text-xs",
        md:  "h-9 px-4 text-sm",
        lg:  "h-11 px-8 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
```

使用：

```tsx
<Button>播放全部</Button>
<Button variant="ghost" size="icon"><Play /></Button>
<Button variant="destructive">删除歌单</Button>
```

`cva` 是 shadcn/ui 每个组件的骨架。CloudTone 的全部可复用 UI 都这么写。

---

## 七、Container Queries：组件级响应式

断点响应的是**视口**；但 CloudTone 的歌曲卡片在 sidebar 内 220px 宽，在主列表区 900px 宽，同样的组件要根据「自身容器」变样子。这就是 Container Query。

安装 plugin：`pnpm add -D @tailwindcss/container-queries`

```tsx
<section className="@container">
  <div className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-4 gap-4">
    ...
  </div>
</section>
```

`@md` 表示「当这个 container 宽度 ≥ 28rem」。不需要知道视口尺寸。

命名 container（多层嵌套）：

```tsx
<div className="@container/list">
  <div className="@container/card">
    <div className="@lg/list:grid-cols-3 @sm/card:flex-col">
```

CloudTone 的 SongList 在桌面布局是 4 列网格，在窄 sidebar 里是 1 列堆叠，完全靠 container query。

---

## 八、和生态集成

### 8.1 shadcn/ui

**shadcn/ui 不是组件库**，而是一个 CLI，帮你把某个组件的代码 **复制** 到你的项目里。这些组件已经用 cva + Radix UI + Tailwind 写好。

```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button dialog dropdown-menu
```

结果：`src/components/ui/button.tsx` 等文件出现在你的仓库里，你可以改任何一行。

CloudTone 用到的 shadcn 组件：Button、Dialog、DropdownMenu、Tooltip、Slider、ScrollArea、ContextMenu、Toast。第 22 章会一次配齐。

### 8.2 lucide-react

图标库。SVG 导入，支持 `className`，大小靠 `className="w-4 h-4"` 控制：

```tsx
import { Play, Pause, SkipForward } from "lucide-react";

<Play className="w-5 h-5 text-white" />
```

CloudTone 整个播放器约 40 个图标全部来自 lucide-react。

### 8.3 Radix UI primitives

Radix 提供无样式、可访问的组件基元（Dropdown、Dialog、Tooltip、Popover、Toast、Slider 等）。它输出 `data-state`、`data-side` 等属性，配合 Tailwind 的 data-* 变体：

```tsx
<DropdownMenu.Content
  className="
    min-w-[8rem] rounded-md border border-white/10 bg-popover p-1 text-popover-foreground shadow-md
    data-[state=open]:animate-in data-[state=closed]:animate-out
    data-[side=bottom]:slide-in-from-top-2
  "
/>
```

shadcn/ui 底层几乎全是 Radix。

### 8.4 tailwindcss-animate

提供 `animate-in`、`fade-in-0`、`slide-in-from-top-2` 等组合类，专门搭配 Radix 的进入/离开动画。shadcn/ui 依赖它。

---

## 九、Tailwind v3 vs v4（Oxide）

CloudTone 本书主线用 v3（稳定），但你要知道 v4（2024 末稳定）的核心变化：

| 维度 | v3 | v4 |
| --- | --- | --- |
| 引擎 | PostCSS + 自研 JIT | **Oxide**（Rust 重写，5-10× 更快） |
| 配置方式 | `tailwind.config.ts` (JS/TS) | **CSS-first**：`@import "tailwindcss";` + `@theme { ... }` 在 CSS 里 |
| content 扫描 | 显式配置 | 自动发现（依赖 git/项目扫描） |
| 颜色空间 | RGB/HSL | **OKLCH** 为默认，更准的对比度 |
| CSS 变量 | 靠自己写 | 所有 token 自动生成 CSS 变量，浏览器里可 `var(--color-pink-500)` |
| `@apply` | 支持 | 支持，语法更贴近原生 CSS |
| Safari 要求 | 14+ | 16.4+ (因为依赖 `@property`) |

v4 的 `@theme` 示例：

```css
@import "tailwindcss";

@theme {
  --color-brand-500: oklch(0.7 0.15 340);
  --font-family-sans: "Inter", system-ui, sans-serif;
  --radius-xl: 1rem;
}
```

自动生成 `bg-brand-500`、`font-sans`、`rounded-xl` 等 utility。

**迁移建议**：v4 生态（shadcn、tailwindcss-animate）在 2025 年陆续适配。CloudTone 如果你起新项目，可以直接上 v4；本书代码兼容两种写法，关键不同点会在相应章节提示。附录会给 v3 → v4 的迁移清单。

---

## 十、常见陷阱（高压警示区）

### 10.1 动态类名丢失

```tsx
// ❌ 扫不到，上线后没样式
<div className={`bg-${color}-500`} />

// ✅ 固定映射
const bgMap = {
  red: "bg-red-500",
  green: "bg-green-500",
} as const;
<div className={bgMap[color]} />

// ✅ 或 safelist（tailwind.config.ts）
safelist: [{ pattern: /bg-(red|green|blue)-(100|500|900)/ }]
```

### 10.2 `min-w-0` 让 flex 子元素不撑破

`flex` 子元素默认 `min-width: auto`（内容最小宽度），长歌名会把整行撑出屏幕：

```tsx
// ❌ 歌名把布局撑爆
<div className="flex gap-3">
  <img />
  <div className="flex-1">
    <div className="truncate">{veryLongTitle}</div>
  </div>
</div>

// ✅
<div className="flex gap-3">
  <img />
  <div className="flex-1 min-w-0">
    <div className="truncate">{veryLongTitle}</div>
  </div>
</div>
```

同理 `grid` 子项是 `min-width: 0`，通常不需要，但嵌套 grid 里偶尔也要加。

### 10.3 `dark:` 对比度 / 颜色系统

不要指望「把浅色模式的 `bg-white` 直接换成 `bg-black` 就行」。人眼对暗色下的对比度更敏感。建议：

- 用 11 级灰阶 `zinc / neutral / slate` 而不是纯黑纯白。CloudTone 用 `zinc` 系列。
- 背景 `zinc-950`（几乎纯黑但有 1-2% 色偏），前景 `zinc-100`。
- 卡片层叠时用不同透明度的白（`bg-white/5`、`bg-white/10`），让层次分明。
- 配色工具：tailwindcss 官方 color palette、`oklch.fyi`、`huetone`。

### 10.4 Preflight 重置副作用

Tailwind 的 Preflight 重置会：

- 把 `<h1>`..`<h6>` 的 font-size / font-weight 统一（所以标题默认和正文一样大，得自己加 class）。
- 把 `<ul>` `<ol>` 的 list-style 去掉。
- 把 `<a>` 的颜色继承化。

如果你要渲染一段由第三方 Markdown 生成的 HTML（CloudTone 的评论区或歌单描述），要么用 `@tailwindcss/typography` 的 `prose` 类，要么单独包一层自定义样式。

### 10.5 `@layer` 外写的 CSS 没有层级

```css
/* ❌ 没被 Tailwind 管理，优先级混乱 */
.btn { padding: 8px 16px; }

/* ✅ 放进 layer */
@layer components {
  .btn { @apply px-4 py-2; }
}
```

### 10.6 `group-*` 嵌套冲突

在 group 里再用另一个 group：内层 `group-hover:` 会响应最近祖先的 group。要明确命名：

```tsx
<div className="group/outer">
  <div className="group/inner">
    <span className="group-hover/outer:text-red-500 group-hover/inner:underline" />
  </div>
</div>
```

### 10.7 transition 时机

```tsx
// ❌ 元素初始 display:none，hover 时改成 block，transition 不会生效
<div className="hidden hover:block transition-opacity" />

// ✅ 用 opacity + pointer-events
<div className="opacity-0 pointer-events-none hover:opacity-100 hover:pointer-events-auto transition-opacity" />
```

### 10.8 `content` 路径遗漏

新增一个 `.mdx` 或 `.svelte` 文件类型却忘了加进 `content`，类就不会被扫出。上线才暴露。

### 10.9 `dark:` 只在 `darkMode: "class"` 下能手动切换

忘改 config，`darkMode` 还是默认 `media`，手动加 `.dark` 不生效。

### 10.10 `@apply` 里用自定义 class

```css
.btn { @apply some-custom-class; }   /* ❌ 通常会报错，@apply 只接受 Tailwind 工具类 */
```

绕过：内联 CSS 或用 `theme()` 函数取值。

---

## 十一、CloudTone 风格导览

CloudTone 的视觉骨架（第 22–24 章会逐步实现）：

- **整体背景**：`bg-zinc-950`（顶层 `<html class="dark">`）。
- **侧边栏**：`w-60 shrink-0 bg-zinc-900/60 backdrop-blur-md border-r border-white/5`。
- **主内容区**：`flex-1 overflow-y-auto p-6`，内容卡片 `rounded-2xl bg-white/[0.03] border border-white/5 p-4`。
- **播放器栏**：`h-20 bg-zinc-900/80 backdrop-blur-xl border-t border-white/5 flex items-center px-6`。
- **歌曲行**：`group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors`。
- **品牌色**：`primary` = OKLCH(0.7 0.15 340)（粉红偏紫），其实就是网易云的配色。
- **所有动效**：`transition-all duration-200 ease-out`，`motion-safe:*` 保护减少动画偏好的用户。

最终一个歌曲卡片长这样：

```tsx
import { cn } from "@/lib/cn";
import { Play } from "lucide-react";

interface Props {
  song: { id: number; title: string; artist: string; cover: string };
  active?: boolean;
  onPlay: () => void;
}

export function SongCard({ song, active, onPlay }: Props) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer",
        "transition-colors duration-150",
        "hover:bg-white/5",
        active && "bg-white/10 ring-1 ring-primary/30",
      )}
      onDoubleClick={onPlay}
    >
      <div className="relative w-12 h-12 shrink-0">
        <img
          src={song.cover}
          className="w-full h-full rounded object-cover bg-white/5"
          alt=""
        />
        <button
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded",
            "bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          )}
          onClick={onPlay}
          aria-label={`播放 ${song.title}`}
        >
          <Play className="w-5 h-5 text-white fill-current" />
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm font-medium">{song.title}</div>
        <div className="truncate text-xs text-zinc-400">{song.artist}</div>
      </div>
    </div>
  );
}
```

这段代码展示了本章的大部分要点：group 变体、min-w-0 陷阱、accessibility（aria-label + focus ring）、lucide-react、cn 条件样式、token 化颜色、transition 节制使用。

---

## 十二、工作流与 DX

### 12.1 编辑器设置

- **VS Code**：装 `Tailwind CSS IntelliSense`（完成 / hover 预览 / 冲突检测）、`Prettier` + `prettier-plugin-tailwindcss`（自动排序 class）。
- **settings.json 建议**：

```json
{
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "tailwindCSS.classAttributes": ["class", "className", "classNames"],
  "editor.quickSuggestions": { "strings": true }
}
```

这样 `cva(...)` 和 `cn(...)` 里的字符串也会有补全和 hover 预览。

### 12.2 Prettier 排序

`prettier-plugin-tailwindcss` 会按 Tailwind 推荐顺序自动排序 class：布局 → flex/grid → 间距 → 尺寸 → 排版 → 背景 → 边框 → 效果 → 变体。

```bash
pnpm add -D prettier prettier-plugin-tailwindcss
```

```json
// .prettierrc
{ "plugins": ["prettier-plugin-tailwindcss"] }
```

### 12.3 ESLint 规则

- `eslint-plugin-tailwindcss`：检查无效类、条件类一致性。
- `tailwindcss/no-contradicting-classname`：禁止 `p-2 p-4` 这种冲突（`tailwind-merge` 能解决，但还是希望代码本身不冲突）。

### 12.4 构建产物检视

开发环境 CSS 上万行是正常的（Tailwind 生成几乎所有可能的类）。生产构建（Vite `build`）JIT 只保留用到的类，CloudTone 最终 `index.css` 约 18 KB，gzip 6 KB。命令：

```bash
pnpm build && du -h dist/assets/index-*.css
```

---

## 十三、学习与回查路径

- 官方文档：`https://tailwindcss.com/docs`（没必要从头读，用搜索）。
- Play ground：`https://play.tailwindcss.com`，贴代码即调，非常适合调试。
- `tailwindcss.com/docs/installation` 的 Preflight 列表背一下。
- shadcn/ui 源码：`https://github.com/shadcn-ui/ui`，是学习「Tailwind + Radix + cva」组合的最佳范本。
- Lucide 图标搜索：`https://lucide.dev/icons`。
- 颜色工具：`https://uicolors.app/create`、`https://oklch.com`。

---

## 十四、精通自查清单

做完这一章你应该能对每项回答「是」：

- 说得出 Tailwind vs BEM vs CSS Modules vs CSS-in-JS 四个方案各自的优劣。
- 看到一个需求能直接想到用哪个属性分类的工具类，而不是 Google「how to center div in tailwind」。
- 自己写过至少一个自定义 plugin（addUtilities / matchUtilities）。
- 用 CSS 变量 + HSL 方案搭建了一套可切换主题的 token 系统。
- 写过用 `cva` 的多变体组件。
- 用 `group/name` + `data-[state=...]` 给 Radix 组件写过过渡动画。
- 知道 `@layer base/components/utilities` 的三层优先级，并且在设计系统里正确放置自己的规则。
- 能判断 `@apply` 什么时候用、什么时候不用。
- 踩过并解决过 `min-w-0`、动态类、dark 对比度、group 嵌套至少各一次。
- 对 v3 vs v4 的迁移策略有清晰判断。

如果上面你还有 1-2 项答不出，翻回相应小节补齐；3 项以上的话，写 500 行 CloudTone UI 是最好的巩固方式——第 22 章起我们就开始。

---

## 本章小结

- Tailwind 的威力来自「设计 token + atomic class + JIT + 变体系统」这四样东西的合力，不是任何一个单独的点。
- 要精通，关键是记分类而不是记条目，熟变体系统而不是熟类名。
- 工程化落地三件套：`tailwind.config.ts` + `cn()` + `cva()`；再加 shadcn/ui 就是现代 React 项目的默认起手。
- 避开 10 个陷阱，写 3000 行 UI，就过了精通门槛。

## 动手时刻

1. 在第 2 章的 smoke-test 项目里，把 `SongCard` 按本章最终版本写一遍，加上 `group` + `data-[state=active]` 变体。
2. 建立 `src/lib/cn.ts`、`src/components/ui/button.tsx`（用 cva）。
3. 用 `@tailwindcss/container-queries` 做一个「在宽度 < 400px 时变成单列」的歌曲列表。
4. 用 CSS 变量 + HSL 定义 `--background / --foreground / --primary` 三个 token，切换 `<html>` 的 class 看效果。

下一章，我们回到 Rust，复盘在 Tauri 场景下你最容易踩的几个坑——生命周期、Send/Sync、async runtime 的交互。
