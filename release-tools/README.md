# 项目维护的发布工具

这些工具只在开发/发布环境使用，**不进入浏览器安装 ZIP**。这是本项目维护的安全修补版本，不是上游官方新版本。

## 来源与变更

|目录|上游基准|本地修改|
|---|---|---|
|attest|[actions/attest v4.2.2](https://github.com/actions/attest/tree/1e69f48acb82d1966a394da916b4c1698aa569d6)|保留核心业务与测试；更新锁定依赖；构建输出 webpack 输入清单；ESLint 10/import-x 替代停止维护的 ESLint 9 组合，补齐 lint 配置；按新规则去除重复赋值并保留两个文件读取错误的 cause；保留 MIT 许可证。上游 package.json 的 4.1.0 与发布标签不同，未把它当作标签版本。|
|release|[softprops/action-gh-release v3.0.3](https://github.com/softprops/action-gh-release/tree/efb35369e0ad2afab669f228072c1b0d510eae64)|锁定修复依赖；输出 esbuild 输入清单；去除手动打标签脚本；按 home 路径选择 posix/win32 解析，两个文件路径测试使用平台正常形式；保留 MIT 许可证。|
|deepmerge|[v4.3.1 / 5b87756](https://github.com/TehShrike/deepmerge/tree/5b87756a5671635679001cbac72aa42f23472c81)|源对象与目标对象都拒绝 `__proto__` / `constructor` / `prototype`，覆盖 null-prototype 情况；只供工具链使用。保留 MIT 许可证。|
|http-cache-semantics|[4.3.0 / b1d4bd6](https://github.com/kornelski/http-cache-semantics/tree/b1d4bd682fbab0252985de45219f4e7497c0067c)|在 max-stale 处理前拒绝不可缓存、no-cache 以及共享缓存中需重验证的响应，保留普通 public 缓存行为。保留 BSD-2-Clause 许可证。|

deepmerge 的 [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) 没有已公布的官方修复版。2026-10-29 复核发现：http-cache-semantics 的 [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) 已于 2026-10-28 被撤回，GitHub 说明它不是有效漏洞，不再列作未解决的高危问题。现有缓存补丁作为已测试的防御性加固保留，不声称是上游认可的漏洞修复，也不声称本项目曾发生跨用户泄露；恢复上游行为需另行评估和测试。

两个补丁使用明确的本地维护包名和 `-patch.1` 版本，防止冒充上游。**公共漏洞数据库不会自动识别本地包：npm audit 的 0 条不能证明这两个包安全。** 必须同时审核补丁、运行 `security.test.cjs` 并检查安装包与源文件一致。以后上游发布修复时，要重新比较行为和测试，不能简单删掉 overrides。

关键实际版本：undici 6.29.1（运行）/8.12.2（attest 测试）、brace-expansion 5.0.12、@sigstore/core 3.2.1、csv-parse 7.0.3、ip-address 10.7.4、smol-toml 1.9.1。brace-expansion 的 2.1.7 只作为 ^2 override 保留，当前最终树没有该版本。包括开发依赖在内的实际完整版本见两个 package-lock.json；构建后 `dist/verification.json` 列出安装和实际 bundle 依赖。

额外维护修复：glob 10 升级到 13.0.6（同步/异步匹配与 test-exclude 兼容性已测）；re2js 锁定 2.9.1，修复 [GHSA-gg6h-894w-4m9c](https://github.com/advisories/GHSA-gg6h-894w-4m9c) 描述的 lookbehind 重复匹配 DoS（官方修复起点 2.8.7）。后者只在 Markdown 开发工具链，不进入插件或发布 Action 运行 bundle。

## 本地验证

通话共享助手新增加固：attest 的 SBOM、predicate、checksums 文件使用同一打开描述符校验并限量读取，避免检查后按路径重开；Linux 发布环境拒绝最终符号链接，并限制读取中增长的文件。缓存 Connection 头改为按逗号拆分后逐项 trim，避免原正则的二次时间复杂度。相关回归测试随源代码保存。

构建环境使用 scripts/setup-node.sh 与 scripts/setup-npm.cjs，安装带官方补丁依赖的隔离 npm；不修改系统全局安装。具体版本和限制见 SECURITY-DEPENDENCIES.md。

使用 Node.js 24.22.1 或经单独审核的受支持版本。每个子项目内运行 `npm ci --ignore-scripts --no-audit --no-fund`；attest 的 `.npmrc` 要求 install-links=true，使本地补丁复制进依赖树，而非符号链接。所有 npm audit 均覆盖开发依赖，不设置忽略公告清单。

```sh
(cd release-tools/attest && npm ci --ignore-scripts --no-audit --no-fund && npm audit --audit-level=low)
(cd release-tools/release && npm ci --ignore-scripts --no-audit --no-fund && npm audit --audit-level=low)
node --test release-tools/security.test.cjs
(cd release-tools/attest && node node_modules/typescript/bin/tsc --noEmit && node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand && npm run package)
(cd release-tools/release && npm run typecheck && npm test -- --run && npm run build)
node release-tools/verify.cjs
```

不要执行带真实凭据的 Action 入口进行本地测试。测试使用 mock、`.invalid` 域名和一次性内存密钥，DSSE 测试真实签名并验证篡改失败，但不请求 GitHub OIDC、Fulcio 或 Rekor。

## 发布边界

工作流只处理语法有效的版本标签，检出精确提交且不持久化凭据。Node 官方 Linux x64 归档使用固定 SHA-256，先校验再解压；所有 npm 安装禁止生命周期脚本。只在所有测试、扫描和 ZIP 校验通过之后签发构建来源证明并发布，不手动补传附件。

仍需信任 GitHub 托管 runner、官方 Node 归档、锁定的 npm 代码及仓库写入者。测试与扫描在独立的 validation 作业运行，发布作业需要 contents/attestations/id-token 写权限，并重新构建已验证的源文件；不向 npm 步骤显式传入仓库 Token，但这并不是进程级权限隔离。仓库环境审批、规则集、成员权限需要按实际治理政策配置；不要把这份代码审核当成账户权限认证。补丁和工具链必须随上游安全公告持续维护，不能保证以后没有新漏洞。
