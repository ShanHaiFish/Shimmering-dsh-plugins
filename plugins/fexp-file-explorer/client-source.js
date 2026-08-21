// ============================================================
// 左侧文件浏览器 (fexp) — v1.5.1 (DSH 动态 Cordis 插件 · 回退形态)
// 本文件是 cordis_define 的 code.client 参数原文(函数体)。
//
// v1.5.0 起主形态为静态 bundle(lib/index.js + client/client.js, 随 profile
// 自动加载); 本文件与 host-source.js 保留为动态插件回退形态(无 bundle
// 能力的 profile 按 README 恢复流程加载)。
//
// Client 半区职责:
//   - 侧栏顶部「文件浏览」胶囊按钮 (shell.overlay, 宽栏时显示, 定位在
//     「工作区」标题行右侧/搜索图标左侧附近)
//   - 会话标题栏「打开目录」按钮 (conversation.session.header.actions)
//   - 左侧 320px 浏览面板 (shell.overlay): 面包屑导航、目录列表、文件预览
//   - 主题适配: 面板与按钮颜色全部使用主题 CSS 变量, 深浅色及任意主题
//     下文字与背景都保持对比; SVG 矢量图标
//
// v1.5.1 修复:
//   - 「文件浏览」按钮遮挡工作区「搜索会话」搜索框: 点击工作区顶部搜索图标
//     展开搜索框时, 固定定位的「文件浏览」入口按钮(top:126px/left:70px)
//     正好叠在搜索框上, 挡住输入。修复: TopToggle 用 MutationObserver 监听
//     搜索按钮的 aria-expanded 状态(搜索按钮展开时 aria-expanded="true" 且
//     其下一个兄弟元素就是 input[type=text], 与同样带 aria-expanded 的
//     会话行/分组折叠按钮可区分), 搜索框展开期间隐藏入口按钮, 收起后恢复。
//
// v1.4.0 更新:
//   - 图标整体改用 Google Material Icons 官方图标库
//     (https://fonts.google.com/icons, Apache 2.0 许可,
//     @material-design-icons/svg outlined 变体), 实心填充风格, 小尺寸下
//     依然清晰锐利, 与 Chrome/Android 等大厂产品视觉一致:
//     · 关闭面板: keyboard_double_arrow_left(«, 收起左侧面板, 与 VS Code 一致)
//     · 当前工作区目录: workspaces(Material 标准「工作区」图标)
//     · 回到根目录: home
//     · 上一级: arrow_upward
//     · 刷新: refresh
//     · 在系统资源管理器中打开: folder_open
//     · 关闭预览: close
//     · 目录/文件/添加到聊天: folder / description / chat
//   - svgIcon 改为 fill=currentColor 实心渲染(去掉 stroke), 图标默认尺寸
//     从 14px 提到 16px, 更清晰。
//
// v1.3.0 新增:
//   - 图标改用 Lucide 官方图标库 path(已被 v1.4.0 的 Material Icons 取代)。
//
// v1.2.3 修复:
//   - 「文件浏览」「打开目录」按钮在浅色主题下文字看不清: 根因是按钮颜色
//     硬编码(文字 #e8edf3 近白、背景半透明灰), 浅色主题下无对比。
//     修复: 入口按钮由内联样式改为 CSS 类, 颜色全部走主题变量——文字
//     --dsw-alias-label-primary、背景 --dsw-alias-bg-layer-1/2、边框
//     --dsw-alias-border-l2、激活态 --dsw-alias-brand-primary, 随任意
//     主题(浅色/深色/其他)自动适配, 保证对比; 补充 hover 反馈。
//
// v1.2.2 修复:
//   - 「文件浏览」入口打开面板时定位到上一个工作区目录: 根因是面板加载
//     effect 的 path === null 守卫——之前浏览过(或进入过子目录)后, 关闭
//     再打开或切换工作区都不会重新加载, 直接展示旧目录。
//     修复: 状态新增 boundWs(当前列表绑定的工作区 cwd), 打开面板或工作区
//     切换时若 boundWs !== 当前 wsPath 则重新绑定并加载新工作区目录;
//     同一工作区重开仍保留上次浏览位置。「文件浏览」/「打开目录」统一走
//     openPanelFor, 工具栏「当前工作区目录」统一走 bindWorkspace, 保证
//     绑定状态一致。
//
// v1.2.0 新增:
//   - 预览区「添加到聊天」按钮(位于「关闭预览」左侧): 通过会话作用域插槽
//     conversation.input.dock 的隐藏桥组件捕获标准包 inputActions/useInput,
//     点击后把文件引用 [文件名](绝对路径) 追加到聊天输入框草稿(不覆盖已有
//     内容), 由用户编辑后发送, 方便告诉 AI 具体文件信息; 纯 Client 能力
//
// v1.2.1 修复:
//   - 移除「已添加」状态: 按钮始终保持「添加到聊天」可用, 支持连续添加多个
//     文件(输入框已可见引用, 无需重复状态提示)
//
// v1.1.0 新增:
//   - 工具栏「在系统资源管理器中打开」按钮: 调用 Client workspaces.openPath
//     (DSH 原生 host.openPath, Windows 走 Invoke-Item), 在系统资源管理器中
//     打开当前浏览的目录; 不新增 Host RPC, 不引入 spawn/网络能力
//
// v1.0.0 要点:
//   - 修复启动时序竞态: useStore 订阅后立即自愈同步当前状态(避免探针写入
//     早于订阅导致更新丢失); sidebarWide 默认 true(探针异常时按钮仍可见)
//   - 侧栏宽窄探针 (sidebar.footer.action 内隐藏 null 单元格) 报告 wide 状态
// ============================================================
return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    const workspaces = ctx.get('workspaces')

    styles.insert(`
      .fexp-panel {
        position: fixed; left: 0; top: 0; bottom: 0; width: 320px; z-index: 1000;
        display: flex; flex-direction: column;
        background: var(--dsw-specific-sidebar-fill, #171a1f);
        border-right: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.35));
        box-shadow: 10px 0 28px rgba(0,0,0,.22);
        color: var(--dsw-alias-label-primary, #e8e8e8);
        font-size: 13px; line-height: 1.45; pointer-events: auto;
      }
      .fexp-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px 8px; }
      .fexp-head-icon { display: flex; color: var(--dsw-alias-brand-primary, #4c8dff); }
      .fexp-head-title { flex: 1; font-weight: 600; font-size: 13px; }

      .fexp-tbtn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 26px; height: 26px; padding: 0;
        border: 1px solid transparent; border-radius: 6px;
        background: transparent; color: var(--dsw-alias-label-secondary, #9aa4b2);
        cursor: pointer;
      }
      .fexp-tbtn:hover:not(:disabled) {
        background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,.06));
        color: var(--dsw-alias-label-primary, #e8e8e8);
      }
      .fexp-tbtn:disabled { opacity: .35; cursor: default; }

      .fexp-toolbar { display: flex; align-items: center; gap: 2px; padding: 2px 10px 6px; }

      .fexp-crumbs {
        display: flex; align-items: center; gap: 2px; padding: 2px 10px 8px;
        overflow-x: auto; white-space: nowrap; scrollbar-width: thin;
      }
      .fexp-crumb {
        display: inline-flex; align-items: center; max-width: 140px;
        overflow: hidden; text-overflow: ellipsis;
        background: transparent; border: none; padding: 2px 4px; border-radius: 4px;
        color: var(--dsw-alias-label-secondary, #9aa4b2); font-size: 12px; cursor: pointer;
      }
      .fexp-crumb:hover {
        background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,.06));
        color: var(--dsw-alias-label-primary, #e8e8e8);
      }
      .fexp-crumb-sep { color: var(--dsw-alias-label-secondary, #9aa4b2); opacity: .55; font-size: 12px; }

      .fexp-error {
        margin: 0 10px 8px; padding: 6px 8px;
        border: 1px solid var(--dsw-alias-state-error-primary, rgba(255,92,92,.5));
        border-radius: 6px; background: rgba(255,92,92,.08);
        color: var(--dsw-alias-state-error-primary, #ff5c5c); font-size: 12px;
      }

      .fexp-body { flex: 1; overflow-y: auto; padding: 0 6px 8px; }
      .fexp-list { display: flex; flex-direction: column; gap: 1px; }
      .fexp-empty {
        padding: 18px 10px; text-align: center;
        color: var(--dsw-alias-label-secondary, #9aa4b2); font-size: 12px;
      }
      .fexp-row {
        display: flex; align-items: center; gap: 6px;
        padding: 5px 6px; border-radius: 6px; cursor: pointer; user-select: none;
      }
      .fexp-row:hover { background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,.06)); }
      .fexp-row-icon { display: flex; flex-shrink: 0; color: var(--dsw-alias-label-secondary, #9aa4b2); }
      .fexp-row-dir .fexp-row-icon { color: var(--dsw-alias-brand-primary, #4c8dff); }
      .fexp-row-name {
        flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px;
      }
      .fexp-row-size { flex-shrink: 0; color: var(--dsw-alias-label-secondary, #9aa4b2); font-size: 11px; }

      .fexp-preview {
        display: flex; flex-direction: column; height: 40%; min-height: 140px;
        border-top: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.35));
        background: var(--dsw-alias-bg-base, #101318);
      }
      .fexp-preview-head {
        display: flex; align-items: center; gap: 8px;
        padding: 6px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.35));
      }
      .fexp-preview-name {
        flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        font-size: 12px; font-weight: 600;
      }
      .fexp-preview-size { color: var(--dsw-alias-label-secondary, #9aa4b2); font-size: 11px; }
      .fexp-preview-body {
        flex: 1; overflow: auto; margin: 0; padding: 8px 10px;
        font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
        font-size: 11.5px; white-space: pre; tab-size: 4;
      }
      .fexp-preview-empty {
        align-items: center; justify-content: center;
        color: var(--dsw-alias-label-secondary, #9aa4b2); font-size: 12px;
      }

      .fexp-chat-btn {
        display: inline-flex; align-items: center; gap: 4px;
        height: 22px; padding: 0 8px; margin-left: 2px;
        border: 1px solid rgba(124,176,255,.45); border-radius: 5px;
        background: rgba(124,176,255,.12);
        color: var(--dsw-alias-brand-primary, #7cb0ff);
        font-size: 11.5px; white-space: nowrap; cursor: pointer;
      }
      .fexp-chat-btn:hover:not(:disabled) { background: rgba(124,176,255,.24); }
      .fexp-chat-btn:disabled { opacity: .45; cursor: default; }

      /* 双入口按钮(「文件浏览」/「打开目录」): 颜色全部走主题 CSS 变量,
         保证浅色/深色及其他任意主题下文字与背景都有对比。 */
      .fexp-entry-btn {
        display: inline-flex; align-items: center; gap: 5px;
        height: 28px; padding: 0 10px;
        border: 1px solid var(--dsw-alias-border-l2, rgba(120,130,145,.45));
        border-radius: 7px;
        background: var(--dsw-alias-bg-layer-1, rgba(148,163,184,.14));
        color: var(--dsw-alias-label-primary, #333a44);
        font-size: 12px; white-space: nowrap; cursor: pointer;
        box-sizing: border-box; margin: 2px;
        transition: background .15s ease, border-color .15s ease, color .15s ease;
      }
      .fexp-entry-btn:hover {
        border-color: var(--dsw-alias-brand-primary, rgba(124,176,255,.7));
        background: var(--dsw-alias-bg-layer-2, rgba(148,163,184,.22));
      }
      .fexp-entry-btn-active {
        color: var(--dsw-alias-brand-primary, #4c8dff);
        border-color: var(--dsw-alias-brand-primary, #4c8dff);
        background: var(--dsw-alias-bg-layer-1, rgba(148,163,184,.14));
      }
    `)

    const listeners = new Set()
    let state = {
      open: false,
      sidebarWide: true,
      searchOpen: false,
      root: null,
      boundWs: null,
      path: null,
      entries: null,
      loading: false,
      error: null,
      preview: null,
      previewLoading: false,
      opening: false,
      inputActions: null,
      chatDraft: '',
    }

    function setState(patch) {
      state = Object.assign({}, state, patch)
      listeners.forEach((fn) => { try { fn() } catch (e) { /* noop */ } })
    }

    function useStore(selector) {
      const [value, setValue] = React.useState(() => selector(state))
      React.useEffect(() => {
        const fn = () => setValue(selector(state))
        listeners.add(fn)
        // Self-heal: re-read the current state after subscribing so an update
        // that landed before this subscription (mount-order race) is not lost.
        setValue(selector(state))
        return () => listeners.delete(fn)
      }, [])
      return value
    }

    async function safeCall(method, args) {
      try {
        return await host.call(method, args)
      } catch (err) {
        return { ok: false, error: String((err && err.message) || err) }
      }
    }

    let dirSeq = 0

    async function loadDir(p) {
      const seq = ++dirSeq
      setState({ loading: true, error: null, preview: null })
      const res = await safeCall('list-dir', { path: p })
      if (seq !== dirSeq) return
      if (!res || !res.ok) {
        setState({ loading: false, error: (res && res.error) || '无法读取目录' })
        return
      }
      setState({ loading: false, path: res.path, entries: res.entries })
    }

    async function openRoot() {
      const seq = ++dirSeq
      setState({ loading: true, error: null })
      const res = await safeCall('default-root', {})
      if (seq !== dirSeq) return
      if (!res || !res.ok) {
        setState({ loading: false, error: (res && res.error) || '无法获取根目录' })
        return
      }
      setState({ root: res.path })
      await loadDir(res.path)
    }

    // 把当前列表重新绑定到指定工作区目录: 重置 root/path/entries 后加载。
    // 用于「打开目录」「文件浏览」打开面板及切换工作区时的自动重定位。
    function bindWorkspace(wsPath) {
      setState({ root: wsPath, boundWs: wsPath, path: null, entries: null, preview: null })
      loadDir(wsPath)
    }

    // 统一打开面板入口: 有当前工作区则绑定并加载, 没有则回退到根目录。
    function openPanelFor(wsPath) {
      if (wsPath) {
        setState({ open: true })
        bindWorkspace(wsPath)
      } else {
        setState({ open: true, boundWs: null })
        openRoot()
      }
    }

    async function openFile(entry, dirPath) {
      const full = joinPath(dirPath, entry.name)
      setState({ previewLoading: true, preview: null, error: null })
      const res = await safeCall('read-file', { path: full })
      setState({ previewLoading: false })
      if (!res || !res.ok) {
        setState({ error: (res && res.error) || '无法打开文件' })
        return
      }
      setState({ preview: { path: (res.path || full), name: entry.name, content: res.content, bytes: res.bytes } })
    }

    function joinPath(dir, name) {
      return String(dir).replace(/[\\/]+$/, '') + '/' + name
    }

    function addToChat(fileInfo) {
      const actions = state.inputActions
      if (!actions || !fileInfo || !fileInfo.path) return
      const ref = '[' + fileInfo.name + '](' + fileInfo.path + ')'
      const base = (state.chatDraft || '').trim()
      const next = base ? base + '\n' + ref : ref
      actions.setDraft(next)
    }

    function InputBridge(props) {
      // 会话作用域隐藏桥: 捕获标准包 inputActions / useInput, 供面板使用。
      const useInput = props.useInput
      const actions = props.inputActions
      const draft = useInput ? useInput((s) => s.draft) : undefined
      React.useEffect(() => {
        setState({ inputActions: actions || null })
        return () => {
          if (actions && state.inputActions === actions) setState({ inputActions: null })
        }
      }, [actions])
      React.useEffect(() => {
        setState({ chatDraft: draft || '' })
      }, [draft])
      return null
    }

    async function openInExplorer(p) {
      if (!workspaces || !p || state.opening) return
      setState({ opening: true, error: null })
      try {
        await workspaces.openPath(p)
      } catch (err) {
        setState({ error: String((err && err.message) || err) })
      } finally {
        setState({ opening: false })
      }
    }

    function parentOf(p) {
      const str = String(p).replace(/[\\/]+$/, '')
      const idx = Math.max(str.lastIndexOf('/'), str.lastIndexOf('\\'))
      if (idx < 0) return null
      if (idx === 1 && str.charAt(1) === ':') return str.slice(0, 2) + '/'
      const par = str.slice(0, idx)
      return par === '' ? '/' : par
    }

    function crumbsOf(p) {
      const str = String(p)
      const isPosix = str.indexOf('/') === 0
      const parts = str.split(/[\\/]+/).filter(Boolean)
      const crumbs = []
      if (isPosix) crumbs.push({ name: '/', path: '/' })
      let acc = ''
      parts.forEach((part) => {
        acc = acc ? acc + '/' + part : (isPosix ? '/' + part : part)
        crumbs.push({ name: part, path: acc })
      })
      return crumbs
    }

    function fmtSize(n) {
      if (n == null) return ''
      if (n < 1024) return n + ' B'
      if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
      return (n / 1048576).toFixed(1) + ' MB'
    }

    function svgIcon(size, children) {
      return React.createElement('svg', {
        width: size || 16, height: size || 16, viewBox: '0 0 24 24',
        fill: 'currentColor',
        style: { flexShrink: 0, display: 'block' },
      }, children)
    }
    // 全部图标 path 来自 Google Material Icons 官方库 (Apache 2.0 许可,
    // @material-design-icons/svg outlined 变体, https://fonts.google.com/icons),
    // 实心填充风格, 小尺寸下依然清晰, 与 Chrome/Android 大厂产品视觉一致。
    function IconFolder(props) {
      // material folder
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'm9.17 6 2 2H20v10H4V6h5.17M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z' }))
    }
    function IconFile(props) {
      // material description: 文档图标, 表示普通文件。
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M8 16h8v2H8zm0-4h8v2H8zm6-10H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z' }))
    }
    function IconHome(props) {
      // material home: 回到根目录。
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'm12 5.69 5 4.5V18h-2v-6H9v6H7v-7.81l5-4.5M12 3 2 12h3v8h6v-6h2v6h6v-8h3L12 3z' }))
    }
    function IconWorkspace(props) {
      // material workspaces: Material 标准「工作区」图标(三组圆点),
      // 表示定位到当前工作区目录。
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M6 15c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m0-2c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm6-8c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m0-2C9.8 3 8 4.8 8 7s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm6 12c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m0-2c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z' }))
    }
    function IconUp(props) {
      // material arrow_upward: 上一级。
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'm4 12 1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z' }))
    }
    function IconRefresh(props) {
      // material refresh: 刷新(Chrome/Android 同款弧线箭头)。
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z' }))
    }
    function IconClose(props) {
      // material close: 标准关闭 X, 用于「关闭预览」。
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z' }))
    }
    function IconFolderOpen(props) {
      // material folder_open: 在系统资源管理器中打开当前目录。
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z' }))
    }
    function IconPanelClose(props) {
      // material keyboard_double_arrow_left («): 收起左侧面板, 与 VS Code
      // 侧栏收起图标一致。
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M17.59 18 19 16.59 14.42 12 19 7.41 17.59 6l-6 6z' }),
        React.createElement('path', { d: 'm11 18 1.41-1.41L7.83 12l4.58-4.59L11 6l-6 6z' }))
    }
    function IconChat(props) {
      // material chat: 添加到聊天。
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M4 4h16v12H5.17L4 17.17V4m0-2c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H4zm2 10h8v2H6v-2zm0-3h12v2H6V9zm0-3h12v2H6V6z' }))
    }

    function HeaderToggle(props) {
      const open = useStore((s) => s.open)
      const wsPath = props.useSessions
        ? props.useSessions((s) => (s.byId[s.current] ? s.byId[s.current].cwd : undefined))
        : undefined
      const onClick = () => {
        if (open) {
          setState({ open: false })
          return
        }
        openPanelFor(wsPath)
      }
      return React.createElement('button', {
        type: 'button',
        className: open ? 'fexp-entry-btn fexp-entry-btn-active' : 'fexp-entry-btn',
        title: '打开当前工作区目录',
        onClick: onClick,
      }, React.createElement(IconFolder, { size: 16 }),
        React.createElement('span', null, '打开目录'))
    }

    function SidebarWideProbe(props) {
      const wide = Boolean(props.wide)
      React.useEffect(() => { setState({ sidebarWide: wide }) }, [wide])
      return null
    }

    function TopToggle(props) {
      const open = useStore((s) => s.open)
      const wide = useStore((s) => s.sidebarWide)
      const searchOpen = useStore((s) => s.searchOpen)
      const wsPath = props.useSessions
        ? props.useSessions((s) => (s.byId[s.current] ? s.byId[s.current].cwd : undefined))
        : undefined

      // 工作区「搜索会话」搜索框展开检测: 搜索按钮展开时带
      // aria-expanded="true", 且它的下一个兄弟元素就是搜索输入框
      // (input[type=text])。会话行/分组折叠按钮也带 aria-expanded,
      // 但后面没有文本输入框, 不会误判; 无 DOM 环境(如受限 runner)
      // 时按未展开处理。
      React.useEffect(() => {
        if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
        const sync = () => {
          let value = false
          try {
            const buttons = document.querySelectorAll('button[aria-expanded="true"]')
            for (const btn of buttons) {
              const input = btn.nextElementSibling
              if (input && input.tagName === 'INPUT' && input.getAttribute('type') === 'text') {
                value = true
                break
              }
            }
          } catch (e) { /* ignore */ }
          if (state.searchOpen !== value) setState({ searchOpen: value })
        }
        sync()
        const observer = new MutationObserver(sync)
        observer.observe(document.documentElement, {
          subtree: true,
          attributes: true,
          attributeFilter: ['aria-expanded'],
          childList: true,
        })
        return () => observer.disconnect()
      }, [])

      if (!wide) return null
      // 搜索框展开时隐藏入口按钮, 避免遮挡搜索框; 收起后自动恢复。
      if (searchOpen) return null
      const style = {
        position: 'fixed',
        top: '126px',
        left: '70px',
        zIndex: 10,
        pointerEvents: 'auto',
        padding: '0 9px',
      }
      return React.createElement('button', {
        type: 'button',
        className: open ? 'fexp-entry-btn fexp-entry-btn-active' : 'fexp-entry-btn',
        style: style,
        title: '文件浏览',
        'aria-label': '文件浏览',
        onClick: () => {
          if (open) {
            setState({ open: false })
            return
          }
          openPanelFor(wsPath)
        },
      }, React.createElement(IconFolder, { size: 16 }),
        React.createElement('span', null, '文件浏览'))
    }

    function ExplorerPanel(props) {
      const open = useStore((s) => s.open)
      const root = useStore((s) => s.root)
      const path = useStore((s) => s.path)
      const entries = useStore((s) => s.entries)
      const loading = useStore((s) => s.loading)
      const error = useStore((s) => s.error)
      const preview = useStore((s) => s.preview)
      const previewLoading = useStore((s) => s.previewLoading)
      const opening = useStore((s) => s.opening)
      const inputActions = useStore((s) => s.inputActions)

      const wsPath = props.useSessions
        ? props.useSessions((s) => (s.byId[s.current] ? s.byId[s.current].cwd : undefined))
        : undefined

      React.useEffect(() => {
        if (!open) return
        if (wsPath) {
          if (state.boundWs !== wsPath) {
            // 首次打开或工作区已切换: 重新绑定到当前工作区并加载,
            // 避免展示上一个工作区的旧目录。
            setState({ root: wsPath, boundWs: wsPath, path: null, entries: null, preview: null })
            loadDir(wsPath)
          } else if (path === null && !loading) {
            loadDir(wsPath)
          }
        } else if (path === null && !loading) {
          openRoot()
        }
      }, [open, wsPath])

      if (!open) return null

      const crumbs = path ? crumbsOf(path) : []
      const parent = path ? parentOf(path) : null
      const dirs = entries ? entries.filter((e) => e.type === 'directory') : []
      const files = entries ? entries.filter((e) => e.type !== 'directory') : []

      const rows = []
      dirs.forEach((entry) => {
        const full = joinPath(path, entry.name)
        rows.push(React.createElement('div', {
          key: 'd' + entry.name,
          className: 'fexp-row fexp-row-dir',
          title: full,
          onClick: () => loadDir(full),
        },
          React.createElement('span', { className: 'fexp-row-icon' }, React.createElement(IconFolder, null)),
          React.createElement('span', { className: 'fexp-row-name' }, entry.name)))
      })
      files.forEach((entry) => {
        const full = joinPath(path, entry.name)
        rows.push(React.createElement('div', {
          key: 'f' + entry.name,
          className: 'fexp-row fexp-row-file',
          title: full,
          onClick: () => openFile(entry, path),
        },
          React.createElement('span', { className: 'fexp-row-icon' }, React.createElement(IconFile, null)),
          React.createElement('span', { className: 'fexp-row-name' }, entry.name),
          entry.size != null ? React.createElement('span', { className: 'fexp-row-size' }, fmtSize(entry.size)) : null))
      })

      const crumbEls = []
      crumbs.forEach((c, i) => {
        if (i > 0) crumbEls.push(React.createElement('span', { key: 'sep' + i, className: 'fexp-crumb-sep' }, '/'))
        crumbEls.push(React.createElement('button', {
          key: c.path,
          type: 'button',
          className: 'fexp-crumb',
          title: c.path,
          onClick: () => loadDir(c.path),
        }, c.name))
      })

      let bodyEl
      if (entries === null) {
        bodyEl = React.createElement('div', { className: 'fexp-empty' }, loading ? '加载中…' : '正在准备…')
      } else if (rows.length) {
        bodyEl = React.createElement('div', { className: 'fexp-list' }, rows)
      } else {
        bodyEl = React.createElement('div', { className: 'fexp-empty' }, '（空目录）')
      }

      let previewEl = null
      if (previewLoading) {
        previewEl = React.createElement('div', { className: 'fexp-preview fexp-preview-empty' }, '正在读取文件…')
      } else if (preview) {
        previewEl = React.createElement('div', { className: 'fexp-preview' },
          React.createElement('div', { className: 'fexp-preview-head' },
            React.createElement('span', { className: 'fexp-preview-name', title: preview.path }, preview.name),
            React.createElement('span', { className: 'fexp-preview-size' }, fmtSize(preview.bytes)),
            React.createElement('button', {
              type: 'button', className: 'fexp-chat-btn',
              title: inputActions ? '将文件信息添加到聊天输入框' : '当前没有可用的会话输入框',
              disabled: !inputActions,
              onClick: () => addToChat(preview),
            }, React.createElement(IconChat, { size: 13 }),
              React.createElement('span', null, '添加到聊天')),
            React.createElement('button', {
              type: 'button', className: 'fexp-tbtn', title: '关闭预览',
              onClick: () => setState({ preview: null }),
            }, React.createElement(IconClose, null))),
          React.createElement('pre', { className: 'fexp-preview-body' }, preview.content))
      }

      const errorEl = error ? React.createElement('div', { className: 'fexp-error' }, error) : null

      return React.createElement('div', { className: 'fexp-panel' },
        React.createElement('div', { className: 'fexp-head' },
          React.createElement('span', { className: 'fexp-head-icon' }, React.createElement(IconFolder, { size: 16 })),
          React.createElement('span', { className: 'fexp-head-title' }, '文件浏览'),
          React.createElement('button', {
            type: 'button', className: 'fexp-tbtn', title: '关闭面板',
            onClick: () => setState({ open: false }),
          }, React.createElement(IconPanelClose, null))),
        React.createElement('div', { className: 'fexp-toolbar' },
          React.createElement('button', {
            type: 'button', className: 'fexp-tbtn', title: '当前工作区目录', disabled: !wsPath,
            onClick: () => { if (wsPath) bindWorkspace(wsPath) },
          }, React.createElement(IconWorkspace, null)),
          React.createElement('button', {
            type: 'button', className: 'fexp-tbtn', title: '回到根目录', disabled: !root,
            onClick: () => { if (root) loadDir(root) },
          }, React.createElement(IconHome, null)),
          React.createElement('button', {
            type: 'button', className: 'fexp-tbtn', title: '上一级', disabled: !parent,
            onClick: () => { if (parent) loadDir(parent) },
          }, React.createElement(IconUp, null)),
          React.createElement('button', {
            type: 'button', className: 'fexp-tbtn', title: '刷新', disabled: !path,
            onClick: () => { if (path) loadDir(path) },
          }, React.createElement(IconRefresh, null)),
          React.createElement('button', {
            type: 'button', className: 'fexp-tbtn',
            title: workspaces ? '在系统资源管理器中打开当前目录' : '当前环境不支持在系统资源管理器中打开',
            disabled: !path || !workspaces || opening,
            onClick: () => openInExplorer(path),
          }, React.createElement(IconFolderOpen, null))),
        React.createElement('div', { className: 'fexp-crumbs' },
          crumbEls.length ? crumbEls : React.createElement('span', { className: 'fexp-crumb' }, '…')),
        errorEl,
        React.createElement('div', { className: 'fexp-body' }, bodyEl),
        previewEl)
    }

    slots.inject('sidebar.footer.action', () => slots.register(
      { name: 'sidebar.footer.action', id: 'fexp-wide-probe', order: 6, label: '文件浏览' },
      (props) => React.createElement(SidebarWideProbe, { wide: Boolean(props && props.wide) }),
    ))

    slots.inject('conversation.session.header.actions', () => slots.register(
      { name: 'conversation.session.header.actions', id: 'fexp-header-toggle', order: 30, label: '打开目录' },
      (props) => React.createElement(HeaderToggle, { useSessions: props && props.useSessions }),
    ))

    slots.inject('conversation.input.dock', () => slots.register(
      { name: 'conversation.input.dock', id: 'fexp-input-bridge', order: 0, label: '文件浏览器输入桥' },
      (props) => React.createElement(InputBridge, {
        useInput: props && props.useInput,
        inputActions: props && props.inputActions,
      }),
    ))

    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'fexp-top-toggle', order: 5 },
      (props) => React.createElement(TopToggle, { useSessions: props && props.useSessions }),
    ))

    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'fexp-panel', order: 10 },
      (props) => React.createElement(ExplorerPanel, { useSessions: props && props.useSessions }),
    ))
  },
}
