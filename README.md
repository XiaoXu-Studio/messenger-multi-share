# 通话共享助手 / Messenger Multi Share

Chrome / Edge 扩展：在同一浏览器个人资料内，将一次选择的屏幕画面共享到已选中的多个 Messenger / Facebook 群组通话，并提供停止共享和批量摄像头控制。

今后的源码和版本只在个人仓库 [XiaoXu-Studio/messenger-multi-share](https://github.com/XiaoXu-Studio/messenger-multi-share) 维护，组织仓库不再更新。当前本地安全修订版本为 **2.6.18**；是否已正式发布，以个人仓库 Releases 为准。

## 安装和使用

1. 从个人仓库 Releases 下载正式 ZIP 并解压；开发时也可加载源码目录。
2. 在浏览器扩展页开启开发者模式，选择“加载已解压的扩展程序”。
3. 打开群组通话，在扩展面板勾选要接收画面的通话，再开始共享。
4. 在浏览器原生选择框中确认共享的窗口/屏幕。扩展不会自动替你选择屏幕。
5. 点击停止共享，结束本次捕获和扩展管理的媒体流。

第一次使用浮动共享按钮且没有面板勾选记录时，仍按原设计选择已检测到的群组通话；一旦已有勾选记录，就严格遵守该选择。为空、失效或当前通话未勾选时，请先在面板重新选择，不会悄悄扩大共享范围。后台重启可能丢失内存状态，重要会议前请重新确认面板选择。批量摄像头按钮仍按原设计作用于检测到的通话，和屏幕共享勾选不是同一个范围。

## 权限与隐私

- 站点权限仅为 `https://www.messenger.com/*` 和 `https://www.facebook.com/*`。为了适应站内导航，脚本在这两个站点加载；共享目标须通过群组通话路径校验。没有所有网站、Cookie、历史记录或下载权限。
- `scripting`：通话页面脚本补注入和批量摄像头控制。
- `system.display`：获取显示器边界以临时调整通话窗口，随后恢复。窗口 API 不需要额外的 `windows` 权限。
- 屏幕流通过浏览器 WebRTC 传到选中的通话页面，随后由 Messenger/Facebook 的通话功能分发给参会者。请确认共享内容和所有收件通话均合适。
- 保留 Google STUN 服务 `stun:stun.l.google.com:19302` 帮助建立连接，服务可能看到 IP 等连接元数据；不应描述为“完全不联网”。没有配置 TURN 中继或开发者收集服务器。
- 不读取密码或 Cookie，不远程加载 JavaScript，不自行将屏幕上传给开发者。诊断日志仅在内存中保留最多 500 条，导出时不带通话标题，并对 URL、邮箱和常见 Token 脱敏；用户自行导出的日志文件仍需妥善保管。
- 页面 MAIN world 的消息不是密码学认证通道。真正的跨标签页授权由扩展隔离脚本和后台校验。已授权接收屏幕的网页仍属于信任边界；扩展不能保证被攻陷的网页删除其已复制的媒体。

## 开发验证

插件运行时和根目录构建/单元测试均无第三方 npm 依赖。使用 Node.js 24.22.1：

```sh
npm ci --ignore-scripts
npm audit --audit-level=low
npm test
npm run build
node scripts/scan-secrets.cjs
```

构建只允许 11 个经过审核的运行文件进入 `dist`，拒绝意外文件、目录链接和输出硬链接。发布 ZIP 必须根目录包含 manifest，并逐项与源文件比对。

`scripts/browser-test.cjs` 是可选的隔离浏览器测试，需要单独提供 Playwright 安装路径。它使用合成画面、本地 WebRTC ICE 和模拟窗口管理，不采集真实桌面、不连接真实 Facebook；不能替代真实会议的兼容性验收。`gen_icons.py` 和 `generate-icons.html` 是可选图标制作工具，不参与插件构建，也不进入安装包。Python 依赖已在 `requirements-icons.txt` 固定为 Pillow 13.0.0；`tests/icons_test.py` 在内存中测试，保证现有图标文件不变。

## 发布与安全状态

发布流程先运行应用、工具链测试和固定版本的 CodeQL 安全扩展扫描；存在未解决的扫描结果或失败时不发布。发布工具依赖固定在锁文件，安装禁用生命周期脚本，源码重新构建并校验真实 bundle 中的版本。具体审计结论与验证边界见 `SECURITY-AUDIT.md`，完整依赖表见 `SECURITY-DEPENDENCIES.md`。

完成发布检查后，只向个人仓库推送 `main` 和与 manifest 一致的版本标签（例如 `v2.6.18`）。禁止复用或强制移动已经发布的标签；构建来源证明用于验证产物与构建来源，不等于代码安全认证、浏览器商店审核或 Windows 代码签名。旧组织链接不会自动变成个人仓库链接，开发者模式安装也不会仅因新建 GitHub Release 自动更新。
