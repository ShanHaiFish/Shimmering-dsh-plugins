# 贡献指南 (Contributing)

感谢你愿意为 **dsh-plugin-manager-lite** 贡献！请花几分钟阅读以下约定。

## 工作流

1. **先讨论，后编码**：对于较大的改动，请先开 Issue 讨论方案，避免浪费精力。
2. **Fork + 分支**：从 `main` 新建功能分支（如 `feat/enable-foo`、`fix/list-bug`）。
3. **小步提交**：每个提交只做一件事，提交信息清晰（用 changesets 风格：`feat:` / `fix:` / `docs:` / `refactor:` / `chore:`）。
4. **提交 Pull Request**：PR 需关联 Issue、描述改动与测试。

## 开发环境

- Node.js `>=18`、DSH `0.1.0-rc.7+`

```bash
# 语法检查
npm run check
```

## 代码规范

- **纯 JavaScript / ESM**：Host（`lib/index.js`）为 ESM 模块；Client（`client/client.js`）为浏览器 bundle（`window.__ModuleLoader__.load`）。
- **金三角规则**：`package.json` 的 `name`、`cordis.patch.yml` 的 `name`、`client/client.js` 的 `__ModuleLoader__.load({ id })` 三者必须等于**包名**。
- **Host 与 Client 通信**：Client 用同源 `fetch('/tppm/<method>')` 调用 Host 的 `webServer` 路由，不用动态 `host.call`。
- **只 require 平台种子词**：Client 的 `require` 只能加载 `react` 等已注册模块，不能触发网络加载。
- **生命周期可回收**：Host 的副作用（路由等）放入 `ctx.effect` 的 disposer，确保停止/更新时清除。

## 测试

当前没有自动化测试框架；至少保证：

- `node --check lib/index.js && node --check client/client.js` 通过；
- 如有涉及 dsh 运行时的改动，在本地 profile 装好插件并重启验证。

## 提交信息

建议遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：

```
feat: 增加按来源筛选插件
fix: 修复停用插件从列表消失的问题
docs: 更新 README 安装说明
```

## 提交 PR 前检查清单

- [ ] `npm run check` 通过
- [ ] 代码遵循本指南规范
- [ ] README / CHANGELOG 相应更新
- [ ] 已同步到本地 profile 并重启验证

再次感谢你的贡献！
