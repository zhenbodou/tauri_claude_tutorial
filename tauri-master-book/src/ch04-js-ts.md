# 第 4 章 JavaScript 与 TypeScript 深度指南

> 本章目标：从"能看懂"升级到"能设计"。每节都带着 Rust 视角对照讲，让你少走弯路。读完能在 TypeScript 里游刃有余地描述任何领域模型，并看透 React 源码里那些奇怪的类型签名。

## 本章目标

- JavaScript：类型语义、对象与函数、闭包、this、迭代器、异步与事件循环、模块、错误处理。
- TypeScript：基础 + 进阶类型系统（条件、映射、模板字面量、`infer`、`satisfies`）、推断与收窄、工程化。
- 从"写出来能跑"到"写出来类型永远对、重构永远安全"。

## 一、JavaScript 的心智模型

JavaScript 是**单线程 + 事件循环 + 动态类型**的语言。值分两大类：**原始值**（primitives）和**对象引用**。

```js
const a = 1;        // primitive
const b = a;        // 复制值
const o = { x: 1 }; // reference
const p = o;        // 复制引用，o 和 p 指向同一个对象
p.x = 2;            // o.x 也是 2
```

Rust 工程师务必记住：**JS 所有对象默认都是引用语义**，你把一个对象"传给函数"其实是传引用。纯函数化要自己 `{...obj}` 或用 Immer。

原始类型：`number`、`string`、`boolean`、`null`、`undefined`、`symbol`、`bigint`。其它都是对象。

### 1.1 `null` vs `undefined`

- `undefined`：系统给的"没值"（未赋值变量、函数无返回、对象没这个字段）。
- `null`：你主动赋的"空"。

现代 TS 项目里，大多数地方都用 `undefined`，只有 API 约定需要时（比如 JSON 里的 `null`）才用 `null`。TS 的 `strictNullChecks` 会让两者都显式化。

### 1.2 相等比较

- `===` / `!==`：严格相等。优先用它。
- `==` / `!=`：会做类型强制转换。几乎永远别用。
- `Object.is(a, b)`：跟 `===` 很像，区别是 `Object.is(NaN, NaN) === true` 且 `Object.is(0, -0) === false`。React 内部用它判断 state 是否变化。

### 1.3 类型转换暗礁

```js
Number("");        // 0
Number(" ");       // 0
Number("12abc");   // NaN
Boolean("");       // false
Boolean("false");  // true（非空字符串都真）
Boolean(0);        // false
[] + [];           // ""
[] + {};           // "[object Object]"
```

JS 的"趣味代码"大部分来自这里。写业务代码别依赖这些默认行为，显式转换：`Number(x)`、`String(x)`、`Boolean(x)`、`!!x`。

## 二、变量、作用域、闭包

### 2.1 `var` / `let` / `const`

- `var`：函数作用域，有 hoisting（声明提升）。**别用**。
- `let`：块作用域，有 TDZ（暂时性死区）。
- `const`：块作用域，且不能重新绑定（但对象内部可变）。

```js
{
  let x = 1;
  const y = { a: 1 };
}
// x, y 都不可见
```

### 2.2 Hoisting 与 TDZ

```js
console.log(foo); // ReferenceError（TDZ）
let foo = 1;

console.log(bar); // undefined（var 被 hoist）
var bar = 1;

hi();             // 正常执行（函数声明整体 hoist）
function hi() { console.log("hi"); }
```

### 2.3 闭包

内层函数"记住"外层变量，即使外层函数已经返回。这是 JS 模块化和状态封装的基石：

```js
function counter() {
  let n = 0;
  return { inc: () => ++n, get: () => n };
}
const c = counter();
c.inc(); c.get(); // 1
```

React 的"闭包陷阱"就是它在帮倒忙：

```js
useEffect(() => {
  const id = setInterval(() => setCount(count + 1), 1000);
  return () => clearInterval(id);
}, []);
// 这里的 count 永远是 mount 那一刻的值（0）
```

解决：用函数式更新 `setCount(c => c + 1)`，或把 `count` 放进依赖。

## 三、对象、类、原型

### 3.1 字面量与解构

```js
const song = { id: 1, title: "起风了", artist: { name: "买辣椒" } };

// 解构 + 重命名 + 默认值
const { id, title: t, artist: { name } = { name: "匿名" } } = song;
```

### 3.2 Spread & Rest

