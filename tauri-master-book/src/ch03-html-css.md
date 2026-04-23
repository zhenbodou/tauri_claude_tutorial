# 第 3 章 前端基石：HTML 与 CSS 深度指南

> 原来的速通版本被这章全面取代。读完你应该能做到：看到任何 Web 截图，脑子里立刻能还原它的结构树和关键 CSS；遇到奇怪的对齐、溢出、层叠 bug，能在 1 分钟内定位。

## 本章目标

- 把 HTML 从"标签列表"升级为"语义 + 可访问性 + DOM 树"的综合视角。
- 把 CSS 从"调一调属性"升级为"盒模型 + 布局系统 + 层叠机制 + 现代特性"的全景理解。
- 掌握 Flex、Grid、Position、Transform、动画、响应式、暗色主题、变量、容器查询这些真实项目必备的知识。
- 能独立完成 CloudTone 所有静态页面的实现与调试。

## 一、HTML 不只是标签

### 1.1 文档的骨架

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0f0f14" />
    <title>CloudTone</title>
    <link rel="icon" href="/favicon.ico" />
    <link rel="stylesheet" href="/src/styles/index.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

每一行都不是装饰：

- `<!doctype html>`：告诉浏览器"用标准模式渲染"。没它就会退回怪异模式（Quirks Mode），盒模型算法都会变。
- `lang="zh-CN"`：屏幕阅读器、自动断词、拼写检查都看它。SEO 也看。
- `charset="utf-8"`：必须出现在 `<head>` 前 1024 字节，否则浏览器可能误判编码。
- `viewport`：移动端适配命脉。Tauri 桌面端用不到缩放，但保留它能让 WebView 行为和现代浏览器一致。
- `theme-color`：Windows 标题栏、PWA、某些 Linux 窗口管理器会读取它。
- `<script type="module">`：启用 ESM。Vite 出的代码是 ESM，这个属性是刚需。
- `<div id="root">`：React 挂载点。Tauri 里永远是这一个根。

### 1.2 DOM 是树，不是字符串

浏览器读到 HTML，会建一棵 **DOM 树**：

```
Document
└── html
    ├── head
    │   ├── meta
    │   ├── title
    │   └── link
    └── body
        ├── div#root
        └── script
```

所有 CSS 和 JS 都是在操作这棵树：增删节点、改属性、监听事件。React 所做的事情也只是"声明式地描述这棵树应该长什么样"。

### 1.3 语义化：标签不是 `<div>` 的同义词

HTML5 引入的语义标签不只是换皮：

| 标签 | 语义 | 谁在乎 |
| --- | --- | --- |
| `<header>` | 顶部、横幅区域 | 屏幕阅读器、SEO |
| `<nav>` | 导航区 | 屏幕阅读器跳转快捷键 |
| `<main>` | 主要内容（一页只能一个） | 屏幕阅读器 Skip To Main |
| `<article>` | 自成一体的内容块 | RSS、ReadMode |
| `<section>` | 有主题的分区（配标题） | 大纲算法 |
| `<aside>` | 辅助内容、侧栏 | 屏幕阅读器 |
| `<footer>` | 页脚、区块脚部 | 屏幕阅读器 |
| `<figure>/<figcaption>` | 图 + 说明 | 搜索引擎抓图 |
| `<time>` | 机器可读的时间 | 搜索引擎结构化数据 |

CloudTone 里大量 `<div>` 可以读作"没想好语义的容器"；但顶栏写成 `<header>`、侧栏 `<nav>`、歌曲列表区域 `<main>`，对可访问性和未来扩展都更好。

### 1.4 可访问性（a11y）速成

桌面应用被忽视最多的事情就是可访问性。Tauri 的 WebView 继承浏览器 ARIA 支持，几条最小实践：

