const ACTION_COPY = {
  bootstrap: {
    start: '正在加载 warehouse',
    success: 'warehouse 已就绪',
    error: 'warehouse 初始化失败'
  },
  refresh: {
    start: '正在刷新 warehouse',
    success: 'warehouse 已刷新',
    error: 'warehouse 刷新失败'
  },
  saveMetadata: {
    start: '正在保存技能元数据',
    success: '技能元数据已保存',
    error: '技能元数据保存失败'
  },
  loadTree: {
    start: '正在加载技能目录',
    success: '技能目录已加载',
    error: '技能目录加载失败'
  },
  saveFile: {
    start: '正在保存文件',
    success: '文件已保存',
    error: '文件保存失败'
  },
  createPath: {
    start: '正在创建路径',
    success: '路径已创建',
    error: '路径创建失败'
  },
  renamePath: {
    start: '正在重命名路径',
    success: '路径已重命名',
    error: '路径重命名失败'
  },
  deletePath: {
    start: '正在删除路径',
    success: '路径已删除',
    error: '路径删除失败'
  },
  migrate: {
    start: '正在迁移现有 skills',
    success: '迁移已完成',
    error: '迁移失败'
  },
  sync: {
    start: '正在同步到客户端',
    success: '客户端同步完成',
    error: '客户端同步失败'
  },
  generateCommand: {
    start: '正在生成 init-project 命令',
    success: '命令已生成',
    error: '命令生成失败'
  }
}

export function createActionState() {
  return {
    busy: false,
    activeAction: null,
    statusTone: 'idle',
    statusText: '准备就绪'
  }
}

export function createEditorState() {
  return {
    path: '',
    value: '',
    dirty: false
  }
}

export function nextEditorState(state, event) {
  if (event.type === 'load') {
    return {
      path: event.path,
      value: event.value,
      dirty: false
    }
  }

  if (event.type === 'edit') {
    return {
      ...state,
      value: event.value,
      dirty: true
    }
  }

  if (event.type === 'saved') {
    return {
      ...state,
      dirty: false
    }
  }

  return state
}

export function nextActionState(state, event) {
  const copy = ACTION_COPY[event.action] || {
    start: '正在处理',
    success: '操作已完成',
    error: '操作执行失败'
  }

  if (event.type === 'start') {
    return {
      ...state,
      busy: true,
      activeAction: event.action,
      statusTone: 'working',
      statusText: copy.start
    }
  }

  if (event.type === 'success') {
    return {
      ...state,
      busy: false,
      activeAction: null,
      statusTone: 'success',
      statusText: copy.success
    }
  }

  if (event.type === 'error') {
    return {
      ...state,
      busy: false,
      activeAction: null,
      statusTone: 'error',
      statusText: copy.error
    }
  }

  return state
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function groupSkillsByType(skills) {
  const groups = new Map()

  skills.forEach(skill => {
    const label = skill.skill_type || 'uncategorized'
    if (!groups.has(label)) {
      groups.set(label, [])
    }
    groups.get(label).push(skill)
  })

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, items]) => ({
      label,
      items: items.sort((left, right) => {
        const leftName = left.name || left.id
        const rightName = right.name || right.id
        return leftName.localeCompare(rightName)
      })
    }))
}

export function filterSkills(skills, filters = {}) {
  const query = (filters.query || '').trim().toLowerCase()
  const tag = (filters.tag || '').trim()

  return skills.filter(skill => {
    const haystack = [skill.id, skill.name, skill.description, skill.skill_type]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    const matchesQuery = !query || haystack.includes(query)
    const matchesTag = !tag || (skill.tags || []).includes(tag)
    return matchesQuery && matchesTag
  })
}

export function collectKnownTags(skills) {
  return [...new Set(skills.flatMap(skill => skill.tags || []))].sort((left, right) =>
    left.localeCompare(right)
  )
}

