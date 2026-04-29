# 第 3 章 前端基石：HTML 与 CSS（从零开始）

> **本章假设你一点前端基础都没有**。我们从"网页到底是什么"开始，一步一步走到能独立写出 CloudTone 的主界面。每一节都有可以直接复制跑起来的小例子，鼓励你边看边试。

## 零、先把地基打平：网页到底是什么？

先回答几个常常被跳过的问题。

**问题 1：你在浏览器里看到的"网页"是什么？**
本质上是**三个文件**的配合：

- `HTML` 文件 → 决定页面上**有什么东西**（标题、按钮、图片、输入框……）。像盖房子时先立的**骨架**。
- `CSS` 文件 → 决定这些东西**长什么样**（颜色、大小、位置、字体）。像给骨架**刷漆、贴瓷砖**。
- `JavaScript` 文件 → 决定这些东西**会做什么**（点按钮弹窗、拖滑块变音量）。像给房子装**电器和开关**（下一章讲）。

**问题 2：Tauri 和这些有什么关系？**
Tauri 把一个真正的浏览器引擎（WebView）塞进一个桌面窗口里。你写的 HTML + CSS + JS 就在这个窗口里运行，看起来像一个原生桌面软件。所以**学前端 = 学怎么做 Tauri 应用的界面**。

**问题 3：我需要装什么才能开始？**
什么都不用。你已经有浏览器了——Chrome、Edge、Safari 都行。接下来的例子，你只需要：

1. 新建一个文件夹，比如 `Desktop/hello-web/`。
2. 里面新建一个文件叫 `index.html`。
3. 把本章每个示例的 HTML 代码粘进去。
4. 双击 `index.html`，浏览器就会打开它。
5. 改代码 → 保存 → 浏览器按 F5 刷新 → 看效果。

就这么简单。这个循环（**写 → 存 → 刷 → 看**）你会重复几千次，越快越舒服。

## 一、你的第一个 HTML 页面

把下面这段完整复制到 `index.html` 并双击打开：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>我的第一个网页</title>
  </head>
  <body>
    <h1>你好，世界</h1>
    <p>这是我用 HTML 写的第一个页面。</p>
  </body>
