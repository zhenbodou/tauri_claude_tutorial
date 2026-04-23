# 第 2 章 开发环境全套搭建

## 本章目标

- 在 macOS / Windows / Linux 任意一个系统下装好 Rust、Node.js、Tauri CLI、系统 WebView 依赖。
- 配置好 VS Code 的必备插件，让 Rust 和 TypeScript 写起来顺手。
- 跑通 `cargo tauri info`，确认环境无误。

## 为什么环境是大坑

Tauri 的环境比单一语言项目复杂：你需要 **Rust 工具链 + Node 工具链 + 系统原生依赖**，三者任意一个不对就会卡在 `cargo build` 阶段半天。我在开始做本书的时候专门统计过社区 issue，「环境搭不起来」占了初学者提问的约 40%。**把这一章做扎实，后面才能愉快地学。**

## 一、Rust 工具链

### 安装 rustup

所有平台都用 `rustup`。官网：<https://rustup.rs>。

**macOS / Linux**：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Windows**：下载 `rustup-init.exe`，双击运行，选 **默认安装**（MSVC 工具链）。

装完关掉当前终端重开一个，执行：

```bash
rustc --version
cargo --version
```

应该能看到 `rustc 1.77.x` 以上。

### 国内网络加速

访问 crates.io 可能慢。创建 `~/.cargo/config.toml`（Windows 是 `%USERPROFILE%\.cargo\config.toml`），写入：

```toml
[source.crates-io]
replace-with = 'rsproxy-sparse'

[source.rsproxy]
registry = "https://rsproxy.cn/crates.io-index"

[source.rsproxy-sparse]
registry = "sparse+https://rsproxy.cn/index/"

[registries.rsproxy]
index = "https://rsproxy.cn/crates.io-index"

[net]
git-fetch-with-cli = true
```

### 常用组件

```bash
rustup component add rust-src rust-analyzer clippy rustfmt
```

- `rust-analyzer`：让 IDE 跳转/补全。
- `clippy`：Rust 官方 lint。
- `rustfmt`：格式化。

## 二、Node.js 工具链

### 安装 Node 20+

推荐用 `fnm`（跨平台）或 `nvm`。

**fnm（推荐）**：

```bash
# macOS / Linux
curl -fsSL https://fnm.vercel.app/install | bash
fnm install 20
fnm use 20

# Windows (PowerShell)
winget install Schniz.fnm
fnm install 20
fnm use 20
```

检查：

```bash
node -v   # v20.x
npm -v    # 10.x
```

### 推荐使用 pnpm

本书示例使用 `pnpm`，速度快、磁盘占用少。

```bash
npm install -g pnpm
pnpm -v
```

### 国内 npm 镜像

```bash
pnpm config set registry https://registry.npmmirror.com
```

## 三、系统原生依赖

这是最容易被忽略的一步，但 Tauri 编译需要本地的 WebView 运行时和一些 C/C++ 库。

### macOS

只需要 Xcode Command Line Tools：

```bash
xcode-select --install
```

WebView 是系统自带的 WKWebView，无需单独装。

### Windows

必须装两个东西：

1. **Microsoft C++ Build Tools**（在 Visual Studio Installer 里勾选「Desktop development with C++」，或者单独下载 [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/)）。
2. **WebView2 Runtime**：Windows 11 默认自带。Windows 10 从 <https://developer.microsoft.com/microsoft-edge/webview2/> 下载 Evergreen Bootstrapper 装好。

### Linux（以 Ubuntu 24.04 为例）

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libxdo-dev \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

