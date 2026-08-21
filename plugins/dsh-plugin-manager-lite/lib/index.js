// ============================================================
// 第三方插件管理器 (dsh-plugin-manager-lite) — v0.1.0 (静态 bundle 插件 · Host 半区)
// 随 profile 层栈自动加载（像 dsh-check-for-updates / fexp-file-explorer 一样），
// 无需每次重启 DSH 后在会话内重新 cordis_define/run。
//
// 与动态形态(src/host.js)的差异:
//   - 动态的 harness.handle(method, fn) → 这里用 webServer.register 暴露同源 JSON 路由:
//       POST /tppm/listThirdPartyPlugins
//       POST /tppm/listAllPlugins
//       POST /tppm/enablePlugin
//       POST /tppm/disablePlugin
//       POST /tppm/uninstallPlugin
//       POST /tppm/checkForUpdates
//       POST /tppm/diagnose
//     Client 半区(client/client.js)用 fetch('/tppm/<method>', {POST}) 调用，返回 { ok, data } / { ok:false, error }。
//   - 其余逻辑(列表收集、loader 运行时热切换、~/.dsh/cordis.patch.yml 持久化停用、
//     profile package.json 卸载、npm registry 更新检查)与动态形态完全一致。
//
// 安全提示：本插件会读写文件(~/.dsh/cordis.patch.yml、profile package.json)、
// 读取 clientModules/loader，并通过 web.fetch 访问 npm registry，属于高能力插件，
// 需由操作者在安全白名单放行。
// ============================================================