- 按钮用 `<button>`，不要用"可点击的 `<div>`"——否则不能用键盘 Tab/Enter 触发。
- 图标按钮必须配 `aria-label`：`<button aria-label="播放">▶</button>`。
- 表单 input 要有 `<label>` 关联：`<label for="q">搜索</label><input id="q" />`。或者把 input 嵌在 label 里。
- 状态变化用 `aria-live="polite"` 通知屏幕阅读器（比如"下载完成"）。
- `alt` 写给看不到图的人看：装饰图写 `alt=""`，内容图写"专辑封面：起风了"。

### 1.5 表单元素

```html
<form onSubmit={submit}>
  <label>
    关键词
    <input type="search" name="q" required maxlength="100" autocomplete="off" />
  </label>
  <label>
    数量
    <input type="number" name="limit" min="1" max="500" step="10" value="50" />
  </label>
  <label>
    类型
    <select name="type">
      <option value="song">歌曲</option>
      <option value="album">专辑</option>
    </select>
  </label>
  <label>
    <input type="checkbox" name="online" /> 同时搜索在线
  </label>
  <button type="submit">搜索</button>
  <button type="reset">清空</button>
</form>
```

`type` 值决定了输入法、键盘、校验规则。`email`/`url`/`tel`/`search`/`number`/`date` 各有用途。HTML5 自带校验（`required`、`pattern`、`min`/`max`）够用时就别自己写。

### 1.6 HTML 转义和安全

如果你把用户输入直接塞进 `innerHTML`，就给了 XSS 机会：

```js
el.innerHTML = userInput; // 危险
el.textContent = userInput; // 安全
```

React 的 JSX 默认对 `{expr}` 做转义，`<p>{userInput}</p>` 是安全的；你必须显式写 `dangerouslySetInnerHTML` 才能绕过它——注意那个名字，React 在提醒你。

## 二、CSS 的四大核心

CSS 看起来是一堆属性赋值，真正构成"理解力"的是四块：**选择器 + 层叠 + 盒模型 + 布局**。

### 2.1 选择器系统

```css
/* 元素 */        p { }
/* 类 */          .title { }
/* ID */          #hero { }
/* 属性 */        input[type="checkbox"] { }
/* 后代 */        .card .title { }
/* 子代 */        .card > .title { }
/* 相邻 */        h1 + p { }
/* 通用兄弟 */    h1 ~ p { }
/* 伪类 */        button:hover:not(:disabled) { }
/* 伪元素 */      p::first-letter { }
/* 现代伪类 */    li:has(> img) { }  /* 包含 img 的 li */
                 :is(h1, h2, h3) { }  /* 任一匹配 */
                 :where(h1, h2, h3) { } /* 同上但 specificity 为 0 */
```

**优先级（specificity）** 的简化打分：

```
内联 style      (1,0,0,0)
#id             (0,1,0,0)
.class / [attr] / :pseudo-class (0,0,1,0)
tag / ::pseudo-element (0,0,0,1)
```

高位比低位强，打不平再按**出现顺序**：后定义的胜。`!important` 强行升级（别滥用）。

**继承**：颜色、字体、行高等文字相关属性会被子元素继承；盒子相关（width/margin/border）不会。

### 2.2 Cascade：层叠三板斧

一条样式最终有没有生效，走三轮：

1. **来源 + 层**：用户代理样式 < user 样式 < 作者样式，后者压前者。Tailwind/Bootstrap 是作者样式。`@layer` 让你显式声明顺序：

```css
@layer base, components, utilities;
@layer base { a { color: blue; } }
@layer utilities { .text-red { color: red !important; } } /* 保证 utilities 总赢 */
```

2. **Specificity**：如上。
3. **Source order**：都打平看谁在后面。

日常最常见的 bug 是你的 `.active .title` 被 `.card .title` 压住——数数分数就能判。DevTools 的 Elements 面板会把**被覆盖的样式划掉**，非常清楚。

### 2.3 盒模型

```css
.box {
  width: 200px;
  padding: 16px;
  border: 2px solid;
  margin: 8px;
  box-sizing: border-box;  /* 推荐统一设置 */
}
```

