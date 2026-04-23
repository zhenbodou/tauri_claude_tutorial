# 第 13 章 Tauri 2.x 权限与能力系统（Capabilities/ACL）

## 本章目标

- 彻底理解 Tauri 2.x 为什么把权限完全重构。
- 掌握 Capabilities JSON 的写法、作用域、平台过滤。
- 学会给自定义命令声明 ACL。
- 解决初学者 80% 的 "not allowed by ACL" 报错。

**这一章是 Tauri 2 和 1 最大的差异**。读不懂这一章，后面每一章你都会被 ACL 卡住。

## 一、为什么需要 Capabilities

Tauri 1 的权限粒度很粗：一个 `allowList` 写在 `tauri.conf.json` 里，开一项整个应用都能用。这有两个问题：

1. 权限泄露：某个 WebView 被 XSS 攻破，全部权限都在它手里。
2. 第三方内容：如果你嵌入第三方网页（比如插件窗口），它和你主界面共享权限。

Tauri 2 的模型：

- **权限** = 一个 `permission` 条目，例如「允许调用 `fs:read-text-file`」。
- **作用域** = 允许访问哪些路径、哪些 URL。
- **能力（Capability）** = 把一组权限 + 作用域绑定到**指定的窗口**。

一个 Capability 就是一条规则：「`main` 窗口可以读 `$APPDATA/cloudtone` 下的文件」。

## 二、Capabilities 文件在哪

项目结构：

```
src-tauri/
├── capabilities/
│   ├── default.json        # 适用于所有窗口
│   └── main-window.json    # 仅 main 窗口
```

一个最小 `default.json`：

```jsonc
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "默认能力集",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:event:default",
    "core:window:default"
  ]
}
```

`windows` 字段：Capability 作用于哪些窗口 label。支持通配符 `"*"`。

`permissions` 字段：要启用的权限条目。`core:` 前缀是 Tauri 内置，插件的前缀是它自己的名字（例如 `fs:`、`shell:`、`dialog:`）。

## 三、权限条目的命名规则

```
<plugin-name>:<action>
```

常见：

- `core:window:allow-set-title`
- `core:window:allow-close`
- `core:event:default`
- `core:path:default`
- `fs:allow-read-text-file`
- `fs:allow-write-text-file`
- `dialog:allow-open`
- `shell:allow-open`
- `sql:default`
- `http:default`

每个插件的权限列表在它的 Cargo 目录下 `permissions/` 能找到。

## 四、作用域（Scope）

对涉及资源访问的权限（文件、URL），可以加 scope 限制：

```jsonc
{
  "identifier": "fs-limited",
  "windows": ["main"],
  "permissions": [
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [
        { "path": "$APPDATA/cloudtone/**" },
        { "path": "$HOME/Music/**" }
      ],
      "deny": [
        { "path": "$APPDATA/cloudtone/secrets/**" }
      ]
    }
  ]
}
```

支持的变量：`$APPDATA`、`$APPCONFIG`、`$APPLOCALDATA`、`$APPCACHE`、`$HOME`、`$DOWNLOAD`、`$DESKTOP`、`$DOCUMENT` 等。

**安全原则**：能用变量就不写绝对路径；`**` 是递归通配，必要时用 `*` 限制到单层。

## 五、给自定义命令声明 ACL

默认情况下，你自己写的 `#[tauri::command]` **不需要**在 capability 里声明，因为它们注册在 invoke handler 里，权限由你代码控制。但如果你用 `tauri-plugin-*` 提供的功能（比如 `fs`、`shell`），必须声明。

如果你想对**自定义命令也做精细化 ACL**（例如第三方插件只能调 `library::search` 不能调 `library::delete`），用 `#[tauri::command]` 的 `fn` + 命名约定 + capability 的 `core:app:*` 权限。完整做法在第 42 章插件系统里演示。

## 六、动态创建 Capability

有时需要运行时新增能力（比如用户勾选了「允许 CloudTone 访问 ~/Music」）：

```rust
use tauri_plugin_fs::FsExt;

app.fs_scope().allow_directory("/Users/me/Music", true)?;
```

这是 `fs` 插件提供的运行时 scope 扩展。不走 capabilities 文件。

## 七、错误诊断：「not allowed by ACL」

典型错误日志：

```
Command not allowed by ACL: fs:allow-read-text-file
```

诊断三步：

1. 确认该命令的 permission 名字。查插件仓库或 `src-tauri/gen/schemas/acl-manifests.json`。
2. 去 `capabilities/*.json` 对应 `windows` 里加上这条 permission。
3. 重启 `pnpm tauri dev`（capabilities 是编译期读取的，热更不生效）。

## 八、CloudTone 的 Capabilities 设计（预告）

主窗口 `main`：

- `core:default`、`core:event:default`、`core:window:default`、`core:path:default`
- `fs:default` + scope 限制到 `$APPDATA/cloudtone/**` 和用户选择的音乐目录
- `dialog:default`（选目录）
- `http:default`（调用在线音源 API）
- `notification:default`
- `sql:default`
- `log:default`

迷你播放器窗口 `mini`：

- `core:default`、`core:window:allow-set-focus`、`core:event:default`
- 只允许订阅 `player:*` 事件，不允许任意 IPC 调用（通过 remote 策略）

桌面歌词窗口 `lyric-overlay`：

- 只有窗口控制和事件订阅，**不能写文件、不能调 HTTP**。

这种分层让即使某个窗口被注入恶意脚本，能造成的破坏也很有限。

第 22 章会把这份配置一次性写出来。

## 九、Remote 内容与 Isolation

如果你 `iframe` 嵌了外部网站，或者加载第三方 HTML，Tauri 会把它视为「remote 内容」。给它的 capabilities 要加 `remote` 字段：

```jsonc
{
  "identifier": "third-party",
  "windows": ["plugin-*"],
  "remote": { "urls": ["https://plugins.cloudtone.app/**"] },
  "permissions": ["core:event:default"]
}
```

更狠的：Isolation Pattern（`tauri.conf.json` 的 `security.pattern`）在 WebView 和 Core 之间插一层 JS，把每个 IPC 消息过一遍。适合装载不可信插件的场景。第 42 章讲。

## 常见陷阱

> **1. 改了 capability，没重启**
>
> 必须重启 `tauri dev`。

> **2. 作用域 `$APPDATA` 找不到文件**
>
> Windows 和 macOS 的 APPDATA 不同。用 `tauri::path::resolve` 或 `dirs::config_dir()` 统一。

> **3. 权限带 `deny` 但 `allow` 更广**
>
> Tauri 的规则是 deny 优先，但要求 allow 必须先命中。所以模式是「先 allow 粗粒度，再 deny 细粒度」。

> **4. 多个 capability 冲突**
>
> 同一 window 受多个 capability 加权：任意允许就算允许。小心「一个宽松的 capability 把另一个紧的盖掉」。

## 本章小结

- Capability = 权限 + 作用域 + 窗口绑定。
- Tauri 2 默认拒绝一切，显式开放。
- 每个窗口按「最小权限」分配。
- `not allowed by ACL` 99% 的问题都在 capability 里。

## 动手时刻

在你的 hello 项目里：

- [ ] 创建一个 `plugin-window`（第 14 章会教，先看文档）。
- [ ] 让它只能订阅事件，不能调用任何命令。试试 `invoke` 是否被阻止。

下一章，窗口、菜单、系统托盘。