```js
const a = { x: 1 };
const b = { ...a, y: 2 };     // 浅拷贝 + 扩展

function f(first, ...rest) {} // rest 参数
f(1, 2, 3);                   // rest = [2, 3]
```

**浅拷贝** 只拷一层，嵌套对象仍共享引用。深拷贝用 `structuredClone(obj)`（现代浏览器/Node 原生）。

### 3.3 类

```js
class Player {
  #audio;              // 私有字段，# 前缀
  static maxVolume = 100;
  constructor(src) { this.#audio = new Audio(src); }
  play() { this.#audio.play(); }
  get duration() { return this.#audio.duration; }
  set volume(v) { this.#audio.volume = v; }
}
```

现代 JS 类已经够用，继承、static、getter/setter、private 一应俱全。但 React 里几乎不用 class，全是函数式。

### 3.4 原型链（了解即可）

`instance.__proto__ === Class.prototype`。方法查找顺序：自己 → `__proto__` → …  → `Object.prototype`。日常不用关心，读老代码时要认识 `Object.create`、`Object.getPrototypeOf`。

### 3.5 `this` 的 4 种绑定

```js
fn()            // 默认：严格模式 undefined，松散模式全局
obj.fn()        // 隐式：this = obj
fn.call(ctx)    // 显式：this = ctx
new Fn()        // 构造：this = 新对象
```

箭头函数**没有自己的 this**，继承词法作用域的 this。这是它在回调里不翻车的根本原因：

```js
button.addEventListener("click", () => {
  this.state; // 拿到外部 this（比如 React 组件实例）
});
```

## 四、函数的各种形态

```js
function add(a, b) { return a + b; }       // 声明
const add2 = function(a, b) { return a + b; }; // 表达式
const add3 = (a, b) => a + b;               // 箭头
const add4 = (a, b = 0) => a + b;           // 默认参数
function sum(...nums) { return nums.reduce((a,b)=>a+b, 0); } // rest
function parse(obj = {}) { const { a, b = 1 } = obj; }       // 参数解构
```

**一等公民**：函数可以作为参数传递、作为返回值、存在变量里。整个 React 就是"把 UI 函数传给 React 调用"。

### 4.1 常用数组方法（必须熟）

```ts
arr.length; arr[i]; arr.at(-1);  // at 支持负索引
arr.push(x); arr.pop();          // 尾部
arr.unshift(x); arr.shift();     // 头部
arr.indexOf(x); arr.includes(x);
arr.slice(1, 3);                 // 截取（不改原）
arr.splice(1, 2, "new");         // 修改原数组
arr.concat(b);                   // 合并
arr.join("-"); "a-b-c".split("-");
arr.map(f); arr.filter(f); arr.reduce(f, init);
arr.find(f); arr.findIndex(f); arr.findLast(f);
arr.some(f); arr.every(f);
arr.flat(depth); arr.flatMap(f);
arr.sort((a,b) => a-b);          // in-place！
arr.toSorted((a,b) => a-b);      // 不改原的新 API
arr.reverse(); arr.toReversed();
arr.fill(0, 1, 3);
Array.from({ length: 5 }, (_, i) => i); // 0..4
```

### 4.2 对象工具

```ts
Object.keys(o); Object.values(o); Object.entries(o);
Object.fromEntries(entries);
Object.assign({}, a, b);        // 等价 { ...a, ...b }
Object.freeze(o);               // 浅冻结
Object.hasOwn(o, "k");          // 替代 o.hasOwnProperty
structuredClone(o);             // 深拷贝
```

### 4.3 Map / Set / WeakMap / WeakSet

```ts
const m = new Map<string, number>();
m.set("a", 1); m.get("a"); m.has("a"); m.delete("a");
for (const [k, v] of m) { }

const s = new Set<number>();
s.add(1); s.has(1); s.delete(1); s.size;

// Weak 系列：key 被 GC 时自动删除，不能遍历
const wm = new WeakMap<object, MetaData>();
```

Map 比 Object 更适合键是动态/非字符串、需要保持插入顺序和已知大小的场景。

## 五、异步：Promise、async/await、事件循环

### 5.1 事件循环基本

JS 是单线程，但"不阻塞"是因为同步代码跑完后，**event loop** 会从 task 队列里挑任务执行。大体有两类：

- **宏任务（macro task）**：`setTimeout`、I/O、消息事件、`setImmediate`（Node）。
- **微任务（micro task）**：Promise 回调、`queueMicrotask`、`MutationObserver`。

