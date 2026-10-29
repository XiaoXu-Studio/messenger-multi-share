# 最终直接依赖清单

复核：2026-10-29。插件自身直接与间接 npm 依赖均为 0。以下是独立发布工具的全部直接依赖（运行/开发分列），均不进入扩展安装 ZIP。实际完整间接版本由各自 package-lock.json 固定；关键修复见 SECURITY-AUDIT.md。

|工具|用途|包名（安装入口）|锁定实际版本|
|---|---|---|---|
|attest|运行工具依赖|http-cache-semantics|4.3.0-patch.1|
|attest|运行工具依赖|@actions/attest|3.2.0|
|attest|运行工具依赖|@actions/core|3.0.1|
|attest|运行工具依赖|@actions/github|9.1.1|
|attest|运行工具依赖|@actions/glob|0.7.0|
|attest|运行工具依赖|@sigstore/oci|0.7.2|
|attest|运行工具依赖|csv-parse|7.0.3|
|attest|开发工具依赖|deepmerge|4.3.1-patch.1|
|attest|开发工具依赖|@eslint/js|10.0.1|
|attest|开发工具依赖|@jest/globals|30.5.2|
|attest|开发工具依赖|@sigstore/mock|0.13.0|
|attest|开发工具依赖|@types/jest|30.0.0|
|attest|开发工具依赖|@types/make-fetch-happen|10.0.4|
|attest|开发工具依赖|@types/node|26.6.6|
|attest|开发工具依赖|@vercel/ncc|0.44.1|
|attest|开发工具依赖|eslint|10.13.0|
|attest|开发工具依赖|eslint-import-resolver-typescript|4.4.5|
|attest|开发工具依赖|eslint-plugin-import-x|4.17.1|
|attest|开发工具依赖|eslint-plugin-jest|29.17.0|
|attest|开发工具依赖|jest|30.5.2|
|attest|开发工具依赖|js-yaml|5.5.0|
|attest|开发工具依赖|markdownlint-cli|0.50.0|
|attest|开发工具依赖|nock|13.5.6|
|attest|开发工具依赖|prettier|3.9.10|
|attest|开发工具依赖|typescript|6.0.3|
|attest|开发工具依赖|ts-jest|29.4.15|
|attest|开发工具依赖|typescript-eslint|8.72.1|
|attest|开发工具依赖|undici|8.12.2|
|release|运行工具依赖|@actions/core|3.0.1|
|release|运行工具依赖|@actions/github|9.1.1|
|release|运行工具依赖|@octokit/plugin-retry|8.1.1|
|release|运行工具依赖|@octokit/plugin-throttling|11.0.5|
|release|运行工具依赖|glob|13.0.6|
|release|运行工具依赖|mime-types|3.0.2|
|release|开发工具依赖|@types/mime-types|3.0.1|
|release|开发工具依赖|@types/node|24.19.2|
|release|开发工具依赖|@vitest/coverage-v8|4.1.12|
|release|开发工具依赖|esbuild|0.28.2|
|release|开发工具依赖|prettier|3.9.6|
|release|开发工具依赖|typescript|7.0.2|
|release|开发工具依赖|vitest|4.1.12|

两个本地补丁的包名为 @browser-audio/deepmerge-security-backport 和 @browser-audio/http-cache-semantics-security-backport，以原安装入口提供兼容 API。deepmerge 的直接依赖 is-mergeable-object 为 1.1.0；缓存补丁没有直接依赖。公共数据库扫描不代替对本地补丁的审查。

attest 锁定 619 个依赖位置（当前 Windows 实装 582）；release 锁定 182 个依赖位置（当前实装 113）。其余主要为其他平台可选二进制；不是遗漏必要依赖。两个锁文件去重后的 721 个公共包名称/版本组合已做 OSV 查询，未返回匹配；两个本地补丁另行验证。

本项目另有可选图标依赖 Pillow 13.0.0（requirements-icons.txt），不进入安装包。721 个公共 npm 包版本和 Pillow 共 722 项已重新查询 OSV，未返回匹配。CodeQL 改为固定官方 CLI 2.27.3（含查询包），Node 24.22.1；二者分别校验官方 SHA-256。这是二进制工具信任边界，不声称 npm 扫描覆盖其中所有原生组件。
