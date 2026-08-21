# DSH 第三方插件管理器 — 重启后一键恢复提示词

> 使用方法：重启 DSH 后，把下面「提示词」整段发给新会话的 AI，AI 会自动读取源码并重新部署本插件。

---

## 提示词（可直接复制）

```
请帮我把「第三方插件管理器」动态插件重新部署到当前 DSH 进程。

## 背景
这个插件（pluginId: tpm-3）是动态 Cordis 插件，定义只存在于进程内存中，DSH 重启后需要重新部署。源码已保存在本机项目目录中。

## 源码位置（用 read 工具读取）
- Host 半源码: M:\2026年\2026-DeepSeekHarness相关\dsh-plugin-Management\src\host.js
- Client 半源码: M:\2026年\2026-DeepSeekHarness相关\dsh-plugin-Management\src\client.js

## 部署步骤
1. 先用 read 工具读取上面两个文件（这是 cordis 插件源码，含注释头，可直接作为函数体传入）
2. 加载 cordis-plugin-development 技能，按标准流程操作
3. 调用 cordis_define：
   - plugin: { "kind": "existing", "pluginId": "tpm-3" }
   - name: "third-party-plugin-manager"
   - purpose: "第三方插件管理：列表/启用/停用/卸载/检查更新。CAPABILITIES: network,fs,file-read,file-write,loader"
   - code.host: 完整读取 src/host.js 的内容（整个文件，包括开头的注释块）
   - code.client: 完整读取 src/client.js 的内容（整个文件，包括开头的注释块）
4. 调用 cordis_run：mode = "run"（因为是重启后首次部署，没有 currentPackageId），pluginId = 返回的 pluginId，packageId = 返回的 packageId
5. 如果安全审查弹出确认框，请用户点击「同意」

## 验证
部署成功后：
- Host 端应注册 8 个 handler：listThirdPartyPlugins, listAllPlugins, enablePlugin, disablePlugin, uninstallPlugin, checkForUpdates, installUpdate, diagnose
- Client 端应在设置页「插件 → 第三方插件」显示 6 个第三方插件
- 用 cordis_inspect_self 确认 state 为 running

## 注意事项
- pluginId 固定为 tpm-3（重启后原定义已丢失，kind: existing 会重新创建同名插件）
- 如果 tpm-3 已被占用报错，则改用 kind: "new" + idPrefix: "tpm"，并把返回的新 pluginId 记下来
- 插件功能：停用/启用是持久化到 ~/.dsh/cordis.patch.yml（重启后仍保持），运行时热切换尽力而为
```

---

## 手动快速检查清单（给 AI 的辅助）

确认恢复成功：

| 检查项 | 方法 |
|---|---|
| 插件运行 | `cordis_inspect_self` 显示 state: running |
| Handler 就绪 | runtime.host.handlers 含 7 个方法 |
| UI 就绪 | 设置 → 插件 → 第三方插件，显示 6 个插件 |
| 持久化生效 | `~/.dsh/cordis.patch.yml` 中存在之前停用的插件（disabled: true） |

## 长期方案（可选，避免每次重启重部署）

如果需要插件在 DSH 重启后**自动加载**（无需提示词），需要把它从「动态插件」改造成「静态 bundle 插件」：
1. 将 src/host.js / src/client.js 包装成 npm 包（package.json 声明 `dsh` 字段 + `dsh.profile.bundles`）
2. 放入 `~/.dsh/plugins-dev/<name>/`（或安装到 profile）
3. 在 `~/.dsh/profiles/web/package.json` 的 `dsh.profile.bundles` 添加该包名
4. 运行 `pnpm install` 并重启 DSH

改造见项目 README 的「v5 里程碑：静态化安装」。