一轮宏任务执行完，**把所有微任务清空**，再渲染，再进下一轮宏任务。典型题目：

```js
console.log(1);
setTimeout(() => console.log(2), 0);
Promise.resolve().then(() => console.log(3));
console.log(4);
// 输出：1 4 3 2
```

### 5.2 Promise

```js
const p = new Promise((resolve, reject) => {
  setTimeout(() => resolve(42), 100);
});
p.then(v => v + 1).then(console.log).catch(console.error).finally(() => console.log("done"));
```

组合：

```js
Promise.all([p1, p2, p3]);         // 全部成功才 resolve，有一个 reject 全部 reject
Promise.allSettled([p1, p2, p3]);  // 等所有结算，无论成败
Promise.race([p1, p2, p3]);        // 第一个结算的赢
Promise.any([p1, p2, p3]);         // 第一个成功的赢，全失败才 AggregateError
```

### 5.3 async/await

```js
async function load() {
  try {
    const [songs, artists] = await Promise.all([fetchSongs(), fetchArtists()]);
    return { songs, artists };
  } catch (e) {
    console.error(e);
    throw e;
  }
}
```

等价于 Promise 链，但可读性高得多。两个常犯错误：

1. **串行化**：`const a = await f(); const b = await g();` 会串行，除非真有依赖，否则用 `Promise.all`。
2. **遗漏错误**：`async` 函数中未捕获的 `throw` 会变成 rejected Promise，必须有 `.catch` 或上层 `await try/catch`。

### 5.4 并发模式

```ts
// 限流并发（类似 Rust 的 Semaphore）
async function mapLimit<T, R>(items: T[], limit: number, f: (t: T) => Promise<R>): Promise<R[]> {
  const ret: R[] = [];
  const executing = new Set<Promise<void>>();
  for (const it of items) {
    const p = (async () => { ret.push(await f(it)); })();
    executing.add(p); p.finally(() => executing.delete(p));
    if (executing.size >= limit) await Promise.race(executing);
  }
  await Promise.all(executing);
  return ret;
}
```

### 5.5 AbortController

现代 API 的标准"取消"手段：

```js
const ac = new AbortController();
fetch(url, { signal: ac.signal });
setTimeout(() => ac.abort(), 5000); // 5 秒超时
```

React Query、TanStack Query 都用它做自动取消。写 API 层请把 signal 透传到 fetch。

## 六、错误处理

```js
try { risky(); } catch (e) {
  if (e instanceof TypeError) { /* ... */ }
  console.error(e);
  throw new Error("failed", { cause: e }); // cause 保留原因
} finally { cleanup(); }
```

自定义错误：

```js
class NetworkError extends Error {
  constructor(msg, status) { super(msg); this.name = "NetworkError"; this.status = status; }
}
```

**never return in finally**：在 `finally` 里 return 会吞掉 try 的返回/异常，常见事故。

## 七、模块：ESM 是唯一答案

```js
// utils.ts
export const PI = 3.14;
export function area(r) { return PI * r * r; }
export default function hello() { return "hi"; }

// main.ts
import hello, { PI, area } from "./utils";
import * as utils from "./utils";
import("./lazy").then(mod => mod.run()); // 动态导入
```

CJS (`require`) 在 Tauri 前端基本不会遇到。Node 后端世界里仍可能见到，兼容手段多但都脏。

## 八、TypeScript 大全

### 8.1 基础类型

```ts
let s: string = "a";
let n: number = 1;
let b: boolean = true;
let u: undefined = undefined;
let nil: null = null;
let anyVal: any;       // 逃生舱，能避则避
let unk: unknown;      // 必须先 narrow 才能用
let never: never;      // 不可能出现的值（用于穷尽性检查）
let arr: number[] = [1]; let arr2: Array<number> = [1];
let tup: [string, number] = ["a", 1];
let fn: (a: number) => number = x => x + 1;
```

### 8.2 接口 vs 类型别名

```ts
interface Song { id: number; title: string; }
// 扩展
interface Song { path: string; }        // 声明合并！
interface LikedSong extends Song { liked: true }

type SongT = { id: number; title: string; };
type SongT2 = SongT & { path: string };  // 用 & 交叉
// 不能再次声明 SongT（无合并）
```

通常：描述对象 → `interface`；描述 union / 复杂组合 → `type`。

### 8.3 联合、交叉、字面量

```ts
type Status = "idle" | "loading" | "success" | "error";
type Id = number | string;

type Full = { a: number } & { b: string }; // 交叉

type Theme = "light" | "dark" | `${"zh" | "en"}-${"cn" | "us"}`; // 模板字面量
```