- `content-box`（默认）：`width` 只算内容。实际占地 = width + padding*2 + border*2 + margin*2。
- `border-box`：`width` 包含 content + padding + border。margin 仍在外。

几乎所有现代项目都在根上写：

```css
*, *::before, *::after { box-sizing: border-box; }
```

Tailwind 默认做了这件事。

**margin 折叠（collapsing margins）**：两个垂直相邻的 margin 只取其中较大的一个，不叠加。仅在 block flow 下发生，Flex/Grid 容器里的子元素不会发生。遇到"margin 明明是 20+30 怎么实测只有 30"大概率就是它。

### 2.4 Display：布局的入口

```css
display: block;        /* 独占一行（div, p） */
display: inline;       /* 文本级别，不能设 width/height（span, a） */
display: inline-block; /* 行内但可设尺寸 */
display: flex;         /* 一维布局容器 */
display: inline-flex;  /* 行内 flex */
display: grid;         /* 二维布局容器 */
display: contents;     /* 自身不产生盒子，子元素"透出" */
display: none;         /* 完全不渲染（占位也没） */
```

HTML 默认值是有的：`<div>` 是 block，`<span>` 是 inline。但现代布局里你会频繁改。

## 三、Flexbox 完全指南

记住这幅图：

```
┌ justify-content (主轴) ──────────────►
│  ┌────┐ ┌────┐ ┌────┐
│  │ A  │ │ B  │ │ C  │   align-items (交叉轴)
│  └────┘ └────┘ └────┘
▼
```

### 3.1 容器属性

```css
.container {
  display: flex;
  flex-direction: row;       /* row | row-reverse | column | column-reverse */
  flex-wrap: nowrap;         /* nowrap | wrap | wrap-reverse */
  justify-content: flex-start;
    /* flex-start | center | flex-end | space-between | space-around | space-evenly */
  align-items: stretch;
    /* stretch | flex-start | center | flex-end | baseline */
  align-content: stretch;    /* 只有多行 wrap 时才生效 */
  gap: 12px;                 /* 替代 margin 的现代做法 */
}
```

### 3.2 子项属性

```css
.item {
  flex-grow: 1;    /* 剩余空间分配权重 */
  flex-shrink: 1;  /* 空间不足时压缩权重 */
  flex-basis: 0;   /* 初始大小（auto 表示按 content） */
  flex: 1 1 0;     /* grow shrink basis 的简写，常用 flex: 1 表示均分 */
  align-self: auto;/* 覆盖容器 align-items */
  order: 0;        /* 显示顺序（非 DOM 顺序） */
}
```

### 3.3 日常模式

**水平+垂直居中**：

```css
.center { display: flex; justify-content: center; align-items: center; }
```

**一行三列，中间自适应**：

```css
.row { display: flex; align-items: center; gap: 8px; }
.row > .main { flex: 1; min-width: 0; }
```

`min-width: 0` 非常关键——Flex item 的默认最小尺寸是它的 content（比如长歌名），会把 truncate 顶破。

**顶部栏左右结构**：

```css
.bar { display: flex; justify-content: space-between; align-items: center; }
```

**底部固定（sticky footer）**：

```css
body { min-height: 100vh; display: flex; flex-direction: column; }
.content { flex: 1; }
```

### 3.4 陷阱集锦

- `height: auto` 的 flex 子项可能撑不起来，需要 `flex: 1` 或显式 height。
- `align-items: stretch`（默认）会把子项拉满；放图片时可能被拉变形，写 `align-items: flex-start`。
- `flex: 1` 等价 `flex: 1 1 0%`。`flex: auto` 是 `1 1 auto`，大小会参考 content。
- 子项的 margin auto 会吃掉剩余空间，能做花式对齐：`<span style="margin-left: auto">` 把自己推到最右。

## 四、Grid 完全指南

一维不够用就上 Grid。Grid 适合页面级布局（三栏 Shell、瀑布流、卡片网格）。

### 4.1 容器

