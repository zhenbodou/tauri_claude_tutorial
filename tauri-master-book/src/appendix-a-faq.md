# 附录 A 常见问题 FAQ

## 环境 / 工具链

**Q: `cargo tauri dev` 第一次编译 20 分钟正常吗？**  
A: 正常。首次要编 `wry` / `webkit2gtk-sys` 等原生依赖。之后增量只需几秒。

**Q: Windows 提示找不到 WebView2？**  
A: 在 Windows 10 21H2 之前版本要手动装 Evergreen WebView2 Runtime。Tauri 默认会在首次运行时引导。

**Q: Linux 编译报 `webkit2gtk-4.1 not found`？**  
A: `sudo apt install libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev pkg-config`。

**Q: macOS 启动时弹"无法验证开发者"？**  
A: 未签名的 dev build 属于正常现象。右键 → 打开即可；发行包请完成公证。

## 代码

**Q: 为什么 `tokio::sync::Mutex` 比 `std::sync::Mutex` 贵，却还推荐？**  
A: async 上下文里你可能在持锁时 `.await`，`std::Mutex` 会 block 整个线程，导致其他 task 饿死。`tokio::Mutex` 允许跨 await 持锁。

**Q: `tauri::State<'_, T>` 的 `T` 必须 `Send + Sync + 'static`?**  
A: 是的。因为 State 在任意 async command 里都可能被借用。

**Q: Command 返回 `Result<T, String>` vs 自定义 Error？**  
A: 自定义 Error + `serde::Serialize` + `specta::Type` 最佳，前端能拿到结构化错误。

**Q: 为什么前端改了代码 Tauri 没热更？**  
A: `tauri.conf.json` 的 `build.beforeDevCommand` 需指向 `pnpm dev`，且 `devUrl` 指向 Vite server。

## 音频

**Q: cpal 回调里报 "audio underrun"？**  
A: 解码没跟上。检查 ring buffer 容量、pump thread 是否被其他任务阻塞、Symphonia 是否在解码路径里有 `println!`。

**Q: 播某些 FLAC 出现杂音？**  
A: 多半是采样率转换的锅。确认 rubato 的参数（input_rate、output_rate、chunk_size）与音频一致。

**Q: 怎么做音量归一化？**  
A: 元数据里的 `R128` / `ReplayGain` → 应用增益 → limiter 防 clipping。见第 27 章。

## 数据库

**Q: SQLite 的 "database is locked" 怎么办？**  
A: 打开 WAL（`PRAGMA journal_mode=WAL;`）。避免长事务占写锁。

**Q: 查询几十万行很慢？**  
A: 优先加索引；其次用 keyset 分页；再次考虑预聚合表。

## 打包 / 更新

**Q: DMG 安装后启动闪退？**  
A: 检查 `entitlements.plist` 是否开启 `com.apple.security.cs.allow-unsigned-executable-memory`（PyO3 / WebKit 需要）。

**Q: Windows 安装器被 SmartScreen 拦截？**  
A: 未签名的 EXE 常见现象。买 EV 证书或者等声誉积累；期间引导用户点"更多信息 → 仍要运行"。

**Q: 自动更新没触发？**  
A: 依次排查：
1. `tauri.conf.json` endpoint URL 返回 200？
2. `pubkey` 与签发密钥配对？
3. 新版本号确实 > 当前版本？
4. 平台标识对（arch + os）？

## 性能

**Q: 虚拟列表渲染闪烁？**  
A: 确保 row 有固定 height 或 `estimateSize` 精准；`overscan` 给 8-10。

**Q: 发现内存一直涨？**  
A: 常见泄漏点：全局事件监听没 `unlisten`、Query 缓存未限制、图片缓存无上限。用 Chrome DevTools Heap Snapshot 对比。

## 其它

**Q: 可以在 Tauri App 里调用 Bluetooth / USB 吗？**  
A: 可以，通过 Rust 侧第三方 crate（`btleplug`、`rusb`）。前端无权访问，必须经 IPC。

**Q: 能上架 Mac App Store 吗？**  
A: 需要 sandbox + 额外 entitlements + Apple Distribution 证书。Tauri 社区已有成功案例（WeChat 衍生工具等）。
