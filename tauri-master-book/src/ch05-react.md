# 第 5 章 React（从零开始）

> **假设你看完了第 3、4 章**，知道 HTML 结构、CSS 样式、JS 变量函数数组对象、DOM 操作和异步。这一章告诉你：为什么还需要一个 React？每一个概念都有可跑示例。读完你能独立写出 CloudTone 主界面的所有交互。

## 零、为什么需要 React？

回想第 4 章末尾的 TODO 例子。每次数据变化，你都要：
1. 清空 `<ul>`。
2. 循环生成 `<li>`。
3. 分别加 checkbox、文字、按钮。
4. 给每个元素绑事件。

数据一多，手写 DOM 操作既啰嗦又容易漏改。**React 的核心理念**：

> 你只负责说"**界面现在应该长什么样**"，React 自己搞定怎么改 DOM。

换句话说：
- **纯 JS**：你写操作指令。"找到 ul，清空，然后循环 append li……"
- **React**：你写一个"图纸"。"当前状态是 X，所以界面应该是这个样"。数据变了你只改数据，React 对比新旧图纸，**自动**更新 DOM。

## 一、跑起第一个 React

**最快方式**：用 Vite 一行命令创建项目。打开终端：

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
npm run dev
```

浏览器打开控制台提示的地址（通常 `http://localhost:5173`），你会看到一个 React 欢迎页。

**打开 `src/App.tsx`**，删掉里面所有内容，替换成：

```tsx
function App() {
  return <h1>Hello React</h1>;
}

export default App;
```

保存，浏览器**自动热更新**，显示 "Hello React"。

## 二、JSX：HTML 长在 JS 里

上面 `return <h1>Hello React</h1>` 看起来像 HTML，但它**写在 TS 代码里**——这就是 **JSX**。本质上它被编译成 JS 对象：

```jsx
<div className="box">Hello</div>
// 等价于
React.createElement("div", { className: "box" }, "Hello")
```

### 2.1 JSX 和 HTML 的几点区别

```tsx
// ❌ HTML 里的 class
<div class="card">

// ✓ JSX 里要写 className（因为 class 是 JS 关键字）
<div className="card">

// ❌ HTML 里 for="id"
<label for="name">

// ✓ JSX 里 htmlFor
<label htmlFor="name">

// 自闭合标签必须有斜杠
<img src="..." />     // ✓
<img src="...">       // ❌ 报错

// style 是对象，不是字符串
<div style={{ color: "red", fontSize: 16 }}>

// 注释要写在 {/* */} 里
<div>{/* 这是注释 */}</div>
```

### 2.2 JSX 里嵌 JS 表达式：`{}`

大括号里可以写**任何 JS 表达式**：

```tsx
function App() {
  const name = "小明";
  const age = 18;
  const items = ["苹果", "香蕉", "橘子"];

  return (
    <div>
      <h1>你好 {name}</h1>
      <p>今年 {age} 岁，{age >= 18 ? "成年" : "未成年"}</p>
      <p>1 + 1 = {1 + 1}</p>
      <ul>
        {items.map(item => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
```

**三点关键**：
1. `{name}` 把变量插进 HTML 里。
2. `{items.map(...)}` 循环生成一堆元素。列表里**每个元素都要有唯一的 `key` 属性**，React 用它追踪哪个是哪个。
3. 多个顶层元素要用一个父元素包起来（或者用 `<>...</>`，叫 **Fragment**）：

```tsx
return (
  <>
    <h1>标题</h1>
    <p>段落</p>
  </>
);
```

## 三、组件：UI 的积木

**组件 = 一个返回 JSX 的函数**。组件名必须**大写开头**。

```tsx
function Greeting() {
  return <h1>你好，世界</h1>;
}

function App() {
  return (
    <div>
      <Greeting />
      <Greeting />
      <Greeting />
    </div>
  );
}
```

用大写的 `<Greeting />`，React 会去找 `Greeting` 函数；小写的 `<greeting />` 会被当成 HTML 标签。

### 3.1 props：给组件传参数