</html>
```

你应该看到一个大标题"你好，世界"和下面一行小字。

**解剖一下这段代码。** HTML 由一堆"**标签**"组成。标签长这样：`<标签名>内容</标签名>`。带斜杠的那一半叫**闭合标签**。

- `<!doctype html>`：第一行固定写，告诉浏览器"按现代标准来"。不用深究。
- `<html>...</html>`：整个页面的最外层包裹。所有东西都在它里面。
- `<head>...</head>`：**看不见**的信息（标题、编码、引入的样式表）。
- `<body>...</body>`：**看得见**的页面内容（标题、段落、按钮……）。
- `<h1>`：一级标题（Heading 1）。`<h2>`、`<h3>` 到 `<h6>` 依次变小。
- `<p>`：段落（Paragraph）。

**标签可以嵌套**：`<body>` 里放 `<h1>`，`<h1>` 里放文字。嵌套关系就是所谓的"父子关系"——`<body>` 是 `<h1>` 的父元素。

**动手试试 ①**：把 `<h1>` 改成 `<h2>`，看字号变小；再加一行 `<h3>小标题</h3>` 和另一段 `<p>`，看浏览器的反应。

## 二、HTML 标签和属性

### 2.1 标签的"**属性**"

属性写在开始标签里，格式是 `属性名="值"`：

```html
<a href="https://tauri.app">打开 Tauri 官网</a>
<img src="cat.jpg" alt="一只猫" />
<input type="text" placeholder="请输入姓名" />
```

- `<a>` 是链接（anchor），`href` 属性说明链到哪里。
- `<img>` 是图片，`src` 是图片地址，`alt` 是"图片加载不出时显示的文字"（也给盲人屏幕阅读器用）。
- `<input>` 是输入框，`type` 决定它是普通文本、密码、数字还是复选框。

**自闭合标签**：`<img>`、`<input>`、`<br>`（换行）、`<hr>`（横线）这些没有内容，写成 `<img ... />` 就行，不用结束标签。

### 2.2 最常用的 15 个标签

背下这张表够你写 90% 的界面：

| 标签 | 作用 | 例子 |
| --- | --- | --- |
| `<h1>`~`<h6>` | 标题，从大到小 | `<h1>欢迎</h1>` |
| `<p>` | 段落 | `<p>正文一段话</p>` |
| `<a>` | 链接 | `<a href="/about">关于</a>` |
| `<img>` | 图片 | `<img src="logo.png" alt="logo" />` |
| `<ul>` + `<li>` | 无序列表（圆点） | `<ul><li>苹果</li><li>香蕉</li></ul>` |
| `<ol>` + `<li>` | 有序列表（数字） | 同上换成 `<ol>` |
| `<button>` | 按钮 | `<button>点我</button>` |
| `<input>` | 输入框 | `<input type="text" />` |
| `<label>` | 输入框的说明 | `<label>姓名 <input /></label>` |
| `<form>` | 表单容器 | `<form>...</form>` |
| `<div>` | 万能容器（块级） | `<div>一堆东西</div>` |
| `<span>` | 万能容器（行内） | `<span>一小段</span>` |
| `<br>` | 换行 | `文字<br>换行` |
| `<strong>` | 重要文字（加粗） | `<strong>警告</strong>` |
| `<em>` | 强调（斜体） | `<em>特别提醒</em>` |

`<div>` 和 `<span>` 特别重要：它们本身**没有语义**，就是纯粹的"盒子"，用来把一堆东西包起来方便加样式。
- `<div>` 是**块级**——默认**独占一行**，像一块砖。
- `<span>` 是**行内**——像一个文字片段，同行能挤多个。

**动手试试 ②**：写一个小页面，包含一个标题、一段话、一个"我的爱好"有序列表（至少 3 项）、一张图（可以随便找网上的图片链接贴进 `src`）、一个按钮。

### 2.3 文档骨架的标准写法

后面 CloudTone 里完整的 `index.html` 其实长这样：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CloudTone</title>
    <link rel="stylesheet" href="/src/styles/index.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

逐行理解：

- `<meta charset="utf-8" />` → 使用 UTF-8 编码，**中文不会乱码的保险**。
- `<meta name="viewport" ... />` → 移动设备上的缩放设置，Tauri 桌面端用不到但保留更稳妥。
- `<link rel="stylesheet" href="..." />` → **引入一个 CSS 文件**。
- `<div id="root"></div>` → 一个空盒子，React 启动后会把整个界面塞进去（第 5 章讲）。
- `<script type="module" src="..."></script>` → **引入一个 JavaScript 文件**。`type="module"` 表示用现代模块化方式加载。

现在你应该能看懂任何网页源码的开头了。

## 三、CSS：给 HTML 穿衣服

### 3.1 第一个 CSS 示例

把下面复制到 `index.html`，**整体替换**之前的内容：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>CSS 初体验</title>
    <style>
      h1 {
        color: white;
        background-color: #4f46e5;
        padding: 20px;
      }
      p {
        color: #555;
        font-size: 18px;
      }
    </style>
  </head>
  <body>
    <h1>你好，CSS</h1>
    <p>这段段落变成灰色了，字号也变大了。</p>
  </body>
</html>
```

保存刷新，你应该看到：一个紫色背景、白色字的大标题，下面是灰色变大的正文。

**解剖 CSS 语法**：

```
选择器 {
  属性: 值;
  属性: 值;
}
```

- **选择器**告诉浏览器"**要给谁加样式**"。`h1` 就是"页面上所有 `<h1>` 元素"。
- **属性: 值**告诉浏览器"**加什么样式**"。`color: white` 就是"文字颜色设为白色"。

