# AGENTS.md — fexp 左侧文件浏览器(DSH 动态 Cordis 插件)

给 AI 代理与本仓库协作者的运行手册。开始任何修改前请先读本文档。

## 项目是什么

`fexp` 是一个 DSH 动态 Cordis 插件:在 DSH Web 界面左侧工作区浏览目录与文件。
双入口(侧栏顶部「文件浏览」胶囊 + 会话标题栏「打开目录」按钮)→ 320px 滑出面板,
定位当前工作区目录,目录在前、文件在后,点击目录进入、点击文件预览文本内容。

当前版本:`v1.5.1`(见 `manifest.json` 的 `version` 字段与 `README.md` 版本历史)。
v1.1.0 起工具栏可一键在系统资源管理器中打开当前目录;v1.2.0 起预览文件时
「添加到聊天」把文件引用 `[文件名](绝对路径)` 追加到聊天输入框草稿。

## 文件结构与职责

| 文件 | 职责 | 修改时的注意 |
| --- | --- | --- |
| `host-source.js` | `cordis_define` 的 `code.host` 函数体原文(Host 半区 RPC) | 改完必须同步重建插件,不能只改文件 |
| `client-source.js` | `cordis_define` 的 `code.client` 函数体原文(Client 半区 UI) | 同上;纯 JS + `React.createElement`,无 JSX/TS |
| `manifest.json` | 插件元数据 + 恢复定义参数 + 版本号 | 版本号每次功能变更必须递增 |
| `README.md` | 用户文档 + 恢复步骤 + 版本历史 | 版本历史表随每次发布追加 |
| `AGENTS.md` | 本文件,代理协作约定 | 约定变更时同步更新 |

## 最重要的工作流:重建插件(DSH 重启后必做)

动态 Cordis 插件**不跨 DSH 进程存续**。DSH 重启后,仓库里的源码文件只是存档,
必须重新注册进当前进程:

1. 读取本目录 `host-source.js` 与 `client-source.js` 的完整内容;
2. 调用 `cordis_define`:
   - `plugin`: `{ "kind": "new", "idPrefix": "fexp" }`
   - `name`: `左侧文件浏览器`
   - `purpose`: `manifest.json` 中的 `purpose` 字段(含 `CAPABILITIES: fs, rpc` 声明)
   - `code.host` / `code.client`: 两个源码文件的完整内容(函数体)
3. 调用 `cordis_run` 激活返回的 `pluginId`/`packageId`(首次需要用户批准)。

一句话提示词:「按 `fexp-file-explorer` 目录重建文件浏览器插件」。

## 修改工作流(改功能时)

1. **读档**:先读 `AGENTS.md`、`README.md`、`manifest.json` 和相关源码;
2. **改源码**:只改 `host-source.js` / `client-source.js`(这是存档,也是事实来源);
3. **定义新 Package**:用 `cordis_define`(kind: `existing`,pluginId 为当前运行的插件 ID)
   追加新 Package,代码来自改后的源码文件;
4. **运行**:`cordis_run`(mode: `update`)切换到新 Package;
5. **同步文档**:功能变化时更新 `manifest.json`(version/purpose/slots/rpc/notes)
   与 `README.md`(功能描述/版本历史);
6. **提交**:git add + commit,提交信息遵循下面的约定。

> 不要只改源码文件而不重建插件,也不要只重建插件而不更新仓库存档 —— 两者必须一致。

## 编码与架构约定

- **Host 半区**:用 `ctx.get('fs')` 读取可选的 `fs` 服务(为 `undefined` 时直接 return),
  通过 `harness.handle(method, handler)` 暴露 Package-private RPC;路径先用
  `fs.resolve()` 解析,返回用 `fs.processPath()`;所有 handler 返回
  `{ ok: true, ... }` / `{ ok: false, error, code }` 结构,错误信息来自
  `err.message`。根目录取 `sandboxPolicy.workspaceRoot`,兜底 `fs.resolve('.')`。
- **Client 半区**:只用**增量插槽**(`shell.overlay`、`conversation.session.header.actions`、
  `sidebar.footer.action`、`conversation.input.dock`),绝不替换内置 UI;纯 JS +
  `React.createElement`,禁 JSX/TS;内联样式保证深色主题下可见。调用 Host 用
  `host.call(method, args)`,只传可序列化 JSON。
- **安全红线**:只声明 `CAPABILITIES: fs, rpc`;不引入网络请求、不 spawn 进程;
  新增 RPC 前先过 `plugin_security_review`,保持 WARN 级(≈33/300);
  优先复用 DSH 原生服务(如 `workspaces.openPath`)而非新增 Host RPC。
- **行为细节**(v1.0.0~v1.2.1 已验证,改动需回归):
  - 文件预览文本默认上限 256KB,最大 1MB,超限返回 `FS_TOO_LARGE` 明确提示;
  - 启动时序竞态防护:`useStore` 订阅后立即自愈同步当前状态;`sidebarWide` 默认 `true`;
  - 侧栏底部隐藏探针仅报告宽窄状态(渲染 null),不要让它产生可见 UI;
  - 在系统资源管理器中打开(v1.1.0):Client 直接 `ctx.get('workspaces').openPath(path)`
    (DSH 原生 host.openPath,Windows 走 Invoke-Item),不新增 Host RPC;
  - 添加到聊天(v1.2.0/1.2.1):`conversation.input.dock` 插槽内的隐藏桥捕获标准包
    `inputActions`(setDraft)与 `useInput`(草稿订阅),把 `[文件名](绝对路径)` 追加到
    现有草稿、不覆盖;v1.2.1 起按钮保持常显、无「已添加」状态,支持连续多次添加。

## 版本管理约定

- 版本号统一存放在 `manifest.json` 的 `version` 字段,`README.md` 版本历史表同步登记;
- 语义化版本:`v1.0.0` 起,功能变更递增 minor,修复递增 patch;
- 提交信息用 Conventional Commits,中文描述:
  - `feat:` 新功能 / `fix:` 缺陷修复 / `docs:` 文档 / `refactor:` 重构 / `chore:` 杂项;
  - 示例:`feat: 文件预览支持 markdown 渲染`、`fix: 面板在窄栏下溢出`、`docs: 新增 AGENTS.md 代理协作约定, 纳入版本管理`;
- 每次功能提交保持仓库三件套一致(源码 / manifest / README 版本历史);
- `.gitattributes` 固定 `* text=auto eol=lf`,保持 LF 换行,勿引入 CRLF。

## 常用命令

- 查看状态:`git status` / `git log --oneline`
- 提交:`git add <files>` + `git commit -m "<type>: <中文描述>"`
- 重建插件:见上文「最重要的工作流」
