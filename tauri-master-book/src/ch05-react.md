# 第 5 章 React 精通指南

> 不是"会写组件"就结束，而是"理解 React 为什么这样设计、每个 Hook 适用的边界、怎么避开常见的性能与一致性坑"。读完你能像 React 核心成员一样思考。

## 本章目标

- 心智模型：渲染、reconciliation、Fiber、并发。
- 每个内置 Hook 的用途、陷阱、最佳实践。
- 组件组合模式：受控/非受控、render props、children、compound components、Provider。
- 性能：何时 memo、何时不该 memo；Suspense、Concurrent、useTransition、useDeferredValue。
- 数据加载模式：TanStack Query 为什么流行，怎么融入。
- 错误边界、Portal、Refs、forwardRef、imperative handle。
- 自定义 Hook 的 API 设计。

## 一、React 的三句箴言

1. **UI = f(state)**。组件是"把状态映射到 UI 描述"的纯函数。
2. **渲染是对整棵组件树的重新计算**，React 负责把结果 diff 到 DOM。
3. **状态变化才应该重新渲染**；其它一切（引用相等、父组件重渲）都是优化手段而非正确性保障。

这三句话能让你从"写代码"变成"想明白"。

## 二、从 JSX 到 DOM

### 2.1 JSX 是什么

```jsx
<div className="a" onClick={handler}>hello</div>
```

等价于：

```js
React.createElement("div", { className: "a", onClick: handler }, "hello");
```

它返回的是一个**普通 JS 对象**（React Element），描述"需要一个 div、这些属性、子元素是字符串 hello"。渲染器负责把它变成真实 DOM。

**大小写规则**：首字母小写视为 HTML 标签；大写视为组件变量。`<Play />` 找变量 `Play`，`<play />` 输出 `<play>` 标签。

### 2.2 渲染和提交

React 有两个阶段：

- **Render 阶段**：调用组件函数、计算新的 React 元素树、做 diff。在并发模式下可中断、重做。
- **Commit 阶段**：把变化写入 DOM，跑 `useLayoutEffect`，浏览器 paint，再跑 `useEffect`。

你写的组件函数会在 Render 阶段被调用，所以**必须是纯函数**：同样的 props 和 state → 同样的输出，不能有外部副作用。

### 2.3 Reconciliation / Fiber

同一位置前后两次渲染出的元素，React 会尝试复用 DOM 节点：

- 类型相同（都是 `div`） → 复用 DOM，更新属性。
- 类型不同 → 销毁旧的，新建。
- 列表里 `key` 不同 → 销毁 + 新建。

Fiber 是 React 内部的数据结构，把每次渲染拆成可中断的单元，为"时间切片 / Concurrent Mode"铺路。你不需要直接操作它，但理解"它有优先级、可被高优先级打断"能解释很多行为。

## 三、组件、Props、Children

```tsx
interface BtnProps {
  variant?: "primary" | "ghost";
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}

export function Btn({ variant = "primary", disabled, children, onClick }: BtnProps) {
  return <button disabled={disabled} onClick={onClick} data-variant={variant}>{children}</button>;
}
```

- **props 是只读的**。别直接改 `props.x = ...`。
- **children** 是特殊的 prop，对应标签之间的内容：`<Btn>Hello</Btn>` 里的 `"Hello"`。
- **ReactNode** 涵盖所有合法子类型（string/number/element/array/null/undefined/boolean）。

### 3.1 Children 之外的组合模式

- **Slots**：多个位置接收 ReactNode，比如 `<Layout header={<Header/>} side={<Side/>}>{children}</Layout>`。
- **Render props**：prop 是函数，组件把内部状态传回去渲染：`<Dropdown>{({isOpen}) => <div>{isOpen ? "open" : "closed"}</div>}</Dropdown>`。
- **Compound components**：`<Tabs><Tabs.List/><Tabs.Panel/></Tabs>`，内部用 Context 共享状态。
- **Controlled vs Uncontrolled**：输入组件的状态在外部 / 内部管理。