### 3.2 CSS 写在哪里？

三种方式，由差到好排序：

1. **行内样式**（不推荐，只做临时调试）：

   ```html
   <h1 style="color: red;">红色标题</h1>
   ```

2. **内部样式表**（小页面调试 OK）：把 `<style>...</style>` 放在 `<head>` 里，像上面那个例子。
3. **外部样式表**（正式项目都这么做）：单独写一个 `style.css`，在 HTML 里引入：

   ```html
   <link rel="stylesheet" href="style.css" />
   ```

   ```css
   /* style.css */
   h1 { color: red; }
   ```

CloudTone 用的是第三种（配合后面章节的 Tailwind）。

### 3.3 常用选择器

这是 CSS 的**核心技能**——怎么精准地选中你想改的元素。

```css
/* 1. 标签选择器：所有 <p> */
p { color: gray; }

/* 2. 类选择器：class="title" 的所有元素 */
.title { font-size: 24px; }

/* 3. ID 选择器：id="hero" 的那个元素（一个页面只应有一个同名 id） */
#hero { background: black; }

/* 4. 后代选择器：.card 里面的所有 .title */
.card .title { color: blue; }

/* 5. 子代选择器：.card 的直接子元素中的 .title */
.card > .title { color: blue; }

/* 6. 属性选择器 */
input[type="text"] { border: 1px solid gray; }

/* 7. 伪类：特定状态时生效 */
button:hover { background: yellow; }      /* 鼠标悬停 */
button:disabled { opacity: 0.5; }         /* 被禁用 */
input:focus { outline: 2px solid blue; }  /* 获得焦点 */
```

**类（class）是最常用的**。用法：

```html
<p class="title">标题</p>
<p class="title important">重要标题</p>  <!-- 一个元素可以有多个类，空格分隔 -->
```

```css
.title { font-size: 20px; }
.important { color: red; }
```

### 3.4 优先级：谁说了算？

如果多条规则都匹配到同一个元素，谁赢？简单版打分：

| 规则类型 | 分数 |
| --- | --- |
| 行内 `style="..."` | 1000 |
| ID 选择器 `#hero` | 100 |
| 类 `.title` / 属性 `[type]` / 伪类 `:hover` | 10 |
| 标签 `p` / 伪元素 `::before` | 1 |

分高的赢；同分时**后面写的**赢。

日常 99% 情况你只用到类选择器，基本不会出冲突。万一碰上"我明明写了颜色但没生效"，按 F12 打开浏览器开发者工具，点 Elements 面板，能看到哪条规则生效、哪条被划掉，一目了然。

**动手试试 ③**：写一个页面，有 2 个按钮。第一个加类 `.primary`，背景蓝色白字；第二个加类 `.danger`，背景红色白字。都加 `:hover` 时背景颜色变深。

## 四、盒模型：CSS 的核心概念

每一个 HTML 元素，在页面上都是一个"**盒子**"。每个盒子由四层组成（从里到外）：

```
    ┌─────────── margin（外边距，和别人的距离）─────────┐
    │                                                      │
    │   ┌────── border（边框）──────────────────┐          │
    │   │                                        │          │
    │   │   ┌── padding（内边距，留白）─────┐    │          │
    │   │   │                                │    │          │
    │   │   │       content（内容）          │    │          │
    │   │   │                                │    │          │
    │   │   └────────────────────────────────┘    │          │
    │   │                                        │          │
    │   └────────────────────────────────────────┘          │
    │                                                      │
    └──────────────────────────────────────────────────────┘
```

CSS 里对应：

```css
.box {
  width: 200px;      /* 内容宽度 */
  height: 100px;     /* 内容高度 */
  padding: 16px;     /* 四个方向的内边距 */
  border: 2px solid black;  /* 边框 */
  margin: 10px;      /* 四个方向的外边距 */
}
```

