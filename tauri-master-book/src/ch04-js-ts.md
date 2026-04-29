# 第 4 章 JavaScript 与 TypeScript（从零开始）

> **本章继续假设你没基础**。HTML 给了页面骨架，CSS 给了外观，这一章的 JavaScript 负责让页面**会响应**——点击按钮弹窗、输入搜索词过滤结果、拖进度条改音量。没有 JS 的网页就是一张贴纸。本章末尾会引入 TypeScript，它只是"**给 JS 加上类型检查**"，避免一类粗心错误。

## 零、先问几个问题

**JavaScript 在哪里运行？**
- 浏览器里（包括 Tauri 的 WebView 窗口）——操作页面、发网络请求。
- Node.js 里（服务器或命令行工具）——读写文件、启 HTTP 服务。

本书只关心浏览器里的 JS（Tauri 前端就是这个场景）。

**怎么最快试一段 JS？**
打开任意浏览器，按 **F12** 打开开发者工具，切到 **Console（控制台）** 标签。里面就能直接输入一行 JS 按回车执行：

```js
console.log("Hello");       // 控制台打印 "Hello"
1 + 2                        // 回显 3
Math.random()                // 回显一个 0~1 的随机数
```

**或者**在 HTML 里这样写，一行代码验证：

```html
<!doctype html>
<html>
  <body>
    <h1 id="title">Hello</h1>
    <button id="btn">点我</button>
    <script>
      document.getElementById("btn").addEventListener("click", () => {
        document.getElementById("title").textContent = "被点到了！";
      });
    </script>
  </body>
</html>
```

**保存，双击打开**。点按钮，标题就变了。这就是 JS 做的事。

## 一、变量：给值起名字

```js
const name = "CloudTone";   // 不会改变的用 const
let count = 0;              // 可能变化的用 let
count = count + 1;          // 可以重新赋值

// const name = "别的";     // 报错：const 不能改
```

- `const` = constant（常量），**不能再次赋值**。默认都用它。
- `let` = 可以再次赋值。确实需要变化时才用。
- **别用 `var`**，是老语法，有各种坑。

**命名规则**：用英文字母、数字、下划线、`$`，但**不能以数字开头**。习惯用 `小驼峰` 风格：`userName`、`playCount`、`isLoading`。

## 二、基本数据类型

JS 里你会频繁用到这 5 种：

```js
const age = 25;                 // 数字（number）
const title = "起风了";         // 字符串（string），单双引号都行
const isPlaying = true;         // 布尔（boolean），只有 true / false
const nothing = null;           // "明确的空"
let u;                          // undefined，"还没赋值"
```

**字符串的模板语法**（比加号拼接好用 10 倍）：

```js
const name = "小明";
const age = 18;

// 老写法
const msg1 = "我叫" + name + "，今年" + age + "岁";

// 模板字符串（用反引号 ` 而不是引号）
const msg2 = `我叫${name}，今年${age}岁`;
```

反引号里 `${}` 中可以放**任何表达式**：

```js
const price = 99;
const text = `总价：${price * 1.1} 元`;
```

## 三、运算符

```js
// 算术
1 + 2   // 3
10 / 3  // 3.333...
10 % 3  // 1   取余数
2 ** 8  // 256 幂

// 比较（返回 true / false）
1 === 1    // true  严格相等，永远用这个
1 === "1"  // false 类型不同
1 !== 2    // true
3 > 2      // true
3 >= 3     // true

// 逻辑
true && false   // false  "和"，都真才真
true || false   // true   "或"，一个真就真
!true           // false  "非"

// 字符串拼接
"a" + "b"       // "ab"
```

**关键规则：永远用 `===` 和 `!==`**，不要用 `==` 和 `!=`。后者会做奇怪的类型转换，比如 `0 == ""` 竟然是 true。

## 四、条件判断

```js
const age = 18;

if (age >= 18) {
  console.log("成年");
} else if (age >= 12) {
  console.log("青少年");
} else {
  console.log("儿童");
}
```

**三元运算符**（if-else 的简写，在 React 里用得非常多）：

```js
const status = age >= 18 ? "成年" : "未成年";
// 等价于：if (age >= 18) status = "成年"; else status = "未成年";
```

**短路语法**（常见简写）：

```js
const name = userName || "匿名";          // userName 为空就用 "匿名"
const len = arr?.length ?? 0;             // arr 可能不存在时取 length，没有就 0
```

- `a || b`：a 是 "假值"（`false`/`0`/`""`/`null`/`undefined`）时取 b。
- `a ?? b`：a 是 `null` 或 `undefined` 时取 b，**空字符串和 0 不算**。
- `obj?.field`：obj 是 null/undefined 时直接返回 undefined，不报错。

## 五、数组：有序列表

```js
const fruits = ["苹果", "香蕉", "橘子"];

