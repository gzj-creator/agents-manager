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
    start: '正在加载条目目录',
    success: '条目目录已加载',
    error: '条目目录加载失败'
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
  createMemory: {
    start: '正在创建 Memory',
    success: 'Memory 已创建',
    error: 'Memory 创建失败'
  },
  deleteSkill: {
    start: '正在删除 Skill',
    success: 'Skill 已删除',
    error: 'Skill 删除失败'
  },
  deleteMemory: {
    start: '正在删除 Memory',
    success: 'Memory 已删除',
    error: 'Memory 删除失败'
  },
  renameSkill: {
    start: '正在重命名 Skill',
    success: 'Skill 已重命名',
    error: 'Skill 重命名失败'
  },
  renameMemory: {
    start: '正在重命名 Memory',
    success: 'Memory 已重命名',
    error: 'Memory 重命名失败'
  },
  createPath: {
    start: '正在创建路径',
    success: '路径已创建',
    error: '路径创建失败'
  },
  importDroppedSkill: {
    start: '正在导入拖入的 Skill',
    success: '拖入的 Skill 已导入',
    error: '拖入的 Skill 导入失败'
  },
  importDroppedMemory: {
    start: '正在导入拖入的 Memory',
    success: '拖入的 Memory 已导入',
    error: '拖入的 Memory 导入失败'
  },
  copyDroppedPaths: {
    start: '正在复制拖入内容',
    success: '拖入内容已复制',
    error: '拖入内容复制失败'
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
  generateMemoryCommand: {
    start: '正在生成 init-memory 命令',
    success: '命令已生成',
    error: '命令生成失败'
  },
  copyCommand: {
    start: '正在复制命令',
    success: '命令已复制',
    error: '命令复制失败'
  },
  copyMemoryCommand: {
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

export function createMemoryDraftState() {
  return {
    open: false,
    id: '',
    error: ''
  }
}

export function createPathDraftState() {
  return {
    open: false,
    action: 'create',
    kind: 'file',
    value: '',
    basePath: '',
    targetLabel: '',
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

export function nextMemoryDraftState(state, event) {
  if (event.type === 'open') {
    return {
      ...state,
      open: true,
      error: ''
    }
  }

  if (event.type === 'edit' && event.field === 'id') {
    return {
      ...state,
      id: event.value,
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
    return createMemoryDraftState()
  }

  return state
}

export function nextPathDraftState(state, event) {
  if (event.type === 'open') {
    return {
      ...state,
      open: true,
      action: event.action === 'rename'
        ? 'rename'
        : (event.action === 'delete' ? 'delete' : 'create'),
      kind: event.kind === 'dir' ? 'dir' : 'file',
      value: event.value || '',
      basePath: event.basePath || '',
      targetLabel: event.targetLabel || '',
      error: ''
    }
  }

  if (event.type === 'edit') {
    return {
      ...state,
      value: event.value,
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
    return createPathDraftState()
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

function normalizeSkillType(value) {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return {
      key: 'uncategorized',
      label: 'UNCATEGORIZED'
    }
  }

  const key = raw.toLowerCase()
  return {
    key,
    label: key.toUpperCase()
  }
}

export function groupSkillsByType(skills) {
  const groups = new Map()

  skills.forEach(skill => {
    const type = normalizeSkillType(skill.skill_type)
    if (!groups.has(type.key)) {
      groups.set(type.key, {
        label: type.label,
        items: []
      })
    }
    groups.get(type.key).items.push(skill)
  })

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, group]) => ({
      label: group.label,
      items: group.items.sort((left, right) => {
        const leftName = left.name || left.id
        const rightName = right.name || right.id
        return leftName.localeCompare(rightName)
      })
    }))
}

function sortSkillsByLabel(skills) {
  return [...skills].sort((left, right) => {
    const leftName = left.name || left.id || ''
    const rightName = right.name || right.id || ''
    return leftName.localeCompare(rightName)
  })
}

export function groupSkillsByTag(skills) {
  const groups = new Map()

  skills.forEach(skill => {
    const tags = [...new Set((skill.tags || []).map(tag => tag.trim()).filter(Boolean))]
    const keys = tags.length ? tags : ['uncategorized']

    keys.forEach(key => {
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key).push(skill)
    })
  })

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, items]) => ({
      key,
      label: key === 'uncategorized' ? 'UNCATEGORIZED' : key,
      items: sortSkillsByLabel(items)
    }))
}