其他发行版（Fedora、Arch）请查 Tauri 官网 [Prerequisites](https://tauri.app/start/prerequisites/)。

## 四、Tauri CLI

有两种装法：

**方式 1：全局 cargo 安装（本书推荐）**

```bash
cargo install create-tauri-app --locked
cargo install tauri-cli --version "^2.0" --locked
```

装完后：

```bash
cargo tauri --version
# tauri-cli 2.x.x
```

**方式 2：项目级 npm 依赖**

在每个 Tauri 项目里单独装：

```bash
pnpm add -D @tauri-apps/cli@^2
```

调用方式变成 `pnpm tauri dev`。

两种方式可以共存。

## 五、VS Code 与插件

Tauri 有前后端两套语言，所以 IDE 要能同时驾驭。VS Code 是社区主流。

必装插件：

- **rust-analyzer**（rust-lang.rust-analyzer）
- **Tauri**（tauri-apps.tauri-vscode）：对 capability JSON 的 schema 支持
- **ESLint**（dbaeumer.vscode-eslint）
- **Prettier**（esbenp.prettier-vscode）
- **Tailwind CSS IntelliSense**（bradlc.vscode-tailwindcss）
- **Error Lens**（usernamehw.errorlens）：把报错直接显示在行尾
- **Even Better TOML**（tamasfe.even-better-toml）

推荐 `settings.json`（VS Code 的 UserSetting 或工程 `.vscode/settings.json`）：

```jsonc
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  },
  "rust-analyzer.cargo.features": "all",
  "rust-analyzer.check.command": "clippy",
  "files.watcherExclude": {
    "**/target/**": true,
    "**/node_modules/**": true
  }
}
```

## 六、验证环境：运行 `cargo tauri info`

随便找个目录，执行：

```bash
cargo tauri info
```

你会看到类似：

```
[✔] Environment
    - OS: Mac OS 14.x ...
    - Xcode Command Line Tools: installed
    - rustc: 1.77.x
    - cargo: 1.77.x
    - rustup: 1.26.x

[-] Packages
    - tauri [RUST]: 2.0.x
    - tauri-build [RUST]: 2.0.x
    - @tauri-apps/api [NPM]: 2.0.x
    - @tauri-apps/cli [NPM]: 2.0.x
```

**如果有任何 ✗**，按提示处理。常见的：

- `Microsoft C++ Build Tools` 未装 → 去 Visual Studio Installer 勾选。
- `libwebkit2gtk-4.1-dev` 缺失 → `apt install` 一下。
- `WebView2 Runtime` 未装 → 下载 Evergreen 安装。

## 七、第一个「能跑」的 Tauri 项目（预览）

下一章（第 3 章）之前，请先跑通这个动作，确认环境完全就绪：

```bash
cd ~/projects   # 或你喜欢的目录
pnpm create tauri-app@latest
```

交互式问答时选：

- **Project name**：`tauri-smoke-test`
- **Identifier**：`com.example.smoke`
- **Choose which language to use for your frontend**：TypeScript / JavaScript
- **Choose your package manager**：pnpm
- **Choose your UI template**：React
- **Choose your UI flavor**：TypeScript

然后：

```bash
cd tauri-smoke-test
pnpm install
pnpm tauri dev
```

第一次 `cargo build` 会花 3–10 分钟（取决于网络和 CPU）。结束后一个窗口弹出，里面显示 "Welcome to Tauri!"——你就完事了。

## 常见陷阱

> **1. 国内网络太慢，`cargo build` 一直卡在 `Updating crates.io index`。**
>
> 检查 `~/.cargo/config.toml` 的镜像配置，`rustup show` 确认默认工具链。

> **2. Windows 上 `error: linker 'link.exe' not found`。**
>
> 没装 C++ Build Tools。去 Visual Studio Installer 勾选「使用 C++ 的桌面开发」工作负载。

> **3. Linux 上 `error: failed to run custom build command for 'webkit2gtk-sys'`。**
>
> Tauri 2.x 用的是 `libwebkit2gtk-4.1`，Ubuntu 20.04/22.04 默认只有 `4.0`。升级到 24.04 或手动装 `4.1` 包。

> **4. macOS M1/M2 下，`cargo tauri dev` 编译缓慢。**
>
> 第一次编译慢是正常的。之后增量编译很快（2–5 秒）。如果每次都满编译，检查 `target/` 是否被清理、是否用了 `cargo clean`。

## 本章小结

- Rust + Node + 系统 WebView 依赖 + Tauri CLI = 环境完整。
- VS Code 插件要装齐，开发体验差距巨大。
- `cargo tauri info` 是你验证环境的银弹。

## 动手时刻

- [ ] `rustc --version` 能输出 1.77+。
- [ ] `node -v` 能输出 v20+。
- [ ] `cargo tauri info` 所有项为 ✓。
- [ ] 跑通 `tauri-smoke-test` 能看到欢迎窗口。

完成上面四项后进入第 3 章：零基础前端速成。