**padding vs margin 的区别**（这是初学者最困惑的）：
- `padding` 是**盒子内部**的留白——比如按钮里文字和边框之间的空隙。
- `margin` 是**盒子外部**的距离——比如两个段落之间的空行。

### 4.1 必加的一条"保命"样式

默认情况下，`width: 200px` 指的是**内容**宽，实际占地 = `width + padding + border`。结果你设了 `width: 200px; padding: 20px;`，实测是 240px，很反直觉。

解法：几乎所有现代项目都在最开头写：

```css
*, *::before, *::after { box-sizing: border-box; }
```

这行让 `width` 包含 padding 和 border。你设 200px 就是 200px，所见即所得。**本章后面所有例子都假设你加了这一行。**

### 4.2 四个方向单独设

```css
.box {
  padding-top: 10px;
  padding-right: 20px;
  padding-bottom: 10px;
  padding-left: 20px;
  /* 等价于简写： */
  padding: 10px 20px 10px 20px;   /* 上 右 下 左 */
  padding: 10px 20px;              /* 上下10 左右20 */
  padding: 10px;                   /* 四边都10 */
}
```

`margin` 和 `border` 也是同样的简写规则。

**动手试试 ④**：画一个 200x200 的盒子，背景灰色，内边距 20px，边框 2px 红色实线，外边距 30px。盒子里放一段文字，观察文字离边框的距离。

## 五、尺寸、颜色、字体

### 5.1 长度单位

| 单位 | 含义 | 什么时候用 |
| --- | --- | --- |
| `px` | 像素（绝对） | 最常用，默认就对 |
| `%` | 相对父元素 | 例如 `width: 50%` 占父宽一半 |
| `rem` | 相对根元素字号 | 做整体缩放（默认 1rem = 16px） |
| `em` | 相对自己父元素字号 | 排版里偶尔用，嵌套容易乱 |
| `vw` / `vh` | 视口 1% 宽 / 1% 高 | 做全屏效果，如 `height: 100vh` |

初学阶段就记住 **`px`** 和 **`%`**，其他用到再说。

### 5.2 颜色

四种写法，效果一样：

```css
color: red;                    /* 颜色名，常用的有 red/blue/white/black 等 */
color: #ff0000;                /* 十六进制：#RRGGBB */
color: #f00;                   /* 三位简写 */
color: rgb(255, 0, 0);         /* 红绿蓝 0-255 */
color: rgba(255, 0, 0, 0.5);   /* 最后是透明度 0-1 */
```

常用参考：
- 白 `#fff` / 黑 `#000` / 灰 `#888`
- 主题蓝 `#4f46e5` / 警告红 `#ef4444` / 成功绿 `#10b981`

### 5.3 字体

```css
body {
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 16px;
  font-weight: 400;       /* 400 普通 / 700 粗 / 900 超粗 */
  line-height: 1.5;       /* 行高，建议 1.4 ~ 1.7 */
  text-align: left;       /* left / center / right / justify */
}
```

`font-family` 可以写多个，用逗号隔开，**前面的找不到就用后面的**。最后一个一般写 `sans-serif`（无衬线通用字体）当兜底。

### 5.4 一个完整的排版示例

```html
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "PingFang SC", sans-serif;
    line-height: 1.6;
    background: #f5f5f7;
    color: #333;
    margin: 0;
    padding: 40px;
  }
  .card {
    background: white;
    max-width: 600px;
    margin: 0 auto;         /* 左右 auto 实现水平居中 */
    padding: 24px;
    border-radius: 12px;    /* 圆角 */
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);  /* 阴影 */
  }
  .card h2 { margin-top: 0; color: #1a1a1a; }
  .card p { color: #666; }
</style>

<div class="card">
  <h2>一个卡片</h2>
  <p>看，一点 CSS 就能让页面不像原始 HTML 那么丑。</p>
</div>
```

