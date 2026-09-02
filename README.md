# 闪烁的 DSH 插件库

> **Shimmering-dsh-plugins** —— [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 第三方插件集 · 插件组主页
> 由 [@ShanHaiFish](https://github.com/ShanHaiFish) 开发维护 · 仓库：[ShanHaiFish/Shimmering-dsh-plugins](https://github.com/ShanHaiFish/Shimmering-dsh-plugins)

这里是「**闪烁的 DSH 插件库**」的索引主页：汇总全部插件、功能简介与一键安装命令。
**本仓库只做链接归组，不托管插件源码**——每个插件都是独立仓库，独立更新、独立打 tag、独立发布 Release，互不影响。
插件通过 GitHub 标签 [`dsh-plugin`](https://github.com/ShanHaiFish?tab=repositories&q=topic%3Adsh-plugin) 归组，新插件打上该标签即自动入库。

## 插件一览

> 排序规则：按 star 数降序（同 star 按字母序），顺序手动维护。

| 插件 | Stars | 版本 | 功能 |
|---|---|---|---|
| [dsh-plugin-security-review](https://github.com/ShanHaiFish/dsh-plugin-security-review) | ![stars](https://img.shields.io/github/stars/ShanHaiFish/dsh-plugin-security-review?style=social) | v1.8.1 | 插件安装安全审查守卫：`dsh plugin add` 前的安全审查闸门（security-first） |
| [dsh-check-for-updates](https://github.com/ShanHaiFish/dsh-check-for-updates) | ![stars](https://img.shields.io/github/stars/ShanHaiFish/dsh-check-for-updates?style=social) | v1.13.2 | DSH 更新检查：首次打开自动检查 npm 最新版本，左下方更新弹窗 +【更新到】按钮一键升级 |
| [dsh-plugin-manager-lite](https://github.com/ShanHaiFish/dsh-plugin-manager-lite) | ![stars](https://img.shields.io/github/stars/ShanHaiFish/dsh-plugin-manager-lite?style=social) | v0.1.1 | 第三方插件管理器：列表 / 启用 / 停用 / 卸载 / 检查更新 / npm 一键安装升级（设置页「插件 → 第三方插件」） |
| [dsh-theme-brick](https://github.com/ShanHaiFish/dsh-theme-brick) | ![stars](https://img.shields.io/github/stars/ShanHaiFish/dsh-theme-brick?style=social) | v0.2.1 | DSH 主题（Brick/砌砖）：暖石膏与烧制陶土配色、砖缝线条，纯 token 覆盖层零全局 CSS，设置页一键开关还原 |
| [fexp-file-explorer](https://github.com/ShanHaiFish/fexp-file-explorer) | ![stars](https://img.shields.io/github/stars/ShanHaiFish/fexp-file-explorer?style=social) | v1.6.1 | 左侧工作区文件浏览器：目录/文件浏览、文件预览、一键打开资源管理器、文件引用添加到聊天 |

## 安装

前置要求：

- DeepSeek Harness（`dsh`）`0.1.0-rc.7`+（developer preview，字段可能变化）
- Node.js `>=18`

以 `web` profile 为例（其他 profile 替换 `--profile` 参数）。插件均已发布 npm，按包名直接安装：

```bash
# 插件安装安全审查守卫
dsh plugin --profile web add dsh-plugin-security-review

# DSH 更新检查
dsh plugin --profile web add dsh-check-for-updates

# 第三方插件管理器（建议第一个安装，之后可用它管理其余插件）
dsh plugin --profile web add dsh-plugin-manager-lite

# 主题：砌砖（Brick）
dsh plugin --profile web add dsh-theme-brick

# 工作区文件浏览器
dsh plugin --profile web add fexp-file-explorer
```

安装指定版本（`@版本号`）：

```bash
dsh plugin --profile web add dsh-check-for-updates@1.13.2
```

## 通用说明

- ~~sent-msg-locator~~（对话轮次定位）已退役移除：**新版 DSH 官方客户端已内置对话轮次定位能力**，无需再安装第三方插件。
- 插件均为**静态 bundle 插件**（`package.json` 声明 `dsh.bundle.patch` + web UI client bundle）。
- 安装后需**重启 DSH**（如 `dsh web`）才生效；Host 从 `~/.dsh/profiles/<profile>/node_modules/<包名>/` 解析并服务插件。
- 插件间相互独立，可按需任意组合安装；停用/卸载可用 [dsh-plugin-manager-lite](https://github.com/ShanHaiFish/dsh-plugin-manager-lite) 在设置页完成。
- 各插件**独立更新与发布**：新版本到对应仓库的 [Releases](https://github.com/ShanHaiFish?tab=repositories&q=topic%3Adsh-plugin) 查看，升级重新执行对应安装命令即可。

## 反馈与贡献

各插件的问题与建议请到[对应仓库](https://github.com/ShanHaiFish?tab=repositories&q=topic%3Adsh-plugin)提 Issue；安全相关问题请参阅各仓库的 `SECURITY.md`。

## 许可

各插件均为 MIT License，详见各自仓库的 `LICENSE`。