## 四、内置 Hook 全覆盖

### 4.1 `useState`

```tsx
const [count, setCount] = useState(0);
setCount(1);           // 直接设置
setCount(c => c + 1);  // 函数式更新（推荐在依赖上一个值时）
```

- 初始值只在首次渲染使用。
- 惰性初始：`useState(() => expensiveCompute())`，只会跑一次。
- 相同值（`Object.is`）不会触发重渲。
- **自动批处理**：React 18 起，所有事件、Promise 回调里连续 setState 会合并一次 render。

### 4.2 `useEffect`

```tsx
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, [deps]);
```

- **什么时候跑**：commit 之后、浏览器 paint 之后（异步）。
- **清理函数**：下次执行前、或组件卸载时运行。
- **依赖数组**：省略 → 每次 render 都跑；`[]` → 只在 mount 一次；`[a, b]` → a/b 任一变化时跑。

**严格模式下 Effect 跑两次**：开发环境故意"mount → unmount → mount" 再跑一次，帮你发现未清理的 side effect。不是 bug。生产不会。

常见模式：

```tsx
// 订阅
useEffect(() => {
  const unsub = bus.on("x", handler);
  return unsub;
}, []);

// 异步请求（带取消）
useEffect(() => {
  const ac = new AbortController();
  fetch(url, { signal: ac.signal }).then(setData).catch(e => {
    if (e.name !== "AbortError") throw e;
  });
  return () => ac.abort();
}, [url]);
```

**别在 effect 里做"仅初始化就该知道的事"**：计算 derived state 应该直接在渲染时算，而不是 useState + useEffect 同步。例子：

```tsx
// 错
const [filtered, setFiltered] = useState([]);
useEffect(() => setFiltered(songs.filter(s => s.liked)), [songs]);

// 对
const filtered = songs.filter(s => s.liked); // 或用 useMemo
```

### 4.3 `useLayoutEffect`

签名和 `useEffect` 一样，区别是**同步**在 DOM 更新后、浏览器 paint 前运行。
适用：需要读 DOM 尺寸 + 修改 DOM，避免闪烁。绝大多数业务用 useEffect 即可。

### 4.4 `useMemo` / `useCallback`

```tsx
const sorted = useMemo(() => heavySort(data), [data]);
const handler = useCallback((id: number) => doIt(id), [doIt]);
```

它们只是**引用缓存**。判等依据是依赖数组浅比较。

- 不是"为了性能就必 memo"。memo 本身有开销，过度使用反而慢。
- **真正需要 memo 的三种情况**：
  1. 昂贵计算（几十毫秒级）。
  2. 作为子组件 `memo` 的 props，需要引用稳定。
  3. 放进 `useEffect` 依赖数组需要稳定的引用。

### 4.5 `useRef`

```tsx
const inputRef = useRef<HTMLInputElement>(null);
// 拿 DOM
<input ref={inputRef} />
inputRef.current?.focus();

// 存可变但不触发渲染的值
const countRef = useRef(0);
countRef.current++;
```

两件事别混：改 ref 不会 re-render；ref 值不会在渲染期间被读（除了 ref.current 本身）。

### 4.6 `useContext`

```tsx
const ThemeCtx = createContext<"light" | "dark">("dark");

function A() {
  const theme = useContext(ThemeCtx);
  return <div data-theme={theme} />;
}

<ThemeCtx.Provider value="light"><A/></ThemeCtx.Provider>
```

**Context 陷阱**：任何 Consumer 在 Provider value 变化时都会重渲染。如果你把大对象塞 Context，所有用到它的组件都会频繁 re-render。解决方案：
- 把 Provider 拆小（多个 Context）。
- 用 Zustand / Jotai 等"选择式订阅" 库。

### 4.7 `useReducer`

