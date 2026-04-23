# CloudTone Starter

这是《Tauri 开发实战》配套的起步脚手架。它只给出最小可运行的骨架（空白 shell + 一个能 invoke 的命令），**主要逻辑留给你跟着书从零实现**。

## 启动

```bash
cd cloudtone-starter
pnpm install
pnpm tauri dev
```

首次运行 `pnpm tauri dev` 会拉起一个空白窗口，左下角一个 "Hello from Rust" 按钮。

## 下一步

逐章跟进：

1. 先读 [Ch 21 产品设计](../tauri-master-book/src/ch21-product-design.md) 了解目标。
2. [Ch 22 搭建骨架](../tauri-master-book/src/ch22-bootstrap-project.md) 会告诉你如何把脚手架扩展成完整项目。
3. 接下来每一章就是往里加模块。

## 目录（起步版）

```
cloudtone-starter/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles/index.css
│   └── lib/ipc.ts             (占位;书里第 11 章用 tauri-specta 替换)
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── build.rs
    ├── capabilities/default.json
    └── src/
        ├── main.rs
        └── lib.rs
```

## 版本

- Tauri 2.0+
- Rust 1.78+
- Node 20+ / pnpm 9+

Happy coding!