### 8.4 泛型

```ts
function first<T>(arr: T[]): T | undefined { return arr[0]; }

// 约束
function lengthy<T extends { length: number }>(x: T) { return x.length; }

// 多参 + 默认
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

// 类泛型
class Store<T> { private items: T[] = []; add(x: T) { this.items.push(x); } }
```

### 8.5 类型守卫与 narrowing

TypeScript 会根据控制流自动收窄：

```ts
function f(x: string | number) {
  if (typeof x === "string") { x.toUpperCase(); }   // 已收窄为 string
  else { x.toFixed(2); }
}

function isSong(x: unknown): x is Song {
  return typeof x === "object" && x !== null && "title" in x;
}

// 判别联合（discriminated union）最佳实践
type Msg = { kind: "play"; id: number } | { kind: "pause" } | { kind: "seek"; pos: number };
function handle(m: Msg) {
  switch (m.kind) {
    case "play": return m.id;
    case "pause": return;
    case "seek": return m.pos;
    default: { const _exhaust: never = m; return _exhaust; } // 穷尽性检查
  }
}
```

**穷尽性检查**是 TS 替代 Rust `match` 的最佳实践——新增 kind 忘处理时会编译失败。

### 8.6 工具类型（必须会）

```ts
Partial<T>      // 所有字段可选
Required<T>     // 所有字段必选
Readonly<T>     // 所有字段只读
Pick<T, K>      // 挑几个字段
Omit<T, K>      // 去掉几个字段
Record<K, V>    // 键值对象
Exclude<T, U>   // union 里排除
Extract<T, U>   // union 里保留
NonNullable<T>  // 去掉 null/undefined
Parameters<F>   // 函数参数元组
ReturnType<F>   // 返回值类型
Awaited<P>      // Promise<T> 里的 T
```

### 8.7 映射与条件类型（进阶）

```ts
// 把所有字段变可选
type Partial<T> = { [K in keyof T]?: T[K] };

// 条件类型
type IsString<T> = T extends string ? true : false;
type A = IsString<"hello">;  // true
type B = IsString<123>;      // false

// infer 推断
type ElementOf<T> = T extends (infer U)[] ? U : never;
type Item = ElementOf<number[]>; // number

// 递归：把 API 响应里所有字段变只读
type DeepReadonly<T> = { readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K] };
```

### 8.8 模板字面量类型

```ts
type EventName<T extends string> = `on${Capitalize<T>}`;
type Y = EventName<"click">; // "onClick"

type CssVar = `--${string}`;
```

### 8.9 `satisfies` 与 `as const`

```ts
const routes = {
  home: "/",
  search: "/search",
} as const;
type Route = typeof routes[keyof typeof routes]; // "/" | "/search"

const config = { host: "localhost", port: 3000 } satisfies ServerConfig;
// satisfies 检查是否合法，同时保留具体字面量类型
```

两者经常一起用来拿"字面量 + 类型检查"。

### 8.10 assertion function

```ts
function assert(cond: unknown, msg?: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function parseSong(x: unknown): Song {
  assert(typeof x === "object" && x, "not object");
  assert("title" in x, "no title");
  return x as Song;
}
```

### 8.11 declare / 环境声明

全局变量、第三方库缺声明时用：

```ts
// env.d.ts
declare const __APP_VERSION__: string;
declare module "*.png" { const src: string; export default src; }
interface ImportMetaEnv { VITE_API_URL: string; }
```

Vite 项目里 `import.meta.env.VITE_API_URL` 的类型就靠它。

### 8.12 类型推断的陷阱

```ts
const songs = []; // any[]！
songs.push({ id: 1 });

// 明确类型
const songs: Song[] = [];
// 或
const songs = [] as Song[]; // 不推荐，用 const assertion 时可能过宽
```

函数返回值尽量不显式标注，让 TS 推断；参数类型必须显式。

### 8.13 TS 工程化

