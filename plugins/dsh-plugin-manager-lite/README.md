# dsh-plugin-manager-lite

管理 [DeepSeek Harness](https://github.com/deepseek-ai/dsh) Web 中除官方插件外的第三方插件的**静态 bundle 插件**。

在设置页「插件 → 第三方插件」提供：**列表 / 启用 / 停用 / 卸载 / 检查更新**。停用状态持久化到
`~/.dsh/cordis.patch.yml`，重启 DSH 后仍保持。

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-plugin-manager-lite)](https://www.npmjs.com/package/dsh-plugin-manager-lite)
[![GitHub release](https://img.shields.io/github/v/release/ShanHaiFish/dsh-plugin-manager-lite)](https://github.com/ShanHaiFish/dsh-plugin-manager-lite/releases)

> **本插件已并入 [dsh-plugins](https://github.com/ShanHaiFish/dsh-plugins) 插件组仓库**，源码位于
> [`plugins/dsh-plugin-manager-lite/`](https://github.com/ShanHaiFish/dsh-plugins/tree/main/plugins/dsh-plugin-manager-lite)。
> 原独立仓库 [ShanHaiFish/dsh-plugin-manager-lite](https://github.com/ShanHaiFish/dsh-plugin-manager-lite) 已归档（v0.1.0 Release 与历史提交保留在那里）。

## 功能

- **列表第三方插件**：只显示非官方（非 `@deepseek-ai/*`）插件，读取 `package.json` 展示真实名称、版本、作者、描述，标注「本地安装 / npm」
- **启用 / 停用**：切换插件运行状态；停用状态持久化到 `~/.dsh/cordis.patch.yml`，重启后保持
- **卸载**：运行时停用 + 从 profile 配置移除（`dependencies` / `bundles`）
- **检查更新**：查询 npm registry，对比当前版本与最新版本
- **一键安装/升级**：对 npm 安装的第三方插件，更新 profile 依赖版本并在 profile 目录执行 `pnpm add <pkg>@^latest` 完成安装，装完后重启 DSH 生效；本地 `file:` 安装的插件不开放此按钮
- **`/tppm/debug`**：排错端点，报告列表数据源各环节实际值

## 要求

- DeepSeek Harness（`dsh`）`0.1.0-rc.7`+（developer preview，字段可能变化）
- Node.js `>=18`
- Peer dependency：`@deepseek-ai/cordis` `^4.0.1`

## 安装

推荐用 `dsh plugin` 命令（等价于在 profile 下执行 `pnpm add`）：

```bash
# 从 npm（发布后）
dsh plugin --profile web add dsh-plugin-manager-lite

# 从 GitHub（dsh-plugins monorepo 子目录）
dsh plugin --profile web add "github:ShanHaiFish/dsh-plugins#path:plugins/dsh-plugin-manager-lite"

# 本地目录（开发期）
dsh plugin --profile web add /path/to/dsh-plugins/plugins/dsh-plugin-manager-lite
```

或在 `~/.dsh/profiles/web/package.json` 手动加入依赖与 `dsh.profile.bundles`，然后重启 DSH。

> **注意**：Host 从 `~/.dsh/profiles/web/node_modules/<包名>/` 解析并服务本插件。
> 开发期修改本仓库源码后，必须把改动**同步到该副本**再重启 DSH 才生效
> （`dsh plugin add` 会执行同步；手动拷贝请见「开发」）。

## 使用

重启 DSH 后，打开浏览器进入 Web GUI → **设置 → 插件 → 第三方插件**：

- 点「刷新」重新拉取插件列表；
- 运行中的插件可「停用」；已停用的插件可「启用」；
- 每个插件可「检查更新」「卸载」。

停用 / 启用结果通过 `alert` 提示，操作成功会刷新列表反映真实状态。

## 目录结构

```
dsh-plugin-manager-lite/
├── package.json          # 包名 = 金三角事实源（name / patch name / client load id）
├── cordis.patch.yml      # 把本包插入 profile 层栈（层 id: tppm）
├── lib/
│   └── index.js          # Host 半区（ESM）：webServer 同源 JSON 路由 /tppm/*
├── client/
│   └── client.js         # Client 半区（浏览器 bundle）：设置页选项卡 UI
├── src/                  # 动态形态源码（参考，不参与安装加载）
├── CONTRIBUTING.md
├── SECURITY.md
├── CODE_OF_CONDUCT.md
└── LICENSE               # MIT
```

## Host 路由

Client 半区通过同源 `fetch` 调用 Host 半区（`/tppm/*`），区别于动态形态的 `host.call`：

| 方法 | 说明 |
|---|---|
| `POST /tppm/listThirdPartyPlugins` | 列出第三方插件（含已停用） |
| `POST /tppm/listAllPlugins` | 列举所有插件（含官方，调试用） |
| `POST /tppm/enablePlugin` | 启用插件（热启用 + 持久化） |
| `POST /tppm/disablePlugin` | 停用插件（热停用 + 持久化） |
| `POST /tppm/uninstallPlugin` | 卸载插件 |
| `POST /tppm/checkForUpdates` | 检查更新 |
| `POST /tppm/installUpdate` | 一键安装/升级到 npm 最新版本 |
| `POST /tppm/diagnose` | loader entry 诊断 |
| `POST /tppm/debug` | 列表数据源诊断 |

## 开发

```bash
# 语法检查
npm run check
```

**开发期同步到 profile**：Host 实际加载 `~/.dsh/profiles/web/node_modules/dsh-plugin-manager-lite/`。
每次改动本仓库后，同步相关文件到该副本再重启：

```powershell
$dst = "$HOME\.dsh\profiles\web\node_modules\dsh-plugin-manager-lite"
Copy-Item package.json, cordis.patch.yml, lib\index.js, client\client.js -Destination $dst -Force
```

或直接重新 `dsh plugin --profile web add /path/to/dsh-plugins/plugins/dsh-plugin-manager-lite`。

## 贡献

欢迎提交 Issue 与 Pull Request。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。
安全相关请按 [SECURITY.md](SECURITY.md) 处理。

## 许可证

[MIT](LICENSE) © [ShanHaiFish](https://github.com/ShanHaiFish)。