export function resolveEditorGroupKey(skill, preferredGroupKey = '') {
  const tags = [...new Set((skill?.tags || []).map(tag => tag.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))

  if (!tags.length) {
    return 'uncategorized'
  }

  if (preferredGroupKey && tags.includes(preferredGroupKey)) {
    return preferredGroupKey
  }

  return tags[0]
}

function normalizeComparableSkillName(value) {
  return String(value ?? '').trim().toLowerCase()
}

function displayComparableSkillName(value) {
  return String(value ?? '').trim()
}

function comparableSkillKeys(skill = null) {
  return [...new Set(
    [skill?.name, skill?.id]
      .map(normalizeComparableSkillName)
      .filter(Boolean)
  )]
}

function displayComparableSkillLabel(skill = null) {
  return displayComparableSkillName(skill?.name) || displayComparableSkillName(skill?.id)
}

function droppedPathDepth(path = '') {
  return String(path ?? '')
    .trim()
    .replace(/[\\/]+$/, '')
    .split(/[\\/]+/)
    .filter(Boolean)
    .length
}

export function prioritizeDroppedSkillImportPaths(paths = []) {
  return [...new Set(
    paths
      .map(path => String(path ?? '').trim())
      .filter(Boolean)
  )].sort((left, right) => {
    const depthDiff = droppedPathDepth(left) - droppedPathDepth(right)
    if (depthDiff) {
      return depthDiff
    }

    const leftIsSkillMd = /(?:^|[\\/])SKILL\.md$/i.test(left)
    const rightIsSkillMd = /(?:^|[\\/])SKILL\.md$/i.test(right)
    if (leftIsSkillMd !== rightIsSkillMd) {
      return leftIsSkillMd ? -1 : 1
    }

    return left.localeCompare(right)
  })
}

export function isDroppedSkillAlreadyExistsError(error) {
  const message = String(error?.message ?? error ?? '').toLowerCase()
  return (
    message.includes('already exists') ||
    message.includes('file exists') ||
    message.includes('os error 17')
  )
}

export function resolveDroppedSkillImportCollision(skills = [], droppedSkill = null) {
  const droppedKeys = comparableSkillKeys(droppedSkill)
  if (!droppedKeys.length) {
    return { mode: 'import' }
  }

  const matches = skills.filter(skill =>
    comparableSkillKeys(skill).some(key => droppedKeys.includes(key))
  )
  if (!matches.length) {
    return { mode: 'import' }
  }

  const displayName = displayComparableSkillLabel(matches[0]) || displayComparableSkillLabel(droppedSkill)

  if (matches.length === 1) {
    return {
      mode: 'confirm-overwrite',
      targetSkillId: matches[0].stable_id,
      name: displayName
    }
  }

  return {
    mode: 'ambiguous-name',
    name: displayName,
    targetSkillIds: matches.map(skill => skill.stable_id)
  }
}

export function treeMenuActionNeedsDirtyConfirm(action) {
  return [
    'rename-skill',
    'delete-skill',
    'rename-memory',
    'delete-memory',
    'rename-path',
    'delete-path'
  ].includes(action)
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
  return ['skills', 'editor', 'memory', 'mcp', 'settings'].includes(page) ? page : 'skills'
}

function activeSkillInteraction(skillInteraction, stableId) {
  if (!skillInteraction || skillInteraction.skillId !== stableId) {
    return null
  }
  return skillInteraction
}

function renderSkillRenameFormHtml(draftId) {
  return `
    <div class="skill-inline-card skill-inline-card--rename" data-role="skill-rename-form">
      <label class="field">
        <span>Skill ID</span>
        <input
          id="skillRenameInput"
          value="${escapeHtml(draftId || '')}"
          autocomplete="off"
          spellcheck="false"
        />
      </label>
      <div class="button-row compact">
        <button type="button" class="primary" data-skill-inline-action="rename-submit">确定</button>
        <button type="button" class="ghost" data-skill-inline-action="rename-cancel">取消</button>
      </div>
      <p class="sidebar-copy">按 Enter 保存，按 Esc 取消。</p>
    </div>
  `
}

function renderSkillDeleteConfirmHtml(label) {
  return `
    <div class="skill-inline-card skill-inline-card--delete" data-role="skill-delete-confirm">
      <p class="sidebar-copy">删除 ${escapeHtml(label)} 后，整个 skill 目录都会被移除。</p>
      <div class="button-row compact">
        <button type="button" class="primary danger" data-skill-inline-action="delete-confirm">删除</button>
        <button type="button" class="ghost" data-skill-inline-action="delete-cancel">取消</button>
      </div>
    </div>
  `
}

function renderCreateSkillInlineHtml({
  createError = '',
  createId = '',
  createTargetLabel = ''
} = {}) {
  const target = createTargetLabel ? `<span class="explorer-create-skill__target">${escapeHtml(createTargetLabel)}</span>` : ''
  const errorHtml = createError ? `<p class="form-error">${escapeHtml(createError)}</p>` : ''

  return `
    <form class="explorer-create-skill" data-role="create-skill-form">
      <div class="explorer-create-skill__head">
        <strong>新建 Skill</strong>
        ${target}
      </div>
      <div class="explorer-create-skill__row">
        <input
          id="createSkillId"
          value="${escapeHtml(createId)}"
          placeholder="skill-id"
          autocomplete="off"
          spellcheck="false"
        />
        <button id="createSkill" type="button" class="primary compact-button" data-create-skill-action="submit">创建</button>
        <button id="cancelCreateSkill" type="button" class="ghost compact-button" data-create-skill-action="cancel">取消</button>
      </div>
      ${errorHtml}
    </form>
  `
}

function renderCreatePathInlineHtml({
  createPathAction = 'create',
  createPathKind = 'file',
  createPathValue = '',
  createPathError = '',
  createPathTargetLabel = ''
} = {}) {
  const isRename = createPathAction === 'rename'
  const isDelete = createPathAction === 'delete'
  const title = isRename
    ? '重命名'
    : (isDelete ? '删除' : (createPathKind === 'dir' ? '新建文件夹' : '新建文件'))
  const submitLabel = isRename ? '重命名' : (isDelete ? '删除' : '创建')
  const target = createPathTargetLabel
    ? `<span class="explorer-create-path__target">${escapeHtml(createPathTargetLabel)}</span>`
    : ''
  const errorHtml = createPathError ? `<p class="form-error">${escapeHtml(createPathError)}</p>` : ''

  if (isDelete) {
    return `
      <form class="skill-inline-card skill-inline-card--delete" data-role="create-path-form">
        <div class="explorer-create-path__head">
          <strong>${title}</strong>
          ${target}
        </div>
        <p class="sidebar-copy">删除 ${escapeHtml(createPathTargetLabel || createPathValue || '当前路径')} 后无法恢复。</p>
        <div class="button-row compact">
          <button id="createTreePath" type="button" class="primary danger" data-create-path-action="submit">${submitLabel}</button>
          <button id="cancelCreateTreePath" type="button" class="ghost" data-create-path-action="cancel">取消</button>
        </div>
        ${errorHtml}
      </form>
    `
  }

  return `
    <form class="explorer-create-path" data-role="create-path-form">
      <div class="explorer-create-path__head">
        <strong>${title}</strong>
        ${target}
      </div>
      <div class="explorer-create-path__row">
        <input
          id="createPathValue"
          value="${escapeHtml(createPathValue)}"
          placeholder="${createPathKind === 'dir' ? 'folder/name' : 'file.md'}"
          autocomplete="off"
          spellcheck="false"
        />
        <button id="createTreePath" type="button" class="primary compact-button" data-create-path-action="submit">${submitLabel}</button>
        <button id="cancelCreateTreePath" type="button" class="ghost compact-button" data-create-path-action="cancel">取消</button>
      </div>
      ${errorHtml}
    </form>
  `
}

export function renderSkillGroupsHtml(
  skills,
  selectedSkillId,
  checkedSkillIds = [],
  skillInteraction = null
) {
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
          const type = escapeHtml(normalizeSkillType(skill.skill_type).label)
          const tags = (skill.tags || [])
            .map(tag => `<span class="tag-chip">${escapeHtml(tag)}</span>`)
            .join('')
          const interaction = activeSkillInteraction(skillInteraction, skill.stable_id)
          const content = interaction?.mode === 'rename'
            ? renderSkillRenameFormHtml(interaction.draftId || skill.id)
            : `
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
            `
          const deleteConfirm = interaction?.mode === 'delete'
            ? renderSkillDeleteConfirmHtml(skill.name || skill.id || '当前 Skill')
            : ''

          return `
            <div class="skill-row-shell">
              <label class="skill-row-check" aria-label="选择 ${title}">
                <input type="checkbox" data-skill-check="${skill.stable_id}"${checked} />
                <span class="skill-row-check__box" aria-hidden="true"></span>
              </label>
              <div class="skill-row-stack">
                ${content}
                ${deleteConfirm}
              </div>
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

export function renderExplorerSkillListHtml(skills, selectedSkillId, skillInteraction = null) {
  if (!skills.length) {
    return '<div class="empty-state">暂无 skills</div>'
  }

  return sortSkillsByLabel(skills)
    .map(skill => {
      const selected = skill.stable_id === selectedSkillId ? ' is-selected' : ''
      const label = skill.name || skill.id || ''
      const name = escapeHtml(label)
      const id = escapeHtml(skill.id || '')
      const title = escapeHtml(skill.id && skill.id !== label ? `${label} · ${skill.id}` : label)
      const interaction = activeSkillInteraction(skillInteraction, skill.stable_id)
      const content = interaction?.mode === 'rename'
        ? renderSkillRenameFormHtml(interaction.draftId || skill.id)
        : `
          <button class="explorer-entry explorer-entry--skill${selected}" type="button" data-skill-id="${skill.stable_id}" title="${title}">
            <span class="explorer-entry__lead">
              <span class="explorer-entry__label">${name}</span>
            </span>
            ${skill.id && skill.id !== label ? `<span class="explorer-entry__meta">${id}</span>` : ''}
          </button>
        `
      const deleteConfirm = interaction?.mode === 'delete'
        ? renderSkillDeleteConfirmHtml(label || '当前 Skill')
        : ''

      return `
        <div class="explorer-skill-shell">
          <div class="explorer-skill-stack">
            ${content}
            ${deleteConfirm}
          </div>
        </div>
      `
    })
    .join('')
}

export function renderExplorerGroupListHtml(
  groups = [],
  selectedSkillId = null,
  skillInteraction = null,
  collapsedGroupKeys = []
) {
  if (!groups.length) {
    return '<div class="empty-state">暂无 skills</div>'
  }

  const collapsedSet = new Set(collapsedGroupKeys)

  return groups
    .map(group => {
      const collapsed = collapsedSet.has(group.key)
      const count = `${group.items.length} 个 skill`
      return `
        <section class="explorer-group">
          <button
            class="explorer-entry explorer-entry--group"
            type="button"
            data-explorer-group="${escapeHtml(group.key)}"
            data-explorer-group-toggle="${escapeHtml(group.key)}"
            aria-expanded="${collapsed ? 'false' : 'true'}"
            title="${escapeHtml(group.label)}"
          >
            <span class="explorer-entry__lead">
              <span class="explorer-entry__twistie" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>
              <span class="explorer-entry__label">${escapeHtml(group.label)}</span>
            </span>
            <span class="explorer-entry__meta">${escapeHtml(count)}</span>
          </button>
          <div class="explorer-group__items" data-role="explorer-group-skill-list"${collapsed ? ' hidden' : ''}>
            ${collapsed ? '' : renderExplorerSkillListHtml(group.items, selectedSkillId, skillInteraction)}
          </div>
        </section>
      `
    })
    .join('')
}

export function renderSkillContextMenuHtml(contextMenu = {}) {
  const { open = false, skill = null, x = 0, y = 0 } = contextMenu || {}

  if (!open || !skill) {
    return ''
  }

  const label = escapeHtml(skill.name || skill.id || 'Skill')

  return `
    <div
      class="skill-context-menu"
      data-role="skill-context-menu"
      style="left:${Number(x) || 0}px;top:${Number(y) || 0}px"
    >
      <div class="skill-context-menu__title">${label}</div>
      <button type="button" data-skill-menu-action="rename">重命名</button>
      <button type="button" data-skill-menu-action="delete">删除</button>
    </div>
  `
}

export function renderMemoryContextMenuHtml(contextMenu = {}) {
  const { open = false, memory = null, x = 0, y = 0 } = contextMenu || {}

  if (!open || !memory) {
    return ''
  }

  const label = escapeHtml(memory.id || `Memory ${memory.stable_id || ''}`.trim())

  return `
    <div
      class="skill-context-menu"
      data-role="memory-context-menu"
      style="left:${Number(x) || 0}px;top:${Number(y) || 0}px"
    >
      <div class="skill-context-menu__title">${label}</div>
      <button type="button" data-memory-menu-action="rename">重命名</button>
      <button type="button" data-memory-menu-action="delete">删除</button>
    </div>
  `
}

export function renderWarehouseContextMenuHtml(contextMenu = {}) {
  const {
    open = false,
    title = 'WAREHOUSE',
    x = 0,
    y = 0
  } = contextMenu || {}

  if (!open) {
    return ''
  }

  return `
    <div
      class="skill-context-menu"
      data-role="warehouse-context-menu"
      style="left:${Number(x) || 0}px;top:${Number(y) || 0}px"
    >
      <div class="skill-context-menu__title">${escapeHtml(title)}</div>
      <button type="button" data-warehouse-menu-action="create-skill">新建 Skill</button>
    </div>
  `
}

export function renderDroppedSkillImportConfirmHtml(confirmState = {}) {
  const {
    open = false,
    name = ''
  } = confirmState || {}

  if (!open) {
    return ''
  }

  const label = escapeHtml(name || '当前 Skill')

  return `
    <div class="app-modal" data-role="dropped-skill-import-confirm">
      <div class="app-modal__scrim" data-dropped-skill-confirm-action="cancel"></div>
      <div class="app-modal__dialog">
        <p class="panel-kicker">Skill Import</p>
        <h3>覆盖现有 Skill</h3>
        <p class="sidebar-copy">发现同名 Skill <strong>${label}</strong>，是否使用拖入内容覆盖现有目录？</p>
        <div class="button-row compact">
          <button type="button" class="primary compact-button" data-dropped-skill-confirm-action="confirm">覆盖</button>
          <button type="button" class="ghost compact-button" data-dropped-skill-confirm-action="cancel">取消</button>
        </div>
      </div>
    </div>
  `
}

export function renderMemoryRenameModalHtml(renameState = {}) {
  const {
    open = false,
    draftId = '',
    error = ''
  } = renameState || {}

  if (!open) {
    return ''
  }

  return `
    <div class="app-modal" data-role="memory-rename-modal">
      <div class="app-modal__scrim" data-memory-rename-action="cancel"></div>
      <div class="app-modal__dialog">
        <p class="panel-kicker">Memory Rename</p>
        <h3>重命名 Memory</h3>
        <label class="field">
          <span>Memory ID</span>
          <input
            id="memoryRenameInput"
            type="text"
            value="${escapeHtml(draftId)}"
            spellcheck="false"
          />
        </label>
        ${error ? `<p class="sidebar-copy" data-role="memory-rename-error">${escapeHtml(error)}</p>` : ''}
        <div class="button-row compact">
          <button type="button" class="primary compact-button" data-memory-rename-action="confirm">保存</button>
          <button type="button" class="ghost compact-button" data-memory-rename-action="cancel">取消</button>
        </div>
      </div>
    </div>
  `
}

export function renderTreeContextMenuHtml(contextMenu = {}) {
  const {
    open = false,
    title = '',
    target = 'root',
    entryKind = 'skill',
    x = 0,
    y = 0
  } = contextMenu || {}

  if (!open) {
    return ''
  }

  const actions = []
  if (target === 'root' || target === 'dir') {
    actions.push('<button type="button" data-tree-menu-action="create-file">新建文件</button>')
    actions.push('<button type="button" data-tree-menu-action="create-folder">新建文件夹</button>')
  }

  if (target === 'root' && entryKind === 'skill') {
    actions.push('<button type="button" data-tree-menu-action="rename-skill">重命名 Skill</button>')
    actions.push('<button type="button" data-tree-menu-action="delete-skill">删除 Skill</button>')
  } else if (target === 'root' && entryKind === 'memory') {
    actions.push('<button type="button" data-tree-menu-action="rename-memory">重命名 Memory</button>')
    actions.push('<button type="button" data-tree-menu-action="delete-memory">删除 Memory</button>')
  } else if (target !== 'root') {
    actions.push('<button type="button" data-tree-menu-action="rename-path">重命名</button>')
    actions.push('<button type="button" data-tree-menu-action="delete-path">删除</button>')
  }

  return `
    <div
      class="skill-context-menu"
      data-role="tree-context-menu"
      style="left:${Number(x) || 0}px;top:${Number(y) || 0}px"
    >
      <div class="skill-context-menu__title">${escapeHtml(title || 'Explorer')}</div>
      ${actions.join('')}
    </div>
  `
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

  return childHtml || ''
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

function renderEditorContextBarHtml({
  selectedSkillName = '',
  showTree = false,
  refreshLabel = '刷新当前条目'
} = {}) {
  const title = showTree
    ? (selectedSkillName ? escapeHtml(selectedSkillName) : '选择一个文件')
    : '文本编辑器'
  const context = showTree ? '从左侧打开文件后，在这里继续编辑内容。' : ''
  return `
    <div class="panel-head editor-context-bar" data-role="editor-toolbar">
      <div class="editor-context-copy">
        <h2 id="editorTitle">${title}</h2>
        <p id="editorContext"${context ? '' : ' hidden'}>${context}</p>
      </div>
      <div class="editor-context-actions">
        <span class="editor-dirty-state" id="editorDirtyState">已保存</span>
        <button id="refresh" class="ghost icon-button" type="button" aria-label="${escapeHtml(refreshLabel)}" title="${escapeHtml(refreshLabel)}">↻</button>
        <button id="saveFile" class="primary compact-button">保存</button>
      </div>
    </div>
  `
}

export function createEditorPageHtml({
  selectedSkillName = '',
  selectedTagName = '',
  browserMode = 'roots',
  createOpen = false,
  createError = '',
  createId = '',
  createTargetLabel = '',
  createPathOpen = false,
  createPathAction = 'create',
  createPathKind = 'file',
  createPathValue = '',
  createPathError = '',
  createPathTargetLabel = '',
  showTree = false,
  explorerBackLabel = 'Editor',
  rootEntryLabel = 'Skill',
  showRootEntryActions = true,
  editorHint = '适合修改现有 SKILL.md 和目录里的其他文本文件。',
  refreshLabel = '刷新当前条目',
  skillContextMenu = null,
  skillInteraction = null,
  treeContextMenu = null,
  warehouseContextMenu = null
} = {}) {
  const resolvedBrowserMode = showTree ? 'tree' : browserMode
  const showSkillTree = resolvedBrowserMode === 'tree'
  const explorerBack = showSkillTree
    ? `<button id="showWarehouseBrowser" class="explorer-back explorer-back--prominent" data-role="explorer-back" type="button">← 返回 ${escapeHtml(explorerBackLabel)}</button>`
    : ''
  const treeSkillInteraction = showSkillTree && showRootEntryActions && skillInteraction?.skillId
    ? (skillInteraction.mode === 'rename'
        ? renderSkillRenameFormHtml(skillInteraction.draftId || selectedSkillName)
        : renderSkillDeleteConfirmHtml(selectedSkillName || '当前 Skill'))
    : ''
  const workspaceClass = showSkillTree
    ? 'editor-workspace'
    : 'editor-workspace editor-workspace--solo'

  return `
    <section class="page-grid page-grid--editor">
      <section class="panel editor-panel">
        ${renderEditorContextBarHtml({ selectedSkillName, showTree: showSkillTree, refreshLabel })}

        <div class="${workspaceClass}">
          ${showSkillTree
            ? `
              <div class="tree-panel" data-role="editor-explorer">
                <div class="explorer-head">
                  <div>
                    ${explorerBack}
                    <h2>${escapeHtml(selectedSkillName || `当前 ${rootEntryLabel}`)}</h2>
                  </div>
                </div>
                <section class="explorer-section explorer-section--fill">
                  ${treeSkillInteraction}
                  ${createPathOpen
                    ? renderCreatePathInlineHtml({
                        createPathAction,
                        createPathKind,
                        createPathValue,
                        createPathError,
                        createPathTargetLabel
                      })
                    : ''}
                  <div class="tree-view tree-view--explorer" id="skillTree" data-role="skill-tree"></div>
                  ${renderTreeContextMenuHtml(treeContextMenu)}
                </section>
              </div>
            `
            : ''}

          <div class="editor-surface" data-role="editor-workbench">
            <div class="editor-code-head">
              <label class="section-title" for="editorInput">文本编辑器</label>
              <span class="editor-code-hint">${escapeHtml(editorHint)}</span>
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
  force = false,
  command = '',
  copyLabel = '复制',
  copyState = 'idle'
} = {}) {
  if (!selectedSkill) {
    return `
      <article class="panel skills-page__details" data-role="skills-metadata-panel" data-pane-role="details">
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
    <article class="panel skills-page__details" data-role="skills-metadata-panel" data-pane-role="details">
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
      <div class="field">
        <span>Description</span>
        <p class="field-copy">${escapeHtml(selectedSkill.description || '暂无 description')}</p>
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
        <button id="deleteSkill" class="ghost" type="button">删除当前 Skill</button>
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
        <label class="field" data-role="sync-force">
          <span>生成选项</span>
          <span class="field-toggle">
            <input id="commandForceToggle" type="checkbox"${force ? ' checked' : ''} />
            <span>强制覆盖</span>
          </span>
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
  force = false,
  command = '',
  copyLabel = '复制',
  copyState = 'idle',
  importExpanded = false,
  gitImportUrl = '',
  migrationResult = null,
  migrationOutput = null,
  gitImportResult = null,
  gitImportOutput = null,
  createOpen = false,
  createId = '',
  createError = '',
  createTargetLabel = '',
  skillContextMenu = null,
  warehouseContextMenu = null,
  skillInteraction = null
} = {}) {
  return `
    <section class="page-grid page-grid--skills" data-role="skills-workspace">
      <article class="panel skills-page__catalog" data-pane-role="browse">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">Browse</p>
            <h2>Warehouse</h2>
          </div>
          <div class="button-row compact">
            <button id="openCreateSkill" class="ghost compact-button" type="button" data-role="open-create-skill">新建 Skill</button>
            <button id="refresh" class="ghost compact-button" type="button">刷新</button>
          </div>
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
        ${createOpen
          ? renderCreateSkillInlineHtml({
              createError,
              createId,
              createTargetLabel
            })
          : ''}
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
          ${renderSkillGroupsHtml(skills, selectedSkillId, checkedSkillIds, skillInteraction)}
        </div>
        ${renderSkillContextMenuHtml(skillContextMenu)}
        ${renderWarehouseContextMenuHtml(warehouseContextMenu)}
      </article>

      ${renderSkillsMetadataPanelHtml(selectedSkill, {
        checkedSkillIds,
        distributionSummary,
        client,
        mode,
        force,
        command,
        copyLabel,
        copyState
      })}
    </section>
  `
}

export function renderMemoryListHtml(memories = [], selectedMemoryId = null) {
  if (!memories.length) {
    return '<div class="empty-state">暂无 memories</div>'
  }

  return memories
    .map(memory => {
      const selected = memory.stable_id === selectedMemoryId ? ' is-selected' : ''
      return `
        <button
          class="memory-row${selected}"
          type="button"
          data-memory-id="${memory.stable_id}"
        >
          <strong>${escapeHtml(memory.id || '')}</strong>
          <span>${memory.stable_id}</span>
        </button>
      `
    })
    .join('')
}

function renderMemoryMetadataPanelHtml(selectedMemory = null, {
  selectedContext = '',
  client = 'codex',
  force = false,
  command = '',
  copyLabel = '复制',
  copyState = 'idle'
} = {}) {
  if (!selectedMemory) {
    return `
      <article class="panel skills-page__details" data-role="memory-metadata-panel" data-pane-role="details">
        <div class="panel-head compact-head">
          <div>
            <p class="panel-kicker">Memory Details</p>
            <h2>选择一个 Memory</h2>
          </div>
          <button id="openMemoryEditor" class="primary" type="button" data-role="memory-open-editor" disabled>打开编辑器</button>
        </div>
        <p class="sidebar-copy">在左侧选中一个 memory 后，就可以在这里生成 init-memory 命令。编辑正文时再进入 Editor。</p>
      </article>
    `
  }

  return `
    <article class="panel skills-page__details" data-role="memory-metadata-panel" data-pane-role="details">
      <div class="panel-head compact-head">
        <div>
          <p class="panel-kicker">Memory Details</p>
          <h2>${escapeHtml(selectedMemory.id || `Memory ${selectedMemory.stable_id}`)}</h2>
        </div>
        <button id="openMemoryEditor" class="primary" type="button" data-role="memory-open-editor">打开编辑器</button>
      </div>
      <div class="field">
        <span>Stable ID</span>
        <strong id="memoryStableId">${selectedMemory.stable_id}</strong>
      </div>
      <p class="sidebar-copy">正文编辑放在 Editor 页面。这里负责 memory 的命令生成。</p>

      <section class="skills-inline-panel" data-role="memory-command-panel">
        <div class="section-title">客户端分发</div>
        <div class="field">
          <span>命令目标</span>
          <strong class="memory-context" data-role="memory-selected-context">${escapeHtml(selectedContext)}</strong>
        </div>
        <label class="field">
          <span>客户端</span>
          <select id="memoryClientSelect" data-role="memory-client">
            <option value="codex"${client === 'codex' ? ' selected' : ''}>Codex</option>
            <option value="claude"${client === 'claude' ? ' selected' : ''}>Claude</option>
            <option value="cursor"${client === 'cursor' ? ' selected' : ''}>Cursor</option>
          </select>
        </label>
        <label class="field" data-role="memory-force">
          <span>生成选项</span>
          <span class="field-toggle">
            <input id="memoryCommandForceToggle" type="checkbox"${force ? ' checked' : ''} />
            <span>强制覆盖</span>
          </span>
        </label>
        <div class="button-row">
          <button id="generateMemoryCommand" class="ghost" type="button" data-role="memory-generate-command">生成 init-memory 命令</button>
        </div>
        <label class="field">
          <span class="field__between">
            <span>生成命令</span>
            <button
              id="copyMemoryCommand"
              class="ghost"
              data-role="memory-copy-command"
              data-copy-state="${copyState}"
              type="button"
              ${command ? '' : 'disabled'}
            >${escapeHtml(copyLabel)}</button>
          </span>
          <textarea
            id="generatedMemoryCommand"
            data-role="memory-command"
            readonly
            placeholder="选择 memory 后生成 init-memory 命令"
          >${escapeHtml(command)}</textarea>
        </label>
      </section>
    </article>
  `
}

export function createMemoryPageHtml({
  memories = [],
  selectedMemoryId = null,
  client = 'codex',
  force = false,
  command = '',
  copyLabel = '复制',
  copyState = 'idle',
  selectedMemory = null,
  createOpen = false,
  createId = '',
  createError = '',
  deleteOpen = false
} = {}) {
  const selectedContext = selectedMemory
    ? `Memory ${selectedMemory.stable_id} · ${selectedMemory.id}`
    : '选择左侧 memory 后生成 init-memory 命令'
  const createForm = createOpen
    ? `
        <form class="explorer-create-skill" data-role="memory-create-form">
          <div class="explorer-create-skill__head">
            <strong>新建 Memory</strong>
            <span class="explorer-create-skill__target">WAREHOUSE</span>
          </div>
          <div class="explorer-create-skill__row">
            <input
              id="createMemoryId"
              type="text"
              placeholder="memory-id"
              value="${escapeHtml(createId)}"
              spellcheck="false"
            />
            <button
              id="createMemorySubmit"
              type="button"
              class="primary compact-button"
              data-create-memory-action="submit"
            >创建</button>
            <button
              id="cancelCreateMemory"
              type="button"
              class="ghost compact-button"
              data-create-memory-action="cancel"
            >取消</button>
          </div>
          ${createError
            ? `<p class="sidebar-copy" data-role="memory-create-error">${escapeHtml(createError)}</p>`
            : ''}
        </form>
      `
    : ''
  const deleteConfirm = deleteOpen && selectedMemory
    ? `
        <div class="skill-inline-card skill-inline-card--delete" data-role="memory-delete-confirm">
          <p class="sidebar-copy">删除整个 memory <strong>${escapeHtml(selectedMemory.id || '')}</strong> ?</p>
          <div class="button-row compact">
            <button
              id="confirmDeleteMemory"
              type="button"
              class="primary danger"
              data-delete-memory-action="confirm"
            >删除</button>
            <button
              id="cancelDeleteMemory"
              type="button"
              class="ghost"
              data-delete-memory-action="cancel"
            >取消</button>
          </div>
        </div>
      `
    : ''

  return `
    <section class="page-grid page-grid--memory" data-role="memory-workspace">
      <article class="panel memory-sidebar" data-role="memory-sidebar">
        <div class="panel-head compact-head">
          <div>
            <p class="panel-kicker">Memory</p>
            <h2>Warehouse</h2>
          </div>
          <div class="button-row compact">
            <button
              id="createMemory"
              class="ghost compact-button"
              type="button"
              data-role="memory-create"
              ${createOpen ? 'disabled' : ''}
            >新建</button>
            <button
              id="deleteMemory"
              class="ghost compact-button"
              type="button"
              data-role="memory-delete"
              ${selectedMemoryId == null || deleteOpen ? 'disabled' : ''}
            >删除</button>
          </div>
        </div>
        ${createForm}
        ${deleteConfirm}
        <div class="memory-list" data-role="memory-list">
          ${renderMemoryListHtml(memories, selectedMemoryId)}
        </div>
      </article>
      ${renderMemoryMetadataPanelHtml(selectedMemory, {
        selectedContext,
        client,
        force,
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
  appVersion = '',
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
        <p class="sidebar-copy settings-version" data-role="settings-version">当前版本：${escapeHtml(appVersion || '-')}</p>
        <p class="sidebar-copy">维护桌面端使用的技能仓库路径。优先通过按钮选择，避免手动记目录结构。</p>
        <label class="field">
          <span>Warehouse Path</span>
          <input
            id="settingsWarehouse"
            value="${escapeHtml(skillWarehouse)}"
            placeholder="/path/to/warehouse"
          />
        </label>
        <div class="button-row compact settings-actions">
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
        <div class="button-row compact settings-actions">
          <button id="addLibraryRoot" class="secondary" type="button">添加目录</button>
        </div>
      </article>
    </section>
  `
}

function renderMcpServerStateHtml(enabled = true) {
  return `
    <span class="mcp-state-pill${enabled ? '' : ' is-disabled'}">
      ${enabled ? '已启用' : '禁用中'}
    </span>
  `
}

function renderMcpServerListHtml(servers = [], selectedServerName = '', checkedServerNames = []) {
  if (!servers.length) {
    return '<div class="empty-state">当前目标还没有 MCP server</div>'
  }

  const checkedSet = new Set(checkedServerNames)

  return servers
    .map(server => {
      const name = escapeHtml(server.name)
      const isSelected = server.name === selectedServerName ? ' is-selected' : ''
      const mode = server.url ? 'Remote' : 'stdio'
      const checked = checkedSet.has(server.name) ? ' checked' : ''
      const enabled = server.enabled !== false

      return `
        <div class="mcp-server-row-shell">
          <label class="mcp-server-check" aria-label="选择 ${name}">
            <input type="checkbox" data-mcp-check="${name}"${checked} />
            <span class="mcp-server-check__box" aria-hidden="true"></span>
          </label>
          <button
            class="mcp-server-row${isSelected}"
            type="button"
            data-mcp-server="${name}"
          >
            <div class="mcp-server-row__main">
              <strong>${name}</strong>
              <span class="mcp-server-row__mode">${mode}</span>
            </div>
            <div class="mcp-server-row__meta">
              ${renderMcpServerStateHtml(enabled)}
            </div>
          </button>
        </div>
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
  checkedServerNames = [],
  selectedServerName = '',
  editor = {},
  disabledProjectScope = false
} = {}) {
  const mode = editor.transport || (editor.url ? 'remote' : 'stdio')
  const serverCount = servers.length
  const selectedServer = servers.find(server => server.name === selectedServerName) || null

  return `
    <section class="page-grid page-grid--mcp">
      <article class="panel mcp-sidebar">
        <div class="panel-head compact-head mcp-sidebar__head">
          <div class="mcp-sidebar__title">
            <h2>配置入口</h2>
          </div>
          <button id="reloadMcp" class="ghost icon-button" type="button" aria-label="重新读取 MCP 配置" title="重新读取 MCP 配置">↻</button>
        </div>

        <section class="mcp-target-controls" data-role="mcp-target-controls">
          <div class="mcp-target-grid">
            <label class="field field--compact">
              <span>客户端</span>
              <select id="mcpClientSelect" data-role="mcp-client-select">
                <option value="codex"${client === 'codex' ? ' selected' : ''}>Codex</option>
                <option value="claude"${client === 'claude' ? ' selected' : ''}>Claude</option>
                <option value="cursor"${client === 'cursor' ? ' selected' : ''}>Cursor</option>
              </select>
            </label>

            <label class="field field--compact">
              <span>作用域</span>
              <select id="mcpScopeSelect" data-role="mcp-scope-select">
                <option value="global"${scope === 'global' ? ' selected' : ''}>全局</option>
                <option value="project"${scope === 'project' ? ' selected' : ''}${disabledProjectScope ? ' disabled' : ''}>项目内</option>
              </select>
            </label>
          </div>

          ${disabledProjectScope
            ? '<p class="mcp-target-note">Codex 目前只开放全局 MCP 配置，项目内会保持禁用。</p>'
            : ''}

          ${scope === 'project'
            ? `
              <div class="mcp-target-project-row">
                <label class="field field--compact field--wide">
                  <span>项目路径</span>
                  <input id="mcpProjectPath" value="${escapeHtml(projectPath)}" placeholder="/path/to/project" />
                </label>
                <button id="pickMcpProject" class="secondary" type="button">选择项目目录</button>
              </div>
            `
            : ''}

          <label class="field field--compact mcp-target-file">
            <span>目标文件</span>
            <input value="${escapeHtml(targetPath)}" readonly />
          </label>
        </section>

        <section class="mcp-server-section">
          <div class="mcp-server-section__head">
            <div class="mcp-server-section__title">
              <h3>Servers</h3>
              <span>${serverCount}</span>
            </div>
          </div>
          <div class="button-row compact mcp-server-section__actions">
            <button id="enableSelectedMcpServers" class="secondary compact-button" type="button" data-role="mcp-enable-selected">启用所选</button>
            <button id="disableSelectedMcpServers" class="secondary compact-button" type="button" data-role="mcp-disable-selected">禁用所选</button>
            <button id="newMcpServer" class="secondary compact-button" type="button">新建</button>
          </div>
          <div class="mcp-server-list" data-role="mcp-server-list">
            ${renderMcpServerListHtml(servers, selectedServerName, checkedServerNames)}
          </div>
        </section>
      </article>

      <article class="panel mcp-editor-panel" data-role="mcp-editor">
        <div class="panel-head compact-head">
          <div class="mcp-editor-heading">
            <h2>${escapeHtml(selectedServerName || '新建 MCP Server')}</h2>
            ${selectedServer ? renderMcpServerStateHtml(selectedServer.enabled !== false) : ''}
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
          <button id="applyBetterIconsDemo" class="ghost" type="button">Better Icons Demo</button>
          <button id="applyOpenAiDocsDemo" class="ghost" type="button">OpenAI Docs Demo</button>
        </div>
      </article>
    </section>
  `
}

export function createAppShellHtml(appVersion = '') {
  return `
    <main class="app-shell">
      <aside class="nav-rail" data-role="nav-rail">
        <div class="product-label" data-role="product-label">agents-manager</div>

        <nav class="nav-links" aria-label="Primary">
          <button class="nav-link is-active" type="button" data-page-link="skills">Skills</button>
          <button class="nav-link" type="button" data-page-link="editor">Editor</button>
          <button class="nav-link" type="button" data-page-link="memory">Memory</button>
          <button class="nav-link" type="button" data-page-link="mcp">MCP</button>
          <button class="nav-link" type="button" data-page-link="settings">Settings</button>
        </nav>
        <div class="nav-version" data-role="app-version">${escapeHtml(appVersion || '-')}</div>
      </aside>

      <section class="app-stage">
        <header class="page-header" data-role="page-header">
          <div class="page-copy">
            <h2 id="pageTitle">Skills</h2>
            <p id="pageDescription" hidden></p>
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
      <div id="appModalRoot" data-role="app-modal-root"></div>
    </main>
  `
}