把这段替换到 `index.html` 的 `<style>` 和 `<body>` 部分，你会看到一个居中的白色圆角卡片。**这就是现代网页 UI 的基本长相**。

## 六、布局入门：文档流与 display

默认情况下，HTML 元素按**从上到下**（块级）或**从左到右**（行内）排列。这叫"**文档流**"。

- **块级元素**（`<div>`、`<p>`、`<h1>`……）：独占一行，宽度撑满父元素。
- **行内元素**（`<span>`、`<a>`、`<strong>`……）：跟文字一起排，一行能挤多个。

`display` 属性可以改变这个行为：

```css
display: block;         /* 变块级 */
display: inline;        /* 变行内 */
display: inline-block;  /* 行内但能设宽高 */
display: flex;          /* 变成 Flex 容器（下一节讲） */
display: grid;          /* 变成 Grid 容器 */
display: none;          /* 完全隐藏，不占空间 */
```

初学者最常遇到："我给 `<span>` 设 `width: 200px` 怎么没效果？"——因为 `<span>` 默认是 `inline`，不接受宽高。改成 `inline-block` 就行。

## 七、Flexbox：一维布局（最重要的一节）

90% 的网页布局问题用 Flex 就能解决。记住这幅图：

```
容器（display: flex）
┌────────────────────────────────────────────────┐
│  主轴方向 →                                     │
│  ┌─────┐  ┌─────┐  ┌─────┐                    │
│  │ A   │  │ B   │  │ C   │    ↕ 交叉轴        │
│  └─────┘  └─────┘  └─────┘                    │
└────────────────────────────────────────────────┘
       justify-content 控制主轴方向
       align-items 控制交叉轴方向
```

Flex 的核心就两件事：
1. 给**父元素**加 `display: flex`，它就变成"Flex 容器"。
2. 然后用几个属性控制**子元素**怎么排。

### 7.1 一个最小的 Flex 例子

```html
<style>
  .row {
    display: flex;
    gap: 12px;                  /* 子元素之间的间距 */
    background: #eee;
    padding: 10px;
  }
  .row > div {
    background: #4f46e5;
    color: white;
    padding: 20px;
  }
</style>

<div class="row">
  <div>A</div>
  <div>B</div>
  <div>C</div>
</div>
```

三个 `<div>` 原本会各占一行，加了 `display: flex` 后**变成同一行横排**。

### 7.2 四个必须会的容器属性

```css
.container {
  display: flex;

  /* 1. 方向：row 横排（默认）/ column 竖排 */
  flex-direction: row;

  /* 2. 主轴对齐（横排时就是"水平"对齐） */
  justify-content: flex-start;
    /* flex-start 左 | center 中 | flex-end 右 |
       space-between 两端对齐中间平分 |
       space-around 每项两侧均有间距 */

  /* 3. 交叉轴对齐（横排时就是"垂直"对齐） */
  align-items: stretch;
    /* stretch 拉伸撑满 | flex-start 顶 | center 中 | flex-end 底 */

  /* 4. 子元素之间的间距 */
  gap: 12px;
}
```

### 7.3 四个经典需求的标准答案

**需求 1：水平 + 垂直居中**（以前是经典面试题）：

```css
.center {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400px;           /* 要有高度才能垂直居中 */
}
```

```html
<div class="center"><div>我被居中了</div></div>
```

**需求 2：顶部栏，左边标题右边按钮**：

```css
.topbar {
  display: flex;
  justify-content: space-between;   /* 两端对齐 */
  align-items: center;
  padding: 12px 20px;
}
```

```html
<div class="topbar">
  <h1>CloudTone</h1>
  <button>登录</button>
</div>
```

**需求 3：一行三列，中间自适应撑满**：

```css
.row { display: flex; align-items: center; gap: 8px; }
.row > .middle { flex: 1; }    /* 关键：flex: 1 表示占用所有剩余空间 */
```

