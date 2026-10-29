# 通话共享助手安全审核记录（远端验收进行中）

最新进展：开发者已批准两项升级。维护的 attest/release 已安装、审计、重新构建并校验真实 bundle；根目录及两套发布工具 npm audit 均为 0，721 个 npm 包版本加 Pillow 13.0.0 共 722 项 OSV 查询无匹配。Pillow 隔离测试通过，现有图标未变。CodeQL 改为直接运行哈希固定的官方 CLI 2.27.3，移除旧 Action 的依赖树。以下为初始审查记录，最终验收报告将在远端扫描及发布验证完成后更新；原文“待开发者决定”现已得到批准。

审核日期：2026-10-29。基线：组织仓库 `secure-artifacts/messenger-multi-share`，提交 `ffd7857ae74eb1ed5eef382688c54f3ae0dc708c`，版本 2.6.17。本地修订：2.6.18，尚未提交、推送或发布。

## 结论和迁移状态

运行代码的已确认边界问题已修复，34 项单元/安全回归测试通过，隔离 Chromium 的十通话合成画面测试通过。但上游发布/扫描工具依赖仍有告警，升级方案和可选 Pillow 固定版本方案等待开发者决定，**不能判定整个项目已经通过最终安全审核**。

已创建独立的个人仓库：[XiaoXu-Studio/messenger-multi-share](https://github.com/XiaoXu-Studio/messenger-multi-share)。本地唯一 remote 和默认推送目标已经切换到该个人仓库；组织仓库未修改。个人仓库尚为空，待工具链复核后再推送、打标签和发布，避免把尚待处理的流程作为正式版本分发。

## 一、概况与范围

- 原生 JavaScript / HTML / CSS，Chrome Manifest V3；后台 Service Worker、ISOLATED 内容脚本和 MAIN 媒体适配脚本。
- 浏览器安装包：11 个白名单文件，运行时第三方 npm 依赖 **0**。新增 Node 内建测试和构建脚本，根目录 npm 直接/间接依赖均为 **0**，package-lock v3。
- 原始项目 16 个受控文件全部审阅；同时审阅新增校验、构建、测试脚本和 CI 配置。原始 10 次提交、34 个去重历史 blob 纳入密钥扫描。
- 可选图标工具：`gen_icons.py` 直接依赖 Pillow，原来没有版本或锁文件；`generate-icons.html` 使用原生 Canvas。二者都不参与发布安装包。
- CI 直接引用 4 个上游 Action 仓库（CodeQL 的 init/analyze 算同一依赖）。另有系统 Node、Git、zip/unzip、GitHub runner 信任边界。单独安装的 Playwright 仅用于本次测试，不加入项目或安装包。
- 没有服务器、数据库、登录后端、移动端或 Electron 组件；SQL/NoSQL 注入、后端 CSRF/SSRF、桌面 IPC、WebView、数据库连接串等不适用于本项目，不能把“不适用”写成已验证安全。

## 二、问题汇总

行号为本地修订文件的定位点；风险描述基于修复前行为。依赖严重程度沿用数据库，不能直接等同于插件实际可利用程度。

|编号|类别|严重级别|位置|状态|
|---|---|---|---|---|
|C01|代码|High|background.js:34、background.js:453、content.js:24|已修复：跨标签页消息、角色、会话和目标授权|
|C02|代码|High|background.js:178|已修复：显式勾选为空/失效时误退回所有通话|
|C03|代码|Medium|inject.js:21、inject.js:38、content.js:102|已修复：取消后的迟到捕获、等待和克隆流清理|
|C04|代码|Medium|background.js:197、background.js:95、background.js:275|已修复：并发启动、重复 SOURCE_READY、过期异步操作|
|C05|代码|Low|manifest.json:6|已修复：删除不需要的 tabs、activeTab、windows 权限|
|C06|代码|Low|background.js:740、background.js:757、security.js:29|已修复：诊断标题/URL/邮箱/常见 Token 泄露及无界日志|
|C07|代码|Medium|.github/workflows/release.yml:31|已修复：标签直接拼接 shell、可变 Action 引用及凭据持久化|
|C08|代码|Low|scripts/build.cjs、scripts/package-safety.cjs、scripts/verify-zip.cjs|已修复：打包文件范围和链接目标缺少校验|
|C09|代码|Low|content.js:494、content.js:527、popup.js:134|已修复：脚本合成浮动按钮点击和失败却显示共享成功|
|D01|依赖|Critical|旧 attest Action 的 tar 7.4.3 及其他锁定依赖|待开发者决定：升级/维护工具链；实际利用路径尚待确认|
|D02|依赖|High|checkout、release、CodeQL 的上游锁文件|待开发者决定：更新并验证实际运行 bundle，不仅修改版本标签|
|D03|依赖|Low|gen_icons.py:2|待开发者决定：Pillow 未锁定；实际环境版本未知，不据此宣称存在可利用 Critical|
|K01|密钥|High|历史聊天中曾粘贴 GitHub 凭据（不在本次代码命中中）|建议关注：到 GitHub 确认旧凭据已撤销；状态待确认|

### C01：消息与共享目标授权

原来网页消息缺少角色/会话校验，后台转发信令没有核对用户选中的接收目标。若允许站点内有恶意或被攻陷脚本，并且用户已经开始捕获，存在跨通话错误路由、干扰或扩大共享对象的风险。是否能完整窃取媒体取决于攻击者完成 SDP/ICE 协商等条件；本次没有把负向测试当成旧版本媒体外泄实证。

修复：验证浏览器提供的扩展 ID、发送者 URL、顶层 frame；面板命令仅接受扩展自己的 popup；事件绑定当前随机会话及源/接收角色；只允许“源 ↔ 已选择接收端”，禁止接收端互连或指定其他标签页。再次发送前检查目标仍在允许的通话页面，显式投递到 frame 0。限制 tab 数、SDP/ICE 大小、候选缓存和每对端信令数量，投影允许的字段。

MAIN world 和同页 postMessage **不是身份认证机制**，随机会话值用于隔离旧会话，并不对同页脚本保密；必须同时依赖 ISOLATED/background 中的目标集合校验。已被授权拿到屏幕的网页仍需信任。

### C02—C04：尊重选择与生命周期

- 用户取消勾选或标签页失效后，原浮动按钮会退回所有通话，可能把画面发到非预期通话。现在拒绝启动并提示重新选择，不扩大范围。
- 原生选择框尚未返回时停止共享：返回的迟到流立即停止并以 AbortError 结束；接收端等待取消后不得继续打开原生选择框。
- STOP 同时清理原始捕获流、接收流、扩展交付的克隆、PeerConnection 和 ICE 缓存。无法承诺销毁恶意网页自行复制的数据或第三方另建的媒体流。
- 启动前立即占用会话，防止第二个面板抢占；关键 await 后重新确认会话；SOURCE_READY 去重；旧会话异常不得停止新会话；停止/关闭标签页时释放等待器；延迟停止按钮操作以代次号隔离。

### C05—C09：最小权限、诊断与构建

- 两个站点的 host_permissions 已足以读取匹配标签页的 URL/title，不需要广泛的 tabs 权限；activeTab 没有实际用途，windows 不是此处需要的权限。保留 scripting/system.display，并用真实浏览器验证标签页发现仍正常。[Chrome 权限文档](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- 对日志先脱敏再输出到控制台；移除导出诊断中的通话标题，限制 500 条事件、128 个诊断对象、单项 2048 字符。脱敏是尽力保护，不承诺识别所有任意格式的个人信息。
- 标签经环境变量传入 shell 并限制为严格语义版本格式，所有第三方 Action 固定完整提交，不持久化 checkout 凭据。仅个人仓库能触发发布 job。**固定 SHA 不会修复该提交自身的依赖漏洞**；因此仍未发布。
- 新增白名单构建、版本/标签一致性检查、源文件大小/语法/疑似凭据检查、源/目标链接与硬链接检查、ZIP 完整条目及逐字节校验。
- 浮动按钮要求可信用户点击；诊断 HTML 的 tabId 也转义；共享启动失败时面板显示错误而不是成功。此处不是完整的网页防点击劫持方案。
- 图标 Python 工具去掉硬编码 D 盘路径，改为项目 icons，并增加 main guard 和文件关闭，不会在 import 时改图标；本轮未运行生成器、未修改 PNG。

## 三、依赖核对与扫描

### 项目全部直接依赖

|依赖|实际基准/状态|作用|
|---|---|---|
|插件运行和根目录 npm|0 个第三方依赖；Node 24.22.1|构建和测试只使用内建模块|
|Pillow|原始未固定，实际安装版本待确认；PyPI 查询最新 13.0.0|可选图标生成，不进入 ZIP|
|actions/checkout|v4.3.0；11d5960a326750d5838078e36cf38b85af677262|CI 检出|
|actions/attest-build-provenance|v2 指向 e8998f949152b193b063cb0ec769d69d929409be；其中 package.json 自报 1.1.5，不能据此冒充 Action 标签版本|构建来源证明|
|softprops/action-gh-release|v2.6.2；3bb12739c298aeb8a4eeaf626c5b8d85266b0e65|Release 附件发布|
|github/codeql-action|v4.39.1；9b3254085494b55a0f7c4c2b3d2d52cc712ce370|JavaScript 语义扫描|

逐一查询了各 Action 官方安全页、Pillow 官方公告，并从固定提交下载 package.json/package-lock.json。对每份锁文件运行 npm audit（包含开发依赖，不执行其代码）。结果为包级告警计数，不是唯一 CVE 数，也不能将不同树简单相加：

|扫描对象|锁文件 package 节点数（非根）|Critical|High|Moderate|Low|
|---|---:|---:|---:|---:|---:|
|项目根目录|0|0|0|0|0|
|checkout|551|0|8|6|8|
|attest-build-provenance|678|1|14|10|12|
|action-gh-release|185|0|6|3|2|
|codeql-action|778|0|2|0|0|

本地完整库存和原始审计 JSON 位于工作区 `work/callshare-audit-2026-10-29/`；包含全部上游 directDependencies、devDependencies 和锁文件实际节点，不把 manifest 版本范围误当实际版本。此目录是证据，不进入扩展 ZIP。`scripts/audit-upstream.cjs` 可按固定提交复查。

关键间接依赖实际版本：checkout 的 undici 5.29.0、brace-expansion 1.1.12/2.0.2、deepmerge 4.3.1；attest 的 tar 7.4.3、@sigstore/core 2.0.0、undici 5.29.0、http-cache-semantics 4.1.1、deepmerge 4.3.1；release 的 undici 6.24.1、brace-expansion 5.0.5、vite 8.0.5、vitest 4.1.0；CodeQL 的 node-forge 1.4.0、undici 6.28.0。

重点判断：

- tar 的 [GHSA-23hp-3jrh-7fpw](https://github.com/advisories/GHSA-23hp-3jrh-7fpw) 标记 Critical，单条公告修复点 7.5.19；同一树还有其他较新的 tar 公告，不能只升级到这一最低版本。利用需要处理恶意归档，本扩展不使用 tar；Action 实际 bundle 和输入路径是否可达还需核对。
- undici 的 TLS 配置丢失和异常内容编码等公告对应修复分支 6.29.1 / 7.30.1 / 8.12.2。网络处理发生在 CI 而非插件；本项目未配置自定义 TLS Agent，也没有 WebSocket/EventSource 客户端业务，不能把所有公告都算成可直接利用。普通 HTTP 请求的相关路径仍需结合实际 bundle 复核。[TLS 公告](https://github.com/advisories/GHSA-2m5v-pch6-74hx)、[内容编码公告](https://github.com/advisories/GHSA-xjj6-f33q-929c)
- node-forge 1.4.0 命中 [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)。检索并阅读 CodeQL 的 `src/start-proxy/ca.ts`，该处生成/签署 CA，没有调用公告中的不可信 RSA 签名验证；本项目仅使用 JS init/analyze，未配置该代理。公告页面当前未列修复版本，但 registry 已有 1.4.2；**其修复映射及完整 bundle 可达性待确认**，不能仅凭 npm fixAvailable=true 宣称已解决。
- [CodeQL 旧 PAT 泄露公告](https://github.com/github/codeql-action/security/advisories/GHSA-vqf5-2xx6-9wfm) 的 Action 修复点为 3.28.3，本次 v4.39.1 不在其列出的 Action 受影响区间；这不抵消其他依赖告警。
- Pillow [FPX JPEG 解码公告](https://github.com/python-pillow/Pillow/security/advisories/GHSA-5x8w-8jj5-q52h) 修复于 13.0.0，利用需要恶意 FPX 与相应解析路径。本图标脚本只绘图并读取自身生成 PNG，不接收上传图片；实际 Pillow 未固定，因此列为依赖管理问题而非本插件确认可利用的 Critical。
- 锁文件内有已弃用的 uuid 3.4.0、@types/glob 9.0.0、旧 ESLint 8.57.1 及配套包、rimraf 3.0.2。它们属于工具链，不随扩展安装。未发现顶层依赖名称疑似仿冒，但未对每位上游维护者身份作认证。[checkout 安全页](https://github.com/actions/checkout/security)、[release 安全页](https://github.com/softprops/action-gh-release/security)、[attest 官方迁移说明](https://github.com/actions/attest-build-provenance)

当前只检查了上游锁文件，未宣称已经解包、重建并验证每个上游发布 bundle。最终工具链方案确定后需重新安装、扫描、测试、重建和核对实际包含的版本。

## 四、密钥与敏感数据

`scripts/scan-secrets.cjs` 扫描源码、配置、测试、文档、dist 和完整历史，覆盖 GitHub/云服务常见 Key、私钥、带凭据 URI、Webhook 和疑似硬编码密码。首次扫描 64 个文本对象，报告加入后复扫 68 个文本对象，10 次提交、34 个去重历史 blob，命中 0；没有受版本控制的 .env / 私钥文件，.env、.env.local、*.key、*.pem 均被忽略。

没有发现需要改为环境变量的应用密钥，因此不制造一个无用途的 .env.example。扫描是启发式检查，不能保证识别任意未知格式。先前聊天中曾公开过的 GitHub Token 不在此次代码扫描结果中；必须在 GitHub 撤销旧 Token，删除聊天或代码不能使其失效。未使用或自动轮换该旧凭据。

## 五、验证与未完成事项

已通过：

- Node 原生测试 34/34（消息身份、目标/角色/会话限制、选择范围、取消、克隆停止、候选上限、日志脱敏、打包路径/硬链接/目录链接/ZIP 白名单等）。
- Chromium 153.0.8010.12 隔离回归 8 项：11 个模拟通话发现；选择 10 个（1 源 + 9 接收）建立真实 PeerConnection；第 11 个不收流；原生捕获替身只调用一次；未选中目标伪造消息不扩大集合；停止全部 10 个已交付流；没有捕获错误。
- 浏览器测试仅替换原生捕获为 canvas 合成流、ICE 为本地直连；Windows headless 不支持本次原生窗口管理调用，测试替身禁用窗口调整/显示器查询。**真实屏幕选择框、原生窗口调整、线上 Messenger 当前 DOM、多台机器及长期通话尚未实测**。
- 根目录 npm audit 0 条，11 文件构建通过；Python AST 语法检查通过，未安装/运行新的 Pillow，也未改图标。
- `git diff --check` 通过。远端 CodeQL、Release 工作流、签名证明和下载包一致性尚未运行，因为未推送/发布。

## 六、需要开发者决定与建议

1. **发布工具链大版本升级/本地维护**：建议复用此前“浏览器拉线助手”已维护的新版 attest/release 工具，逐项核对本项目、锁定依赖和提交、重跑测试；CodeQL 的依赖也需修复或确认不受影响。备选：保留本轮兼容加固，暂不发布，等待上游完整修复。维护版本意味着以后持续跟进上游，不能只看 npm audit=0。
2. **可选图标工具**：建议在单独开发依赖清单锁定 Pillow 13.0.0，隔离测试绘图函数，不重新生成现有图标。备选：暂时不运行该脚本并保留待确认项；删除工具属于删功能，未经同意不做。
3. 真实会议兼容性、被授权网页本身的信任、STUN 元数据、后台重启内存状态、浏览器未知漏洞、仓库账号及 runner 权限属于剩余边界。不要以本报告承诺绝对安全、永不误报或已经通过商店/第三方平台审核。

确认上述工具链方案后，再完成所有扫描和测试、个人仓库推送及 v2.6.18 发布，最终报告应补齐源码提交、工作流链接、ZIP SHA-256、来源证明验证和剩余告警处理结论。当前没有伪造这些尚未发生的结果。
