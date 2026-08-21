# dsh-plugins

> [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/dsh) 第三方插件集 —— 插件组主页
> 由 [@ShanHaiFish](https://github.com/ShanHaiFish) 开发维护

本仓库是 **DSH 插件组的索引主页**：汇总全部插件、功能简介与一键安装命令，并**托管新开发插件的源码**（`plugins/` 目录）。

- 已有存量用户的成熟插件保持独立仓库、**路径不变**，已按 `github:ShanHaiFish/<repo>` 方式安装的用户不受任何影响。
- 刚发布的新插件源码直接托管在本仓库 `plugins/<包名>/`，用子目录 spec 安装（见下文）。
- 插件通过 GitHub 标签 [`dsh-plugin`](https://github.com/ShanHaiFish?tab=repositories&q=topic%3Adsh-plugin) 归组，新插件打上该标签即自动入组。

## 插件一览

| 插件 | 版本 | 功能 |
|---|---|---|
| [dsh-plugin-manager-lite](https://github.com/ShanHaiFish/dsh-plugins/tree/main/plugins/dsh-plugin-manager-lite)（源码在本仓库） | v0.1.0 | 第三方插件管理器：列表 / 启用 / 停用 / 卸载 / 检查更新 / npm 一键安装升级（设置页「插件 → 第三方插件」） |
| [dsh-check-for-updates](https://github.com/ShanHaiFish/dsh-check-for-updates) | v1.12.0 | DSH 更新检查：首次打开自动检查 npm 最新版本，左下方更新弹窗 +【更新到】按钮一键升级 |
| [dsh-plugin-security-review](https://github.com/ShanHaiFish/dsh-plugin-security-review) | v1.8.0 | 插件安装安全审查守卫：`dsh plugin add` 前的安全审查闸门（security-first） |
| [sent-msg-locator](https://github.com/ShanHaiFish/sent-msg-locator) | v2.3.5 | 对话区左缘轮次图标列，点击定位到每轮用户输入文本 |
| [fexp-file-explorer](https://github.com/ShanHaiFish/fexp-file-explorer) | v1.5.1 | 左侧工作区文件浏览器：目录/文件浏览、文件预览、一键打开资源管理器、文件引用添加到聊天 |

## 安装

前置要求：

- DeepSeek Harness（`dsh`）`0.1.0-rc.7`+（developer preview，字段可能变化）
- Node.js `>=18`

以 `web` profile 为例（其他 profile 替换 `--profile` 参数）。当前插件均从 GitHub 安装：

```bash
# 第三方插件管理器（建议第一个安装，之后可用它管理其余插件；源码在本仓库 plugins/ 目录）
dsh plugin --profile web add "github:ShanHaiFish/dsh-plugins#path:plugins/dsh-plugin-manager-lite"

# DSH 更新检查
dsh plugin --profile web add github:ShanHaiFish/dsh-check-for-updates

# 插件安装安全审查守卫
dsh plugin --profile web add github:ShanHaiFish/dsh-plugin-security-review

# 对话轮次定位
dsh plugin --profile web add github:ShanHaiFish/sent-msg-locator

# 工作区文件浏览器
dsh plugin --profile web add github:ShanHaiFish/fexp-file-explorer
```

安装指定版本（tag）：

```bash
dsh plugin --profile web add github:ShanHaiFish/sent-msg-locator#v2.3.5
```

## 通用说明

- 插件均为**静态 bundle 插件**（`package.json` 声明 `dsh.bundle.patch` + web UI client bundle）。
- 安装后需**重启 DSH**（如 `dsh web`）才生效；Host 从 `~/.dsh/profiles/<profile>/node_modules/<包名>/` 解析并服务插件。
- 插件间相互独立，可按需任意组合安装；停用/卸载可用 [dsh-plugin-manager-lite](https://github.com/ShanHaiFish/dsh-plugins/tree/main/plugins/dsh-plugin-manager-lite) 在设置页完成。
- 刚发布的新插件托管在本仓库 `plugins/<包名>/`，安装 spec 为 `github:ShanHaiFish/dsh-plugins#path:plugins/<包名>`（pnpm `#path:` 子目录语法，已实测可用）；其原独立仓库（如 `dsh-plugin-manager-lite`）归档仅作历史存档，归档仓库仍可克隆，老 spec 安装不受影响。

## 反馈与贡献

各插件的问题与建议请到[对应仓库](https://github.com/ShanHaiFish?tab=repositories&q=topic%3Adsh-plugin)提 Issue；安全相关问题请参阅各仓库的 `SECURITY.md`。

## 许可

各插件均为 MIT License，详见各自仓库的 `LICENSE`。
