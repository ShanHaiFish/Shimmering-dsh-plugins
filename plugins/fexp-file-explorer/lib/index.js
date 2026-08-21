// ============================================================
// 左侧文件浏览器 (fexp) — v1.5.0 (DSH 静态 bundle 插件 · Host 半区)
// 随 profile 层栈自动加载(像 dsh-plugin-security-review / dshmarket 一样),
// 无需每次重启 DSH 后重新 cordis_define/run。
//
// 通过 webServer 暴露三个 JSON 路由供 Client 半区(client/client.js)调用:
//   GET  /fexp/default-root   返回当前工作区根目录(sandboxPolicy.workspaceRoot,
//                             兜底 fs.resolve('.'))
//   POST /fexp/list-dir       列出目录内容 { path } → { ok, path, entries }
//   POST /fexp/read-file      读取文本文件 { path, maxBytes? } → { ok, path, content, bytes }
//
// 底层复用 DSH 的 fs 服务(resolve/listDir/stat/readText/processPath),
// 与动态形态(host-source.js)的 RPC 行为保持一致。
// ============================================================
export const name = 'fexp'

function messageOf(err) {
  return String((err && err.message) || err)
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

async function readJsonBody(request, limit = 64 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > limit) throw new Error('request body too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export function apply(ctx) {
  ctx.inject(['webServer'], (hostCtx) => {
    const fs = hostCtx.get('fs')
    if (fs === undefined) return
    const sandboxPolicy = hostCtx.get('sandboxPolicy')

    const disposers = [
      hostCtx.webServer.register({
        kind: 'exact',
        path: '/fexp/default-root',
        handler: async (request, response) => {
          try {
            let root
            if (sandboxPolicy && typeof sandboxPolicy.workspaceRoot === 'string' && sandboxPolicy.workspaceRoot) {
              root = sandboxPolicy.workspaceRoot
            } else {
              const target = await fs.resolve('.')
              root = fs.processPath(target)
            }
            sendJson(response, 200, { ok: true, path: root })
          } catch (err) {
            sendJson(response, 200, { ok: false, error: messageOf(err) })
          }
        },
      }),
      hostCtx.webServer.register({
        kind: 'exact',
        path: '/fexp/list-dir',
        handler: async (request, response) => {
          try {
            const args = await readJsonBody(request)
            const raw = args && args.path
            if (typeof raw !== 'string' || !raw) {
              sendJson(response, 200, { ok: false, error: '缺少目录路径' })
              return
            }
            const target = await fs.resolve(raw)
            const entries = await fs.listDir(target)
            sendJson(response, 200, {
              ok: true,
              path: fs.processPath(target),
              entries: entries.map((e) => ({
                name: e.name,
                type: e.type,
                size: typeof e.size === 'number' ? e.size : null,
              })),
            })
          } catch (err) {
            sendJson(response, 200, { ok: false, error: messageOf(err), code: err && err.code ? err.code : null })
          }
        },
      }),
      hostCtx.webServer.register({
        kind: 'exact',
        path: '/fexp/read-file',
        handler: async (request, response) => {
          try {
            const args = await readJsonBody(request)
            const raw = args && args.path
            if (typeof raw !== 'string' || !raw) {
              sendJson(response, 200, { ok: false, error: '缺少文件路径' })
              return
            }
            const maxBytes = Math.min(Math.max(Number(args.maxBytes) || 262144, 4096), 1048576)
            const target = await fs.resolve(raw)
            const info = await fs.stat(target)
            if (!info) {
              sendJson(response, 200, { ok: false, error: '文件不存在', code: 'FS_NOT_FOUND' })
              return
            }
            if (info.type !== 'file') {
              sendJson(response, 200, { ok: false, error: '不是普通文件，无法以文本方式打开', code: 'FS_NOT_REGULAR_FILE' })
              return
            }
            if (typeof info.size === 'number' && info.size > maxBytes) {
              sendJson(response, 200, {
                ok: false,
                error: '文件过大（超过 ' + maxBytes + ' 字节），请在对话中让助手读取',
                code: 'FS_TOO_LARGE',
              })
              return
            }
            const content = await fs.readText(target)
            sendJson(response, 200, {
              ok: true,
              path: fs.processPath(target),
              content: content,
              bytes: typeof info.size === 'number' ? info.size : content.length,
            })
          } catch (err) {
            sendJson(response, 200, { ok: false, error: messageOf(err), code: err && err.code ? err.code : null })
          }
        },
      }),
    ]

    hostCtx.effect(() => () => {
      for (const dispose of disposers) {
        try {
          dispose()
        } catch (e) {
          /* ignore */
        }
      }
    }, 'fexp: http routes')
  })
}
