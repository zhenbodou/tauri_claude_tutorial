import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
export default function App() {
    const [msg, setMsg] = useState("点击按钮向 Rust 打招呼");
    async function sayHi() {
        const hi = await invoke("greet", { name: "CloudTone" });
        setMsg(hi);
    }
    return (_jsxs("div", { className: "min-h-screen flex flex-col items-center justify-center gap-4", children: [_jsx("h1", { className: "text-3xl font-bold text-brand-500", children: "CloudTone" }), _jsx("p", { className: "text-text-secondary", children: msg }), _jsx("button", { onClick: sayHi, className: "px-4 py-2 bg-brand-500 rounded hover:bg-brand-600 transition", children: "Hello from Rust" }), _jsx("p", { className: "text-text-tertiary text-sm mt-8", children: "\u8FD9\u662F CloudTone \u8D77\u6B65\u811A\u624B\u67B6\u3002\u8DDF\u7740\u4E66 Ch 22 \u8D77\u9010\u6B65\u6269\u5C55\u6210\u5B8C\u6574\u5E94\u7528\u3002" })] }));
}