```tsx
type Action = { type: "inc" } | { type: "set"; value: number };
function reducer(state: number, a: Action) {
  switch (a.type) {
    case "inc": return state + 1;
    case "set": return a.value;
  }
}
const [n, dispatch] = useReducer(reducer, 0);
dispatch({ type: "inc" });
```

状态多且相关时用它。TS 搭配判别联合天然适合。

### 4.8 `useTransition` / `useDeferredValue`（并发特性）

```tsx
const [pending, startTransition] = useTransition();
function onChange(q: string) {
  setInput(q);                                 // 紧急更新（输入框立即响应）
  startTransition(() => setSearchResults(q));   // 非紧急（搜索结果）
}

// 或者让显示值"跟着但不同步"
const deferredQ = useDeferredValue(q);
```

典型场景：搜索框内输入不卡，结果区落后于输入。React 会保证输入优先级高。

### 4.9 `useId`

```tsx
const id = useId();
<label htmlFor={id}>名字</label>
<input id={id} />
```

为 SSR 和可访问性提供稳定唯一 ID。

### 4.10 `useSyncExternalStore`

和外部状态（如 Zustand、浏览器 location）对接：

```tsx
const value = useSyncExternalStore(subscribe, getSnapshot);
```

Zustand 内部就是用它。你平时几乎不直接用。

### 4.11 `useImperativeHandle` + `forwardRef`

```tsx
interface VideoAPI { play(): void; pause(): void; }

const Video = forwardRef<VideoAPI, { src: string }>(function Video({ src }, ref) {
  const el = useRef<HTMLVideoElement>(null);
  useImperativeHandle(ref, () => ({
    play: () => el.current?.play(),
    pause: () => el.current?.pause(),
  }), []);
  return <video ref={el} src={src} />;
});

// 父组件
const vRef = useRef<VideoAPI>(null);
vRef.current?.play();
```

用于暴露"命令式接口"。少用，优先考虑 props / state 驱动。

## 五、事件、表单、Refs

### 5.1 合成事件

React 事件都是 `React.MouseEvent<HTMLButtonElement>` 这种泛型，继承自 DOM Event，但被包了一层。行为基本一致。

```tsx
<input onChange={e => setV(e.target.value)} onKeyDown={e => {
  if (e.key === "Enter") submit();
}} />
```

### 5.2 受控 vs 非受控

**受控**：值存 state：

```tsx
const [v, setV] = useState("");
<input value={v} onChange={e => setV(e.target.value)} />
```

**非受控**：DOM 自己管值，读的时候拿 ref：

```tsx
const ref = useRef<HTMLInputElement>(null);
<input defaultValue="" ref={ref} />
<button onClick={() => console.log(ref.current?.value)}>提交</button>
```

大多数表单用受控；超大表单或只读一次时用非受控更快。

### 5.3 防止默认行为 & 阻止冒泡

```tsx
<form onSubmit={e => { e.preventDefault(); submit(); }}>
  <a href="x" onClick={e => e.stopPropagation()}>click</a>
</form>
```

## 六、性能：避免不必要的重渲染

### 6.1 触发重渲染的情形

- 组件自己 setState。
- 父组件重渲（不管 props 是否变化）。
- Context 的 value 变化，订阅该 Context 的消费者全部重渲。
- 传入 key 变化 → 卸载 + 重挂。

### 6.2 `React.memo`

```tsx
const Row = React.memo(function Row({ song, onPlay }: Props) {
  return <div>...</div>;
});
```

仅在 props 浅比较变化时重渲。依赖的前提是 props 本身引用稳定（用 `useCallback`、`useMemo`，或提到父组件外）。

### 6.3 "为啥 memo 没用"

常见原因：
- props 里传了内联对象/函数：`<Row onPlay={() => play(id)} />`。每次父渲染都是新引用。
- children 里是 JSX：每次都是新元素。拆到 memo 化的位置。
- Context 影响到了它。