```tsx
interface GreetingProps {
  name: string;
  age?: number;           // 可选
}

function Greeting({ name, age }: GreetingProps) {
  return <p>你好 {name}，{age ? `今年 ${age} 岁` : "请问贵庚？"}</p>;
}

function App() {
  return (
    <div>
      <Greeting name="小明" age={18} />
      <Greeting name="张三" />
    </div>
  );
}
```

**关键点**：
- 参数像 HTML 属性一样传：`name="小明" age={18}`。
- 字符串用双引号，其他值（数字、变量、对象）用 `{}`。
- 组件函数用**对象解构**接收：`function X({ name, age })`。
- 用 `interface XxxProps` 定义参数类型，编辑器帮你检查。

### 3.2 children：把 JSX 当参数传

```tsx
interface CardProps {
  title: string;
  children: React.ReactNode;    // 内容可以是任意 JSX
}

function Card({ title, children }: CardProps) {
  return (
    <div style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8 }}>
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  );
}

function App() {
  return (
    <Card title="我的卡片">
      <p>这是卡片里的内容</p>
      <button>按钮</button>
    </Card>
  );
}
```

`<Card>...</Card>` 之间的内容，在 `Card` 里通过 `children` 拿到。**组件组合的核心**。

## 四、State：组件的记忆

组件函数每次调用都会**从头执行一遍**——局部变量每次都是新的。那怎么记住"点了几次按钮"这种状态？用 **`useState`**：

```tsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);   // 初始值 0

  return (
    <div>
      <p>当前计数: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
      <button onClick={() => setCount(0)}>重置</button>
    </div>
  );
}
```

**解剖 `useState`**：

```ts
const [count, setCount] = useState(0);
//      ↑        ↑              ↑
//      当前值   更新函数        初始值
```

- `useState` 返回一个**数组**，习惯上用解构拿出来。
- `count` 是当前值，**只能读，不能直接改**（`count++` 无效）。
- `setCount(新值)` 更新状态，React 会**重新调用整个组件函数**，用新值再画一次。

### 4.1 重要规则

**① 不要直接改 state**，要用 setter：

```tsx
// ❌ 无效
count = count + 1;
arr.push(x);
obj.x = 2;

// ✓ 用 setter
setCount(count + 1);
setArr([...arr, x]);           // 创建新数组
setObj({ ...obj, x: 2 });      // 创建新对象
```

React 靠"**引用变了没**"判断是否需要重画。改内部没用，必须整个换。

**② 依赖上一次的值时，用函数式写法**：

```tsx
// ❌ 连点两次只加了 1
<button onClick={() => { setCount(count + 1); setCount(count + 1); }}>

// ✓ 函数式，基于最新值
<button onClick={() => { setCount(c => c + 1); setCount(c => c + 1); }}>
```

### 4.2 多个 state

```tsx
function Form() {
  const [name, setName] = useState("");
  const [age, setAge] = useState(0);
  const [agree, setAgree] = useState(false);

  return (
    <div>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="姓名" />
      <input type="number" value={age} onChange={e => setAge(Number(e.target.value))} />
      <label>
        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
        同意协议
      </label>
      <p>{agree ? `${name}, ${age} 岁` : "未同意"}</p>
    </div>
  );
}
```

每个独立状态一个 `useState`。

**动手试试 ①**：把这段代码放到 `App.tsx` 看看效果。试试输入时 `<p>` 实时更新。

## 五、事件处理

React 的事件名是**驼峰式**（`onClick`、`onChange`、`onSubmit`），值是函数：

```tsx
<button onClick={() => alert("点了！")}>点我</button>

<button onClick={handleClick}>点我</button>
// 其中
function handleClick() {
  alert("点了！");
}

<input onChange={e => setText(e.target.value)} />
<form onSubmit={e => { e.preventDefault(); submit(); }}>
```

`e.preventDefault()` 阻止默认行为（比如表单提交后刷新页面）。

### 5.1 传参给事件处理函数

```tsx
function List() {
  const items = ["a", "b", "c"];

  function handleDelete(item: string) {
    console.log("删", item);
  }

  return (
    <ul>
      {items.map(item => (
        <li key={item}>
          {item}
          <button onClick={() => handleDelete(item)}>删</button>
        </li>
      ))}
    </ul>
  );
}
```