fruits[0];          // "苹果"，下标从 0 开始
fruits.length;      // 3
fruits.push("梨");   // 末尾追加
fruits.pop();        // 弹出末尾
fruits.includes("苹果");  // true
```

**最常用的三个数组方法**（React 里天天用）：

```js
const nums = [1, 2, 3, 4];

// map：每个元素做一次变换，得到新数组
const doubled = nums.map(n => n * 2);         // [2, 4, 6, 8]

// filter：只保留满足条件的元素
const evens = nums.filter(n => n % 2 === 0);  // [2, 4]

// find：找第一个满足条件的
const first = nums.find(n => n > 2);          // 3
```

`n => n * 2` 是"**箭头函数**"（下一节讲），先知道它就是个函数。

**遍历数组**：

```js
for (const fruit of fruits) {
  console.log(fruit);
}

// 或者 forEach
fruits.forEach(fruit => console.log(fruit));
```

## 六、对象：带标签的数据

对象是"**一堆键值对**"：

```js
const song = {
  id: 1,
  title: "起风了",
  artist: "买辣椒也用券",
  duration: 321,
  isLiked: true,
};

song.title;       // "起风了"
song.duration;    // 321

song.title = "新标题";   // 修改
song.rating = 5;          // 添加新字段
```

对象可以嵌套：

```js
const user = {
  name: "小明",
  address: {
    city: "北京",
    zip: "100000",
  },
};
user.address.city;    // "北京"
```

**对象数组**（最常见的数据结构）：

```js
const songs = [
  { id: 1, title: "歌曲 A", artist: "歌手甲" },
  { id: 2, title: "歌曲 B", artist: "歌手乙" },
  { id: 3, title: "歌曲 C", artist: "歌手丙" },
];

// 找 ID 为 2 的歌
const song = songs.find(s => s.id === 2);

// 列出所有标题
const titles = songs.map(s => s.title);   // ["歌曲 A", "歌曲 B", "歌曲 C"]

// 过滤出 "歌手甲" 的歌
const filtered = songs.filter(s => s.artist === "歌手甲");
```

**这三个操作**（map、filter、find）将来你会在 React 里每天用几十次。

### 6.1 解构：快速提取字段

```js
const song = { id: 1, title: "起风了", artist: "买辣椒" };

// 老写法
const id = song.id;
const title = song.title;

// 解构（推荐）
const { id, title } = song;
const { artist: singer } = song;   // 顺便重命名
```

数组解构：

```js
const [first, second] = [10, 20, 30];  // first=10, second=20
```

### 6.2 展开运算符 `...`

```js
const a = [1, 2, 3];
const b = [...a, 4, 5];              // [1, 2, 3, 4, 5]

const song1 = { id: 1, title: "A" };
const song2 = { ...song1, title: "B" };  // 复制 + 覆盖 title
// song2 = { id: 1, title: "B" }
```

展开运算符在 React 里做"**不可变更新**"必备。

## 七、函数：可复用的代码块

三种写法，**功能几乎一样**：

```js
// 1. 函数声明
function add(a, b) {
  return a + b;
}

// 2. 函数表达式
const add2 = function(a, b) {
  return a + b;
};

// 3. 箭头函数（推荐，最简洁）
const add3 = (a, b) => a + b;

// 如果函数体多行：
const add4 = (a, b) => {
  const sum = a + b;
  return sum;
};
```

调用方式相同：

```js
add(3, 4);    // 7
add3(3, 4);   // 7
```

**默认参数**：

```js
function greet(name = "朋友") {
  return `你好，${name}`;
}
greet();          // "你好，朋友"
greet("小明");    // "你好，小明"
```

**函数是一等公民**：函数可以存进变量，也可以当参数传给别的函数。这就是为什么 `arr.map(n => n * 2)` 能工作——`map` 接收一个函数参数。

```js
function applyTwice(fn, x) {
  return fn(fn(x));
}
applyTwice(n => n + 1, 5);   // 7，因为 (5+1)+1
```

## 八、DOM 操作：让 JS 控制 HTML

**DOM** 是浏览器给 JS 的"操作界面"——每个 HTML 元素在 JS 里对应一个对象，改这个对象，页面就变。

```html
<h1 id="title">原文字</h1>
<button id="btn">点我</button>
<ul id="list"></ul>