export const name = 'tppm'
export const inject = ['webServer']

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
  // ------------------------------------------------ 路径推导

  /** 路径统一为正斜杠（clientPath 在 Windows 返回反斜杠路径） */
  function normPath(p) {
    return (p || '').replace(/\\/g, '/')
  }

  /** 从 bundle 路径推导 DSH home 目录（C:/Users/x/.dsh） */
  function dshHomeOf(bundlePath) {
    const p = normPath(bundlePath)
    const idx = p.indexOf('/.dsh/')
    if (idx === -1) return null
    return p.slice(0, idx + 5) // 含 /.dsh
  }

  /** 从 bundle 路径推导 profile 根目录（.../profiles/web） */
  function profileRootOf(bundlePath) {
    const p = normPath(bundlePath)
    const idx = p.indexOf('/node_modules/')
    if (idx === -1) return null
    return p.slice(0, idx)
  }

  /** 从 bundle 路径推导 profile 的 package.json 绝对路径 */
  function profilePackagePathOf(bundlePath) {
    const root = profileRootOf(bundlePath)
    return root ? root + '/package.json' : null
  }

  /**
   * 从 graph 里挑一个「走 profile 安装」的 bundle 的 client 路径，用来推导真正的
   * profile 根目录。不能取任意有路径的 entry：graph 开头是核心/host 插件，其路径在
   * 全局 dsh 安装里（如 C:/home/whaow/.npm-global/node_modules/...），往下推会得到
   * 全局 npm 根而不是 profile；只有路径含 `/profiles/` 的才是 profile 里安装的 bundle。
   */
  function firstProfileBundlePath(graph, clientModules) {
    for (const entry of (graph.entries || [])) {
      const p = clientModules.clientPath(entry && entry.id) || ''
      if (p && normPath(p).indexOf('/profiles/') !== -1) return p
    }
    return ''
  }

  // ------------------------------------------------ 文件工具（fs 服务）

  async function readJsonFile(absPath) {
    const fs = ctx.get('fs')
    if (!fs || !absPath) return null
    try {
      const target = await fs.resolve(absPath)
      const text = await fs.readText(target)
      return JSON.parse(text)
    } catch (e) {
      return null
    }
  }

  async function writeJsonFile(absPath, value) {
    const fs = ctx.get('fs')
    if (!fs || !absPath) return false
    try {
      const target = await fs.resolve(absPath)
      await fs.writeText(target, JSON.stringify(value, null, 2) + '\n')
      return true
    } catch (e) {
      console.error('[tppm] 写入失败: ' + absPath + ' -> ' + (e && e.message))
      return false
    }
  }

  async function readTextFile(absPath) {
    const fs = ctx.get('fs')
    if (!fs || !absPath) return null
    try {
      const target = await fs.resolve(absPath)
      return await fs.readText(target)
    } catch (e) {
      return null
    }
  }

  async function writeTextFile(absPath, content) {
    const fs = ctx.get('fs')
    if (!fs || !absPath) return false
    try {
      const target = await fs.resolve(absPath)
      await fs.writeText(target, content)
      return true
    } catch (e) {
      console.error('[tppm] 写入失败: ' + absPath + ' -> ' + (e && e.message))
      return false
    }
  }

  // ------------------------------------------------ 从 bundle 路径向上查找包根目录的 package.json

  async function loadPkgMeta(id, bundlePath) {
    const fs = ctx.get('fs')
    if (!fs || !bundlePath) return null
    let dir = bundlePath.replace(/\\/g, '/')
    const slashIdx = dir.lastIndexOf('/')
    if (slashIdx < 0) return null
    dir = dir.slice(0, slashIdx)
    for (let i = 0; i < 6; i++) {
      try {
        const target = await fs.resolve(dir + '/package.json')
        const text = await fs.readText(target)
        const pkg = JSON.parse(text)
        if (pkg && pkg.name === id) return pkg
      } catch (e) { /* 继续向上 */ }
      const idx = dir.lastIndexOf('/')
      if (idx < 0) break
      dir = dir.slice(0, idx)
    }
    return null
  }

  /** 解析 author 字段（字符串或对象） */
  function authorOf(pkg) {
    if (!pkg || !pkg.author) return ''
    if (typeof pkg.author === 'string') return pkg.author
    if (typeof pkg.author === 'object' && pkg.author && pkg.author.name) return pkg.author.name
    return ''
  }

  // ------------------------------------------------ Loader 运行时热切换

  /** 在 Loader 树中查找某个包的 entry（非 group） */
  async function findLoaderEntry(pluginId) {
    const loader = ctx.get('loader')
    if (!loader) return null
    for (const entry of loader.entries()) {
      if (entry.options && entry.options.name === pluginId && !entry.options.group) {
        return entry
      }
    }
    return null
  }

  /** 诊断：loader 服务可用性与 entry 匹配情况（返回纯 JSON） */
  async function diagnoseLoader(pluginId) {
    const out = { loaderAvailable: false, entryCount: 0, matchedEntry: null, sampleNames: [] }
    try {
      const loader = ctx.get('loader')
      if (!loader) return out
      out.loaderAvailable = true
      // loader.entries() 是生成器，必须先展开为数组
      const entries = Array.from(loader.entries() || [])
      out.entryCount = entries.length
      out.sampleNames = entries.slice(0, 12).map((e) => e && e.options && e.options.name)
        .filter((n) => typeof n === 'string' && n.length > 0)
      for (const entry of entries) {
        if (entry && entry.options && entry.options.name === pluginId && !entry.options.group) {
          out.matchedEntry = {
            id: typeof entry.id === 'string' ? entry.id : String(entry.id),
            name: String(entry.options.name),
            disabled: !!entry.disabled,
            hasFiber: !!entry.fiber,
            group: !!entry.options.group,
          }
          break
        }
      }
    } catch (e) {
      out.error = (e && e.message) || String(e)
    }
    return out
  }

  /** 当前 Loader 中该插件是否有效启用（fiber 活着） */
  async function pluginActuallyEnabled(pluginId) {
    const entry = await findLoaderEntry(pluginId)
    if (!entry) return null
    return !entry.disabled && !!entry.fiber
  }

  // ------------------------------------------------ home patch 持久化（$DSH_HOME/cordis.patch.yml）

  /**
   * 读取 home patch 文件内容（顶层 YAML 数组）。
   * 由于动态环境无 YAML 库，采用轻量行级维护：
   *   - 读原文
   *   - 查找 `- id: <pluginId>` 条目块
   *   - 修改该块内的 `disabled: ...` 行，或整块追加
   */
  function splitPatchEntries(text) {
    const entries = []
    if (!text || !text.trim()) return entries
    const lines = text.split(/\r?\n/)
    let current = null
    for (const line of lines) {
      if (/^\s*-\s+id:/.test(line)) {
        if (current) entries.push(current)
        current = { header: line, body: [] }
      } else if (current) {
        current.body.push(line)
      }
    }
    if (current) entries.push(current)
    return entries
  }

  /** 在 patch 文本中设置某个插件的 disabled 状态；返回新文本 */
  function setPatchDisabled(text, pluginId, disabled) {
    const lines = (text || '').split(/\r?\n/)
    const out = []
    let blockStart = -1
    let blockEnd = -1
    // 找目标块
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*-\s+id:/.test(lines[i]) && lines[i].includes(pluginId)) {
        blockStart = i
        blockEnd = i + 1
        while (blockEnd < lines.length && !/^\s*-\s+id:/.test(lines[blockEnd]) && lines[blockEnd].trim() !== '') {
          blockEnd++
        }
        break
      }
    }
    if (blockStart !== -1) {
      // 修改现有块
      const blockLines = lines.slice(blockStart, blockEnd)
      const cleaned = blockLines.filter((l) => !/^\s*disabled:/.test(l))
      if (disabled) {
        // 保留缩进
        const indent = (blockLines[0].match(/^\s*/) || [''])[0]
        cleaned.push(indent + '  disabled: true')
      }
      out.push(...lines.slice(0, blockStart), ...cleaned, ...lines.slice(blockEnd))
      // 清理连续空行
      return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
    }
    // 追加新块（仅禁用时需要；启用时无块则无需写入）
    if (!disabled) return (text || '').trim() + '\n'
    const base = (text || '').trim()
    const addition = '- id: ' + pluginId + '\n  disabled: true'
    return base ? base + '\n' + addition + '\n' : addition + '\n'
  }

  /**
   * 解析某个第三方插件在 loader 中的真实 entry id（即 bundle 层插入的短 id，如
   * fexp / dsh-market / updck / tppm），home patch 的禁用类条目必须以这个短 id 为目标，
   * 而不是 npm 包名（包名只是 options.name，loader 按 options.id 匹配补丁）。
   * 已停用插件在 loader.entries() 中仍保留（无 fiber），因此 findLoaderEntry 总能返回其 id。
   * 找不到时兜底读插件自身 bundle 目录的 cordis.patch.yml 里的 insert id，再兜底用包名。
   */
  async function resolveDisableId(pluginId) {
    try {
      const entry = await findLoaderEntry(pluginId)
      // 用 entry.options.id（裸短 id，如 fexp / dsh-market / updck / tppm）作为 home patch
      // 的目标：loader 按 options.id 匹配补丁。不能直接用 entry.id（其 getter 会加父级
      // 前缀，如 include:fexp），否则写入的 id 对不上已验证可用的 `- id: fexp`。
      if (entry && entry.options && entry.options.id) return String(entry.options.id)
    } catch (e) { /* ignore */ }
    const cm = ctx.get('clientModules')
    const bp = cm ? (cm.clientPath(pluginId) || '') : ''
    if (bp) {
      const dir = normPath(bp).replace(/\/[^/]*\/?$/, '')
      const pt = await readTextFile(dir + '/cordis.patch.yml')
      if (pt) {
        const m = pt.match(/(?:^|\n)\s*-\s+id:\s*([^\s,'"#]+)/)
        if (m && m[1]) return m[1]
      }
    }
    return pluginId
  }

  /** 持久化 disabled 状态到 home patch（以 loader entry 短 id 为目标） */
  async function persistDisabled(bundlePath, pluginId, disabled) {
    const home = dshHomeOf(bundlePath)
    if (!home) return false
    const path = home + '/cordis.patch.yml'
    const existing = await readTextFile(path)
    const disableId = await resolveDisableId(pluginId)
    const next = setPatchDisabled(existing || '', disableId, disabled)
    return await writeTextFile(path, next)
  }

  // ------------------------------------------------ profile package.json 维护（卸载）

  /** 从 profile package.json 移除一个插件（dependencies + bundles） */
  async function removeFromProfile(bundlePath, pluginId) {
    const pkgPath = profilePackagePathOf(bundlePath)
    if (!pkgPath) return { ok: false, message: '无法定位 profile 配置' }
    const profile = await readJsonFile(pkgPath)
    if (!profile) return { ok: false, message: '无法读取 profile 配置' }
    let changed = false
    // dependencies
    if (profile.dependencies && profile.dependencies[pluginId] !== undefined) {
      delete profile.dependencies[pluginId]
      changed = true
    }
    // devDependencies
    if (profile.devDependencies && profile.devDependencies[pluginId] !== undefined) {
      delete profile.devDependencies[pluginId]
      changed = true
    }
    // bundles
    if (profile.dsh && profile.dsh.profile && Array.isArray(profile.dsh.profile.bundles)) {
      const before = profile.dsh.profile.bundles.length
      profile.dsh.profile.bundles = profile.dsh.profile.bundles.filter((b) => b !== pluginId)
      if (profile.dsh.profile.bundles.length !== before) changed = true
    }
    if (!changed) return { ok: false, message: '该插件不在 profile 配置中（可能由其他方式安装）' }
    const wrote = await writeJsonFile(pkgPath, profile)
    if (!wrote) return { ok: false, message: '写入 profile 配置失败' }
    return { ok: true, message: '已从 profile 配置移除（重启后生效）' }
  }

  // ------------------------------------------------ 服务主体

  // 直接从包目录读取 package.json（用于已停用插件，其 bundle 已从 clientModules 表移除）
  async function loadPkgFromDir(id, pkgDir) {
    const fs = ctx.get('fs')
    if (!fs || !pkgDir) return null
    try {
      const target = await fs.resolve(normPath(pkgDir) + '/package.json')
      const text = await fs.readText(target)
      const pkg = JSON.parse(text)
      if (pkg && pkg.name === id) return pkg
    } catch (e) { /* 读取失败 */ }
    return null
  }

  /**
   * 解析插件的 package.json 与包目录（含已停用插件）。
   * 已停用插件会被从 clientModules 表移除，clientPath(id) 返回空串，
   * 因此必须兜底从 profile 的 node_modules 直接读取 —— 否则「检查更新」会误报
   * 「插件不存在」（与 collectPlugin 的列表采集逻辑保持一致）。
   */
  async function resolvePluginPackage(clientModules, pluginId) {
    let bundlePath = clientModules ? (clientModules.clientPath(pluginId) || '') : ''
    let pkg = bundlePath ? await loadPkgMeta(pluginId, bundlePath) : null
    if (!pkg) {
      const graph = clientModules ? clientModules.graph() : null
      const anyPath = graph ? firstProfileBundlePath(graph, clientModules) : ''
      const root = anyPath ? profileRootOf(anyPath) : null
      if (root) {
        const fallbackDir = pluginId.indexOf('@') === 0
          ? root + '/node_modules/' + pluginId.replace('/', '/')
          : root + '/node_modules/' + pluginId
        pkg = await loadPkgFromDir(pluginId, fallbackDir)
        if (pkg) bundlePath = fallbackDir + '/client.js'
      }
    }
    return { pkg, dir: bundlePath }
  }

  /**
   * 判断插件是否为本地安装，从而跳过 npm 更新检查。
   * 两个判据：包目录含 plugins-dev；或 profile 依赖声明为 file:/link:/workspace: 等本地协议。
   * 不能只靠路径含 'plugins-dev'：pnpm 把 file: 依赖装进 node_modules/ 后，
   * clientPath 返回的是 node_modules 下的路径，不含 plugins-dev，
   * 那样本地插件会被误当成 npm 包去 registry 查询而报「无法获取远程版本信息」。
   */
  async function isLocallyInstalled(pluginId, dir) {
    if (dir && normPath(dir).indexOf('plugins-dev') !== -1) return true
    const clientModules = ctx.get('clientModules')
    const graph = clientModules ? clientModules.graph() : null
    const anyPath = graph ? firstProfileBundlePath(graph, clientModules) : ''
    const pkgPath = anyPath ? profilePackagePathOf(anyPath) : null
    const profile = pkgPath ? await readJsonFile(pkgPath) : null
    if (!profile) return false
    const spec = (profile.dependencies && profile.dependencies[pluginId]) ||
                 (profile.devDependencies && profile.devDependencies[pluginId])
    return typeof spec === 'string' && /^(file:|link:|workspace:|\.\/|\.\.\/)/.test(spec)
  }

  /** 从 npm registry 查询某个包的最新版本号；查询不到返回 ''（供检查更新与安装复用） */
  async function fetchLatestVersion(pluginId) {
    const web = ctx.get('web')
    if (!web) return ''
    try {
      const encoded = pluginId.indexOf('@') === 0 ? pluginId.replace('/', '%2F') : pluginId
      const fetched = await web.fetch({ url: 'https://registry.npmjs.org/' + encoded + '/latest' })
      // WebFetchResult: { url, statusCode, body: { kind, content }, truncated }
      const text = fetched && fetched.body && typeof fetched.body.content === 'string' ? fetched.body.content : ''
      let remote = null
      try { remote = JSON.parse(text) } catch (e) { /* 解析失败 */ }
      return (remote && remote.version) || ''
    } catch (e) {
      return ''
    }
  }

  /** 推导 profile 根目录（从任意走 profile 安装的 bundle 路径） */
  function deriveProfileRoot() {
    const clientModules = ctx.get('clientModules')
    if (!clientModules) return ''
    const graph = clientModules.graph()
    const anyPath = firstProfileBundlePath(graph, clientModules)
    return anyPath ? profileRootOf(anyPath) : ''
  }

  /**
   * 生成可直接 spawn 的 argv。subprocess 的 spawn 不经 shell（shell:false），
   * Windows 上 .cmd/.bat 垫片无法被 Node 直接启动（会抛 EINVAL），
   * 因此把它们改经 cmd.exe /d /s /c 启动。
   */
  function spawnableArgv(bin, args) {
    let lower = ''
    try { lower = String(bin).toLowerCase() } catch (e) { /* ignore */ }
    if (process.platform === 'win32' && /\.(cmd|bat)$/.test(lower)) {
      return [process.env.ComSpec || 'cmd.exe', '/d', '/s', '/c', bin, ...args]
    }
    return [bin, ...args]
  }

  // 读取 home patch 中某个插件的 disabled 标记（持久化状态，按 loader entry 短 id 匹配）
  async function patchedDisabledOf(bundlePath, pluginId) {
    const home = dshHomeOf(bundlePath)
    if (!home) return false
    const text = await readTextFile(home + '/cordis.patch.yml')
    if (!text) return false
    const disableId = await resolveDisableId(pluginId)
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*-\s+id:/.test(lines[i]) && lines[i].includes(disableId)) {
        // 检查该块的 disabled 行
        let j = i + 1
        while (j < lines.length && !/^\s*-\s+id:/.test(lines[j]) && lines[j].trim() !== '') {
          if (/^\s*disabled:\s*true\s*$/.test(lines[j])) return true
          j++
        }
      }
    }
    return false
  }

  // 收集一个第三方插件的信息；已停用的插件 graph 中不存在，但 profile 配置仍在
  async function collectPlugin(clientModules, id, seen, profileRoot) {
    if (!id || id.startsWith('@deepseek-ai/') || seen.has(id)) return
    seen.add(id)
    let bundlePath = clientModules.clientPath(id) || ''
    let pkg = bundlePath ? await loadPkgMeta(id, bundlePath) : null
    // 已停用插件拿不到 clientPath：从 profile 的 node_modules 直接读
    let fallbackDir = ''
    if (!pkg && profileRoot) {
      fallbackDir = id.indexOf('@') === 0
        ? profileRoot + '/node_modules/' + id.replace('/', '/')
        : profileRoot + '/node_modules/' + id
      pkg = await loadPkgFromDir(id, fallbackDir)
    }
    const actualEnabled = await pluginActuallyEnabled(id)
    // 已停用插件 clientPath 为空，但用 fallbackDir 也能推导 home 读取持久化标记；
    // disableId 由 loader entry 的短 id 决定。
    const patchedDisabled = await patchedDisabledOf(
      bundlePath || (fallbackDir ? fallbackDir + '/client.js' : ''), id
    )
    // enabled = loader 实际运行 且 未被持久化停用
    const enabled = actualEnabled !== false && !patchedDisabled
    const displayPath = bundlePath || (fallbackDir ? fallbackDir + '/client.js' : '')
    return {
      id,
      name: (pkg && pkg.name) || id,
      version: (pkg && pkg.version) || '',
      description: (pkg && pkg.description) || '',
      author: authorOf(pkg),
      homepage: (pkg && pkg.homepage) || '',
      repository: (pkg && pkg.repository && (typeof pkg.repository === 'string' ? pkg.repository : pkg.repository.url)) || '',
      enabled,
      persistedDisabled: patchedDisabled,
      path: displayPath,
      installedLocally: await isLocallyInstalled(id, displayPath),
    }
  }

  const pluginManager = {
    // 获取第三方插件列表（排除 @deepseek-ai/ 官方包）
    // 数据源合并：当前 graph（运行中的）+ profile.bundles（配置中但可能已停用）
    async listThirdPartyPlugins() {
      const clientModules = ctx.get('clientModules')
      if (!clientModules) return []
      const graph = clientModules.graph()
      const seen = new Set()
      const plugins = []
      // 用 profile 内安装的某个 bundle 的 client 路径推导 profile 根（供已停用插件兜底）。
      // 不能用 graph.entries[0]：开头是核心/host 插件，clientPath 指向全局 dsh 安装，
      // 会推导出全局 npm 根而不是 profile 根，导致 bundles 为空、停用插件从列表消失。
      const anyPath = firstProfileBundlePath(graph, clientModules)
      const profilePkgPath = anyPath ? profilePackagePathOf(anyPath) : null
      const profileRoot = profilePkgPath ? profileRootOf(anyPath) : null
      const profile = profilePkgPath ? await readJsonFile(profilePkgPath) : null
      const bundles = profile && profile.dsh && profile.dsh.profile && Array.isArray(profile.dsh.profile.bundles)
        ? profile.dsh.profile.bundles
        : []
      // 1. 当前运行中的第三方插件（graph）
      for (const entry of (graph.entries || [])) {
        const info = await collectPlugin(clientModules, entry && entry.id, seen, profileRoot)
        if (info) plugins.push(info)
      }
      // 2. profile.bundles 中配置但已停用的第三方插件（停用后 graph 不再包含它）
      for (const bundleId of bundles) {
        if (bundleId && bundleId.startsWith('@deepseek-ai/')) continue // 跳过官方 bundle
        const info = await collectPlugin(clientModules, bundleId, seen, profileRoot)
        if (info) plugins.push(info)
      }
      return plugins
    },

    // 获取所有插件（含官方，供对比调试）
    async listAllPlugins() {
      const clientModules = ctx.get('clientModules')
      if (!clientModules) return []
      const graph = clientModules.graph()
      return (graph.entries || []).map((entry) => {
        return { id: entry.id, isOfficial: entry.id.indexOf('@deepseek-ai/') === 0 }
      })
    },

    // 启用插件（运行时热启用 + 持久化）
    async enablePlugin(pluginId) {
      console.log('[tppm] 启用插件: ' + pluginId)
      const clientModules = ctx.get('clientModules')
      let bundlePath = clientModules ? (clientModules.clientPath(pluginId) || '') : ''
      // 已停用插件拿不到 clientPath：从 profile 内安装的 bundle 推导 home
      if (!bundlePath && clientModules) {
        const graph = clientModules.graph()
        const anyPath = firstProfileBundlePath(graph, clientModules)
        if (anyPath) {
          const root = profileRootOf(anyPath)
          bundlePath = normPath(pluginId.indexOf('@') === 0
            ? root + '/node_modules/' + pluginId.replace('/', '/') + '/client.js'
            : root + '/node_modules/' + pluginId + '/client.js')
        }
      }
      // 1. 运行时热启用
      const entry = await findLoaderEntry(pluginId)
      let updateError = null
      if (entry) {
        try {
          await entry.update({ disabled: false })
        } catch (e) {
          updateError = (e && e.message) || String(e)
          console.error('[tppm] 热启用失败: ' + updateError)
        }
      } else {
        updateError = 'loader 中未找到该插件的 entry（可能未在配置中）'
      }
      // 2. 持久化到 home patch
      let persisted = false
      if (bundlePath) persisted = await persistDisabled(bundlePath, pluginId, false)
      return {
        success: updateError === null,
        message: updateError === null
          ? '插件 ' + pluginId + ' 已启用' + (persisted ? '（已持久化，重启后保持）' : '（运行时生效，未持久化）')
          : '启用失败: ' + updateError,
        diagnostic: { updateError, persisted },
      }
    },

    // 停用插件（运行时热停用 + 持久化）
    async disablePlugin(pluginId) {
      console.log('[tppm] 停用插件: ' + pluginId)
      const clientModules = ctx.get('clientModules')
      let bundlePath = clientModules ? (clientModules.clientPath(pluginId) || '') : ''
      // 1. 运行时热停用
      const entry = await findLoaderEntry(pluginId)
      let updateError = null
      let afterDisabled = null
      let afterHasFiber = null
      if (entry) {
        try {
          console.log('[tppm] 找到 entry: name=' + entry.options.name + ' disabled=' + entry.disabled + ' hasFiber=' + !!entry.fiber)
          await entry.update({ disabled: true })
          // update 后立即复查状态
          afterDisabled = !!entry.disabled
          afterHasFiber = !!entry.fiber
          console.log('[tppm] update 后: disabled=' + afterDisabled + ' hasFiber=' + afterHasFiber)
          if (!afterDisabled) {
            updateError = 'update 调用完成但 entry.disabled 仍为 false（热切换未生效）'
          }
        } catch (e) {
          updateError = (e && e.message) || String(e)
          console.error('[tppm] 热停用失败: ' + updateError)
        }
      } else {
        updateError = 'loader 中未找到该插件的 entry'
      }
      // 2. 持久化到 home patch（clientPath 在热停用后仍可查，此处兜底）
      let persisted = false
      if (bundlePath) persisted = await persistDisabled(bundlePath, pluginId, true)
      const loaderDiag = await diagnoseLoader(pluginId)
      return {
        success: updateError === null,
        message: updateError === null
          ? '插件 ' + pluginId + ' 已停用' + (persisted ? '（已持久化，重启后保持）' : '（运行时生效，未持久化）')
          : '停用失败: ' + updateError,
        diagnostic: {
          loaderAvailable: loaderDiag.loaderAvailable,
          entryCount: loaderDiag.entryCount,
          matchedEntry: loaderDiag.matchedEntry,
          updateError,
          afterDisabled,
          afterHasFiber,
          persisted,
        },
      }
    },

    // 卸载插件（运行时停用 + 从 profile 配置移除 + 持久化 disabled）
    async uninstallPlugin(pluginId) {
      console.log('[tppm] 卸载插件: ' + pluginId)
      const clientModules = ctx.get('clientModules')
      const bundlePath = clientModules ? (clientModules.clientPath(pluginId) || '') : ''
      // 1. 运行时停用
      const entry = await findLoaderEntry(pluginId)
      if (entry) {
        try {
          await entry.update({ disabled: true })
        } catch (e) { /* 忽略 */ }
      }
      // 2. 持久化 disabled
      if (bundlePath) await persistDisabled(bundlePath, pluginId, true)
      // 3. 从 profile 配置移除依赖与 bundles
      const removed = bundlePath ? await removeFromProfile(bundlePath, pluginId) : { ok: false, message: '无法定位安装路径' }
      return {
        success: removed.ok,
        message: '插件 ' + pluginId + ' 已卸载：' + removed.message + '。请重启 DSH 完成清理。',
      }
    },

    // 检查更新：查询 npm registry
    async checkForUpdates(pluginId) {
      console.log('[tppm] 检查更新: ' + pluginId)
      const clientModules = ctx.get('clientModules')
      if (!clientModules) return { hasUpdate: false, message: '无法获取插件信息' }
      // 用兜底解析（含已停用插件），避免 clientPath 为空时误报「插件不存在」
      const { pkg, dir } = await resolvePluginPackage(clientModules, pluginId)
      if (!pkg) return { hasUpdate: false, message: '插件不存在（profile 中未找到 ' + pluginId + '）' }
      const currentVersion = pkg.version || ''
      // 本地 file: 安装的插件无法从 npm 更新
      if (await isLocallyInstalled(pluginId, dir)) {
        return { hasUpdate: false, currentVersion, latestVersion: '', message: '本地安装插件，无 npm 远程版本（' + pluginId + ' v' + currentVersion + '）' }
      }
      const latestVersion = await fetchLatestVersion(pluginId)
      const hasUpdate = !!latestVersion && latestVersion !== currentVersion
      return {
        hasUpdate,
        currentVersion,
        latestVersion,
        message: hasUpdate
          ? '发现新版本：' + pluginId + ' ' + currentVersion + ' → ' + latestVersion
          : (latestVersion ? pluginId + ' 已是最新版本 (' + currentVersion + ')' : '无法获取远程版本信息'),
      }
    },

    // 一键安装/升级到 npm 最新版本：更新 profile 依赖版本 + 在 profile 目录执行包管理器安装
    async installUpdate(pluginId) {
      console.log('[tppm] 安装/升级: ' + pluginId)
      const clientModules = ctx.get('clientModules')
      if (!clientModules) return { success: false, message: '无法获取插件信息' }
      const { pkg, dir } = await resolvePluginPackage(clientModules, pluginId)
      if (!pkg) return { success: false, message: '插件不存在（profile 中未找到 ' + pluginId + '）' }
      const currentVersion = pkg.version || ''
      // 只对 npm 安装的插件开放
      if (await isLocallyInstalled(pluginId, dir)) {
        return { success: false, message: '本地安装插件，不能用 npm 一键升级（' + pluginId + '）。请用 dsh plugin add / 手动同步源码。' }
      }
      const latestVersion = await fetchLatestVersion(pluginId)
      if (!latestVersion) return { success: false, message: '无法获取 ' + pluginId + ' 的远程版本信息' }
      if (latestVersion === currentVersion) {
        return { success: false, message: pluginId + ' 已是最新版本 (' + latestVersion + ')' }
      }
      const profileRoot = deriveProfileRoot()
      if (!profileRoot) return { success: false, message: '无法定位 profile 目录，安装中止' }

      // 包管理器优先 pnpm，回退 npm
      const sub = ctx.get('subprocess')
      if (!sub) return { success: false, message: '子进程服务不可用，无法执行安装（请改用 dsh plugin --profile web add ' + pluginId + '@' + latestVersion + '）' }
      // 用精确版本号：避免 cmd.exe 把 `^`（转义符）吃掉而破坏版本范围
      const target = pluginId + '@' + latestVersion
      let bin
      try {
        bin = await sub.resolveExecutable('pnpm')
      } catch (e) {
        return { success: false, message: '未找到 pnpm：请手动执行 dsh plugin --profile web add ' + target }
      }
      // Windows 上 pnpm 解析到的是 pnpm.CMD 垫片，不能直接 spawn，须经 cmd.exe /c 启动
      const argv = spawnableArgv(bin, ['add', target])
      console.log('[tppm] 执行安装: ' + argv.join(' ') + ' @ ' + profileRoot)
      let handle
      try {
        handle = sub.spawn({
          argv,
          cwd: profileRoot,
          stdio: {
            stdin: 'ignore',
            stdout: { maxBytes: 64 * 1024, spill: { maxBytes: 4 * 1024 * 1024 } },
            stderr: { maxBytes: 64 * 1024 },
          },
          graceMs: 30000,
        })
      } catch (err) {
        return { success: false, message: '启动安装进程失败: ' + (err && err.message ? err.message : String(err)) }
      }
      const outcome = await handle.done.catch(function (e) {
        return { exitCode: 1, signal: null, _error: (e && e.message) || String(e) }
      })
      let tail = ''
      try {
        const st = handle.collected && handle.collected.stdout ? handle.collected.stdout.readFrom(0) : null
        const se = handle.collected && handle.collected.stderr ? handle.collected.stderr.readFrom(0) : null
        tail = ((st && st.text) || '') + ((se && se.text) || '')
      } catch (e) { /* 读取输出失败忽略 */ }
      const ok = !outcome._error && outcome.exitCode === 0
      if (ok) {
        return {
          success: true,
          message: '已安装 ' + pluginId + ' ' + currentVersion + ' → ' + latestVersion + '（依赖已更新，请重启 DSH 使新 bundle 生效）',
          currentVersion,
          latestVersion,
          outputTail: tail.slice(-4000),
        }
      }
      return {
        success: false,
        message: '安装失败：' + pluginId + ' ' + currentVersion + ' → ' + latestVersion + '（exit ' + outcome.exitCode + '）。请手动执行 dsh plugin --profile web add ' + target,
        currentVersion,
        latestVersion,
        outputTail: tail.slice(-4000),
      }
    },
  }

  // ---------- 暴露同源 JSON 路由（替代动态 harness.handle） ----------

  // 排错用：报告列表数据源各环节实际看到的值（profile 根 / bundles / 每个停用插件采集痕迹）
  async function debugList() {
    const clientModules = ctx.get('clientModules')
    if (!clientModules) return { clientModules: false }
    const graph = clientModules.graph()
    const anyPath = firstProfileBundlePath(graph, clientModules)
    const profilePkgPath = anyPath ? profilePackagePathOf(anyPath) : null
    const profileRoot = profilePkgPath ? profileRootOf(anyPath) : null
    const profile = profilePkgPath ? await readJsonFile(profilePkgPath) : null
    const bundles = profile && profile.dsh && profile.dsh.profile && Array.isArray(profile.dsh.profile.bundles)
      ? profile.dsh.profile.bundles
      : []
    const samples = {}
    for (const id of ['fexp-file-explorer', 'dshmarket', 'sent-msg-locator']) {
      try {
        const cp = clientModules.clientPath(id) || ''
        const entry = await findLoaderEntry(id)
        const disableId = await resolveDisableId(id)
        const info = await collectPlugin(clientModules, id, new Set(), profileRoot)
        samples[id] = {
          graphClientPath: cp,
          loaderEntry: entry ? { id: String(entry.id), optId: entry.options && entry.options.id, name: entry.options && entry.options.name, disabled: !!entry.disabled, hasFiber: !!entry.fiber } : null,
          resolveDisableId: disableId,
          collected: info || null,
        }
      } catch (e) {
        samples[id] = { error: (e && e.message) || String(e) }
      }
    }
    return { anyPath, profilePkgPath, profileRoot, profileReadOk: !!profile, bundles, samples }
  }

  const routeHandlers = {
    listThirdPartyPlugins: () => pluginManager.listThirdPartyPlugins(),
    listAllPlugins: () => pluginManager.listAllPlugins(),
    enablePlugin: (args) => pluginManager.enablePlugin(args && args.pluginId),
    disablePlugin: (args) => pluginManager.disablePlugin(args && args.pluginId),
    uninstallPlugin: (args) => pluginManager.uninstallPlugin(args && args.pluginId),
    checkForUpdates: (args) => pluginManager.checkForUpdates(args && args.pluginId),
    installUpdate: (args) => pluginManager.installUpdate(args && args.pluginId),
    diagnose: (args) => diagnoseLoader(args && args.pluginId),
    debug: () => debugList(),
  }

  const disposers = Object.keys(routeHandlers).map((method) =>
    ctx.webServer.register({
      kind: 'exact',
      path: '/tppm/' + method,
      handler: async (request, response) => {
        try {
          const args = await readJsonBody(request)
          sendJson(response, 200, { ok: true, data: await routeHandlers[method](args) })
        } catch (err) {
          sendJson(response, 200, { ok: false, error: messageOf(err) })
        }
      },
    })
  )

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try {
        dispose()
      } catch (e) {
        /* ignore */
      }
    }
  }, 'tppm: http routes')
}