```css
.grid {
  display: grid;
  grid-template-columns: 240px 1fr 320px;  /* 三栏 */
  grid-template-rows: 56px 1fr 72px;       /* 三排 */
  gap: 12px;                                /* row-gap & column-gap */
  grid-template-areas:
    "sidebar header header"
    "sidebar main   panel"
    "sidebar player player";
}
```

`fr` 单位表示剩余空间的分数。`repeat(12, 1fr)` 十二列等宽。`minmax(200px, 1fr)` 最小 200 最大自适应。

### 4.2 子项定位

```css
.header { grid-area: header; }
.main   { grid-area: main; }

/* 或者显式 */
.item {
  grid-column: 2 / 5;    /* 从第 2 条线到第 5 条线 */
  grid-row: span 2;      /* 跨 2 行 */
}
```

### 4.3 自适应卡片墙

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}
```

这一条就能让卡片随宽度自动折行，每列至少 180px。CloudTone 专辑列表经典用法。

### 4.4 Grid vs Flex 怎么选

- 内容驱动、一维流式 → Flex。
- 固定骨架、二维精确控制 → Grid。
- 实际项目经常嵌套：Grid 分大区，每个大区内部用 Flex。

## 五、Position 与层叠

```css
position: static;   /* 默认，不接受 top/left */
position: relative; /* 相对自己原位偏移，仍占原位 */
position: absolute; /* 脱离文档流，相对最近的 positioned 祖先 */
position: fixed;    /* 相对 viewport */
position: sticky;   /* 滚动到阈值前是 relative，之后是 fixed */
```

重要：`absolute` 找的是**最近的非 static 祖先**，默认是 `<html>`。做弹窗时父容器记得加 `position: relative`。

### 5.1 z-index 与 stacking context

`z-index` 只在同一个 stacking context 里比较。什么情况下会新开一个 stacking context？非 static 的 position + z-index 不为 auto；`opacity < 1`；`transform`、`filter`、`will-change` 等。

这就解释了：为什么你把 `z-index: 9999` 加在里层元素上还是被外层 `z-index: 10` 的东西盖住——因为它们不在同一个 context 里。

### 5.2 现代居中

CSS 居中以前是面试题，现在只要：

```css
/* 单行 */ display: grid; place-items: center;
/* 或 */ display: flex; justify-content: center; align-items: center;
```

垂直居中文字行高技巧依然有用：`height: 40px; line-height: 40px;` 对单行文本最省。

## 六、单位、颜色、响应式

### 6.1 长度单位

- `px`：绝对像素（实际是 CSS 像素，设备像素还涉及 DPR）。
- `rem`：根元素 font-size 的倍数。`html { font-size: 16px }` 时 `1rem = 16px`。缩放友好。
- `em`：父元素 font-size 的倍数。嵌套容易出坑，一般只用于排版。
- `%`：相对父元素对应属性。
- `vw`/`vh`：视口 1% 宽/高。`100vh` 有移动端地址栏坑，替代方案 `100dvh`（dynamic viewport height）。
- `svh`/`lvh`/`dvh`：小/大/动态视口高，处理带 UI 条的移动浏览器。
- `ch`：一个字符宽度。做行宽 `max-width: 65ch` 读起来最舒服。

### 6.2 颜色

```css
color: red;                  /* 命名 */
color: #ff0000;              /* hex */
color: rgb(255 0 0 / 50%);   /* 现代语法 */
color: rgba(255, 0, 0, 0.5); /* 老语法 */
color: hsl(0 100% 50% / 50%);/* 更直观 */
color: oklch(70% 0.25 20);   /* 感知均匀，推荐 */
```

OKLCH 在主题设计里很有用：L 是亮度、C 是饱和度、H 是色相。用它生成色板不会在蓝色段暗绿色段亮。

### 6.3 媒体查询与响应式

```css
.sidebar { width: 240px; }
@media (max-width: 900px) {
  .sidebar { width: 56px; }   /* 窄屏折叠为图标 */
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #0a0a0a; --fg: #eee; }
}
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

