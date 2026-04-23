# 第 46 章 CI/CD 多平台打包与代码签名

## 本章目标

- GitHub Actions 三平台矩阵构建。
- macOS 公证（notarization）。
- Windows 代码签名。
- Linux `.deb`、`.rpm`、AppImage。
- 产物上传到 Releases 并自动生成 `latest.json`。

## 一、Workflow 骨架

`.github/workflows/release.yml`：

```yaml
name: Release
on:
  push:
    tags: ["v*"]

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - { platform: "macos-14",    args: "--target aarch64-apple-darwin" }
          - { platform: "macos-14",    args: "--target x86_64-apple-darwin" }
          - { platform: "windows-latest", args: "" }
          - { platform: "ubuntu-22.04",   args: "" }
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "pnpm" }
      - uses: pnpm/action-setup@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
        with: { workspaces: "./src-tauri -> target" }
      - name: install (linux)
        if: runner.os == 'Linux'
        run: sudo apt-get update && sudo apt-get install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
      - run: pnpm install --frozen-lockfile

      - name: Build & sign
        uses: tauri-apps/tauri-action@v0
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERT }}
          WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERT_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: "CloudTone ${{ github.ref_name }}"
          releaseBody: "See CHANGELOG.md"
          releaseDraft: true
          args: ${{ matrix.args }}
```

## 二、macOS 公证

1. 在 Apple Developer 后台申请 "Developer ID Application" 证书。
2. 导出 .p12，用 base64 放 `APPLE_CERTIFICATE`。
3. 创建 app-specific password，放 `APPLE_ID_PASSWORD`。
4. `APPLE_TEAM_ID` = 10 位字符。

`tauri.conf.json`：

```jsonc
"bundle": {
  "macOS": {
    "minimumSystemVersion": "11.0",
    "entitlements": "./entitlements.plist",
    "hardenedRuntime": true,
    "providerShortName": "XXXXXXXXXX",
    "signingIdentity": "Developer ID Application: Your Name (XXXXXXXXXX)"
  }
}
```

`entitlements.plist` 至少包含：

```xml
<plist><dict>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <key>com.apple.security.device.audio-input</key><false/>
</dict></plist>
```

tauri-action 会在有对应 env 时自动 notarize。

## 三、Windows 代码签名

- 个人开发者：EV 证书贵 ($300/年)，普通 OV 也行但 SmartScreen 要积累信誉。
- 生成 `.pfx`，base64 放 secret。
- `tauri.conf.json`：

```jsonc
"bundle": {
  "windows": {
    "certificateThumbprint": null,
    "digestAlgorithm": "sha256",
    "timestampUrl": "http://timestamp.sectigo.com"
  }
}
```

tauri-action 会用证书签 .exe 和 .msi。

## 四、Linux

三种产物：

- `.deb`（Debian/Ubuntu）：`cargo tauri build` 自动生成。
- `.rpm`（Fedora/RHEL）：需要 rpmbuild。
- `.AppImage`：Tauri 默认生成。

如果没有 code signing，**至少**发 SHA256 摘要文件。

## 五、生成 `latest.json`

tauri-action 输出每个平台的 signature。用后置步骤拼接：

```yaml
  collect:
    needs: build
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/download-artifact@v4
      - run: node scripts/compose-latest-json.js
      - uses: softprops/action-gh-release@v2
        with:
          files: latest.json
```

`scripts/compose-latest-json.js` 读取各平台的 `.sig`，输出合并后的 JSON（第 43 章的结构）。

## 六、稳定 vs 预发

- 分支 `main` 自动 build 但 `releaseDraft: true`，只上传 artifact。
- 打 tag `v1.2.3` 走 stable endpoint。
- 打 tag `v1.2.3-beta.1` 走 beta endpoint。

```yaml
  args: ${{ matrix.args }} ${{ startsWith(github.ref, 'refs/tags/v') && !contains(github.ref, '-beta') && '' || '--config src-tauri/tauri.beta.conf.json' }}
```

## 七、加速构建

- `Swatinem/rust-cache@v2` 缓存 target。
- `pnpm store` 缓存 node_modules。
- macOS runner 用 `macos-14`（Apple Silicon，速度快 2-3x）。
- Windows 用 sccache：

```yaml
      - uses: mozilla-actions/sccache-action@v0.0.3
      - run: echo "RUSTC_WRAPPER=sccache" >> $GITHUB_ENV
```

## 八、供应链安全

- Secret 只加在需要它的 job 上，用 `environment` 审核。
- 用 `cargo-audit` + `npm audit` 每周跑一次。
- 生成 SBOM（`cargo sbom` + `cyclonedx-bom`）。

## 本章小结

- Tauri-action 封装了 80% 的打包细节。
- 签名和公证是"门槛成本"，搞定一次终身受益。
- 矩阵构建 + 缓存 = CI 20 分钟内出四平台包。

## 动手时刻

- [ ] 打一个 v0.1.0，手动下载每平台包验证能启动。
- [ ] macOS 包装后用 `spctl -a -v` 检查公证。

下一章：发布、分发、监控。
