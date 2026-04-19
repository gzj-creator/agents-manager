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
  createSkill: {
    start: '正在创建 Skill',
    success: 'Skill 已创建',
    error: 'Skill 创建失败'
  },
  createPath: {
    start: '正在创建路径',
    success: '路径已创建',
    error: '路径创建失败'
  },
  importGitSkills: {
    start: '正在导入 Git 仓库',
    success: '仓库导入完成',
    error: '仓库导入失败'
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
  },
  copyCommand: {
    start: '正在复制命令',
    success: '命令已复制',
    error: '命令复制失败'
  },
  saveSettings: {
    start: '正在保存设置',
    success: '设置已保存',
    error: '设置保存失败'
  },
  pickFolder: {
    start: '正在选择目录',
    success: '目录已选中',
    error: '目录选择失败'
  },
  loadMcp: {
    start: '正在读取 MCP 配置',
    success: 'MCP 配置已加载',
    error: 'MCP 配置读取失败'
  },
  saveMcpServer: {
    start: '正在整理当前 MCP Server',
    success: 'MCP Server 已整理到列表',
    error: 'MCP Server 保存失败'
  },
  saveMcpConfig: {
    start: '正在写入 MCP 配置',
    success: 'MCP 配置已写入',
    error: 'MCP 配置写入失败'
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

export function createSkillDraftState() {
  return {
    open: false,
    id: '',
    name: '',
    description: '',
    error: ''
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

export function nextSkillDraftState(state, event) {
  if (event.type === 'open') {
    return {
      ...state,
      open: true,
      error: ''
    }
  }

  if (event.type === 'edit' && ['id', 'name', 'description'].includes(event.field)) {
    return {
      ...state,
      [event.field]: event.value,
      error: ''
    }
  }

  if (event.type === 'error') {
    return {
      ...state,
      open: true,
      error: event.message
    }
  }

  if (event.type === 'close' || event.type === 'created') {
    return createSkillDraftState()
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

export function resolveDistributionSkillIds(checkedSkillIds = [], selectedSkillId = null) {
  const checked = [...new Set(checkedSkillIds.filter(id => Number.isFinite(id)))]
  if (checked.length) {
    return checked
  }
  return selectedSkillId == null ? [] : [selectedSkillId]
}

export function normalizePageId(page) {
  return ['skills', 'editor', 'mcp', 'settings'].includes(page) ? page : 'skills'
}

export function renderSkillGroupsHtml(skills, selectedSkillId, checkedSkillIds = []) {
  if (!skills.length) {
    return '<div class="empty-state">暂无 skills</div>'
  }

  const checkedSet = new Set(checkedSkillIds)

  return groupSkillsByType(skills)
    .map(group => {
      const items = group.items
        .map(skill => {
          const selected = skill.stable_id === selectedSkillId ? ' is-selected' : ''
          const checked = checkedSet.has(skill.stable_id) ? ' checked' : ''
          const title = escapeHtml(skill.name || skill.id)
          const type = escapeHtml(skill.skill_type || 'uncategorized')
          const tags = (skill.tags || [])
            .map(tag => `<span class="tag-chip">${escapeHtml(tag)}</span>`)
            .join('')

          return `
            <div class="skill-row-shell">
              <label class="skill-row-check" aria-label="选择 ${title}">
                <input type="checkbox" data-skill-check="${skill.stable_id}"${checked} />
                <span class="skill-row-check__box" aria-hidden="true"></span>
              </label>
              <button class="skill-row${selected}" type="button" data-skill-id="${skill.stable_id}">
                <div class="skill-row__main">
                  <strong>${title}</strong>
                  <span>${skill.stable_id}</span>
                </div>
                <div class="skill-row__meta">
                  <span class="type-pill">${type}</span>
                  <span class="tag-strip">${tags || '<span class="tag-chip tag-chip--muted">未打标签</span>'}</span>
                </div>
              </button>
            </div>
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

export function renderExplorerSkillListHtml(skills, selectedSkillId) {
  if (!skills.length) {
    return '<div class="empty-state">暂无 skills</div>'
  }

  return groupSkillsByType(skills)
    .map(group => {
      const items = group.items
        .map(skill => {
          const selected = skill.stable_id === selectedSkillId ? ' is-selected' : ''
          const name = escapeHtml(skill.name || skill.id)
          const id = escapeHtml(skill.id)

          return `
            <button class="explorer-skill${selected}" type="button" data-skill-id="${skill.stable_id}">
              <span class="explorer-skill__name">${name}</span>
              <span class="explorer-skill__meta">${id}</span>
            </button>
          `
        })
        .join('')

      return `
        <section class="explorer-group">
          <header class="explorer-group__head">${escapeHtml(group.label)}</header>
          <div class="explorer-group__items">${items}</div>
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

export function renderGitImportSummary(report) {
  if (!report) {
    return '<div class="migration-summary__empty">尚未导入仓库</div>'
  }

  return `
    <div class="migration-summary">
      <strong>导入完成</strong>
      <div class="migration-summary__grid">
        <span>发现 ${report.discovered ?? 0}</span>
        <span>导入 ${report.imported ?? 0}</span>
        <span>跳过 ${report.skipped ?? 0}</span>
        <span>冲突 ${report.conflicts ?? 0}</span>
      </div>
    </div>
  `
}

function renderSkillsImportPanelHtml({
  importExpanded = false,
  gitImportUrl = '',
  migrationResult = null,
  migrationOutput = null,
  gitImportResult = null,
  gitImportOutput = null
} = {}) {
  const triggerLabel = importExpanded ? '收起仓库操作' : '仓库导入与迁移'

  return `
    <section class="skills-import-shell">
      <button
        id="toggleSkillsImport"
        class="ghost"
        type="button"
        data-role="skills-import-trigger"
        aria-expanded="${importExpanded ? 'true' : 'false'}"
      >${triggerLabel}</button>

      ${importExpanded
        ? `
          <div class="skills-import-panel" data-role="skills-import-panel">
            <div class="skills-import-grid">
              <section class="skills-import-card">
                <div class="section-title">导入旧 Skills</div>
                <p class="sidebar-copy">把旧客户端目录中的 skills 一次性迁移到当前 warehouse。</p>
                <div class="button-row compact">
                  <button id="migrate" class="secondary" type="button">执行迁移</button>
                </div>
                ${renderMigrationSummary(migrationResult)}
                ${renderToolOutputHtml(migrationOutput, 'skills-migration-output')}
              </section>

              <section class="skills-import-card">
                <div class="section-title">导入仓库中的 Skills</div>
                <p class="sidebar-copy">支持 clone Git 仓库后自动查找形如 <code>xxxx/SKILL.md</code> 的目录结构并导入到 warehouse。</p>
                <label class="field">
                  <span>Git URL</span>
                  <input
                    id="gitRepoUrl"
                    value="${escapeHtml(gitImportUrl)}"
                    placeholder="https://github.com/org/repo.git"
                  />
                </label>
                <div class="button-row compact">
                  <button id="importGitSkills" class="secondary" type="button">导入仓库</button>
                </div>
                ${renderGitImportSummary(gitImportResult)}
                ${renderToolOutputHtml(gitImportOutput, 'skills-git-output')}
              </section>
            </div>
          </div>
        `
        : ''}
    </section>
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

function renderEditorContextBarHtml({ selectedSkillName = '' } = {}) {
  const title = selectedSkillName ? escapeHtml(selectedSkillName) : '选择一个文件'
  return `
    <div class="panel-head editor-context-bar">
      <div class="editor-context-copy">
        <p class="panel-kicker">Editor</p>
        <h2 id="editorTitle">${title}</h2>
        <p id="editorContext">主要用于整理、移动和修改现有 skill 文件</p>
      </div>
      <div class="editor-context-actions">
        <span class="editor-dirty-state" id="editorDirtyState">已保存</span>
        <button id="refresh" class="ghost">刷新</button>
        <button id="saveFile" class="primary">保存文件</button>
      </div>
    </div>
  `
}

function renderCreateSkillFormShellHtml({
  createError = '',
  createId = ''
} = {}) {
  const errorHtml = createError
    ? `<p class="form-error">${escapeHtml(createError)}</p>`
    : ''

  return `
    <form class="create-skill" data-role="create-skill-form">
      <div class="section-title">创建目录</div>
      <p class="sidebar-copy">只创建目录，不生成 SKILL.md。你可以之后自己把文件移进来，再点刷新开始管理。</p>
      ${errorHtml}
      <label class="field">
        <span>Skill ID</span>
        <input id="createSkillId" value="${escapeHtml(createId)}" placeholder="alpha" />
      </label>
      <div class="button-row compact">
        <button id="createSkill" class="primary" type="button">创建目录</button>
        <button id="cancelCreateSkill" class="ghost" type="button">取消</button>
      </div>
    </form>
  `
}

export function createEditorPageHtml({
  selectedSkillName = '',
  createOpen = false,
  createError = '',
  createId = ''
} = {}) {
  return `
    <section class="page-grid page-grid--editor">
      <section class="panel editor-panel">
        ${renderEditorContextBarHtml({ selectedSkillName })}

        <div class="editor-workspace">
          <div class="tree-panel" data-role="editor-explorer">
            <div class="explorer-head">
              <div>
                <p class="panel-kicker">Explorer</p>
                <h2>Skills</h2>
              </div>
              <button id="openCreateSkill" class="ghost" type="button" data-role="create-skill-entry">新建</button>
            </div>
            ${createOpen
              ? renderCreateSkillFormShellHtml({
                  createError,
                  createId
                })
              : ''}

            <section class="explorer-section">
              <div class="section-title">Warehouse</div>
              <div class="explorer-skill-list" id="explorerSkillList" data-role="explorer-skill-list"></div>
            </section>

            <section class="explorer-section explorer-section--tree">
              <div class="section-title">文件树</div>
              <div class="tree-view" id="skillTree" data-role="skill-tree"></div>
            </section>

            <div class="button-row explorer-actions">
              <button id="createFile" class="secondary">新建文件</button>
              <button id="createFolder" class="secondary">新建文件夹</button>
              <button id="renamePath" class="ghost">重命名</button>
              <button id="deletePath" class="ghost">删除</button>
            </div>
          </div>

          <div class="editor-surface" data-role="editor-workbench">
            <div class="editor-code-head">
              <label class="section-title" for="editorInput">文本编辑器</label>
              <span class="editor-code-hint">适合修改现有 SKILL.md 和目录里的其他文本文件。</span>
            </div>
            <textarea id="editorInput" data-role="editor" spellcheck="false" placeholder="选择文本文件后开始编辑"></textarea>
          </div>
        </div>
      </section>
    </section>
  `
}

export function createWorkspacePageHtml() {
  return createEditorPageHtml()
}

function renderSkillsMetadataPanelHtml(selectedSkill = null, {
  checkedSkillIds = [],
  distributionSummary = '',
  client = 'codex',
  mode = 'symlink',
  command = '',
  copyLabel = '复制',
  copyState = 'idle'
} = {}) {
  if (!selectedSkill) {
    return `
      <article class="panel skills-page__details" data-role="skills-metadata-panel">
        <div class="panel-head compact-head">
          <div>
            <p class="panel-kicker">Skill Details</p>
            <h2>选择一个 Skill</h2>
          </div>
          <button id="openEditor" class="primary" type="button" data-role="open-editor" disabled>打开编辑器</button>
        </div>
        <p class="sidebar-copy">在左侧选中一个 skill 后，就可以在这里维护类型、标签、同步客户端和生成命令。编辑正文时再进入 Editor。</p>
      </article>
    `
  }

  return `
    <article class="panel skills-page__details" data-role="skills-metadata-panel">
      <div class="panel-head compact-head">
        <div>
          <p class="panel-kicker">Skill Details</p>
          <h2>${escapeHtml(selectedSkill.name || selectedSkill.id)}</h2>
        </div>
        <button id="openEditor" class="primary" type="button" data-role="open-editor">打开编辑器</button>
      </div>
      <div class="field">
        <span>Stable ID</span>
        <strong id="skillStableId">${selectedSkill.stable_id}</strong>
      </div>
      <label class="field">
        <span>Skill Type</span>
        <input id="skillType" value="${escapeHtml(selectedSkill.skill_type || '')}" placeholder="workflow / tooling / research" />
      </label>
      <label class="field">
        <span>Tags</span>
        <input id="skillTags" value="${escapeHtml((selectedSkill.tags || []).join(', '))}" placeholder="rust, cli, editor" />
      </label>
      <div class="button-row">
        <button id="saveMetadata" class="secondary" type="button">保存标签</button>
      </div>
      <p class="sidebar-copy">正文编辑放在 Editor 页面。这里负责 skill 的整理、同步和命令生成。</p>

      <section class="skills-inline-panel" data-role="skills-distribution-panel">
        <div class="section-title">客户端分发</div>
        <div class="field">
          <span>命令目标</span>
          <strong>${escapeHtml(distributionSummary || `当前 skill：${selectedSkill.name || selectedSkill.id}`)}</strong>
        </div>
        <label class="field">
          <span>客户端</span>
          <select id="clientSelect" data-role="sync-client">
            <option value="codex"${client === 'codex' ? ' selected' : ''}>Codex</option>
            <option value="claude"${client === 'claude' ? ' selected' : ''}>Claude</option>
            <option value="cursor"${client === 'cursor' ? ' selected' : ''}>Cursor</option>
          </select>
        </label>
        <label class="field">
          <span>同步模式</span>
          <select id="modeSelect">
            <option value="symlink"${mode === 'symlink' ? ' selected' : ''}>symlink</option>
            <option value="copy"${mode === 'copy' ? ' selected' : ''}>copy</option>
          </select>
        </label>
        <div class="button-row">
          <button id="syncSkills" class="primary" type="button">同步到客户端</button>
          <button id="generateCommand" class="ghost" type="button">生成 init-project 命令</button>
        </div>
        <label class="field">
          <span class="field__between">
            <span>生成命令</span>
            <button id="copyCommand" class="ghost" data-copy-state="${copyState}" type="button"${command ? '' : ' disabled'}>${escapeHtml(copyLabel)}</button>
          </span>
          <textarea
            id="generatedCommand"
            data-role="sync-command"
            readonly
            placeholder="生成的命令会显示在这里"
          >${escapeHtml(command)}</textarea>
        </label>
      </section>
    </article>
  `
}

export function createSkillsPageHtml({
  skills = [],
  query = '',
  tag = '',
  tags = [],
  selectedSkillId = null,
  selectedSkill = null,
  checkedSkillIds = [],
  distributionSummary = '',
  client = 'codex',
  mode = 'symlink',
  command = '',
  copyLabel = '复制',
  copyState = 'idle',
  importExpanded = false,
  gitImportUrl = '',
  migrationResult = null,
  migrationOutput = null,
  gitImportResult = null,
  gitImportOutput = null
} = {}) {
  return `
    <section class="page-grid page-grid--skills">
      <article class="panel skills-page__catalog">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">Browse</p>
            <h2>Warehouse Skills</h2>
          </div>
          <button id="refresh" class="ghost">刷新</button>
        </div>
        <div class="skills-toolbar">
          <label class="field">
            <span>搜索</span>
            <input
              id="searchInput"
              data-role="skills-search"
              value="${escapeHtml(query)}"
              placeholder="搜索名称 / ID / 描述"
            />
          </label>
          <label class="field">
            <span>标签</span>
            <select id="tagFilter" data-role="skills-tag-filter">
              ${renderTagOptionsHtml(tags, tag)}
            </select>
          </label>
        </div>
        ${renderSkillsImportPanelHtml({
          importExpanded,
          gitImportUrl,
          migrationResult,
          migrationOutput,
          gitImportResult,
          gitImportOutput
        })}
        <div class="catalog-toolbar">
          <span class="catalog-count">${skills.length} skills</span>
        </div>
        <div class="skill-list skill-list--page" id="skillList" data-role="skill-list">
          ${renderSkillGroupsHtml(skills, selectedSkillId, checkedSkillIds)}
        </div>
      </article>

      ${renderSkillsMetadataPanelHtml(selectedSkill, {
        checkedSkillIds,
        distributionSummary,
        client,
        mode,
        command,
        copyLabel,
        copyState
      })}
    </section>
  `
}

function renderToolOutputHtml(output = null, dataRole = 'migration-output') {
  if (!output) {
    return ''
  }

  const expanded = output.tone === 'error' ? ' open' : ''
  const toneLabel = output.tone === 'error' ? '错误详情' : '执行结果'

  return `
      <div class="tool-output" data-role="${dataRole}">
        <details class="output-disclosure"${expanded}>
          <summary class="output-disclosure__summary">
            <span class="output-disclosure__title">${toneLabel}</span>
            <span class="output-disclosure__hint">查看执行结果</span>
          </summary>
          <pre class="output-console" data-role="output" data-tone="${output.tone}">${escapeHtml(output.text)}</pre>
        </details>
      </div>
  `
}

export function createSettingsPageHtml({
  skillWarehouse = '',
  libraryRoots = []
} = {}) {
  const rootItems = Array.isArray(libraryRoots)
    ? libraryRoots
        .map(
          (root, index) => `
            <div class="settings-root-row">
              <span class="settings-root-row__path">${escapeHtml(root)}</span>
              <button
                class="ghost"
                type="button"
                data-remove-library-root="${index}"
              >移除</button>
            </div>
          `
        )
        .join('')
    : ''

  return `
    <section class="page-grid page-grid--split">
      <article class="panel" data-role="settings-warehouse">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">App Config</p>
            <h2>Skill Warehouse</h2>
          </div>
        </div>
        <p class="sidebar-copy">维护桌面端使用的技能仓库路径。优先通过按钮选择，避免手动记目录结构。</p>
        <label class="field">
          <span>Warehouse Path</span>
          <input
            id="settingsWarehouse"
            value="${escapeHtml(skillWarehouse)}"
            placeholder="/path/to/warehouse"
          />
        </label>
        <div class="button-row compact">
          <button id="pickSettingsWarehouse" class="secondary" type="button">选择文件夹</button>
          <button id="resetSettingsWarehouse" class="ghost" type="button">恢复默认</button>
          <button id="saveSettings" class="primary" type="button">保存设置</button>
        </div>
      </article>

      <article class="panel" data-role="settings-library-roots">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">App Config</p>
            <h2>Library Roots</h2>
          </div>
        </div>
        <p class="sidebar-copy">这些目录会一起参与 skill 扫描。对不熟悉仓库结构的人，优先点按钮添加即可。</p>
        <div class="settings-root-list" id="settingsLibraryRoots" data-role="settings-library-root-list">
          ${rootItems || '<div class="empty-state">尚未添加额外目录</div>'}
        </div>
        <div class="button-row compact">
          <button id="addLibraryRoot" class="secondary" type="button">添加目录</button>
        </div>
      </article>
    </section>
  `
}

function renderMcpServerListHtml(servers = [], selectedServerName = '') {
  if (!servers.length) {
    return '<div class="empty-state">当前目标还没有 MCP server</div>'
  }

  return servers
    .map(server => {
      const name = escapeHtml(server.name)
      const isSelected = server.name === selectedServerName ? ' is-selected' : ''
      const mode = server.url ? 'Remote' : 'stdio'

      return `
        <button
          class="mcp-server-row${isSelected}"
          type="button"
          data-mcp-server="${name}"
        >
          <strong>${name}</strong>
          <span>${mode}</span>
        </button>
      `
    })
    .join('')
}

export function createMcpPageHtml({
  client = 'codex',
  scope = 'global',
  projectPath = '',
  targetPath = '',
  servers = [],
  selectedServerName = '',
  editor = {},
  disabledProjectScope = false
} = {}) {
  const mode = editor.transport || (editor.url ? 'remote' : 'stdio')

  return `
    <section class="page-grid page-grid--mcp">
      <article class="panel mcp-sidebar">
        <div class="panel-head compact-head">
          <div>
            <p class="panel-kicker">MCP Target</p>
            <h2>配置入口</h2>
          </div>
          <button id="reloadMcp" class="ghost" type="button">重新读取</button>
        </div>

        <label class="field">
          <span>客户端</span>
          <select id="mcpClientSelect" data-role="mcp-client-select">
            <option value="codex"${client === 'codex' ? ' selected' : ''}>Codex</option>
            <option value="claude"${client === 'claude' ? ' selected' : ''}>Claude</option>
            <option value="cursor"${client === 'cursor' ? ' selected' : ''}>Cursor</option>
          </select>
        </label>

        <label class="field">
          <span>作用域</span>
          <select id="mcpScopeSelect" data-role="mcp-scope-select">
            <option value="global"${scope === 'global' ? ' selected' : ''}>全局</option>
            <option value="project"${scope === 'project' ? ' selected' : ''}${disabledProjectScope ? ' disabled' : ''}>项目内</option>
          </select>
        </label>
        ${disabledProjectScope
          ? '<p class="sidebar-copy">Codex 当前只开放全局 MCP 配置，项目内作用域会保持禁用。</p>'
          : ''}

        ${scope === 'project'
          ? `
            <label class="field">
              <span>项目路径</span>
              <input id="mcpProjectPath" value="${escapeHtml(projectPath)}" placeholder="/path/to/project" />
            </label>
            <div class="button-row compact">
              <button id="pickMcpProject" class="secondary" type="button">选择项目目录</button>
            </div>
          `
          : ''}

        <label class="field">
          <span>目标文件</span>
          <input value="${escapeHtml(targetPath)}" readonly />
        </label>

        <section class="explorer-section">
          <div class="section-title">Servers</div>
          <div class="mcp-server-list" data-role="mcp-server-list">
            ${renderMcpServerListHtml(servers, selectedServerName)}
          </div>
        </section>

        <div class="button-row compact">
          <button id="newMcpServer" class="secondary" type="button">空白新建</button>
          <button id="applyBetterIconsDemo" class="ghost" type="button">Better Icons Demo</button>
          <button id="applyOpenAiDocsDemo" class="ghost" type="button">OpenAI Docs Demo</button>
        </div>
      </article>

      <article class="panel mcp-editor-panel" data-role="mcp-editor">
        <div class="panel-head compact-head">
          <div>
            <p class="panel-kicker">Server Editor</p>
            <h2>${escapeHtml(selectedServerName || '新建 MCP Server')}</h2>
          </div>
          <button id="saveMcpConfig" class="primary" type="button">保存 MCP 配置</button>
        </div>

        <div class="mcp-editor-grid">
          <label class="field">
            <span>Server Name</span>
            <input id="mcpServerName" value="${escapeHtml(editor.name || '')}" placeholder="better-icons" />
          </label>

          <label class="field">
            <span>连接方式</span>
            <select id="mcpTransportMode">
              <option value="stdio"${mode === 'stdio' ? ' selected' : ''}>stdio</option>
              <option value="remote"${mode === 'remote' ? ' selected' : ''}>remote URL</option>
            </select>
          </label>

          ${mode === 'remote'
            ? `
              <label class="field field--wide">
                <span>Remote URL</span>
                <input
                  id="mcpServerUrl"
                  value="${escapeHtml(editor.url || '')}"
                  placeholder="https://developers.openai.com/mcp"
                />
              </label>
            `
            : `
              <label class="field">
                <span>Command</span>
                <input id="mcpServerCommand" value="${escapeHtml(editor.command || '')}" placeholder="npx" />
              </label>
              <label class="field field--wide">
                <span>Args</span>
                <input
                  id="mcpServerArgs"
                  value="${escapeHtml((editor.args || []).join(' '))}"
                  placeholder="-y better-icons"
                />
              </label>
            `}
        </div>

        <div class="button-row">
          <button id="saveMcpServer" class="secondary" type="button">保存当前 Server</button>
          <button id="deleteMcpServer" class="ghost" type="button"${selectedServerName ? '' : ' disabled'}>移除当前</button>
        </div>
      </article>
    </section>
  `
}

export function createAppShellHtml() {
  return `
    <main class="app-shell">
      <aside class="nav-rail" data-role="nav-rail">
        <div class="brand-mark">
          <p class="eyebrow">Warehouse Client</p>
          <h1>agents-manager</h1>
          <p>技能仓库、编辑、同步、迁移都通过单窗口客户端完成。</p>
        </div>

        <nav class="nav-links" aria-label="Primary">
          <button class="nav-link is-active" type="button" data-page-link="skills">Skills</button>
          <button class="nav-link" type="button" data-page-link="editor">Editor</button>
          <button class="nav-link" type="button" data-page-link="mcp">MCP</button>
          <button class="nav-link" type="button" data-page-link="settings">Settings</button>
        </nav>
      </aside>

      <section class="app-stage">
        <header class="page-header" data-role="page-header">
          <div class="page-copy">
            <h2 id="pageTitle">Warehouse Workspace</h2>
            <p id="pageDescription">浏览 warehouse 中的技能，并在独立页面里继续编辑、同步和迁移流程。</p>
          </div>

          <div class="page-header__meta">
            <div class="status-chip" data-role="status" data-tone="idle">
              <span class="status-dot"></span>
              <strong id="statusText">准备就绪</strong>
            </div>
          </div>
        </header>

        <section class="page-body" id="pageBody" data-role="page-body"></section>
      </section>
    </main>
  `
}