Tauri 是桌面应用，但窗口可以被用户任意拉宽/拉窄；CloudTone 设计时我们坚持"≥ 1024 不折叠、900~1024 折叠侧栏、< 900 只显示内容区"。

### 6.4 容器查询（新，但已广泛支持）

```css
.card-grid { container-type: inline-size; container-name: grid; }

@container grid (min-width: 600px) {
  .card { grid-template-columns: 1fr 2fr; }
}
```

它让组件**根据自己的容器宽度**响应式，而不是 viewport。写独立组件时比 media query 灵活得多。

## 七、CSS 变量与主题

### 7.1 定义和使用

```css
:root {
  --bg: #0f0f14;
  --fg: #f2f2f7;
  --brand: oklch(70% 0.18 20);
  --radius: 8px;
}

.card { background: var(--bg); color: var(--fg); border-radius: var(--radius); }
```

变量遵循继承与层叠，可以在局部覆盖：

```css
.theme-light { --bg: #f6f6f8; --fg: #111; }
```

切换主题只需给根节点加/去类名。CloudTone 就是这么做的（Ch 24）。

### 7.2 和 Tailwind 合作

Tailwind v3 里推荐把设计 token 写成 CSS 变量，然后在 `tailwind.config` 里引用：

```css
:root { --color-brand-500: oklch(70% 0.18 20); }
```

```ts
// tailwind.config.ts
colors: {
  brand: { 500: "oklch(var(--color-brand-500) / <alpha-value>)" },
}
```

这样暗/亮/跟随系统三种主题都能切换，无需在 config 里硬编码。

## 八、过渡、变换与动画

### 8.1 Transform

```css
.thumb { transition: transform 200ms ease; }
.thumb:hover { transform: scale(1.05) rotate(-2deg); }
```

`transform` 和 `opacity` 由合成器（compositor）处理，不触发重排/重绘，60fps 友好。尽量只动这两者。

常用变换：`translate(X, Y)`, `translateZ`（开启 GPU 层）, `scale`, `rotate`, `skew`, `matrix`。`transform-origin` 改变换中心。

### 8.2 过渡 transition

```css
.btn {
  transition-property: transform, background-color, opacity;
  transition-duration: 200ms;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-delay: 0ms;
}
/* 简写 */
.btn { transition: all 200ms ease; }
```

`all` 方便但会伤性能（所有属性都跟踪）。真实项目列出具体属性更好。

### 8.3 关键帧动画

```css
@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
.loading { animation: spin 1s linear infinite; }

@keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.enter { animation: fade-in 200ms ease both; }
```

`animation-fill-mode: both` 让起止状态都保留。复杂动画用 `framer-motion` 更舒服，但底层还是 transform + opacity。

### 8.4 陷阱

- 动画期间不要改 width/height/top/left——会触发 layout，掉帧。
- 在 display: none 的元素上 transition 没用，要先 block 再下一个 frame 触发变化。React 里常见解法：条件渲染 + `requestAnimationFrame` 或用 `framer-motion` 的 `AnimatePresence`。
- `will-change: transform` 提示浏览器提前准备图层，但滥用反而耗内存。

## 九、Overflow、滚动、Scrollbar

```css
.panel { overflow: auto; }            /* 超出时出现滚动条 */
.panel { overflow-y: auto; overflow-x: hidden; }
.panel { scroll-behavior: smooth; }   /* JS scroll 平滑 */
.panel { overscroll-behavior: contain; } /* 阻止滚动穿透 */
```

CSS 滚动条：

```css
/* WebKit (Tauri WebView 在 mac 上是 WebKit，Win 上是 Blink) */
.panel::-webkit-scrollbar { width: 8px; }
.panel::-webkit-scrollbar-thumb { background: #666; border-radius: 4px; }

/* Firefox / 未来规范 */
.panel { scrollbar-width: thin; scrollbar-color: #666 transparent; }
```

CloudTone 把滚动条做得很细，视觉干扰小。

## 十、现代 CSS 新特性值得记住

