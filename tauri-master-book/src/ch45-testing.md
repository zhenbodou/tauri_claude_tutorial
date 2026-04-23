# 第 45 章 测试：Rust 单测 + React 组件测试 + E2E

## 本章目标

- Rust 单元 / 集成测试：`cargo test`、测试 DB、测试音频解析。
- React 组件测试：`vitest` + `@testing-library/react`。
- E2E：WebDriver（tauri-driver）在真实应用上跑。
- CI 上的策略。

## 一、Rust 测试

### 单元

```rust
// core/lyrics/mod.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_minimal() {
        let s = "[00:12.30]hello";
        let r = parse(s);
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].ts_ms, 12_300);
    }
}
```

### 集成（带 SQLite）

测试前启一个**内存数据库**：

```rust
// src-tauri/tests/db_test.rs
use sqlx::SqlitePool;
use cloudtone::core::db::{queries, migrations};

async fn setup_pool() -> SqlitePool {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    migrations::run(&pool).await.unwrap();
    pool
}

#[tokio::test]
async fn create_and_list_playlist() {
    let pool = setup_pool().await;
    let id = queries::create_playlist(&pool, "喜爱").await.unwrap();
    let list = queries::list_playlists(&pool).await.unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].id, id);
}
```

### 音频 smoke test

准备一个 **1 秒的正弦波 WAV** 资产 `tests/fixtures/sine1s.wav`：

```rust
#[test]
fn decode_sine() {
    let r = scanner::read_tags(Path::new("tests/fixtures/sine1s.wav")).unwrap();
    assert!((r.duration_ms as i64 - 1000).abs() < 50);
}
```

## 二、React 组件测试

```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

`vitest.config.ts`：

```ts
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
```

`src/test/setup.ts`：

```ts
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock Tauri IPC
vi.mock("@/lib/ipc", () => ({
  commands: {
    libraryListSongs: vi.fn().mockResolvedValue([]),
    playerPlay: vi.fn(),
  },
  events: { playerEvent: { listen: vi.fn() } },
}));
```

### 例子

```tsx
// src/components/LikeButton.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { LikeButton } from "./LikeButton";
import { commands } from "@/lib/ipc";

test("click calls toggle", () => {
  const song = { id: 1, title: "", liked: false } as any;
  render(<LikeButton song={song} />);
  fireEvent.click(screen.getByRole("button"));
  expect(commands.libraryToggleFavorite).toHaveBeenCalledWith(1);
});
```

## 三、E2E：tauri-driver

```bash
cargo install tauri-driver
pnpm add -D webdriverio @wdio/cli @wdio/local-runner @wdio/mocha-framework
```

`wdio.conf.ts`：

```ts
export const config = {
  specs: ["./e2e/**/*.spec.ts"],
  hostname: "127.0.0.1",
  port: 4444,
  capabilities: [{
    "tauri:options": { application: "./src-tauri/target/release/cloudtone" },
  }],
  framework: "mocha",
};
```

测试：

```ts
// e2e/smoke.spec.ts
describe("CloudTone smoke", () => {
  it("renders library", async () => {
    const title = await $("h1").getText();
    expect(title).toContain("Library");
  });
  it("search opens", async () => {
    await browser.keys(["Meta","k"]);
    await expect($("input[placeholder^='搜索']")).toBeDisplayed();
  });
});
```

启动：

```bash
cargo tauri build --debug
tauri-driver &
pnpm wdio wdio.conf.ts
```

## 四、Mock 策略

- **IPC**：单测 mock；E2E 跑真 IPC。
- **网络**：用 `wiremock`（Rust）或 `msw`（前端）。
- **磁盘**：临时目录 `tempfile::tempdir()`。

## 五、属性测试（Property-based）

`proptest` 验证 LRC 解析器的不变量：

```rust
proptest! {
    #[test]
    fn parse_roundtrip(lines in prop::collection::vec((0i64..3_600_000, ".*"), 1..50)) {
        let raw = lines.iter().map(|(ts, t)| format!("[{:02}:{:02}.{:02}]{}", ts/60000, (ts/1000)%60, (ts%1000)/10, t)).collect::<Vec<_>>().join("\n");
        let parsed = parse(&raw);
        // 同 ts 行一一对应
        assert!(parsed.len() >= lines.len());
    }
}
```

## 六、覆盖率

```bash
cargo install cargo-llvm-cov
cargo llvm-cov --lcov --output-path lcov.info
```

前端：`vitest run --coverage`。

## 七、CI 上的取舍

- 每次 PR：Rust 单测 + 前端组件测试 + lint（几分钟）。
- Nightly：E2E + 全平台构建。
- Release：E2E 全通过才允许发版。

## 本章小结

- 测试分层：快单测 → 中集成 → 慢 E2E。
- Mock 是朋友，别在单测里拉起真 WebView。
- CI 按时长分组，保证 PR 阶段的反馈速度。

## 动手时刻

- [ ] 为 LRC 解析器补 5 个边界单测。
- [ ] 写 1 个 E2E：启动 App → 导入 fixture 目录 → 出现歌曲。

下一章：CI/CD 多平台打包与代码签名。