<script>
  // 找元素
  const title = document.getElementById("title");
  const btn = document.getElementById("btn");
  const list = document.getElementById("list");

  // 改内容
  title.textContent = "新文字";

  // 改样式
  title.style.color = "red";
  title.style.fontSize = "30px";

  // 加类
  title.classList.add("active");
  title.classList.remove("active");
  title.classList.toggle("active");

  // 监听点击
  btn.addEventListener("click", () => {
    // 动态生成一个 <li> 加进列表
    const li = document.createElement("li");
    li.textContent = "新的一项 " + Math.random();
    list.appendChild(li);
  });
</script>
```

把上面整段存成 `index.html` 打开，每次点按钮，列表里就多一项。

**这就是"原生 JS 做前端"的全貌**。但你会发现：
- 要精确找到每个元素（`getElementById`）。
- 每次数据变了都要手动改 DOM。
- 数据多了代码很乱。

这正是 React 要解决的问题（下一章）。

### 8.1 其他常用选择方法

```js
document.querySelector("#title");        // 用 CSS 选择器找第一个
document.querySelector(".card");         // 找第一个 class="card" 的
document.querySelectorAll(".card");      // 找所有，返回数组样的东西
```

## 九、事件：响应用户操作

```js
btn.addEventListener("click", (e) => {
  console.log("被点到了");
  console.log("鼠标坐标:", e.clientX, e.clientY);
});

input.addEventListener("input", (e) => {
  console.log("当前输入:", e.target.value);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") console.log("按了 Esc");
});
```

常用事件名：`click`、`input`、`change`、`submit`、`keydown`、`mouseenter`、`mouseleave`、`focus`、`blur`。

## 十、异步：处理"需要等待的事情"

**问题**：从服务器拉数据、读文件、等几秒、动画……这些操作不会立刻完成。JS 是**单线程**的，不能傻等，否则页面就卡死了。

**解法**：回调 → Promise → async/await。现代 JS 基本只用后两种。

### 10.1 先看一个卡住的例子（反例）

```js
console.log("A");
for (let i = 0; i < 1000000000; i++) {} // 跑一秒多
console.log("B");
// 输出：A（卡一下）B
// 这期间页面完全动不了
```

正确的"等一下"用 `setTimeout`：

```js
console.log("A");
setTimeout(() => {
  console.log("B");
}, 1000);                   // 1000 毫秒 = 1 秒后执行
console.log("C");
// 输出：A → C → (1秒后) B
```

**注意顺序**：`setTimeout` 不会阻塞，它说"1 秒后再跑我给你的函数"，JS 继续往下走，所以 C 在 B 之前。

### 10.2 Promise：描述"将来会有的结果"

想象你点外卖：下单那一刻外卖**还没到**，但你知道将来会到（或失败）。这就是 Promise。

```js
// 一个 3 秒后才给出结果的 Promise
const orderFood = new Promise((resolve, reject) => {
  setTimeout(() => {
    const success = Math.random() > 0.2;
    if (success) {
      resolve("外卖到了 🍜");     // 成功：调 resolve
    } else {
      reject("商家取消订单");     // 失败：调 reject
    }
  }, 3000);
});

// 用法
orderFood
  .then(result => console.log("✓", result))
  .catch(err => console.log("✗", err));

console.log("下单完成，继续干别的");
```

`.then(f)` 是"成功时跑 f"，`.catch(f)` 是"失败时跑 f"。

真实世界的例子：`fetch` 就是返回 Promise 的网络请求。

```js
fetch("https://api.github.com/users/torvalds")
  .then(response => response.json())
  .then(data => console.log(data.name))
  .catch(err => console.error(err));
```

### 10.3 async / await：让异步代码像同步一样读

上面的写法链式调用多了会嵌套得很丑。`async`/`await` 是**糖衣**，让代码从上到下读：

```js
async function loadUser() {
  try {
    const response = await fetch("https://api.github.com/users/torvalds");
    const data = await response.json();
    console.log(data.name);
  } catch (err) {
    console.error("出错了:", err);
  }
}