| 特性 | 作用 | 兼容 |
| --- | --- | --- |
| `:has()` | 父选择器 | WebView 现代版支持 |
| `:is()` / `:where()` | 分组选择器 | 全支持 |
| `@layer` | 显式层叠层 | 全支持 |
| CSS Nesting | 原生嵌套 | 全支持 |
| `@container` | 容器查询 | 全支持 |
| `aspect-ratio` | 定宽高比 | 全支持 |
| `gap` on Flex | flex 容器的 gap | 全支持 |
| `inset` | top/right/bottom/left 简写 | 全支持 |
| `clamp(min, val, max)` | 三值夹取 | 全支持 |
| `accent-color` | 表单控件配色 | 全支持 |

`clamp` 做响应式字号特别香：

```css
h1 { font-size: clamp(20px, 2vw + 12px, 36px); }
```

## 十一、调试 CSS 的方法论

1. **DevTools Element 面板**：查看"Computed"是谁赢了，看"Box Model"确认实际尺寸。
2. **`outline: 1px solid red`**：比 border 更好用——不占盒子空间，加了也不会改变布局。
3. **背景色排查层级**：给嫌疑容器加显眼背景，一眼看出边界。
4. **`display: flex` 的子项神秘失踪**：检查 `overflow`、`flex-shrink: 0`、`width: 0`。
5. **position: fixed 定位错位**：看祖先链上是否有 `transform` / `filter` / `will-change` 创建了新的包含块。
6. **层级 bug**：挨个检查 `position`、`z-index`、`opacity < 1`，画 stacking context。

## 十二、完整实战：CloudTone Shell 骨架

```html
<div class="shell">
  <aside class="sidebar">...</aside>
  <header class="titlebar">...</header>
  <main class="content">...</main>
  <aside class="panel">...</aside>
  <footer class="player">...</footer>
</div>
```

```css
.shell {
  display: grid;
  height: 100vh;
  grid-template-columns: 240px 1fr 320px;
  grid-template-rows: 40px 1fr 80px;
  grid-template-areas:
    "sidebar titlebar titlebar"
    "sidebar content  panel"
    "player  player   player";
  background: var(--bg);
  color: var(--fg);
}
.sidebar  { grid-area: sidebar;  overflow-y: auto; }
.titlebar { grid-area: titlebar; -webkit-app-region: drag; }
.content  { grid-area: content;  overflow-y: auto; }
.panel    { grid-area: panel;    overflow-y: auto; }
.player   { grid-area: player;   border-top: 1px solid #ffffff10; }

@media (max-width: 1024px) {
  .shell { grid-template-columns: 56px 1fr 0; grid-template-areas:
    "sidebar titlebar titlebar"
    "sidebar content  content"
    "player  player   player"; }
  .panel { display: none; }
}
```

这就是 CloudTone 主界面的基础。第 23 章会在这之上换成 Tailwind 写法。

## 十三、陷阱与最佳实践合辑

- 永远别在同一个元素上同时用 Flex 和 margin: auto 以外的定位，避免行为歧义。
- 滚动容器要有显式 height（`h-full`、`flex-1 min-h-0`），否则永远不滚动。
- `100vh` 在移动端等于"加上了地址栏时的高度"，用 `100dvh` 替代。Tauri 桌面通常无此问题，但为跨平台保留一致行为推荐用 dvh。
- 大面积背景图片 prefer `background-image` + `background-size: cover` 而不是 `<img>`，避免 DOM 节点过多。
- 不要给可能变化尺寸的元素加 `transition: height`——会触发 reflow；改用 `transition: max-height`，或用 `grid-template-rows: 0fr -> 1fr` 的现代技巧。
- 动画跟随系统 reduce-motion：

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

## 本章小结

HTML 是 DOM 树和语义；CSS 是选择器、层叠、盒模型、布局（Flex/Grid/Position）、主题（变量）、动效（transform/transition）。掌握这六块，你不再"靠直觉调样式"，而是能用规则推理出结果。

下一章，JavaScript 与 TypeScript 深度指南。