注意是 `onClick={() => handleDelete(item)}`（传一个函数），而**不是** `onClick={handleDelete(item)}`（这会立即调用）。

## 六、条件渲染 & 列表渲染（最常用两招）

### 6.1 条件渲染

```tsx
function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  return (
    <div>
      {loggedIn ? <p>欢迎回来</p> : <button onClick={() => setLoggedIn(true)}>登录</button>}

      {/* 只在为 true 时显示（没 else） */}
      {loggedIn && <p>你已登录</p>}
    </div>
  );
}
```

三元 `A ? B : C` 处理两个分支；`&&` 处理"要么显示要么不显示"。

### 6.2 列表渲染

```tsx
const songs = [
  { id: 1, title: "起风了", artist: "买辣椒" },
  { id: 2, title: "晴天", artist: "周杰伦" },
];

return (
  <ul>
    {songs.map(song => (
      <li key={song.id}>
        {song.title} - {song.artist}
      </li>
    ))}
  </ul>
);
```

**`key` 必须唯一且稳定**。通常用数据里的 id。**别用数组下标** `index` 当 key——列表顺序变动时 React 会认错。

## 七、完整示例：React 版 TODO

对比第 4 章的原生 JS 版本，代码更短、更清晰：

```tsx
import { useState } from "react";

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");

  function addTodo() {
    const text = input.trim();
    if (!text) return;
    setTodos([...todos, { id: Date.now(), text, done: false }]);
    setInput("");
  }

  function toggle(id: number) {
    setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }

  function remove(id: number) {
    setTodos(todos.filter(t => t.id !== id));
  }

  return (
    <div style={{ maxWidth: 400, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>我的 TODO</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          style={{ flex: 1, padding: 8 }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addTodo()}
          placeholder="要做什么？"
        />
        <button onClick={addTodo}>添加</button>
      </div>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {todos.map(todo => (
          <li key={todo.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderBottom: "1px solid #eee" }}>
            <input type="checkbox" checked={todo.done} onChange={() => toggle(todo.id)} />
            <span style={{ flex: 1, textDecoration: todo.done ? "line-through" : "none", color: todo.done ? "#aaa" : "#000" }}>
              {todo.text}
            </span>
            <button onClick={() => remove(todo.id)} style={{ background: "#ef4444", color: "white", border: "none", padding: "4px 8px", borderRadius: 4 }}>
              删
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
```

**对比原生 JS 版，注意**：
- 没有 `getElementById`，没有 `createElement`。
- 没有手动调 `render()`。
- 只改数据（`setTodos`），界面自动同步。

**动手试试 ②**：在你的 Vite 项目里替换 `App.tsx` 为这段，验证能跑。然后尝试自己加一个"**清空已完成**"按钮。

## 八、拆分组件：一个 TODO 拆成三块

代码长了要拆。原则：**一个组件只关心一件事**。

```tsx
// TodoItem.tsx
interface TodoItemProps {
  todo: Todo;
  onToggle: (id: number) => void;
  onRemove: (id: number) => void;
}

function TodoItem({ todo, onToggle, onRemove }: TodoItemProps) {
  return (
    <li>
      <input type="checkbox" checked={todo.done} onChange={() => onToggle(todo.id)} />
      <span>{todo.text}</span>
      <button onClick={() => onRemove(todo.id)}>删</button>
    </li>
  );
}

// TodoList.tsx
function TodoList({ todos, onToggle, onRemove }: { todos: Todo[]; onToggle: (id: number) => void; onRemove: (id: number) => void }) {
  return (
    <ul>
      {todos.map(todo => (
        <TodoItem key={todo.id} todo={todo} onToggle={onToggle} onRemove={onRemove} />
      ))}
    </ul>
  );
}

// App.tsx
function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  // ... 之前的 add/toggle/remove

  return (
    <div>
      {/* 输入框部分 */}
      <TodoList todos={todos} onToggle={toggle} onRemove={remove} />
    </div>
  );
}
```