工具：React DevTools 的 Profiler，能按渲染次数和时间分析。

### 6.4 列表性能

- 虚拟化（TanStack Virtual、react-window）。
- 行组件用 `memo`。
- 行 props 扁平化、稳定。
- 避免在 render 中生成大数组/复杂计算。

### 6.5 Concurrent 辅助

- `useTransition`：低优先级更新。
- `useDeferredValue`：让昂贵派生值滞后。
- `Suspense`：暂停子树渲染等异步。

## 七、Suspense 与数据加载

```tsx
<Suspense fallback={<Spinner/>}>
  <SongList />
</Suspense>
```

Suspense 要和"抛 Promise 直到数据就绪"的数据源配合。目前 TanStack Query (`useSuspenseQuery`) 是最现实的选择。React 官方正在推 React Server Components，但 Tauri 桌面场景不用。

日常在 CloudTone 里我们不滥用 Suspense，组件内处理 loading/error 状态更透明。

## 八、错误边界（Error Boundary）

```tsx
class ErrorBoundary extends React.Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError(_: unknown) { return { hasError: true }; }
  componentDidCatch(err: unknown, info: unknown) { console.error(err, info); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}
```

必须是 class 组件（官方暂未提供 hook 版本）。包在路由层或 feature 边界。错误不会被组件 return 类型系统捕捉到——runtime 错误、渲染函数 throw 都会命中。

## 九、Portal 与 Ref Forwarding

```tsx
ReactDOM.createPortal(<Toast/>, document.body);
```

Dialog、Tooltip、Toast 经常需要渲染到 DOM 根以避免 overflow/stacking 问题。配合 `forwardRef` 做触发器是常见模式。

## 十、自定义 Hook 的设计

### 10.1 何时提取

- 两个及以上组件需要同一段"跨组件生命周期 + 状态"的代码。
- 复杂 effect 难以理解，抽出后命名清晰。

### 10.2 API 设计

- **名字以 `use` 开头**，React 才能识别它。
- 返回 **单一值 / 元组 / 对象**，按含义选：
  - 单值：`const count = useCount()`。
  - 元组（两个相关强）：`const [state, setState] = useBool(false)`。
  - 对象（字段多）：`const { data, isLoading, error } = useSongs()`。
- 参数像函数一样传，允许"选项对象"扩展。

### 10.3 例子：`useDebouncedValue`

```tsx
export function useDebouncedValue<T>(value: T, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
```

### 10.4 例子：`usePrev`

```tsx
export function usePrev<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => { ref.current = value; });
  return ref.current;
}
```

### 10.5 例子：`useEvent`（最新函数引用）

避免 Effect 依赖函数但又不想每次都变的骚操作：

```tsx
export function useEvent<F extends (...a: any[]) => any>(fn: F): F {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  return useRef(((...args: any[]) => ref.current(...args)) as F).current;
}
```

React 官方有 RFC `useEvent`，目前还没正式放出。这个 polyfill 在业界很普遍。

## 十一、Context 的实战模式

### 11.1 Provider 拆分

```tsx
<AuthProvider>
  <ThemeProvider>
    <I18nProvider>
      <App />
    </I18nProvider>
  </ThemeProvider>
</AuthProvider>
```

每个 Provider 只放自己关心的 state，避免无关更新互相触发。

### 11.2 Value 稳定化

```tsx
const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
<Ctx.Provider value={value}>...</Ctx.Provider>
```

如果 value 是内联对象，每次 Provider 重渲染都产生新引用。

### 11.3 组合成自定义 Hook

```tsx
const Ctx = createContext<Auth | null>(null);
export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
```

## 十二、Zustand vs Context vs Redux（为什么 CloudTone 选 Zustand）

- **Context**：简单、React 原生。但 value 变了全量重渲。
- **Zustand**：极小、"选择器订阅"，只在你关心的片段变化时重渲；API 极其简单：