`tsconfig.json` 关键开关：

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,                     // 打开所有严格检查
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noUncheckedIndexedAccess": true,   // arr[i] 类型变 T | undefined，防空读
    "exactOptionalPropertyTypes": true, // optional 不能显式赋 undefined
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,            // Vite 需要
    "skipLibCheck": true,
    "paths": { "@/*": ["src/*"] }
  }
}
```

每一项都有真实价值。尤其 `noUncheckedIndexedAccess`，能把一类难以发现的 undefined 读错暴露在编译期。

## 九、Rust ↔ TypeScript 对照表（加长版）

| 概念 | Rust | TypeScript |
| --- | --- | --- |
| 绑定 | `let x = 1; let mut y = 2;` | `const x = 1; let y = 2;` |
| 结构体 | `struct S { a: i32 }` | `interface S { a: number }` |
| 枚举(无字段) | `enum E { A, B }` | `type E = "a" \| "b"` 或 `enum E {}`（少用） |
| 枚举(带字段) | `enum E { A(i32), B{x: i32} }` | 判别联合 `{ kind: "a"; v: number } \| { kind: "b"; x: number }` |
| Option | `Option<T>` | `T \| undefined` |
| Result | `Result<T, E>` | `{ ok: true; v: T } \| { ok: false; e: E }` |
| Trait | `trait Foo {}` | `interface Foo {}`（结构化） |
| 泛型约束 | `<T: Trait>` | `<T extends I>` |
| 生命周期 | `'a` | 无（GC） |
| Send/Sync | 并发标记 | 无（单线程）/ Worker 用 structuredClone |
| match 穷尽 | `match` 必穷尽 | switch + `never` 默认分支 |
| `?` 传播错误 | `v?` | 手动 `try/catch` 或 `neverthrow` 库 |
| unsafe | `unsafe {}` | `as any` / `// @ts-ignore` |

## 十、实战小题

### 10.1 防抖 / 节流

```ts
export function debounce<F extends (...args: any[]) => void>(fn: F, ms: number) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function throttle<F extends (...args: any[]) => void>(fn: F, ms: number) {
  let last = 0;
  return (...args: Parameters<F>) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
  };
}
```

### 10.2 类型安全的事件总线

```ts
type Events = {
  "player:play": { songId: number };
  "player:pause": void;
  "library:updated": { count: number };
};

class Bus<E extends Record<string, any>> {
  private m = new Map<keyof E, Set<(p: any) => void>>();
  on<K extends keyof E>(k: K, h: (p: E[K]) => void) {
    if (!this.m.has(k)) this.m.set(k, new Set());
    this.m.get(k)!.add(h);
    return () => this.m.get(k)!.delete(h);
  }
  emit<K extends keyof E>(k: K, ...args: E[K] extends void ? [] : [E[K]]) {
    this.m.get(k)?.forEach(h => h(args[0]));
  }
}

const bus = new Bus<Events>();
bus.on("player:play", p => p.songId); // 类型精确
bus.emit("player:pause");              // 无参数 OK
bus.emit("player:play", { songId: 1 });
```

### 10.3 解析 URL 查询参数（类型化）

```ts
function parseQuery<T extends Record<string, string>>(url: string): Partial<T> {
  const u = new URL(url);
  const out: Record<string, string> = {};
  u.searchParams.forEach((v, k) => (out[k] = v));
  return out as Partial<T>;
}
```

## 十一、常见陷阱清单

- `JSON.parse(JSON.stringify(x))` 会丢 Date、Map、undefined、函数。用 `structuredClone`。
- `sort` **原地**排序且默认按字符串比较，数字要写 `(a,b)=>a-b`。
- `typeof null === "object"`（JS 历史遗留）。
- `for...in` 遍历对象 key，`for...of` 遍历 iterable（数组、Map、Set、字符串）。
- 数字精度：`0.1 + 0.2 !== 0.3`。货币用 cents 整数；大 ID 用 bigint 或 string（注意 Rust 的 `u64` 在 JSON 里超过 2^53 会丢精度）。
- `Array.from({ length: n })` 拿到稀疏数组；`[...Array(n)]` 也一样；用 `Array.from({ length: n }, (_, i) => i)` 初始化。
- `typeof undeclaredVar === "undefined"` 合法，但读未声明变量会 ReferenceError（TDZ）。
- `this` 在 `setTimeout(fn)` 回调里会丢（除非用箭头）。
- `async` 函数的 `return Promise.reject(x)` 和 `throw x` 一样效果。

## 本章小结

- JavaScript 的值语义、引用语义、闭包、事件循环，是写任何前端代码的基础心智模型。
- TypeScript 的"判别联合 + 穷尽性 + 工具类型 + 模板字面量 + infer" 这些组合起来，能描述几乎所有领域模型。
- 严格的 tsconfig 是帮你省 bug 的朋友。

下一章，我们进入 React 的完整心智模型。