**数据流规律**：
- **数据向下传**（通过 props）。父组件有 todos，传给 TodoList，再传给 TodoItem。
- **事件向上传**（通过回调）。子组件里点了删，调父传下来的 `onRemove(id)`，父来更新数据。

这就是 React 的"**单向数据流**"。

## 九、useEffect：处理副作用

**副作用** = 组件渲染之外的事：网络请求、订阅事件、定时器、读写 localStorage。

```tsx
import { useEffect, useState } from "react";

function GitHubUser() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("https://api.github.com/users/torvalds")
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  }, []);       // ← 依赖数组：空就是"只在组件挂载时跑一次"

  if (loading) return <p>加载中...</p>;
  return <p>{data.name} · {data.followers} 粉丝</p>;
}
```

**`useEffect(fn, deps)` 三种写法**：

```tsx
// 每次渲染都跑（少用）
useEffect(() => { console.log("每次"); });

// 只在挂载时跑一次
useEffect(() => { console.log("一次"); }, []);

// 依赖变化时跑
useEffect(() => { console.log("id 变了:", id); }, [id]);
```

### 9.1 清理函数

订阅、定时器要清理，避免内存泄漏。`return` 一个函数就是清理：

```tsx
useEffect(() => {
  const timer = setInterval(() => {
    console.log("tick");
  }, 1000);

  return () => clearInterval(timer);   // 组件卸载或依赖变化前先清掉
}, []);
```

### 9.2 依赖传参

```tsx
function UserInfo({ userId }: { userId: string }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`/api/user/${userId}`).then(r => r.json()).then(setData);
  }, [userId]);     // userId 变时重新请求

  return <div>{data?.name}</div>;
}
```

### 9.3 严格模式下 Effect 跑两次是正常的

开发环境下 React 故意把 effect 跑两次（mount → unmount → mount 再跑），逼你检查有没有忘清理。**不是 bug**，生产环境不会这样。

### 9.4 别滥用 useEffect

很多人把"派生数据"错塞进 effect：

```tsx
// ❌ 不需要 effect
const [filtered, setFiltered] = useState([]);
useEffect(() => {
  setFiltered(songs.filter(s => s.isLiked));
}, [songs]);

// ✓ 渲染时直接算
const filtered = songs.filter(s => s.isLiked);
```

渲染时就能算出的东西，**不要**用 state + effect。

## 十、表单与受控组件

上面例子里 `<input value={name} onChange={e => setName(e.target.value)} />` 就是"**受控组件**"——值由 React 管。几乎所有表单都这么写。

**完整例子**：

```tsx
function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agree) { alert("请同意协议"); return; }
    console.log({ name, email });
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        姓名
        <input value={name} onChange={e => setName(e.target.value)} required />
      </label>
      <label>
        邮箱
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </label>
      <label>
        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
        同意协议
      </label>
      <button type="submit">提交</button>
    </form>
  );
}
```

## 十一、useRef：拿 DOM 或存可变值

### 11.1 拿 DOM 元素

```tsx
function AutoFocus() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();    // 页面加载就聚焦
  }, []);

  return <input ref={inputRef} />;
}
```

### 11.2 存可变但不需要触发重渲染的值

```tsx
function Timer() {
  const countRef = useRef(0);

  function inc() {
    countRef.current++;           // 改 ref 不会触发重渲
    console.log(countRef.current);
  }

  return <button onClick={inc}>点我（看控制台）</button>;
}
```

**区别 state 和 ref**：
- 要**显示**在界面上的用 `useState`。
- 只是**存**一下、不影响界面的用 `useRef`。

## 十二、useContext：跨层传数据

props 一层层传烦人时，用 Context。最典型是**主题**：

```tsx
import { createContext, useContext, useState } from "react";

const ThemeContext = createContext<"light" | "dark">("light");

function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  return (
    <ThemeContext.Provider value={theme}>
      <button onClick={() => setTheme(t => t === "light" ? "dark" : "light")}>切换</button>
      <Page />
    </ThemeContext.Provider>
  );
}

function Page() {
  return <Article />;
}

function Article() {
  const theme = useContext(ThemeContext);     // 不用层层传
  return <div style={{ background: theme === "dark" ? "#222" : "#fff" }}>...</div>;
}
```