loadUser();
```

**三点必记**：
1. 用 `async` 标记的函数**总是返回 Promise**。
2. `await` 只能在 `async` 函数里用。
3. `await X` 会"**暂停**这个函数"直到 X 出结果。但**不阻塞整个页面**。

**并发多个异步**：

```js
// ❌ 一个一个等（慢）
const songs = await fetchSongs();
const artists = await fetchArtists();

// ✓ 同时发，一起等（快）
const [songs, artists] = await Promise.all([fetchSongs(), fetchArtists()]);
```

### 10.4 一个完整的小例子

```html
<input id="q" placeholder="输入 GitHub 用户名" />
<button id="go">搜</button>
<div id="result"></div>

<script>
  const q = document.getElementById("q");
  const go = document.getElementById("go");
  const result = document.getElementById("result");

  go.addEventListener("click", async () => {
    result.textContent = "加载中...";
    try {
      const res = await fetch(`https://api.github.com/users/${q.value}`);
      if (!res.ok) throw new Error("未找到");
      const data = await res.json();
      result.innerHTML = `<img src="${data.avatar_url}" width="80" /><p>${data.name}</p>`;
    } catch (e) {
      result.textContent = "出错: " + e.message;
    }
  });
</script>
```

**动手试试 ①**：把这段存成 HTML 打开，输入 `torvalds` 点搜索看看。

## 十一、模块化：代码分文件

一个项目几千行代码放一个文件不现实。JS 用 `import` / `export` 拆文件：

```js
// utils.js
export const PI = 3.14;
export function area(r) {
  return PI * r * r;
}

// 默认导出（一个文件最多一个）
export default function hello() {
  return "hi";
}
```

```js
// main.js
import hello, { PI, area } from "./utils.js";

console.log(PI);
console.log(area(5));
console.log(hello());
```

在 HTML 里用模块：

```html
<script type="module" src="./main.js"></script>
```

`type="module"` 是关键。Vite / Tauri 项目里默认都是模块，不用你手动写。

## 十二、TypeScript：给 JS 加类型

### 12.1 为什么需要它

纯 JS 的这种问题特别常见：

```js
function sum(nums) {
  return nums.reduce((a, b) => a + b, 0);
}
sum(5);           // 炸了！5 不是数组，但直到运行才发现
```

TypeScript 让你**在写代码时**就标出类型，编辑器会立即报红：

```ts
function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
sum(5);           // 编辑器直接红线：参数不对
sum([1, 2, 3]);   // ✓
```

### 12.2 基本类型写法

```ts
let name: string = "小明";
let age: number = 18;
let isMember: boolean = true;
let tags: string[] = ["pop", "rock"];     // 字符串数组
let ids: number[] = [1, 2, 3];

// 可能为空
let nickname: string | null = null;
let optional: number | undefined;

// 字面量联合（限定几个值之一）
let status: "idle" | "loading" | "success" | "error" = "idle";
```

**联合类型 `A | B`** 意思是"要么 A 要么 B"。非常常用。

### 12.3 对象类型：用 interface

```ts
interface Song {
  id: number;
  title: string;
  artist: string;
  duration: number;
  isLiked?: boolean;        // 问号表示"可选"
}

const s: Song = {
  id: 1,
  title: "起风了",
  artist: "买辣椒",
  duration: 321,
};
```

`interface` 就是"**这个对象必须长什么样**"的说明。

### 12.4 函数类型

```ts
function add(a: number, b: number): number {
  return a + b;
}

// 箭头函数
const greet = (name: string): string => `你好 ${name}`;

// 返回值可以省，让 TS 自动推断
const mult = (a: number, b: number) => a * b;
```

### 12.5 数组里装对象

```ts
const songs: Song[] = [
  { id: 1, title: "A", artist: "甲", duration: 200 },
  { id: 2, title: "B", artist: "乙", duration: 180 },
];

// map/filter 的类型自动推断
const titles = songs.map(s => s.title);     // string[]
const longOnes = songs.filter(s => s.duration > 190);
```

### 12.6 泛型：参数化类型

如果一个工具"**对任何类型都行**"，用泛型：

```ts
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