```html
<div class="row">
  <div>左侧固定</div>
  <div class="middle">中间自适应</div>
  <div>右侧固定</div>
</div>
```

`flex: 1` 是 Flex 里**最常用的子项属性**，含义："**剩余空间都给我**"。多个子项都写 `flex: 1` 就平分。

**需求 4：多行自动换行（标签云）**：

```css
.tags {
  display: flex;
  flex-wrap: wrap;       /* 装不下时换行 */
  gap: 8px;
}
```

### 7.4 Flex 常见坑

- **想垂直居中没成功**？检查容器有没有高度——容器本身如果是内容高，`align-items: center` 看起来没反应。
- **文字长了撑破布局**？给这一列加 `min-width: 0`，否则 Flex 默认不让子项比它的内容更窄。
- **按钮被拉变形**？`align-items` 默认 `stretch`，改成 `flex-start` 或 `center` 即可。

**动手试试 ⑤**：写一个顶部导航栏，左边是 logo 文字，中间是三个菜单项（首页/发现/我的），右边是一个"登录"按钮。用 Flex 实现。

## 八、Grid：二维布局

Flex 只能管一维（要么一行要么一列）。当你要做**二维网格**（比如三栏布局、卡片墙），就用 Grid。

### 8.1 一个最小的 Grid 例子

```html
<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;   /* 三等宽列 */
    gap: 10px;
  }
  .grid > div {
    background: #4f46e5;
    color: white;
    padding: 20px;
    text-align: center;
  }
</style>

<div class="grid">
  <div>1</div><div>2</div><div>3</div>
  <div>4</div><div>5</div><div>6</div>
</div>
```

6 个 div 自动变成 2 行 3 列。

**`fr` 是什么？** Fraction（分数）的缩写，表示"剩余空间的份数"。`1fr 2fr 1fr` 意思是三列宽度比 1:2:1。

### 8.2 常用的三个模板写法

**模板 1：固定骨架（左 240 + 自适应中间 + 右 320）**：

```css
.layout {
  display: grid;
  grid-template-columns: 240px 1fr 320px;
  height: 100vh;     /* 占满整个视口高度 */
}
```

这是 CloudTone 主界面的基础结构。

**模板 2：自适应卡片墙**：

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}
```

一行话理解：**每列最少 180px，能放几列放几列，剩余空间平分**。窗口变宽，自动加列；窗口变窄，自动换行。非常实用。

**模板 3：带名字的区域**（适合复杂布局）：

```css
.app {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: 60px 1fr 80px;
  grid-template-areas:
    "sidebar header"
    "sidebar main"
    "player  player";
  height: 100vh;
}
.sidebar { grid-area: sidebar; }
.header  { grid-area: header; }
.main    { grid-area: main; }
.player  { grid-area: player; }
```

用 `grid-template-areas` 画出整个布局的"平面图"，再把每个元素 `grid-area` 指到对应格子。**可读性很强**。

### 8.3 Grid 和 Flex 什么时候用哪个？

- **一维、内容驱动** → Flex（导航栏、按钮组、小列表）。
- **二维、整体骨架** → Grid（整页布局、卡片墙）。
- **实际项目通常嵌套**：大骨架用 Grid，每个区块内部再用 Flex。

**动手试试 ⑥**：写一个个人主页骨架：顶部 60px 是页眉，左边 200px 是导航，右边剩余空间是内容区。用 Grid 实现。

## 九、Position：自由定位与层叠

`position` 属性控制元素**是否脱离文档流**。

```css
position: static;    /* 默认，按文档流排 */
position: relative;  /* 相对自己原位偏移，但仍然占原位 */
position: absolute;  /* 脱离文档流，相对最近的"有定位"的祖先 */
position: fixed;     /* 固定在屏幕上，滚动也不动 */
position: sticky;    /* 滚到一定位置后吸住 */
```

### 9.1 最常见用法：右上角的关闭按钮

```html
<style>
  .dialog {
    position: relative;       /* 让自己成为"定位参照物" */
    width: 300px;
    padding: 20px;
    background: white;
    border: 1px solid #ddd;
  }
  .close {
    position: absolute;       /* 相对 .dialog 定位 */
    top: 8px;
    right: 8px;
  }
