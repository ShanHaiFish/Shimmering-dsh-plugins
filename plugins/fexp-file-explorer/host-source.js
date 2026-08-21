// ============================================================
// 左侧文件浏览器 (fexp) — v1.5.0 (DSH 动态 Cordis 插件 · 回退形态)
// 本文件是 cordis_define 的 code.host 参数原文(函数体)。
// 用途: 在左侧工作区浏览目录与文件, 点击目录进入、点击文件预览内容。
//
// v1.5.0 起主形态为静态 bundle(lib/index.js + client/client.js, 随 profile
// 自动加载); 本文件与 client-source.js 保留为动态插件回退形态(无 bundle
// 能力的 profile 按 README 恢复流程加载)。
//
// Host 半区职责:
//   - default-root: 返回当前工作区根目录(沙箱策略 workspaceRoot, 兜底 fs.resolve('.'))
//   - list-dir:     解析路径并列出目录内容(名称/类型/大小)
//   - read-file:    读取文本文件(默认上限 256KB, 最大 1MB, 超限明确报错)
// 全部通过 Package-private RPC (harness.handle) 暴露给 Client 半区。
//
// v1.1.0: Host 源码无改动。「在系统资源管理器中打开目录」由 Client 直接调用
// DSH 原生 host.openPath(workspaces.openPath), 不新增 RPC。
// v1.2.2: Host 源码无改动(「文件浏览」打开旧目录为 Client 侧状态绑定问题)。
// v1.2.3: Host 源码无改动(主题对比度为 Client 侧样式问题)。
// v1.3.0: Host 源码无改动(图标更换为 Client 侧 SVG path)。
// v1.4.0: Host 源码无改动(图标更换为 Material Icons, Client 侧 SVG path)。
//
// 恢复方式: 见 README.md。
// ============================================================
return {
  apply(ctx) {
    const fs = ctx.get('fs')
    if (fs === undefined) return
    const sandboxPolicy = ctx.get('sandboxPolicy')

    const messageOf = (err) => String((err && err.message) || err)

    harness.handle('default-root', async () => {
      try {
        let root
        if (sandboxPolicy && typeof sandboxPolicy.workspaceRoot === 'string' && sandboxPolicy.workspaceRoot) {
          root = sandboxPolicy.workspaceRoot
        } else {
          const target = await fs.resolve('.')
          root = fs.processPath(target)
        }
        return { ok: true, path: root }
      } catch (err) {
        return { ok: false, error: messageOf(err) }
      }
    })

    harness.handle('list-dir', async (args) => {
      try {
        const raw = args && args.path
        if (typeof raw !== 'string' || !raw) return { ok: false, error: '缺少目录路径' }
        const target = await fs.resolve(raw)
        const entries = await fs.listDir(target)
        return {
          ok: true,
          path: fs.processPath(target),
          entries: entries.map((e) => ({
            name: e.name,
            type: e.type,
            size: typeof e.size === 'number' ? e.size : null,
          })),
        }
      } catch (err) {
        return { ok: false, error: messageOf(err), code: err && err.code ? err.code : null }
      }
    })

    harness.handle('read-file', async (args) => {
      try {
        const raw = args && args.path
        if (typeof raw !== 'string' || !raw) return { ok: false, error: '缺少文件路径' }
        const maxBytes = Math.min(Math.max(Number(args.maxBytes) || 262144, 4096), 1048576)
        const target = await fs.resolve(raw)
        const info = await fs.stat(target)
        if (!info) return { ok: false, error: '文件不存在', code: 'FS_NOT_FOUND' }
        if (info.type !== 'file') return { ok: false, error: '不是普通文件，无法以文本方式打开', code: 'FS_NOT_REGULAR_FILE' }
        if (typeof info.size === 'number' && info.size > maxBytes) {
          return { ok: false, error: '文件过大（超过 ' + maxBytes + ' 字节），请在对话中让助手读取', code: 'FS_TOO_LARGE' }
        }
        const content = await fs.readText(target)
        return {
          ok: true,
          path: fs.processPath(target),
          content: content,
          bytes: typeof info.size === 'number' ? info.size : content.length,
        }
      } catch (err) {
        return { ok: false, error: messageOf(err), code: err && err.code ? err.code : null }
      }
    })
  },
}