export function renderSkillGroupsHtml(skills, selectedSkillId) {
  if (!skills.length) {
    return '<div class="empty-state">暂无 skills</div>'
  }

  return groupSkillsByType(skills)
    .map(group => {
      const items = group.items
        .map(skill => {
          const selected = skill.stable_id === selectedSkillId ? ' is-selected' : ''
          const title = escapeHtml(skill.name || skill.id)
          const type = escapeHtml(skill.skill_type || 'uncategorized')
          const tags = (skill.tags || [])
            .map(tag => `<span class="tag-chip">${escapeHtml(tag)}</span>`)
            .join('')

          return `
            <button class="skill-row${selected}" type="button" data-skill-id="${skill.stable_id}">
              <div class="skill-row__main">
                <strong>${title}</strong>
                <span>#${skill.stable_id}</span>
              </div>
              <div class="skill-row__meta">
                <span class="type-pill">${type}</span>
                <span class="tag-strip">${tags || '<span class="tag-chip tag-chip--muted">未打标签</span>'}</span>
              </div>
            </button>
          `
        })
        .join('')

      return `
        <section class="skill-group">
          <header class="skill-group__head">${escapeHtml(group.label)}</header>
          <div class="skill-group__items">${items}</div>
        </section>
      `
    })
    .join('')
}

export function renderTagOptionsHtml(tags, activeTag) {
  const options = ['<option value="">全部标签</option>']
  tags.forEach(tag => {
    const selected = tag === activeTag ? ' selected' : ''
    options.push(`<option value="${escapeHtml(tag)}"${selected}>${escapeHtml(tag)}</option>`)
  })
  return options.join('')
}

export function renderTreeHtml(node, selectedPath = '') {
  if (!node) {
    return '<div class="empty-state">请选择一个 skill</div>'
  }

  const children = node.children || []
  const childHtml = children
    .map(child => {
      const selected = child.path === selectedPath ? ' is-selected' : ''
      const label = escapeHtml(child.name)
      const branch = child.kind === 'dir' ? renderTreeHtml(child, selectedPath) : ''
      return `
        <div class="tree-node tree-node--${child.kind}">
          <button type="button" class="tree-node__label${selected}" data-tree-path="${escapeHtml(child.path)}" data-tree-kind="${child.kind}">
            ${label}
          </button>
          ${child.kind === 'dir' ? `<div class="tree-node__children">${branch}</div>` : ''}
        </div>
      `
    })
    .join('')

  return childHtml || '<div class="empty-state">skill 目录为空</div>'
}

export function renderMigrationSummary(report) {
  if (!report) {
    return '<div class="migration-summary__empty">尚未执行迁移</div>'
  }

  return `
    <div class="migration-summary">
      <strong>迁移完成</strong>
      <div class="migration-summary__grid">
        <span>新增 ${report.imported ?? 0}</span>
        <span>覆盖 ${report.overwritten ?? 0}</span>
        <span>跳过 ${report.skipped ?? 0}</span>
        <span>移除 ${report.removed ?? 0}</span>
      </div>
    </div>
  `
}

export function formatOutputPayload(payload, tone = 'info') {
  if (payload instanceof Error) {
    return {
      tone: 'error',
      text: payload.message || String(payload)
    }
  }

  if (typeof payload === 'string') {
    return { tone, text: payload }
  }

  return {
    tone,
    text: JSON.stringify(payload, null, 2)
  }
}

