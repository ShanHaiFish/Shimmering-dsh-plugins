# 项目记忆 / 仓库管理备忘

本文件记录本项目的仓库身份、命名约定与组织归属（最终以实际为准）。供维护与后续会话参考。

## 仓库身份

| 项 | 值 |
|---|---|
| npm 包名 | `dsh-plugin-manager-lite`（npm 可用，尚未发布） |
| 包版本 | `0.1.0`（预发布） |
| 层短 id / 路由前缀 | `tppm` / `/tppm/*` |
| 独立（归档）仓库 | `ShanHaiFish/dsh-plugin-manager-lite`（Public，**已归档**） |
| 插件组 monorepo | `ShanHaiFish/dsh-plugins`（DSH 插件组主页） |
| 许可证 / 作者 | MIT / ShanHaiFish |

> 原名 `dsh-plugin-manager` 的 npm 名被 `ruihuahe/hrhgit` 的同名项目占用，故改为 `-lite`。

## 归属现状：已并入 dsh-plugins 插件组（monorepo）

**事实（已核实）：**

- 本插件已并入 **monorepo `ShanHaiFish/dsh-plugins`**，源码位于
  **`plugins/dsh-plugin-manager-lite/`**（含 lib / client / src / docs / LICENSE / .github，与独立仓库一致）。
- 独立仓库 `ShanHaiFish/dsh-plugin-manager-lite` 已在 GitHub 上**归档**（`archived=true`），
  `v0.1.0` Release 与历史提交保留。
- 新安装命令（从插件组获取）：
  ```bash
  dsh plugin --profile web add "github:ShanHaiFish/dsh-plugins#path:plugins/dsh-plugin-manager-lite"
  ```
- **后续开发 / 发布以 monorepo `plugins/dsh-plugin-manager-lite/` 为事实源**；
  本本地目录作为工作副本，改动需同步回 monorepo。

> 备注：还存在一个 Git 组织 `dsh-plugins`（独立于上面的 monorepo 仓库，含若干 dsh 插件
> 仓库），若后续以该组织统一管理，需另行规划；当前方案是并入 `ShanHaiFish/dsh-plugins` monorepo。

## 本地开发 / 安装

- 插件安装在 `~/.dsh/profiles/web/node_modules/dsh-plugin-manager-lite/`（副本，非自动同步）。
- 改源码后需重新拷贝该副本再重启 DSH 才生效（见仓库 README「开发」）。

## 历史背景

- 早期以动态 Cordis 插件形态开发，后改为静态 bundle；
- 曾评估「转入 dsh-plugins 组织」，最终落实为**并入 ShanHaiFish/dsh-plugins monorepo**。