## 十三、自定义 Hook：封装复用逻辑

**Hook** 就是用到 `useState`、`useEffect` 等的函数。你可以写自己的，**函数名必须 `use` 开头**。

例子：封装"防抖"（用户停止输入 300ms 后才生效）：

```tsx
function useDebounce<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);

  return debounced;
}

// 使用
function Search() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);

  useEffect(() => {
    if (debouncedQ) console.log("发请求:", debouncedQ);
  }, [debouncedQ]);

  return <input value={q} onChange={e => setQ(e.target.value)} />;
}
```

用户狂敲键盘，`q` 实时变，但 `debouncedQ` 只在停下 300ms 后才更新，网络请求频率骤减。

## 十四、性能（先会用，再优化）

**先说最重要的话**：**绝大多数场景你不需要优化**。先把功能写对，卡了再说。

三个常见优化手段，**看得懂就够了**：

### 14.1 `useMemo`：缓存昂贵计算

```tsx
const sortedSongs = useMemo(() => {
  return songs.slice().sort((a, b) => b.plays - a.plays);
}, [songs]);
```

只有 `songs` 变了才重新排。songs 没变就用上次缓存的结果。

### 14.2 `useCallback`：缓存函数引用

```tsx
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);
```

让传给子组件的函数引用稳定，避免子组件无谓重渲。

### 14.3 `React.memo`：缓存组件

```tsx
const Row = React.memo(function Row({ song }: { song: Song }) {
  return <div>{song.title}</div>;
});
```

`Row` 的 props 没变就不重画。

**这三个联用才有效**，而且有**分析成本 > 收益**的情况，别提前用。React DevTools 的 Profiler 面板能告诉你哪个组件真慢。

## 十五、React 的 10 个常见坑

1. **state 更新了但组件没变** → 你改了对象内部而不是换了引用。用 `setX({ ...x, y: 2 })`。
2. **effect 跑两次** → 严格模式特性，不是 bug。
3. **依赖数组警告你漏了** → 照 ESLint 提示加，或想清楚为啥不需要（通常还是加上对）。
4. **闭包陷阱**：`useEffect` 里读的 state 永远是挂载时那个值 → 用函数式更新 `setCount(c => c + 1)` 或把值加进依赖。
5. **列表用 index 当 key** → 列表重排或删除时出 bug，用稳定 id。
6. **input 光标乱跳** → 检查是不是 key 写错导致重新挂载。
7. **Context 变一次所有用它的都重渲** → 把大对象拆小 Context，或用 Zustand。
8. **className 拼错** → React 不检查 class 名，CSS 找不到的类静默不生效。
9. **忘了 `e.preventDefault()`** → 表单提交刷新页面。
10. **组件函数里写副作用（直接 fetch）** → 必须放 `useEffect` 里。

## 十六、从这里到精通的路

已经会的：
- 写组件 / 传 props / 组件组合。
- useState / useEffect / useRef / useContext。
- 自定义 Hook、表单、列表。

下一步（本书后续章节）：
- **Tailwind CSS**（第 6 章）：更快地写样式。
- **Zustand**（第 25 章）：比 Context 更好用的全局状态。
- **TanStack Query**（第 25 章）：数据请求的工业级方案。
- **React Router**（第 24 章）：多页面切换。

## 本章小结

- **组件 = 返回 JSX 的函数**，大写开头。
- **props 向下传，事件向上传**。
- **state 不能直接改**，要用 setter。
- **JSX 里 `{}` 里写 JS 表达式**，列表要加 `key`。
- **副作用放 `useEffect`**，清理用返回的函数。
- **先把功能写对，别过早优化**。

**强烈建议**：
1. 把第七节 TODO 例子亲手敲一遍。
2. 再加一个功能："**只看未完成**" 的过滤开关。
3. 再把 TODO 按第八节那样拆成 3 个组件。

做完这三件事，你对 React 就不是"看过"，而是"会用"了。

下一章，用 **Tailwind CSS** 把 CSS 写作效率翻几倍。