```ts
import { create } from "zustand";
interface State { count: number; inc: () => void }
export const useCount = create<State>(set => ({
  count: 0,
  inc: () => set(s => ({ count: s.count + 1 })),
}));

// 组件里
const count = useCount(s => s.count);   // 只订阅 count
const inc = useCount(s => s.inc);        // action
```

- **Redux**：大厂历史选择，生态完善但样板多。现代项目逐渐转向 Zustand / Jotai。

## 十三、Refs 与 DOM 操作指南

- 只有在 React 声明不了的事情上才碰 DOM：测量尺寸、调用播放/全屏 API、聚焦、与第三方库集成。
- 不要在 render 期间读 ref.current（渲染时 DOM 可能还没更新）。
- 第三方库挂载：在 `useEffect` 里初始化，返回清理。

```tsx
useEffect(() => {
  const chart = new Chart(ref.current!, config);
  return () => chart.destroy();
}, []);
```

## 十四、TypeScript 与 React

```tsx
import { FC, PropsWithChildren, ReactNode } from "react";

// 推荐：显式 interface，不用 FC（FC 使用体验争议）
interface CardProps extends PropsWithChildren {
  title: string;
}
export function Card({ title, children }: CardProps) { /* ... */ }

// 事件类型
function onChange(e: React.ChangeEvent<HTMLInputElement>) {}
function onClick(e: React.MouseEvent<HTMLButtonElement>) {}

// ref
const ref = useRef<HTMLDivElement>(null);

// forwardRef 的泛型
const Input = forwardRef<HTMLInputElement, InputProps>(function Input(props, ref) { ... });

// 泛型组件
function Select<T>({ items, onChange }: { items: T[]; onChange: (t: T) => void }) {
  return <select>{items.map(i => <option key={String(i)}>{String(i)}</option>)}</select>;
}
```

## 十五、测试心智

- 测行为，不测实现：用 `@testing-library/react` 按"用户看到/做到什么"查询，别查内部 state。
- `fireEvent` 够用，但 `userEvent` 更真实（模拟键盘输入、tab、焦点）。
- mock IPC/网络，不 mock React 自身。
- 写错误边界测试：故意让子组件 throw，断言 fallback 出现。

（详细在第 45 章）

## 十六、常见坑清单

- "state 改了组件没重渲"：多半是你 mutate 了对象。React 判相等靠 `Object.is`。
- "effect 跑两次"：严格模式特性，非 bug。要设计成可重复执行。
- "子组件拿到的 props 是旧值"：闭包陷阱，用函数式 setState 或 `useEvent`。
- "列表渲染错乱"：key 没写、或 key 是 index。用稳定 id。
- "Context 导致全量重渲"：拆 Provider 或换 Zustand。
- "memo 不起作用"：props 里有新对象/函数引用。
- "父组件每次重渲我就重渲"：正常，不用紧张；真慢再优化。
- "input 输入光标跳到末尾"：你用了 key={value} 或重新 mount。

## 十七、从"能用"到"精通"的清单

- 能说清 Render / Commit / Effect 的时序。
- 知道 useMemo/useCallback 的实际收益和代价。
- 能判断一段代码应该是 state / ref / 常量。
- 熟练写自定义 Hook。
- 熟练写 Compound Components（Tabs、Accordion）。
- 熟练用 Zustand / TanStack Query。
- 会在 Error Boundary 里做有意义的降级。
- 能用 React DevTools Profiler 定位慢组件。
- 能用 Suspense / useTransition / useDeferredValue 改善交互感受。

## 本章小结

React 的强大在于"简单的规则 + 强大的组合性"。理解规则（纯函数渲染 + 单向数据流 + 钩子生命周期）后，组合就是你的日常工作。剩下的 90% 难题都是"性能 + 数据流 + 组件设计" 的权衡。

下一章，Tailwind 工程化进阶。
