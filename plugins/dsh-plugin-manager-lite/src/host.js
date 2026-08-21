/**
 * third-party-plugin-manager — Host 半源码
 *
 * 管理 DSH Web 中除了官方插件（@deepseek-ai/*）之外的第三方插件：
 *   - 列出第三方插件（读取 graph + package.json 元信息）
 *   - 启用 / 停用（运行时热切换 + 持久化到 home patch）
 *   - 卸载（运行时停用 + 从 profile 配置移除）
 *   - 检查 npm 更新
 *
 * 本文件是 cordis_define 时传给 code.host 的函数体（return { apply(ctx) {...} }）。
 */

return {
  apply(ctx) {
    // ---------- 路径推导 ----------

    /** 路径统一为正斜杠（clientPath 在 Windows 返回反斜杠路径） */
    function normPath(p) {
      return (p || '').replace(/\\/g, '/');
    }

    /** 从 bundle 路径推导 DSH home 目录（C:/Users/x/.dsh） */
    function dshHomeOf(bundlePath) {
      const p = normPath(bundlePath);
      const idx = p.indexOf('/.dsh/');
      if (idx === -1) return null;
      return p.slice(0, idx + 5); // 含 /.dsh
    }

    /** 从 bundle 路径推导 profile 根目录（.../profiles/web） */
    function profileRootOf(bundlePath) {
      const p = normPath(bundlePath);
      const idx = p.indexOf('/node_modules/');
      if (idx === -1) return null;
      return p.slice(0, idx);
    }

    /** 从 bundle 路径推导 profile 的 package.json 绝对路径 */
    function profilePackagePathOf(bundlePath) {
      const root = profileRootOf(bundlePath);
      return root ? root + '/package.json' : null;
    }

    // ---------- 文件工具（fs 服务） ----------

    async function readJsonFile(absPath) {
      const fs = ctx.get('fs');
      if (!fs || !absPath) return null;
      try {
        const target = await fs.resolve(absPath);
        const text = await fs.readText(target);
        return JSON.parse(text);
      } catch (e) {
        return null;
      }
    }

    async function writeJsonFile(absPath, value) {
      const fs = ctx.get('fs');
      if (!fs || !absPath) return false;
      try {
        const target = await fs.resolve(absPath);
        await fs.writeText(target, JSON.stringify(value, null, 2) + '\n');
        return true;
      } catch (e) {
        console.error('写入失败: ' + absPath + ' -> ' + (e && e.message));
        return false;
      }
    }

    async function readTextFile(absPath) {
      const fs = ctx.get('fs');
      if (!fs || !absPath) return null;
      try {
        const target = await fs.resolve(absPath);
        return await fs.readText(target);
      } catch (e) {
        return null;
      }
    }

    async function writeTextFile(absPath, content) {
      const fs = ctx.get('fs');
      if (!fs || !absPath) return false;
      try {
        const target = await fs.resolve(absPath);
        await fs.writeText(target, content);
        return true;
      } catch (e) {
        console.error('写入失败: ' + absPath + ' -> ' + (e && e.message));
        return false;
      }
    }

    // ---------- 从 bundle 路径向上查找包根目录的 package.json ----------

    async function loadPkgMeta(id, bundlePath) {
      const fs = ctx.get('fs');
      if (!fs || !bundlePath) return null;
      let dir = bundlePath.replace(/\\/g, '/');
      const slashIdx = dir.lastIndexOf('/');
      if (slashIdx < 0) return null;
      dir = dir.slice(0, slashIdx);
      for (let i = 0; i < 6; i++) {
        try {
          const target = await fs.resolve(dir + '/package.json');
          const text = await fs.readText(target);
          const pkg = JSON.parse(text);
          if (pkg && pkg.name === id) return pkg;
        } catch (e) { /* 继续向上 */ }
        const idx = dir.lastIndexOf('/');
        if (idx < 0) break;
        dir = dir.slice(0, idx);
      }
      return null;
    }

    /** 解析 author 字段（字符串或对象） */
    function authorOf(pkg) {
      if (!pkg || !pkg.author) return '';
      if (typeof pkg.author === 'string') return pkg.author;
      if (typeof pkg.author === 'object' && pkg.author && pkg.author.name) return pkg.author.name;
      return '';
    }

    // ---------- Loader 运行时热切换 ----------

    /** 在 Loader 树中查找某个包的 entry（非 group） */
    async function findLoaderEntry(pluginId) {
      const loader = ctx.get('loader');
      if (!loader) return null;
      for (const entry of loader.entries()) {
        if (entry.options && entry.options.name === pluginId && !entry.options.group) {
          return entry;
        }
      }
      return null;
    }

    /** 诊断：loader 服务可用性与 entry 匹配情况（返回纯 JSON） */
    async function diagnoseLoader(pluginId) {
      const out = { loaderAvailable: false, entryCount: 0, matchedEntry: null, sampleNames: [] };
      try {
        const loader = ctx.get('loader');
        if (!loader) return out;
        out.loaderAvailable = true;
        // loader.entries() 是生成器，必须先展开为数组
        const entries = Array.from(loader.entries() || []);
        out.entryCount = entries.length;
        out.sampleNames = entries.slice(0, 12).map(function (e) { return e && e.options && e.options.name; })
          .filter(function (n) { return typeof n === 'string' && n.length > 0; });
        for (const entry of entries) {
          if (entry && entry.options && entry.options.name === pluginId && !entry.options.group) {
            out.matchedEntry = {
              id: typeof entry.id === 'string' ? entry.id : String(entry.id),
              name: String(entry.options.name),
              disabled: !!entry.disabled,
              hasFiber: !!entry.fiber,
              group: !!entry.options.group
            };
            break;
          }
        }
      } catch (e) {
        out.error = (e && e.message) || String(e);
      }
      return out;
    }

    /** 当前 Loader 中该插件是否有效启用（fiber 活着） */
    async function pluginActuallyEnabled(pluginId) {
      const entry = await findLoaderEntry(pluginId);
      if (!entry) return null;
      return !entry.disabled && !!entry.fiber;
    }

    // ---------- home patch 持久化（$DSH_HOME/cordis.patch.yml） ----------

    /**
     * 读取 home patch 文件内容（顶层 YAML 数组）。
     * 由于动态环境无 YAML 库，采用轻量行级维护：
     *   - 读原文
     *   - 查找 `- id: <pluginId>` 条目块
     *   - 修改该块内的 `disabled: ...` 行，或整块追加
     */
    async function homePatchText(bundlePath) {
      const home = dshHomeOf(bundlePath);
      if (!home) return null;
      const path = home + '/cordis.patch.yml';
      const existing = await readTextFile(path);
      return { path, text: existing };
    }

    /** 解析 YAML patch 条目块：按顶层 `- id:` 分隔（简易实现，适用于 dsh 生成的 patch 文件） */
    function splitPatchEntries(text) {
      const entries = [];
      if (!text || !text.trim()) return entries;
      const lines = text.split(/\r?\n/);
      let current = null;
      for (const line of lines) {
        if (/^\s*-\s+id:/.test(line)) {
          if (current) entries.push(current);
          current = { header: line, body: [] };
        } else if (current) {
          current.body.push(line);
        } else if (line.trim() !== '' && !line.trim().startsWith('#')) {
          // 前置内容（注释等）忽略
        }
      }
      if (current) entries.push(current);
      return entries;
    }

    /** 在 patch 文本中设置某个插件的 disabled 状态；返回新文本 */
    function setPatchDisabled(text, pluginId, disabled) {
      const lines = (text || '').split(/\r?\n/);
      const out = [];
      let blockStart = -1;
      let blockEnd = -1;
      // 找目标块
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*-\s+id:/.test(lines[i]) && lines[i].includes(pluginId)) {
          blockStart = i;
          blockEnd = i + 1;
          while (blockEnd < lines.length && !/^\s*-\s+id:/.test(lines[blockEnd]) && lines[blockEnd].trim() !== '') {
            blockEnd++;
          }
          break;
        }
      }
      if (blockStart !== -1) {
        // 修改现有块
        const blockLines = lines.slice(blockStart, blockEnd);
        const cleaned = blockLines.filter((l) => !/^\s*disabled:/.test(l));
        if (disabled) {
          // 保留缩进
          const indent = (blockLines[0].match(/^\s*/) || [''])[0];
          cleaned.push(indent + '  disabled: true');
        }
        out.push(...lines.slice(0, blockStart), ...cleaned, ...lines.slice(blockEnd));
        // 清理连续空行
        return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
      }
      // 追加新块（仅禁用时需要；启用时无块则无需写入）
      if (!disabled) return (text || '').trim() + '\n';
      const base = (text || '').trim();
      const addition = '- id: ' + pluginId + '\n  disabled: true';
      return base ? base + '\n' + addition + '\n' : addition + '\n';
    }

    /** 持久化 disabled 状态到 home patch */
    async function persistDisabled(bundlePath, pluginId, disabled) {
      const home = dshHomeOf(bundlePath);
      if (!home) return false;
      const path = home + '/cordis.patch.yml';
      const existing = await readTextFile(path);
      const next = setPatchDisabled(existing || '', pluginId, disabled);
      return await writeTextFile(path, next);
    }

    // ---------- profile package.json 维护（卸载） ----------

    /** 从 profile package.json 移除一个插件（dependencies + bundles） */
    async function removeFromProfile(bundlePath, pluginId) {
      const pkgPath = profilePackagePathOf(bundlePath);
      if (!pkgPath) return { ok: false, message: '无法定位 profile 配置' };
      const profile = await readJsonFile(pkgPath);
      if (!profile) return { ok: false, message: '无法读取 profile 配置' };
      let changed = false;
      // dependencies
      if (profile.dependencies && profile.dependencies[pluginId] !== undefined) {
        delete profile.dependencies[pluginId];
        changed = true;
      }
      // devDependencies
      if (profile.devDependencies && profile.devDependencies[pluginId] !== undefined) {
        delete profile.devDependencies[pluginId];
        changed = true;
      }
      // bundles
      if (profile.dsh && profile.dsh.profile && Array.isArray(profile.dsh.profile.bundles)) {
        const before = profile.dsh.profile.bundles.length;
        profile.dsh.profile.bundles = profile.dsh.profile.bundles.filter((b) => b !== pluginId);
        if (profile.dsh.profile.bundles.length !== before) changed = true;
      }
      if (!changed) return { ok: false, message: '该插件不在 profile 配置中（可能由其他方式安装）' };
      const wrote = await writeJsonFile(pkgPath, profile);
      if (!wrote) return { ok: false, message: '写入 profile 配置失败' };
      return { ok: true, message: '已从 profile 配置移除（重启后生效）' };
    }

    // ---------- 服务主体 ----------

    // 直接从包目录读取 package.json（用于已停用插件，其 bundle 已从 clientModules 表移除）
    async function loadPkgFromDir(id, pkgDir) {
      const fs = ctx.get('fs');
      if (!fs || !pkgDir) return null;
      try {
        const target = await fs.resolve(normPath(pkgDir) + '/package.json');
        const text = await fs.readText(target);
        const pkg = JSON.parse(text);
        if (pkg && pkg.name === id) return pkg;
      } catch (e) { /* 读取失败 */ }
      return null;
    }

    // 读取 home patch 中某个插件的 disabled 标记（持久化状态）
    async function patchedDisabledOf(bundlePath, pluginId) {
      const home = dshHomeOf(bundlePath);
      if (!home) return false;
      const text = await readTextFile(home + '/cordis.patch.yml');
      if (!text) return false;
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*-\s+id:/.test(lines[i]) && lines[i].includes(pluginId)) {
          // 检查该块的 disabled 行
          let j = i + 1;
          while (j < lines.length && !/^\s*-\s+id:/.test(lines[j]) && lines[j].trim() !== '') {
            if (/^\s*disabled:\s*true\s*$/.test(lines[j])) return true;
            j++;
          }
        }
      }
      return false;
    }

    // 收集一个第三方插件的信息；已停用的插件 graph 中不存在，但 profile 配置仍在
    async function collectPlugin(clientModules, id, seen, profileRoot) {
      if (!id || id.startsWith('@deepseek-ai/') || seen.has(id)) return;
      seen.add(id);
      let bundlePath = clientModules.clientPath(id) || '';
      let pkg = bundlePath ? await loadPkgMeta(id, bundlePath) : null;
      // 已停用插件拿不到 clientPath：从 profile 的 node_modules 直接读
      let fallbackDir = '';
      if (!pkg && profileRoot) {
        fallbackDir = id.indexOf('@') === 0
          ? profileRoot + '/node_modules/' + id.replace('/', '/')
          : profileRoot + '/node_modules/' + id;
        pkg = await loadPkgFromDir(id, fallbackDir);
      }
      const actualEnabled = await pluginActuallyEnabled(id);
      const patchedDisabled = bundlePath ? await patchedDisabledOf(bundlePath, id) : false;
      // enabled = loader 实际运行 且 未被持久化停用
      const enabled = actualEnabled !== false && !patchedDisabled;
      const displayPath = bundlePath || (fallbackDir ? fallbackDir + '/client.js' : '');
      return {
        id,
        name: (pkg && pkg.name) || id,
        version: (pkg && pkg.version) || '',
        description: (pkg && pkg.description) || '',
        author: authorOf(pkg),
        homepage: (pkg && pkg.homepage) || '',
        repository: (pkg && pkg.repository && (typeof pkg.repository === 'string' ? pkg.repository : pkg.repository.url)) || '',
        enabled: enabled,
        persistedDisabled: patchedDisabled,
        path: displayPath,
        installedLocally: displayPath.indexOf('plugins-dev') !== -1
      };
    }

    const pluginManager = {
      // 获取第三方插件列表（排除 @deepseek-ai/ 官方包）
      // 数据源合并：当前 graph（运行中的）+ profile.bundles（配置中但可能已停用）
      async listThirdPartyPlugins() {
        const clientModules = ctx.get('clientModules');
        if (!clientModules) return [];
        const graph = clientModules.graph();
        const seen = new Set();
        const plugins = [];
        // 用任意 bundle 路径推导 profile 根（先于遍历，供已停用插件兜底）
        const anyEntry = (graph.entries || [])[0];
        const anyPath = anyEntry ? clientModules.clientPath(anyEntry.id) : '';
        const profilePkgPath = anyPath ? profilePackagePathOf(anyPath) : null;
        const profileRoot = profilePkgPath ? profileRootOf(anyPath) : null;
        const profile = profilePkgPath ? await readJsonFile(profilePkgPath) : null;
        const bundles = profile && profile.dsh && profile.dsh.profile && Array.isArray(profile.dsh.profile.bundles)
          ? profile.dsh.profile.bundles
          : [];
        // 1. 当前运行中的第三方插件（graph）
        for (const entry of (graph.entries || [])) {
          const info = await collectPlugin(clientModules, entry && entry.id, seen, profileRoot);
          if (info) plugins.push(info);
        }
        // 2. profile.bundles 中配置但已停用的第三方插件（停用后 graph 不再包含它）
        for (const bundleId of bundles) {
          if (bundleId && bundleId.startsWith('@deepseek-ai/')) continue; // 跳过官方 bundle
          const info = await collectPlugin(clientModules, bundleId, seen, profileRoot);
          if (info) plugins.push(info);
        }
        return plugins;
      },

      // 获取所有插件（含官方，供对比调试）
      async listAllPlugins() {
        const clientModules = ctx.get('clientModules');
        if (!clientModules) return [];
        const graph = clientModules.graph();
        return (graph.entries || []).map(function (entry) {
          return { id: entry.id, isOfficial: entry.id.indexOf('@deepseek-ai/') === 0 };
        });
      },

      // 启用插件（运行时热启用 + 持久化）
      async enablePlugin(pluginId) {
        console.log('启用插件: ' + pluginId);
        const clientModules = ctx.get('clientModules');
        let bundlePath = clientModules ? (clientModules.clientPath(pluginId) || '') : '';
        // 已停用插件拿不到 clientPath：从任意可见 bundle 推导 home
        if (!bundlePath && clientModules) {
          const graph = clientModules.graph();
          const anyEntry = (graph.entries || [])[0];
          const anyPath = anyEntry ? clientModules.clientPath(anyEntry.id) : '';
          if (anyPath) {
            const root = profileRootOf(anyPath);
            bundlePath = normPath(pluginId.indexOf('@') === 0
              ? root + '/node_modules/' + pluginId.replace('/', '/') + '/client.js'
              : root + '/node_modules/' + pluginId + '/client.js');
          }
        }
        // 1. 运行时热启用
        const entry = await findLoaderEntry(pluginId);
        let updateError = null;
        if (entry) {
          try {
            await entry.update({ disabled: false });
          } catch (e) {
            updateError = (e && e.message) || String(e);
            console.error('热启用失败: ' + updateError);
          }
        } else {
          updateError = 'loader 中未找到该插件的 entry（可能未在配置中）';
        }
        // 2. 持久化到 home patch
        let persisted = false;
        if (bundlePath) persisted = await persistDisabled(bundlePath, pluginId, false);
        return {
          success: updateError === null,
          message: updateError === null
            ? '插件 ' + pluginId + ' 已启用' + (persisted ? '（已持久化，重启后保持）' : '（运行时生效，未持久化）')
            : '启用失败: ' + updateError,
          diagnostic: { updateError: updateError, persisted: persisted }
        };
      },

      // 停用插件（运行时热停用 + 持久化）
      async disablePlugin(pluginId) {
        console.log('停用插件: ' + pluginId);
        const clientModules = ctx.get('clientModules');
        let bundlePath = clientModules ? (clientModules.clientPath(pluginId) || '') : '';
        // 1. 运行时热停用
        const entry = await findLoaderEntry(pluginId);
        let updateError = null;
        let afterDisabled = null;
        let afterHasFiber = null;
        if (entry) {
          try {
            console.log('找到 entry: name=' + entry.options.name + ' disabled=' + entry.disabled + ' hasFiber=' + !!entry.fiber);
            await entry.update({ disabled: true });
            // update 后立即复查状态
            afterDisabled = !!entry.disabled;
            afterHasFiber = !!entry.fiber;
            console.log('update 后: disabled=' + afterDisabled + ' hasFiber=' + afterHasFiber);
            if (!afterDisabled) {
              updateError = 'update 调用完成但 entry.disabled 仍为 false（热切换未生效）';
            }
          } catch (e) {
            updateError = (e && e.message) || String(e);
            console.error('热停用失败: ' + updateError);
          }
        } else {
          updateError = 'loader 中未找到该插件的 entry';
        }
        // 2. 持久化到 home patch（clientPath 在热停用后仍可查，此处兜底）
        let persisted = false;
        if (bundlePath) persisted = await persistDisabled(bundlePath, pluginId, true);
        const loaderDiag = await diagnoseLoader(pluginId);
        return {
          success: updateError === null,
          message: updateError === null
            ? '插件 ' + pluginId + ' 已停用' + (persisted ? '（已持久化，重启后保持）' : '（运行时生效，未持久化）')
            : '停用失败: ' + updateError,
          diagnostic: {
            loaderAvailable: loaderDiag.loaderAvailable,
            entryCount: loaderDiag.entryCount,
            matchedEntry: loaderDiag.matchedEntry,
            updateError: updateError,
            afterDisabled: afterDisabled,
            afterHasFiber: afterHasFiber,
            persisted: persisted
          }
        };
      },

      // 卸载插件（运行时停用 + 从 profile 配置移除 + 持久化 disabled）
      async uninstallPlugin(pluginId) {
        console.log('卸载插件: ' + pluginId);
        const clientModules = ctx.get('clientModules');
        const bundlePath = clientModules ? (clientModules.clientPath(pluginId) || '') : '';
        // 1. 运行时停用
        const entry = await findLoaderEntry(pluginId);
        if (entry) {
          try {
            await entry.update({ disabled: true });
          } catch (e) { /* 忽略 */ }
        }
        // 2. 持久化 disabled
        if (bundlePath) await persistDisabled(bundlePath, pluginId, true);
        // 3. 从 profile 配置移除依赖与 bundles
        const removed = bundlePath ? await removeFromProfile(bundlePath, pluginId) : { ok: false, message: '无法定位安装路径' };
        return {
          success: removed.ok,
          message: '插件 ' + pluginId + ' 已卸载：' + removed.message + '。请重启 DSH 完成清理。'
        };
      },

      // 检查更新：查询 npm registry
      async checkForUpdates(pluginId) {
        console.log('检查更新: ' + pluginId);
        const clientModules = ctx.get('clientModules');
        if (!clientModules) return { hasUpdate: false, message: '无法获取插件信息' };
        const bundlePath = clientModules.clientPath(pluginId) || '';
        const pkg = bundlePath ? await loadPkgMeta(pluginId, bundlePath) : null;
        if (!pkg) return { hasUpdate: false, message: '插件不存在' };
        const currentVersion = pkg.version || '';
        // 本地 file: 安装的插件无法从 npm 更新
        if (bundlePath.indexOf('plugins-dev') !== -1) {
          return { hasUpdate: false, currentVersion: currentVersion, latestVersion: '', message: '本地安装插件，无 npm 远程版本（' + pluginId + ' v' + currentVersion + '）' };
        }
        const web = ctx.get('web');
        if (!web) return { hasUpdate: false, currentVersion: currentVersion, message: '无法访问网络服务' };
        try {
          const encoded = pluginId.indexOf('@') === 0 ? pluginId.replace('/', '%2F') : pluginId;
          const fetched = await web.fetch({ url: 'https://registry.npmjs.org/' + encoded + '/latest' });
          // WebFetchResult: { url, statusCode, body: { kind, content }, truncated }
          const text = fetched && fetched.body && typeof fetched.body.content === 'string' ? fetched.body.content : '';
          let remote = null;
          try { remote = JSON.parse(text); } catch (e) { /* 解析失败 */ }
          const latestVersion = (remote && remote.version) || '';
          const hasUpdate = !!latestVersion && latestVersion !== currentVersion;
          return {
            hasUpdate: hasUpdate,
            currentVersion: currentVersion,
            latestVersion: latestVersion,
            message: hasUpdate
              ? '发现新版本：' + pluginId + ' ' + currentVersion + ' → ' + latestVersion
              : (latestVersion ? pluginId + ' 已是最新版本 (' + currentVersion + ')' : '无法获取远程版本信息')
          };
        } catch (err) {
          return { hasUpdate: false, currentVersion: currentVersion, message: '检查更新失败: ' + (err && err.message ? err.message : String(err)) };
        }
      }
    };

    ctx.provide('thirdPartyPluginManager', pluginManager);

    harness.handle('listThirdPartyPlugins', async function () {
      return await pluginManager.listThirdPartyPlugins();
    });
    harness.handle('listAllPlugins', async function () {
      return await pluginManager.listAllPlugins();
    });
    harness.handle('enablePlugin', async function (args) {
      return await pluginManager.enablePlugin(args && args.pluginId);
    });
    harness.handle('disablePlugin', async function (args) {
      return await pluginManager.disablePlugin(args && args.pluginId);
    });
    harness.handle('uninstallPlugin', async function (args) {
      return await pluginManager.uninstallPlugin(args && args.pluginId);
    });
    harness.handle('checkForUpdates', async function (args) {
      return await pluginManager.checkForUpdates(args && args.pluginId);
    });
    harness.handle('diagnose', async function (args) {
      return await diagnoseLoader(args && args.pluginId);
    });

    return function () {};
  }
}