first([1, 2, 3]);           // number | undefined
first(["a", "b"]);          // string | undefined
first<Song>([/* ... */]);   // Song | undefined
```

`<T>` 里的 T 就像一个类型参数。调用时 TS 自动填它。

### 12.7 `any` 和 `unknown`

```ts
let x: any;         // 什么都能塞，什么检查都没（逃避类型检查的逃生舱，别滥用）
let y: unknown;     // 什么都能塞，但用之前必须"收窄"到具体类型
```

**尽量别用 `any`**，它等于放弃了 TS 的保护。

### 12.8 `tsconfig.json` 关键开关

项目根目录的 `tsconfig.json` 控制检查严格程度：

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,                    // 打开所有严格检查（必选）
    "noUncheckedIndexedAccess": true,  // arr[i] 可能是 undefined，逼你处理
    "skipLibCheck": true
  }
}
```

`strict: true` 这一个开关就够大部分项目用了。

## 十三、常见陷阱与坑

- **`typeof null === "object"`**：JS 历史遗留 bug，判断 null 要 `x === null`。
- **0.1 + 0.2 !== 0.3**：浮点数精度问题，金额用分为单位存整数。
- **`arr.sort()` 默认按字符串排**：`[10, 2, 1].sort()` 结果是 `[1, 10, 2]`。数字要写 `arr.sort((a,b) => a-b)`。
- **对象是引用**：`const a = { x: 1 }; const b = a; b.x = 2;` 此时 `a.x` 也是 2！要拷贝用 `{ ...a }`。
- **`for...in` 遍历 key，`for...of` 遍历 value**：别搞混。
- **箭头函数没有自己的 `this`**：在回调里想用外层 `this` 时特别好用，这也是推荐它的原因之一。

## 十四、一个综合小项目：TODO 列表

把本章学的全部用上，写一个最简 TODO。新建 `todo.html`：

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; font-family: sans-serif; }
      body { max-width: 400px; margin: 40px auto; padding: 20px; }
      .row { display: flex; gap: 8px; margin-bottom: 16px; }
      .row input { flex: 1; padding: 8px; }
      .row button { padding: 8px 16px; }
      ul { list-style: none; padding: 0; }
      li { display: flex; align-items: center; gap: 8px; padding: 8px; border-bottom: 1px solid #eee; }
      li.done span { text-decoration: line-through; color: #aaa; }
      li button { margin-left: auto; background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; }
    </style>
  </head>
  <body>
    <h1>我的 TODO</h1>
    <div class="row">
      <input id="input" placeholder="要做什么？" />
      <button id="add">添加</button>
    </div>
    <ul id="list"></ul>

    <script>
      const todos = [];

      const input = document.getElementById("input");
      const addBtn = document.getElementById("add");
      const list = document.getElementById("list");

      function render() {
        list.innerHTML = "";
        todos.forEach((todo, idx) => {
          const li = document.createElement("li");
          if (todo.done) li.classList.add("done");

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = todo.done;
          checkbox.addEventListener("change", () => {
            todos[idx].done = checkbox.checked;
            render();
          });

          const span = document.createElement("span");
          span.textContent = todo.text;

          const delBtn = document.createElement("button");
          delBtn.textContent = "删";
          delBtn.addEventListener("click", () => {
            todos.splice(idx, 1);
            render();
          });

          li.appendChild(checkbox);
          li.appendChild(span);
          li.appendChild(delBtn);
          list.appendChild(li);
        });
      }

      addBtn.addEventListener("click", () => {
        const text = input.value.trim();
        if (!text) return;
        todos.push({ text, done: false });
        input.value = "";
        render();
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addBtn.click();
      });
    </script>
  </body>
</html>
```

打开这个文件，你能：输入任务回车添加、勾选打钩、点"删"删除。

**这就是原生 JS 版的 TODO**。注意每次改数据都要手动 `render()`，页面才更新。React 就是来解决这个烦恼的。

## 本章小结

- **变量**：`const`（不变）/ `let`（变）。
- **类型**：number / string / boolean / null / undefined / 数组 / 对象。
- **函数**：三种写法功能相同，推荐箭头函数。
- **数组三件套**：`map` / `filter` / `find`。
- **DOM 操作**：`getElementById` + `addEventListener` 改 `textContent`/`style`/`classList`。
- **异步**：`async`/`await` + `try/catch` 处理网络请求等。
- **模块**：`import` / `export` 拆代码。
- **TypeScript**：给变量、参数、返回值加类型标注，编辑器帮你提前抓错。

下一章：**React**——让你不再手动拼 DOM，用"写 UI = 写函数"的方式高效做界面。
