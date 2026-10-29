# 通话共享助手 2.6.18 安全审核报告

审核日期：2026-10-29。对象：通话共享助手（messenger-multi-share），不是另一个“浏览器拉线助手”插件。

- 原始基线：2.6.17，提交 `ffd7857ae74eb1ed5eef382688c54f3ae0dc708c`。
- 个人仓库：[XiaoXu-Studio/messenger-multi-share](https://github.com/XiaoXu-Studio/messenger-multi-share)。
- 组织仓库未修改。本地唯一推送目标及新发布流程均为个人仓库，以后在这里更新。
- 开发者已批准发布/扫描工具链升级及维护、Pillow 升级且图标不变；已授权通过验证后发布新版本。

## 一、结论与验收状态

已确认的插件代码边界问题及发布工具漏洞已修复。根目录及两套发布工具 npm audit 均为 0；将隔离 npm 自身计入后，822 个公共包名称/版本查询没有 OSV 匹配。本地维护补丁另外做源码检查与回归，不能仅凭公共数据库的“0”证明安全。

**远端安全检查已通过；正式附件发布验收尚在进行。** 已验证提交为 09e57fb93319d6135db160672e787f854b2e3573，包含插件、维护工具及扫描门禁；[安全检查运行记录](https://github.com/XiaoXu-Studio/messenger-multi-share/actions/runs/40845542172) 的测试和 CodeQL 作业均成功。四处正常落盘提示已按 R01 记录原因并标为 false positive，没有未处理的 CodeQL 漏洞。发布流程仍会对标签提交重新检查，完成后补充附件与来源证明验证结果。

本报告不是第三方认证或“绝对安全”保证。结论仅覆盖本次代码、锁定版本、测试场景和当日公告；账户凭据撤销状态及真实 Facebook 通话兼容性仍有下述边界。

## 二、项目概况及审核范围

- 原生 JavaScript、HTML、CSS；Chrome Manifest V3。后台 Service Worker、ISOLATED 内容脚本、MAIN 媒体适配脚本，以及扩展自己的弹出界面。
- 安装 ZIP 只含 11 个白名单文件。插件运行时第三方依赖为 **0**；根目录 npm 外部依赖也为 **0**，构建/测试使用 Node 内建模块。
- 两个独立发布工具共有 41 条直接依赖声明（含开发依赖、重复名称），完整实际版本见 [依赖清单](SECURITY-DEPENDENCIES.md)。attest 锁文件含 619 个非根位置、release 为 182；平台可选依赖不一定在 Windows 实装。
- 可选图标生成工具固定 Pillow 13.0.0，不进入安装包。使用独立环境测试，现有三个 PNG 与原始提交相比均未改变。
- Node 24.22.1、CodeQL CLI 2.27.3 分别核验官方归档 SHA-256。隔离 npm 12.2.1 的官方归档及两个官方补丁包核验 SHA-512。
- 范围包括原始全部 16 个受控文件、修改/新增的运行代码、配置、测试、构建及发布脚本，以及锁文件、实际构建输入、生成 bundle、Git 可达历史。未将其他项目的文件当作本插件修复。
- 无服务端、数据库、Electron、移动应用组件；SQL/NoSQL 注入、后端 CSRF/CORS/SSRF、移动 WebView/桌面 IPC 等无相应实现。不适用不代表这些类别都经过了可利用性测试。

## 三、问题汇总

位置指向修复后的入口；依赖公告等级与项目实际利用条件分开描述。

|编号|类别|严重级别|位置|状态|
|---|---|---|---|---|
|C01|代码|High|background.js:34、background.js:453；content.js:24|已修复：消息来源、角色、会话及跨标签页目标授权|
|C02|代码|High|background.js:178|已修复：显式空选/失效选择不得扩大为所有通话|
|C03|代码|Medium|inject.js:21；content.js:102|已修复：迟到捕获、取消等待、媒体轨道与克隆清理|
|C04|代码|Medium|background.js:197、background.js:275|已修复：并发开始、重复 READY、过期异步回调|
|C05|代码|Low|manifest.json:6|已修复：移除不必要的 tabs/activeTab/windows 声明|
|C06|代码|Low|background.js:740；security.js:29|已修复：诊断标题、常见敏感值及无界日志|
|C07|代码|Medium|.github/workflows/release.yml:1；scripts/setup-node.sh:1|已修复：可变工具、标签 shell 输入、凭据持久化和发布前检查不足|
|C08|代码|Low|scripts/package-safety.cjs:1；scripts/build.cjs:1；scripts/verify-zip.cjs:1|已修复：打包白名单、链接/硬链接、路径与版本校验|
|C09|代码|Low|content.js:494、content.js:527；popup.js:134|已修复：合成按钮点击及启动失败却显示成功|
|C10|代码|Medium|release-tools/attest/src/read-bounded.ts:7；sbom.ts:13；predicate.ts:36；subject.ts:202|已修复：检查文件后按路径重新打开的竞态及读取增长越界|
|D01|依赖|Critical|旧 attest/checkout/release Action 锁文件；现 release-tools/|已修复：弃用旧运行 bundle、升级/维护依赖并重新构建验证|
|D02|依赖|High|旧 CodeQL Action；现 scripts/codeql-scan.sh:1|已修复：改用固定官方 CLI 和查询包，不再运行旧 Action 依赖树|
|D03|依赖|Low|requirements-icons.txt:1；gen_icons.py:1|已修复：可选 Pillow 未固定；不能据此断言原环境存在可利用 Critical|
|D04|依赖|High|scripts/setup-npm.cjs:7|已修复：npm 自带 undici / ip-address 旧版本|
|D05|代码|High|release-tools/http-cache-semantics/index.js:540|已修复：Connection 头空白匹配的二次时间复杂度|
|R01|代码|Low|scripts/codeql-reviewed.json:1|建议关注：四处已人工确认的正常 HTTP 数据落盘提示，非已确认漏洞|
|K01|密钥|High|以前聊天中公开过的 GitHub 凭据，不在本次代码命中中|建议关注：旧凭据是否已撤销待确认；不在报告复写凭据|

### C01—C04：共享授权及生命周期

利用条件：被允许网站内存在恶意/被攻陷脚本，用户已开始共享，且攻击者能够构造消息或触发异步竞态。旧代码未充分约束角色与目标，有错路由、干扰共享或扩大对象的风险；并未声称已在旧版本复现完整媒体窃取。

修复包括：

1. 后台验证浏览器提供的扩展 ID、顶层 frame、严格 HTTPS 主机/通话路径；控制命令仅接受扩展自己的 popup URL。
2. 随机会话隔离新旧请求；信令只允许“源 ↔ 用户已选择接收端”，不允许接收端互连或添加未选择标签页。投递前再次检查页面和当前会话。
3. 显式空选或选择失效时拒绝启动；不偷偷改成全部通话。限制标签数、SDP/ICE 字段和长度、缓存及每对端信令次数。
4. 停止时清理扩展持有的原始捕获、接收流、交付克隆、PeerConnection、ICE 和等待器；迟到的原生捕获立即停止。取消等待不会意外弹出新的原生选择框。
5. await 前占用会话，之后复核代次；READY 去重，旧回调不能结束新共享。必要的原生用户屏幕选择仍保留。

MAIN world / postMessage 不是身份认证通道，同页脚本可以观察或伪造其中的数据；真正的跨标签页授权必须在 ISOLATED/background 执行。网页既然获准接收媒体，就不能由本插件保证它删除已复制的数据或自己的媒体克隆。

### C05—C09：最小权限、显示及构建

保留 scripting/system.display；host_permissions 限定两个 www HTTPS 网站。网站全路径访问用于 SPA 页面导航，不扩成所有网站。没有 remotely hosted code、外部扩展消息入口或远程 eval。匹配网站的 host 权限可提供相应标签页信息，因此移除不必要 tabs 权限后另做浏览器发现测试。[Chrome 官方权限说明](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)

日志先脱敏再写入控制台；删除导出的通话标题；上限 500 条事件、128 个诊断对象、单文本 2048 字符。常见 URL、邮箱、Token 有替换规则，但不承诺识别所有形式的个人信息。

浮动按钮只响应可信用户事件；诊断插入 HTML 的字段转义；后台拒绝启动时面板显示错误。未将这一措施宣传成完整防点击劫持系统。

发布流程检出精确提交，不保存 Git 凭据；标签通过环境变量传入且严格验证版本语法；只允许个人仓库发布。测试/扫描先在独立 validation 作业通过，再允许发布。所有 npm 安装禁止生命周期脚本，实际构建输入及 bundle 依赖另行验证。

打包前校验源/输出链接、硬链接和文件范围；验证 manifest/package/tag 一致；安装 ZIP 逐条目及逐字节对照白名单，拒绝多余、重复和路径穿越条目。构建/测试工具不会进入插件 ZIP。

### C10 / D05：远端 CodeQL 检出的工具问题

- CodeQL 把三处文件系统竞态标为 High。本项目实际需要攻击者具有 runner 本地文件修改能力，并且使用 SBOM/predicate/checksums 输入（当前发布走 subject-path）；结合可达性评为 Medium。修复不是删除检查，而是先打开，再用同一文件描述符 stat/限量读取，finally 关闭；Linux 拒绝最终符号链接和非普通文件。新增测试覆盖文件读中增长、目录/超限输入、描述符使用及 Linux 符号链接。
- 缓存 Connection 头原正则可能对长空白输入反复回溯，CodeQL 标为 High；触发需要恶意或被篡改的上游 HTTP 头，影响发布工具可用性，不是插件运行时。改为 split(',') 后逐项 trim，并测试 20 万空白字符及正常头删除行为。
- 文件描述符修复不能代替 runner 隔离；具备同一进程权限的恶意程序仍可能修改已打开文件内容，来源证明不对受攻陷构建机提供绝对保证。

### R01：明确记录扫描误报/信息提示

CodeQL 的 js/http-to-file-access 提示了三处审计 JSON 写入和一处安装器归档写入。审计写入目的地来自固定文件名/操作员证据目录，不由 HTTP 内容决定；数据不执行、不进入安装包。安装器只接受常量版本的 HTTPS 地址、禁止重定向，先核验固定 SHA-512 才落盘/解压，使用全新目录和排他创建。

这些提示保留原始 SARIF，不篡改扫描器结果。发布检查仅接受人工审阅清单中的“规则、文件、完整源码 SHA-256、具体写入语句”均匹配的提示；任何源码变化或新位置都需重新审阅，否则阻止发布。回归测试验证未知告警/伪造 suppression 不能绕过。此项属于有依据的复核，不计作四个已修复漏洞。

## 四、依赖公告、实际版本与维护情况

全部直接依赖和关键实际间接版本见 [SECURITY-DEPENDENCIES.md](SECURITY-DEPENDENCIES.md)，两个 package-lock.json 提供完整树；不能用 package.json 的版本范围冒充实际安装版本。

基线扫描包含开发依赖，未运行旧包脚本。下面是包级数量，不是唯一 CVE 数，也不能把树相加当作漏洞总数：

|旧工具|锁文件节点|Critical|High|Moderate|Low|
|---|---:|---:|---:|---:|---:|
|checkout|551|0|8|6|8|
|attest-build-provenance|678|1|14|10|12|
|action-gh-release|185|0|6|3|2|
|codeql-action|778|0|2|0|0|

处理和证据：

- checkout 改为无凭据的受限 Git 检出；旧 CodeQL Action 改为固定 CLI 2.27.3。旧 node-forge 验证缺陷无需靠猜测新版是否修复，旧 Action 包不再运行。CLI 本身是独立二进制信任边界，npm 扫描不覆盖它的所有原生组件。[CodeQL CLI 官方说明](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-cli)
- attest 基于 actions/attest v4.2.2，release 基于 softprops/action-gh-release v3.0.3；保留来源提交、许可证、测试，维护修复后的锁文件，现场重建 bundle。旧 tar 7.4.3 告警的归档解析要求不可信归档进入工具，不是插件业务；不能把它直接说成插件 Critical。旧树已退出执行路径。[tar 公告](https://github.com/advisories/GHSA-23hp-3jrh-7fpw)
- undici 运行依赖固定 6.29.1，测试依赖 8.12.2；修复 TLS/内容编码等相关公告。npm 12.2.1 自带 6.29.0，另在隔离安装中替换成官方 6.29.1，而非假称 npm 最新版自身无告警。[TLS 公告](https://github.com/advisories/GHSA-2m5v-pch6-74hx)、[内容编码公告](https://github.com/advisories/GHSA-xjj6-f33q-929c)、[npm 上游问题](https://github.com/npm/cli/issues/10163)
- npm 自带 ip-address 10.7.2 换为 10.7.4，工具锁文件亦为 10.7.4；长 IPv6 zone 标识可造成二次时间处理，是工具端网络输入风险。[公告](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5)
- @sigstore/oci 0.7.2、@sigstore/core 3.2.1、csv-parse 7.0.3、brace-expansion 5.0.12、glob 13.0.6、re2js 2.9.1 等实际版本已对锁文件、安装树、bundle 输入交叉验证。[OCI 官方安全页](https://github.com/sigstore/sigstore-js/security/advisories)、[CSV 公告](https://github.com/adaltas/node-csv/security/advisories/GHSA-8cw4-87c7-c6xx)、[re2js 公告](https://github.com/advisories/GHSA-gg6h-894w-4m9c)
- deepmerge 官方公告未给出修复版，按已批准的维护方案保留明确命名的本地补丁 4.3.1-patch.1，对源/目标及 null-prototype 对象过滤危险键并回归。公共数据库不识别这一补丁，必须人工审阅并测试。[公告](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
- 缓存库的 GHSA-ch52-4w7c-c8xp 已被撤回为无效漏洞，不再记作未解决 High；保留已测的防御性缓存补丁，并追加本次正则修复。没有虚构上游认可的安全版本。[撤回记录](https://github.com/advisories/GHSA-ch52-4w7c-c8xp)
- Pillow 13.0.0 是官方 FPX 缺陷修复版。攻击需恶意 FPX 进入相应解码路径；本工具只绘图/读取自己生成的 PNG，因此不能将官方 Critical 等级直接套在插件上。按授权固定版本、隔离测试且不重绘现有图标。[Pillow 官方公告](https://github.com/python-pillow/Pillow/security/advisories/GHSA-5x8w-8jj5-q52h)

旧工具中的弃用依赖（如 uuid 3、旧 ESLint 8、rimraf 3 等）随旧树退出；当前两份锁文件没有 deprecated 标记。nock 13 为上游测试兼容保留，应继续关注维护状态；久未更新不自动等于漏洞。未发现直接依赖名有明显仿冒特征，但这不构成对每位发布者身份的认证。

## 五、密钥与凭据检查

扫描配置、测试、示例、注释、文档、构建产物及 Git 可达历史，输出位置而非值。检查 GitHub/云服务 Key、私钥、常见 Token、凭据 URL、Webhook 和赋值模式；检查 .env/私钥类文件是否被追踪及忽略。

本轮未发现待处理的代码凭据命中；.env/.env.local/.pem/.key 等已忽略，没有受控敏感配置文件。公开 mock 密码及 PEM 解析器头标记有逐项审核说明，不当作真实密钥。项目无需凭据配置，不人为增加无用途 .env.example。

**以前粘贴到聊天中的 GitHub Token 属于已经暴露的凭据。必须到 GitHub 作废；重新登录或仅删除文字都不等于撤销旧 Token。本审核未验证其撤销状态，也没有使用该 Token。** 新发布使用 GitHub Actions 短期凭据及 OIDC，不把个人 Token 写入代码或发布物。

## 六、验证结果与可复现入口

|检查|结果/范围|
|---|---|
|根目录测试|36 项通过（含媒体/授权/打包及 2 项 SARIF 门禁测试）|
|维护工具安全回归|17 项通过|
|attest 上游及新增文件读取测试|234 项通过；类型检查、ESLint 通过|
|release 上游测试|180 项通过；类型检查通过|
|Pillow 图标工具测试|1 项通过，三个原 PNG 未变化|
|npm audit|根目录、attest、release：全部等级 0|
|OSV 精确版本查询|821 个去重公共 npm 版本及 Pillow，共 822 项，无匹配|
|bundle 核对|现场重建；锁文件、实装版本、构建输入及本地补丁字节一致|
|浏览器合成集成测试|8 项断言通过，Chromium 153.0.8010.12，选择 10 个标签页（1 源+9 接收），第 11 个不接收；停止后 10 路都结束|
|密钥扫描|项目及可达历史无未处理命中；已确认测试值单独列明|
|远端最终 CodeQL|09e57fb 提交的测试与 CodeQL 作业成功；四项有依据的复核提示，无未处理漏洞|
|Release|标签工作流将重新检查，附件验收待完成|

浏览器测试使用合成 Canvas 代替真实屏幕选择、拦截 Facebook/Messenger 网络页面、局域 ICE；Windows headless 下用测试替身替代窗口布局/显示器 API。它使用真实 PeerConnection，但不代表真实 FB 服务端、实体桌面选取、跨网络或高负载十通话体验已验证，也不证明十路音频效果。不会为测试捕获你的桌面或拨打真实通话。

主要命令：根目录 npm test / npm run build；node release-tools/security.test.cjs（推荐 node --test）；各工具自己的 test/typecheck/package/build；node release-tools/verify.cjs；配置隔离 npm 后 node scripts/audit-dependencies.cjs；node scripts/scan-secrets.cjs。浏览器测试需单独提供 Playwright 和浏览器路径；图标测试在固定 Pillow 的独立 Python 环境执行。

## 七、开发者决定与剩余风险

本轮所需工具升级/维护及 Pillow 升级已经获批，无待批准的业务功能删除或音频逻辑改造。没有擅自轮换凭据，没有替用户修改仓库治理规则。

仍需关注：

1. 确认旧聊天 Token 已撤销。代码扫描通过不能替代账户审计。
2. 已授权网站及浏览器、系统、GitHub runner、固定二进制仍需信任；同页恶意脚本和已接收媒体不可由本插件完全控制。
3. 生产 WebRTC 保留 Google STUN，可能暴露连接所需的 IP/网络元数据；不是纯离线工具。
4. 发布作业具备签发/上传权限。与验证作业已分开，但发布作业仍需重新构建工具，未实现进程级 Token/OIDC 隔离；不声称达到未验证的 SLSA 等级。
5. 本地维护补丁、旧兼容测试依赖、锁文件需持续跟进公告；扫描为当日快照，不是永久安全承诺。
6. 开发者模式加载的 ZIP 不会自动更新。迁移个人仓库后应重新下载新包、重新加载扩展并刷新已有通话页；组织旧版不再更新。
7. 建议对真实 Facebook/Messenger、多显示器、Chrome/Edge/Brave 当前版本和多通话负载做一次用户验收；该项尚待确认。

## 八、发布证据

待通过最终远端检查后填写发布标签、提交、工作流、附件 SHA-256 及 GitHub 来源证明验证结果。不手动跳过失败检查，不移动已发布版本标签。