</style>

<div class="dialog">
  <button class="close">×</button>
  <p>这是一个对话框</p>
</div>
```

**关键规则**：想让子元素 `position: absolute` 相对某个父元素定位，**父元素必须有 `position: relative`**（或其他非 static 值）。

### 9.2 z-index：谁盖在谁上面

```css
.overlay { position: fixed; z-index: 100; }
.modal { position: fixed; z-index: 200; }   /* modal 在 overlay 上层 */
```

`z-index` 只对**非 static 定位**的元素有效。数字大的在上面。

## 十、过渡与动画

鼠标悬停时让按钮颜色渐变，而不是瞬间跳变——这叫"过渡"（transition）。

```css
.btn {
  background: #4f46e5;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  transition: background 200ms ease, transform 200ms ease;
  /* 对这两个属性的变化，持续 200ms，缓动曲线 ease */
}
.btn:hover {
  background: #6366f1;
  transform: scale(1.05);     /* 鼠标悬停时放大 5% */
}
```

`transform` 能做放大、旋转、平移，且**不会引起重新布局**，性能最好：

```css
transform: scale(1.2);              /* 放大到 1.2 倍 */
transform: rotate(45deg);           /* 旋转 45 度 */
transform: translateX(10px);        /* 水平移动 */
transform: scale(1.05) rotate(3deg);/* 组合多个 */
```

循环动画用 `@keyframes`：

```css
@keyframes spin {
  from { transform: rotate(0); }
  to   { transform: rotate(360deg); }
}
.loading-icon {
  animation: spin 1s linear infinite;
}
```

`infinite` 表示无限循环，这就是加载转圈圈。

## 十一、响应式：适配不同宽度

窗口宽度不同，布局也应该变。用 `@media`：

```css
.sidebar { width: 240px; }

@media (max-width: 1024px) {         /* 屏幕宽 ≤ 1024 时 */
  .sidebar { width: 56px; }          /* 侧栏折叠成图标条 */
}

