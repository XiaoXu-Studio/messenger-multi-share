# Messenger Multi Share / 拉线共享助手

## 中文说明

这是一个 Chrome/Edge 浏览器扩展，用于辅助管理多个 Messenger / Facebook 群组通话窗口的屏幕共享。

### 功能

- 自动检测正在进行的 Messenger / Facebook 群组通话标签页。
- 将屏幕共享启动到已选择的多个通话窗口。
- 通过悬浮按钮一键开启所有窗口的屏幕共享。
- 一键停止多个通话窗口中的共享。
- 停止共享后主动刷新 Messenger 通话布局，减少头像错位或画面残留。
- 支持批量开启 / 关闭摄像头。

### 本地安装

1. 打开 Chrome 或 Edge 的扩展程序页面。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本项目文件夹。

### 权限说明

本扩展需要浏览器权限来检测通话标签页、向 Messenger / Facebook 通话页面注入脚本、控制扩展界面，并在共享过程中临时调整通话窗口大小。

## 如何发布新版本

本项目使用 GitHub Actions 自动构建和发布。每次发布新版本只需要创建一个 Git Tag 并推送即可。

### 发布步骤

#### 1. 确保代码已提交并推送

在发布之前，确保你的所有代码改动已经提交并推送到 GitHub：

```bash
# 查看当前状态
git status

# 添加所有改动
git add .

# 提交改动（把“你的改动说明”替换成实际的描述）
git commit -m "你的改动说明"

# 推送到 GitHub
git push origin main
```

#### 2. 创建版本 Tag

Git Tag 是一个版本标记，用于标识发布的版本号。版本号格式为 `v主版本.次版本.修订版本`，例如 `v1.0.0`、`v1.1.0`、`v2.0.0`。

```bash
# 创建一个新的版本 tag（将 v2.6.15 替换为你想要的版本号）
git tag -a v2.6.15 -m "Release version 2.6.15"
```

#### 3. 推送 Tag 触发自动构建

```bash
# 推送 tag 到 GitHub（这会自动触发 CI 构建）
git push origin v2.6.15
```

推送后，GitHub Actions 会自动执行以下操作：

1. 构建项目。
2. 生成安全签名（Attestation）。
3. 创建 Release 并上传构建产物。

#### 4. 查看构建结果

- 构建进度：访问项目的 **Actions** 页面查看。
- 发布结果：访问项目的 **Releases** 页面查看已发布的文件。

### 版本号说明

| 版本号格式 | 什么时候用 | 示例 |
| --- | --- | --- |
| `vX.0.0` | 重大更新、不兼容改动 | `v2.0.0` |
| `vX.Y.0` | 新增功能 | `v1.1.0` |
| `vX.Y.Z` | 修复 bug | `v1.0.1` |

### 如果构建失败怎么办

1. 访问项目的 **Actions** 页面查看错误日志。
2. 修复代码问题。
3. 删除失败的 tag 并重新创建：

```bash
# 删除本地 tag
git tag -d v2.6.15

# 删除远程 tag
git push origin :refs/tags/v2.6.15

# 修复问题后，重新创建并推送
git tag -a v2.6.15 -m "Release version 2.6.15"
git push origin v2.6.15
```

---

## English

This is a Chrome/Edge browser extension for helping manage screen sharing across multiple Messenger/Facebook group call windows.

### Features

- Detects active Messenger/Facebook group call tabs.
- Starts screen sharing across selected call windows.
- Starts screen sharing across all windows with one floating button.
- Stops sharing across active call windows.
- Refreshes the Messenger call layout after sharing stops to reduce misplaced avatars or stale shared-video frames.
- Includes batch camera controls.

### Install locally

1. Open the Chrome or Edge extensions page.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this project folder.

### Permissions

This extension uses browser permissions to find call tabs, inject scripts into Messenger/Facebook call pages, control the extension UI, and temporarily adjust call window sizes during sharing.