export function createAppShellHtml() {
  return `
    <main class="app-shell">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Warehouse Workspace</p>
          <h1>agents-manager</h1>
          <p>单一 warehouse、稳定 ID、迁移、同步、编辑都在同一个桌面工作台里完成。</p>
        </div>
        <div class="status-card" data-role="status" data-tone="idle">
          <span class="status-dot"></span>
          <div>
            <p class="status-label">状态</p>
            <strong id="statusText">准备就绪</strong>
          </div>
        </div>
      </section>

      <section class="workspace">
        <aside class="panel navigator-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">Navigator</p>
              <h2>Skills</h2>
            </div>
          </div>
          <div class="filter-bar" data-role="filter-bar">
            <input id="searchInput" placeholder="搜索名称 / ID / 描述" />
            <select id="tagFilter"></select>
          </div>
          <div class="skill-list" id="skillList" data-role="skill-list"></div>
        </aside>

        <section class="panel editor-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">Editor</p>
              <h2 id="editorTitle">Skill Files</h2>
            </div>
            <div class="button-row compact">
              <button id="refresh" class="ghost">刷新</button>
              <button id="saveFile" class="primary">保存文件</button>
            </div>
          </div>

          <div class="editor-workspace">
            <div class="tree-panel">
              <div class="section-title">文件树</div>
              <div class="tree-view" id="skillTree" data-role="skill-tree"></div>
              <div class="button-row stacked">
                <button id="createFile" class="secondary">新建文件</button>
                <button id="createFolder" class="secondary">新建文件夹</button>
                <button id="renamePath" class="ghost">重命名</button>
                <button id="deletePath" class="ghost">删除</button>
              </div>
            </div>

            <div class="editor-surface">
              <label class="section-title" for="editorInput">文本编辑器</label>
              <textarea id="editorInput" data-role="editor" spellcheck="false" placeholder="选择文本文件后开始编辑"></textarea>
            </div>
          </div>
        </section>

        <aside class="panel sidebar-panel">
          <article class="sidebar-card" data-role="metadata-panel">
            <div class="panel-head compact-head">
              <div>
                <p class="panel-kicker">Metadata</p>
                <h2>类型与标签</h2>
              </div>
            </div>
            <div class="field">
              <span>Stable ID</span>
              <strong id="skillStableId">-</strong>
            </div>
            <label class="field">
              <span>Skill Type</span>
              <input id="skillType" placeholder="workflow / tooling / research" />
            </label>
            <label class="field">
              <span>Tags</span>
              <input id="skillTags" placeholder="rust, cli, editor" />
            </label>
            <button id="saveMetadata" class="primary">保存元数据</button>
          </article>

          <article class="sidebar-card" data-role="migration-panel">
            <div class="panel-head compact-head">
              <div>
                <p class="panel-kicker">Migration</p>
                <h2>导入旧 Skills</h2>
              </div>
            </div>
            <p class="sidebar-copy">首次启动后不再自动迁移。需要时可手动把 \`.codex/.claude\` 中的 skills 移入 warehouse。</p>
            <button id="migrate" class="secondary">迁移现有 Skills</button>
            <div id="migrationResult"></div>
          </article>

          <article class="sidebar-card" data-role="client-actions">
            <div class="panel-head compact-head">
              <div>
                <p class="panel-kicker">Distribution</p>
                <h2>客户端同步</h2>
              </div>
            </div>
            <label class="field">
              <span>客户端</span>
              <select id="clientSelect">
                <option value="codex">Codex</option>
                <option value="claude">Claude</option>
                <option value="cursor">Cursor</option>
              </select>
            </label>
            <label class="field">
              <span>同步模式</span>
              <select id="modeSelect">
                <option value="symlink">symlink</option>
                <option value="copy">copy</option>
              </select>
            </label>
            <div class="button-row stacked">
              <button id="syncSkills" class="primary">同步到客户端</button>
              <button id="generateCommand" class="ghost">生成 init-project 命令</button>
            </div>
            <textarea id="generatedCommand" readonly placeholder="生成的命令会显示在这里"></textarea>
          </article>

          <article class="panel output-panel">
            <div class="panel-head compact-head">
              <div>
                <p class="panel-kicker">Output</p>
                <h2>执行结果</h2>
              </div>
            </div>
            <pre id="output" class="output-console" data-role="output" data-tone="info">等待操作…</pre>
          </article>
        </aside>
      </section>
    </main>
  `
}