@media (max-width: 768px) {          /* 更窄时 */
  .sidebar { display: none; }        /* 直接隐藏 */
}
```

**跟随系统暗色主题**：

```css
@media (prefers-color-scheme: dark) {
  body { background: #1a1a1a; color: #eee; }
}
```

## 十二、CSS 变量：一处改，处处变

```css
:root {
  --brand: #4f46e5;
  --bg: #f5f5f7;
  --radius: 8px;
}

.btn {
  background: var(--brand);
  border-radius: var(--radius);
}
.card {
  background: var(--bg);
  border-radius: var(--radius);
}
```

`--xxx` 就是自定义变量，`var(--xxx)` 取值。改 `:root` 里一个值，所有用到的地方都跟着变。**这是现代主题系统的基础**。

切换主题：

```css
:root { --bg: #fff; --fg: #000; }
.theme-dark { --bg: #1a1a1a; --fg: #eee; }
```

```js
document.body.classList.toggle("theme-dark");
```

## 十三、实战：CloudTone 主界面骨架

把前面学的东西组合起来，这就是 CloudTone 的界面骨架：

```html
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "PingFang SC", sans-serif; }

  :root {
    --bg: #0f0f14;
    --fg: #f2f2f7;
    --panel: #1a1a22;
    --accent: #4f46e5;
  }

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

  .sidebar  { grid-area: sidebar;  background: var(--panel); padding: 16px; overflow-y: auto; }
  .titlebar { grid-area: titlebar; border-bottom: 1px solid #ffffff10; display: flex; align-items: center; padding: 0 16px; }
  .content  { grid-area: content;  padding: 24px; overflow-y: auto; }
  .panel    { grid-area: panel;    background: var(--panel); padding: 16px; overflow-y: auto; }
  .player   { grid-area: player;   background: var(--panel); border-top: 1px solid #ffffff10; display: flex; align-items: center; padding: 0 16px; gap: 16px; }

  /* 窄屏：侧栏变图标条，右侧面板隐藏 */
  @media (max-width: 1024px) {
    .shell {
      grid-template-columns: 56px 1fr 0;
      grid-template-areas:
        "sidebar titlebar titlebar"
        "sidebar content  content"
        "player  player   player";
    }
    .panel { display: none; }
  }
</style>

<div class="shell">
  <aside class="sidebar">导航</aside>
  <header class="titlebar">CloudTone</header>
  <main class="content">主内容区</main>
  <aside class="panel">右侧面板</aside>
  <footer class="player">播放器</footer>
</div>
```

把它存成 `index.html` 打开，拖拽窗口大小观察变化。**你已经写出了 CloudTone 主界面的骨架**。

## 十四、调试 CSS 的方法论

当样式不符合预期，**打开浏览器开发者工具**（F12 或右键 → 检查）：

1. **Elements 面板**：点任一元素，右边显示它命中的所有 CSS 规则。**被划掉的**就是被覆盖了。
2. **Computed 面板**：显示最终生效的值，不管来自哪条规则。
3. **Box Model 图**：显示这个元素真实的 margin/border/padding/content 尺寸。
4. **临时加样式**：可以直接在右边面板改数字看效果，不用回编辑器。

排查技巧：

- 拿不准元素边界 → 加 `outline: 1px solid red`（不占空间，不影响布局）。
- 层级不对 → 检查 `position`、`z-index`、有没有父元素 `transform` 创建新层叠上下文。
- Flex 子项被挤压 → 加 `flex-shrink: 0` 或 `min-width: 0`。

## 十五、语义化与可访问性（简介）

写"差不多能看"的页面用 `<div>` 就够。但正式项目建议：

- 顶部用 `<header>`，导航用 `<nav>`，主要内容用 `<main>`，侧栏 `<aside>`，底部 `<footer>`。
- 按钮一定用 `<button>`，不要用"可点击的 `<div>`"——前者键盘 Tab 能聚焦、Enter/Space 能触发，后者什么都没有。
- 图标按钮加 `aria-label`：`<button aria-label="播放">▶</button>`。
- 图片写 `alt`：`<img src="cover.jpg" alt="专辑封面：起风了" />`，装饰图写空的 `alt=""`。

这些是给屏幕阅读器用户和搜索引擎看的，**不影响视觉效果但极大提升体验和可维护性**。

## 十六、常见陷阱速查

- `width: 100%` + `padding` 会超出父宽 → **一定要加** `box-sizing: border-box`。
- 垂直居中失败 → 父容器没高度，或者忘了 `align-items: center`。
- `position: absolute` 定位不对 → 父元素没 `position: relative`。
- `z-index` 无效 → 那个元素必须是 `position` 非 static。
- margin 上下不叠加 → 叫"**margin 折叠**"，相邻垂直 margin 取较大值，是正常行为；用 padding 或 Flex 容器可避免。
- 滚动条一直不出现 → 容器必须有**固定高度**，`overflow: auto` 才会生效。

## 本章小结

- HTML = 页面**结构**（标签 + 嵌套 + 属性）。
- CSS = 页面**外观**（选择器 + 盒模型 + 布局 + 主题）。
- 布局三把斧：**文档流**处理简单情况、**Flex** 解决一维、**Grid** 解决二维。
- 调试靠开发者工具 Elements 面板。

**建议练习**：把本章每个"动手试试"都亲手敲一遍，再把第十三节的 CloudTone 骨架抄一遍。抄完你就有了独立实现任何 UI 界面的能力。

下一章进入 **JavaScript**——让页面真正"动起来"。
