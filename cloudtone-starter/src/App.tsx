import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function App() {
  const [msg, setMsg] = useState("点击按钮向 Rust 打招呼");

  async function sayHi() {
    const hi = await invoke<string>("greet", { name: "CloudTone" });
    setMsg(hi);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold text-brand-500">CloudTone</h1>
      <p className="text-text-secondary">{msg}</p>
      <button onClick={sayHi} className="px-4 py-2 bg-brand-500 rounded hover:bg-brand-600 transition">
        Hello from Rust
      </button>
      <p className="text-text-tertiary text-sm mt-8">
        这是 CloudTone 起步脚手架。跟着书 Ch 22 起逐步扩展成完整应用。
      </p>
    </div>
  );
}
