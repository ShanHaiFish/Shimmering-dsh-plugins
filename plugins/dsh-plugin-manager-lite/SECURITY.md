# Security Policy

本插件维护 DeepSeek Harness 第三方插件管理功能。它本身是**高能力插件**：
会读写文件（`~/.dsh/cordis.patch.yml`、profile `package.json`）、访问 `loader` 与
`clientModules`，并通过 `web.fetch` 访问 npm registry。

## Reporting a Vulnerability

如发现任何安全漏洞（含本插件的文件读写、路径推导、命令注入、网络访问等风险），
**请勿**公开提交 Issue。请通过以下方式私下报告：

- 联系作者 ShanHaiFish：
  - GitHub: https://github.com/ShanHaiFish
  - Email: aozhengjd_whw@126.com

请在报告中说明：漏洞描述、可复现步骤、影响范围与可能的修复建议。
通常在 72 小时内回复。

## 权限边界

- 本插件仅运行在被授权安装它的 DSH profile 中（操作者装到 `profile.bundles`）。
- 潜在风险点集中在 `lib/index.js` 的路径推导与文件写操作：
  - 路径推导基于 bundle/client 路径（`/.dsh/`、`/profiles/`、`/node_modules/` 定位）；
  - 卸载会改写 profile `package.json`。

## Security best practices

- 只从可信来源安装本插件（npm 官方包 / 本仓库）。
- 若对文件写入有顾虑，不要把 `dsh-plugin-manager-lite` 加入不信任的 profile。
