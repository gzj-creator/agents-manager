import './styles.css'
import { invoke } from '@tauri-apps/api/core'
import {
  collectKnownTags,
  createActionState,
  createAppShellHtml,
  createEditorPageHtml,
  createMcpPageHtml,
  createEditorState,
  createSkillDraftState,
  createSettingsPageHtml,
  createSkillsPageHtml,
  filterSkills,
  formatOutputPayload,
  normalizePageId,
  nextActionState,
  nextEditorState,
  nextSkillDraftState,
  resolveDistributionSkillIds,
  renderExplorerSkillListHtml,
  renderSkillGroupsHtml,
  renderTagOptionsHtml,
  renderTreeHtml
} from './ui.js'

const app = document.getElementById('app')
let copyFeedbackTimer = null
const MCP_DEMOS = {
  betterIcons: {
    name: 'better-icons',
    command: 'npx',
    args: ['-y', 'better-icons'],
    url: null
  },
  openAiDocs: {
    name: 'openai-docs',
    command: null,
    args: [],
    url: 'https://developers.openai.com/mcp'
  }
}

const state = {
  action: createActionState(),
  currentPage: 'skills',
  client: 'codex',
  installMode: 'symlink',
  generatedCommand: '',
  copyFeedback: 'idle',
  skillWarehouse: '',
  defaultSkillWarehouse: '',
  libraryRoots: [],
  skills: [],
  filters: {
    query: '',
    tag: ''
  },
  checkedSkillIds: [],
  selectedSkillId: null,
  tree: null,
  selectedPath: '',
  editor: createEditorState(),
  createSkill: createSkillDraftState(),
  skillsImportExpanded: false,
  migrationResult: null,
  migrationOutput: null,
  gitImportUrl: '',
  gitImportResult: null,
  gitImportOutput: null,
  mcp: {
    client: 'codex',
    scope: 'global',
    projectPath: '',
    targetPath: '',
    servers: [],
    selectedServerName: '',
    editor: {
      name: '',
      transport: 'stdio',
      command: '',
      args: [],
      url: ''
    }
  }
}

const ACTION_BUTTON_IDS = [
  'refresh',
  'saveFile',
  'saveMetadata',
  'migrate',
  'syncSkills',
  'generateCommand',
  'copyCommand',
  'openEditor',
  'openCreateSkill',
  'createSkill',
  'cancelCreateSkill',
  'createFile',
  'createFolder',
  'renamePath',
  'deletePath',
  'importGitSkills',
  'toggleSkillsImport',
  'pickSettingsWarehouse',
  'resetSettingsWarehouse',
  'addLibraryRoot',
  'saveSettings',
  'reloadMcp',
  'pickMcpProject',
  'newMcpServer',
  'applyBetterIconsDemo',
  'applyOpenAiDocsDemo',
  'saveMcpServer',
  'deleteMcpServer',
  'saveMcpConfig'
]

const PAGE_META = {
  skills: {
    eyebrow: 'Skills',
    title: 'Warehouse Skills',
    description: '选中 skill 后直接维护标签、同步客户端和生成命令，再按需打开 Editor 处理正文。'
  },
  editor: {
    eyebrow: 'Editor',
    title: 'Editor',
    description: '保留 Explorer 和主编辑区，把注意力放回文件内容。'
  },
  mcp: {
    eyebrow: 'MCP',
    title: 'MCP',
    description: '集中维护 Codex / Claude / Cursor 的 MCP 配置，并支持一键套用示例。'
  },
  settings: {
    eyebrow: 'Settings',
    title: 'Settings',
    description: '这里只保留可编辑的应用配置，路径选择尽量通过按钮完成。'
  }
}

function renderBase() {
  app.innerHTML = createAppShellHtml()
}

function skillLabel(skill) {
  return skill ? skill.name || skill.id : '未选择'
}

function skillSummary(skill) {
  return skill ? `${skill.stable_id} · ${skillLabel(skill)}` : '未选择'
}

function distributionSkillIds() {
  return resolveDistributionSkillIds(state.checkedSkillIds, state.selectedSkillId)
}

function distributionSummary() {
  const ids = distributionSkillIds()
  if (!ids.length) {
    return '先选择一个 skill'
  }
  if (state.checkedSkillIds.length) {
    return `已勾选 ${ids.length} 个 skills`
  }
  return `当前 skill：${skillLabel(selectedSkill())}`
}

function resetEditorSelection() {
  state.tree = null
  state.selectedPath = ''
  state.editor = createEditorState()
}

function resetGeneratedCommand() {
  if (copyFeedbackTimer) {
    window.clearTimeout(copyFeedbackTimer)
    copyFeedbackTimer = null
  }
  state.generatedCommand = ''
  state.copyFeedback = 'idle'
}

function copyFeedbackLabel() {
  return state.copyFeedback === 'copied' ? '已复制' : '复制'
}

function createMcpEditorState(server = null) {
  return {
    name: server?.name || '',
    transport: server?.url ? 'remote' : 'stdio',
    command: server?.command || '',
    args: [...(server?.args || [])],
    url: server?.url || ''
  }
}

function mcpProjectScopeDisabled(client = state.mcp.client) {
  return client === 'codex'
}

function selectedMcpServer() {
  return state.mcp.servers.find(server => server.name === state.mcp.selectedServerName) || null
}

function mcpMode() {
  return state.mcp.editor.transport || (state.mcp.editor.url ? 'remote' : 'stdio')
}

function mcpRequestPayload() {
  return {
    client: state.mcp.client,
    scope: state.mcp.scope,
    project_path: state.mcp.projectPath.trim() || null
  }
}

function applyMcpServers(servers = []) {
  state.mcp.servers = [...servers].sort((left, right) => left.name.localeCompare(right.name))
  if (
    state.mcp.selectedServerName &&
    state.mcp.servers.some(server => server.name === state.mcp.selectedServerName)
  ) {
    state.mcp.editor = createMcpEditorState(selectedMcpServer())
    return
  }

  const first = state.mcp.servers[0] || null
  state.mcp.selectedServerName = first?.name || ''
  state.mcp.editor = createMcpEditorState(first)
}

function markCommandCopied() {
  if (copyFeedbackTimer) {
    window.clearTimeout(copyFeedbackTimer)
  }
  state.copyFeedback = 'copied'
  copyFeedbackTimer = window.setTimeout(() => {
    state.copyFeedback = 'idle'
    copyFeedbackTimer = null
    syncAll()
  }, 1400)
}

function toggleCheckedSkillId(stableId, checked) {
  const next = new Set(state.checkedSkillIds)
  if (checked) {
    next.add(stableId)
  } else {
    next.delete(stableId)
  }
  state.checkedSkillIds = [...next]
}

function confirmDiscardEditorChanges(targetLabel) {
  if (!state.editor.dirty) {
    return true
  }

  return window.confirm(`当前文件有未保存修改，确定要${targetLabel}吗？`)
}

function renderCurrentPage() {
  const pageBody = document.getElementById('pageBody')
  if (!pageBody) {
    return
  }

  if (state.currentPage === 'skills') {
    pageBody.innerHTML = createSkillsPageHtml({
      skills: filteredSkills(),
      query: state.filters.query,
      tag: state.filters.tag,
      tags: collectKnownTags(state.skills),
      selectedSkillId: state.selectedSkillId,
      selectedSkill: selectedSkill(),
      checkedSkillIds: state.checkedSkillIds,
      distributionSummary: distributionSummary(),
      client: state.client,
      mode: state.installMode,
      command: state.generatedCommand,
      copyLabel: copyFeedbackLabel(),
      copyState: state.copyFeedback,
      importExpanded: state.skillsImportExpanded,
      gitImportUrl: state.gitImportUrl,
      migrationResult: state.migrationResult,
      migrationOutput: state.migrationOutput,
      gitImportResult: state.gitImportResult,
      gitImportOutput: state.gitImportOutput
    })
    return
  }

  if (state.currentPage === 'editor') {
    const skill = selectedSkill()
    pageBody.innerHTML = createEditorPageHtml({
      selectedSkillName: skillLabel(skill),
      createOpen: state.createSkill.open,
      createError: state.createSkill.error,
      createId: state.createSkill.id
    })
    return
  }

  if (state.currentPage === 'mcp') {
    pageBody.innerHTML = createMcpPageHtml({
      client: state.mcp.client,
      scope: state.mcp.scope,
      projectPath: state.mcp.projectPath,
      targetPath: state.mcp.targetPath,
      servers: state.mcp.servers,
      selectedServerName: state.mcp.selectedServerName,
      editor: state.mcp.editor,
      disabledProjectScope: mcpProjectScopeDisabled()
    })
    return
  }

  if (state.currentPage === 'settings') {
    pageBody.innerHTML = createSettingsPageHtml({
      skillWarehouse: state.skillWarehouse,
      libraryRoots: state.libraryRoots
    })
  }
}

function syncShell() {
  const pageMeta = PAGE_META[state.currentPage] || PAGE_META.skills
  const stage = document.querySelector('.app-stage')
  if (stage) {
    stage.dataset.page = state.currentPage
  }

  const eyebrow = document.getElementById('pageEyebrow')
  const title = document.getElementById('pageTitle')
  const description = document.getElementById('pageDescription')
  if (eyebrow) {
    eyebrow.textContent = pageMeta.eyebrow
  }
  if (title) {
    title.textContent = pageMeta.title
  }
  if (description) {
    description.textContent = pageMeta.description
  }

  document.querySelectorAll('[data-page-link]').forEach(link => {
    link.classList.toggle('is-active', link.dataset.pageLink === state.currentPage)
  })
}

function transitionAction(event) {
  state.action = nextActionState(state.action, event)
  syncActionUi()
}

function syncActionUi() {
  const status = document.querySelector('[data-role="status"]')
  const statusText = document.getElementById('statusText')
  if (status) {
    status.dataset.tone = state.action.statusTone
  }
  if (statusText) {
    statusText.textContent = state.action.statusText
  }

  ACTION_BUTTON_IDS.forEach(id => {
    const button = document.getElementById(id)
    if (button) {
      button.disabled = state.action.busy
    }
  })

  const saveFile = document.getElementById('saveFile')
  if (saveFile) {
    saveFile.disabled = state.action.busy || !state.editor.path || !state.editor.dirty
  }

  const saveMetadata = document.getElementById('saveMetadata')
  if (saveMetadata) {
    saveMetadata.disabled = state.action.busy || !state.selectedSkillId
  }

  const createFile = document.getElementById('createFile')
  const createFolder = document.getElementById('createFolder')
  if (createFile) {
    createFile.disabled = state.action.busy || !state.selectedSkillId
  }
  if (createFolder) {
    createFolder.disabled = state.action.busy || !state.selectedSkillId
  }

  const renamePath = document.getElementById('renamePath')
  const deletePath = document.getElementById('deletePath')
  if (renamePath) {
    renamePath.disabled = state.action.busy || !state.selectedSkillId || !state.selectedPath
  }
  if (deletePath) {
    deletePath.disabled = state.action.busy || !state.selectedSkillId || !state.selectedPath
  }

  const createSkill = document.getElementById('createSkill')
  if (createSkill) {
    createSkill.disabled = state.action.busy || !state.createSkill.id.trim()
  }

  const openEditor = document.getElementById('openEditor')
  if (openEditor) {
    openEditor.disabled = state.action.busy || !state.selectedSkillId
  }

  const syncSkillsButton = document.getElementById('syncSkills')
  if (syncSkillsButton) {
    syncSkillsButton.disabled = state.action.busy || !distributionSkillIds().length
  }

  const generateCommandButton = document.getElementById('generateCommand')
  if (generateCommandButton) {
    generateCommandButton.disabled = state.action.busy || !distributionSkillIds().length
  }

  const copyCommandButton = document.getElementById('copyCommand')
  if (copyCommandButton) {
    copyCommandButton.disabled = state.action.busy || !state.generatedCommand
  }

  const importGitSkillsButton = document.getElementById('importGitSkills')
  if (importGitSkillsButton) {
    importGitSkillsButton.disabled = state.action.busy || !state.gitImportUrl.trim()
  }

  const saveSettingsButton = document.getElementById('saveSettings')
  if (saveSettingsButton) {
    saveSettingsButton.disabled = state.action.busy || !state.skillWarehouse.trim()
  }

  const pickMcpProject = document.getElementById('pickMcpProject')
  if (pickMcpProject) {
    pickMcpProject.disabled = state.action.busy || state.mcp.scope !== 'project'
  }

  const saveMcpServer = document.getElementById('saveMcpServer')
  if (saveMcpServer) {
    saveMcpServer.disabled = state.action.busy || !state.mcp.editor.name.trim()
  }

  const saveMcpConfig = document.getElementById('saveMcpConfig')
  if (saveMcpConfig) {
    saveMcpConfig.disabled =
      state.action.busy ||
      (state.mcp.scope === 'project' && !state.mcp.projectPath.trim())
  }
}

function print(payload, tone = 'info') {
  const output = document.getElementById('output')
  if (!output) {
    return
  }
  const formatted = formatOutputPayload(payload, tone)
  output.dataset.tone = formatted.tone
  output.textContent = formatted.text
}

async function runAction(action, task, options = {}) {
  transitionAction({ type: 'start', action })
  try {
    const result = await task()
    transitionAction({ type: 'success', action })
    return result
  } catch (error) {
    if (typeof options.onError === 'function') {
      options.onError(error)
    }
    transitionAction({ type: 'error', action })
    print(error, 'error')
    return null
  }
}

function filteredSkills() {
  return filterSkills(state.skills, state.filters)
}

function selectedSkill() {
  return state.skills.find(skill => skill.stable_id === state.selectedSkillId) || null
}

function syncSkillsPage() {
  const skillList = document.getElementById('skillList')
  const tagFilter = document.getElementById('tagFilter')
  if (!skillList || !tagFilter) {
    return
  }

  skillList.innerHTML = renderSkillGroupsHtml(
    filteredSkills(),
    state.selectedSkillId,
    state.checkedSkillIds
  )
  tagFilter.innerHTML = renderTagOptionsHtml(
    collectKnownTags(state.skills),
    state.filters.tag
  )
}

function syncEditorExplorer() {
  const explorerSkillList = document.getElementById('explorerSkillList')
  if (!explorerSkillList) {
    return
  }

  explorerSkillList.innerHTML = renderExplorerSkillListHtml(
    state.skills,
    state.selectedSkillId
  )
}

function syncTree() {
  const tree = document.getElementById('skillTree')
  if (tree) {
    tree.innerHTML = renderTreeHtml(state.tree, state.selectedPath)
  }
}

function syncEditor() {
  const title = document.getElementById('editorTitle')
  const context = document.getElementById('editorContext')
  const dirtyState = document.getElementById('editorDirtyState')
  const editor = document.getElementById('editorInput')
  const skill = selectedSkill()

  if (!title || !editor) {
    return
  }

  title.textContent = state.editor.path || '选择一个文件'
  if (context) {
    if (!skill) {
      context.textContent = '先在左侧选择一个 skill，或者先创建目录后再把文件移进来。'
    } else if (!state.editor.path) {
      context.textContent = `${skillSummary(skill)} · 目录已就绪，选择现有文件开始编辑`
    } else {
      context.textContent = `${skillSummary(skill)} · ${state.editor.path}`
    }
  }
  if (dirtyState) {
    dirtyState.textContent = state.editor.dirty ? '未保存' : '已保存'
    dirtyState.classList.toggle('is-dirty', state.editor.dirty)
  }
  editor.value = state.editor.value
  editor.placeholder = state.selectedSkillId
    ? '把现有文件移进来后，从左侧文件树打开并编辑'
    : '先在左侧选择 skill，或先创建空目录'
  editor.readOnly = !state.editor.path
}

function syncSkillMetadata() {
  const skill = selectedSkill()
  const stableId = document.getElementById('skillStableId')
  const skillType = document.getElementById('skillType')
  const skillTags = document.getElementById('skillTags')

  if (stableId) {
    stableId.textContent = skill ? String(skill.stable_id) : '-'
  }
  if (skillType) {
    skillType.value = skill?.skill_type || ''
  }
  if (skillTags) {
    skillTags.value = (skill?.tags || []).join(', ')
  }
}

function syncAll() {
  state.currentPage = normalizePageId(state.currentPage)
  syncShell()
  renderCurrentPage()
  syncActionUi()
  syncSkillsPage()
  syncEditorExplorer()
  syncTree()
  syncEditor()
  syncSkillMetadata()
}

async function loadSkills() {
  const previousSelectedSkillId = state.selectedSkillId
  const previousCheckedSkillIds = [...state.checkedSkillIds]
  const data = await invoke('list_warehouse_skills_cmd')
  state.skills = data

  if (!state.selectedSkillId && data.length) {
    state.selectedSkillId = data[0].stable_id
  }

  if (state.selectedSkillId && !data.some(skill => skill.stable_id === state.selectedSkillId)) {
    state.selectedSkillId = data[0]?.stable_id ?? null
  }

  if (previousSelectedSkillId !== state.selectedSkillId) {
    resetGeneratedCommand()
  }

  const availableIds = new Set(data.map(skill => skill.stable_id))
  state.checkedSkillIds = state.checkedSkillIds.filter(id => availableIds.has(id))
  if (previousCheckedSkillIds.length !== state.checkedSkillIds.length) {
    resetGeneratedCommand()
  }

  syncSkillsPage()
  syncEditorExplorer()

  if (state.selectedSkillId && state.currentPage === 'editor') {
    await loadTree(state.selectedSkillId)
  } else if (!state.selectedSkillId) {
    resetEditorSelection()
  }
}

function applyEditableSettingsPayload(payload) {
  state.skillWarehouse = payload.skill_warehouse || ''
  state.defaultSkillWarehouse = payload.default_skill_warehouse || ''
  state.libraryRoots = payload.library_roots || []
}

async function loadEditableSettings() {
  const payload = await invoke('load_editable_settings_cmd')
  applyEditableSettingsPayload(payload)
}

async function pickFolder(startPath = '') {
  return (
    (await invoke('pick_folder_cmd', {
      req: {
        start_path: startPath || null
      }
    })) || ''
  )
}

async function pickSettingsWarehouse() {
  const next = await pickFolder(state.skillWarehouse)
  if (!next) {
    return
  }

  state.skillWarehouse = next
  syncAll()
}

async function addLibraryRoot() {
  const next = await pickFolder(state.libraryRoots[0] || state.skillWarehouse)
  if (!next || state.libraryRoots.includes(next)) {
    return
  }

  state.libraryRoots = [...state.libraryRoots, next]
  syncAll()
}

function removeLibraryRoot(index) {
  state.libraryRoots = state.libraryRoots.filter((_, currentIndex) => currentIndex !== index)
  syncAll()
}

async function saveSettings() {
  const payload = await invoke('save_editable_settings_cmd', {
    req: {
      skill_warehouse: state.skillWarehouse.trim(),
      library_roots: state.libraryRoots
    }
  })

  applyEditableSettingsPayload(payload)
  await loadSkills()
  syncAll()
}

function ensureCompatibleMcpScope() {
  if (mcpProjectScopeDisabled() && state.mcp.scope === 'project') {
    state.mcp.scope = 'global'
    state.mcp.projectPath = ''
  }
}

function mcpEditorHasInput() {
  return Boolean(
    state.mcp.editor.name.trim() ||
      state.mcp.editor.command.trim() ||
      state.mcp.editor.url.trim() ||
      state.mcp.editor.args.length
  )
}

function buildMcpServerFromEditor() {
  const name = state.mcp.editor.name.trim()
  if (!name) {
    throw new Error('请输入 MCP Server 名称')
  }

  if (mcpMode() === 'remote') {
    const url = state.mcp.editor.url.trim()
    if (!url) {
      throw new Error('请输入远程 MCP URL')
    }
    return {
      name,
      command: null,
      args: [],
      url
    }
  }

  const command = state.mcp.editor.command.trim()
  if (!command) {
    throw new Error('请输入 MCP 命令')
  }

  return {
    name,
    command,
    args: [...state.mcp.editor.args],
    url: null
  }
}

function upsertMcpServer(server) {
  const draft = [...state.mcp.servers]
  const previousName = state.mcp.selectedServerName
  const duplicate = draft.find(
    entry => entry.name === server.name && entry.name !== previousName
  )
  if (duplicate) {
    throw new Error(`MCP Server ${server.name} 已存在`)
  }

  const next = draft.filter(entry => entry.name !== previousName && entry.name !== server.name)
  next.push(server)
  applyMcpServers(next)
  state.mcp.selectedServerName = server.name
  state.mcp.editor = createMcpEditorState(server)
}

async function loadMcpConfigForCurrentTarget() {
  ensureCompatibleMcpScope()
  if (state.mcp.scope === 'project' && !state.mcp.projectPath.trim()) {
    state.mcp.targetPath = ''
    state.mcp.selectedServerName = ''
    state.mcp.editor = createMcpEditorState()
    state.mcp.servers = []
    syncAll()
    return
  }

  const payload = await invoke('load_mcp_config_cmd', {
    req: mcpRequestPayload()
  })

  state.mcp.targetPath = payload.target_path || ''
  applyMcpServers(payload.servers || [])
  syncAll()
}

function applyMcpDemo(demo) {
  state.mcp.selectedServerName = demo.name
  state.mcp.editor = createMcpEditorState(demo)
  syncAll()
}

function resetMcpEditor() {
  state.mcp.selectedServerName = ''
  state.mcp.editor = createMcpEditorState()
  syncAll()
}

async function saveCurrentMcpServer() {
  const server = buildMcpServerFromEditor()
  upsertMcpServer(server)
  syncAll()
}

async function persistMcpServers() {
  const payload = await invoke('save_mcp_config_cmd', {
    req: {
      ...mcpRequestPayload(),
      servers: state.mcp.servers
    }
  })
  state.mcp.targetPath = payload.target_path || ''
  applyMcpServers(payload.servers || [])
  syncAll()
}

async function saveMcpConfig() {
  if (mcpEditorHasInput()) {
    const server = buildMcpServerFromEditor()
    upsertMcpServer(server)
  }

  await persistMcpServers()
}

async function deleteCurrentMcpServer() {
  if (!state.mcp.selectedServerName) {
    return
  }

  const confirmed = window.confirm(`移除 ${state.mcp.selectedServerName} ?`)
  if (!confirmed) {
    return
  }

  applyMcpServers(
    state.mcp.servers.filter(server => server.name !== state.mcp.selectedServerName)
  )
  await persistMcpServers()
}

async function loadTree(stableId) {
  const tree = await invoke('inspect_skill_tree_cmd', { stableId })
  state.tree = tree

  const skill = state.skills.find(entry => entry.stable_id === stableId)
  const defaultPath = skill?.skill_md_path
    ? skill.skill_md_path.split('/').pop()
    : ''

  if (defaultPath && findTreePath(tree, defaultPath)) {
    await openFile(defaultPath)
  } else {
    state.selectedPath = ''
    state.editor = createEditorState()
  }

  syncTree()
  syncEditor()
}

function findTreePath(node, target) {
  if (!node) {
    return false
  }
  if (node.path === target) {
    return true
  }
  return (node.children || []).some(child => findTreePath(child, target))
}

async function openFile(relativePath) {
  if (!state.selectedSkillId) {
    return
  }

  const content = await invoke('read_skill_file_cmd', {
    req: {
      stable_id: state.selectedSkillId,
      relative_path: relativePath
    }
  })
  state.selectedPath = relativePath
  state.editor = nextEditorState(state.editor, {
    type: 'load',
    path: relativePath,
    value: content
  })
  syncTree()
  syncEditor()
}

async function createSkillFromSidebar() {
  const created = await invoke('create_skill_cmd', {
    req: {
      id: state.createSkill.id.trim(),
      name: null,
      description: null
    }
  })

  state.createSkill = nextSkillDraftState(state.createSkill, { type: 'created' })
  state.currentPage = 'editor'
  state.selectedSkillId = created.stable_id
  resetGeneratedCommand()
  resetEditorSelection()
  await loadSkills()
  syncAll()
  print(`目录 ${created.id} 已创建。把 SKILL.md 移进来后点刷新即可继续管理。`, 'success')
}

async function saveMetadata() {
  const req = {
    stable_id: state.selectedSkillId,
    skill_type: document.getElementById('skillType').value.trim() || null,
    tags: document
      .getElementById('skillTags')
      .value
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean)
  }
  const updated = await invoke('update_skill_metadata_cmd', { req })
  const index = state.skills.findIndex(skill => skill.stable_id === updated.stable_id)
  if (index >= 0) {
    state.skills[index] = { ...state.skills[index], ...updated }
  }
  syncAll()
  print(updated, 'success')
}

async function saveFile() {
  if (!state.selectedSkillId || !state.editor.path) {
    throw new Error('请选择一个文件')
  }

  await invoke('write_skill_file_cmd', {
    req: {
      stable_id: state.selectedSkillId,
      relative_path: state.editor.path,
      content: state.editor.value
    }
  })
  state.editor = nextEditorState(state.editor, { type: 'saved' })
  syncActionUi()
  print({ saved: state.editor.path }, 'success')
}

async function createPath(kind) {
  if (!state.selectedSkillId) {
    throw new Error('请先选择一个 skill')
  }
  const relativePath = window.prompt(kind === 'dir' ? '输入新文件夹路径' : '输入新文件路径')
  if (!relativePath) {
    return
  }
  await invoke('create_skill_path_cmd', {
    req: {
      stable_id: state.selectedSkillId,
      relative_path: relativePath,
      kind
    }
  })
  await loadTree(state.selectedSkillId)
  print({ created: relativePath, kind }, 'success')
}

async function renamePath() {
  if (!state.selectedSkillId || !state.selectedPath) {
    throw new Error('请先选择一个路径')
  }
  const to = window.prompt('输入新的相对路径', state.selectedPath)
  if (!to || to === state.selectedPath) {
    return
  }
  await invoke('rename_skill_path_cmd', {
    req: {
      stable_id: state.selectedSkillId,
      from: state.selectedPath,
      to
    }
  })
  state.selectedPath = ''
  state.editor = createEditorState()
  await loadTree(state.selectedSkillId)
  print({ renamed: to }, 'success')
}

async function deletePath() {
  if (!state.selectedSkillId || !state.selectedPath) {
    throw new Error('请先选择一个路径')
  }
  const confirmed = window.confirm(`删除 ${state.selectedPath} ?`)
  if (!confirmed) {
    return
  }
  await invoke('delete_skill_path_cmd', {
    req: {
      stable_id: state.selectedSkillId,
      relative_path: state.selectedPath
    }
  })
  state.selectedPath = ''
  state.editor = createEditorState()
  await loadTree(state.selectedSkillId)
  print({ deleted: true }, 'success')
}

async function migrateSkills() {
  const result = await invoke('migrate_legacy_skills_cmd')
  state.skillsImportExpanded = true
  state.migrationResult = result
  state.migrationOutput = formatOutputPayload(result, 'success')
  await loadSkills()
  syncAll()
  syncEditor()
}

async function importGitSkills() {
  const repoUrl = state.gitImportUrl.trim()
  if (!repoUrl) {
    throw new Error('请输入 Git 仓库地址')
  }

  const result = await invoke('import_git_skills_cmd', {
    req: {
      repo_url: repoUrl
    }
  })
  state.skillsImportExpanded = true
  state.gitImportResult = result
  state.gitImportOutput = formatOutputPayload(result, 'success')
  await loadSkills()
  syncAll()
}

async function syncSkills() {
  const skillIds = distributionSkillIds()
  if (!skillIds.length) {
    throw new Error('请先选择一个 skill')
  }

  const result = await invoke('sync_global_skills_cmd', {
    req: {
      client: state.client,
      skill_ids: skillIds,
      mode: state.installMode
    }
  })
  print(result, 'success')
}

async function generateCommand() {
  const skillIds = distributionSkillIds()
  if (!skillIds.length) {
    throw new Error('请先选择一个 skill')
  }

  const command = await invoke('generate_init_project_command_cmd', {
    req: {
      client: state.client,
      skill_ids: skillIds,
      mode: state.installMode
    }
  })
  state.generatedCommand = command
  const commandOutput = document.getElementById('generatedCommand')
  if (commandOutput) {
    commandOutput.value = command
  }
  print(command, 'success')
}

async function copyGeneratedCommand() {
  if (!state.generatedCommand) {
    throw new Error('请先生成命令')
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(state.generatedCommand)
    markCommandCopied()
    syncAll()
    return
  }

  const buffer = document.createElement('textarea')
  buffer.value = state.generatedCommand
  buffer.setAttribute('readonly', 'true')
  buffer.style.position = 'absolute'
  buffer.style.left = '-9999px'
  document.body.appendChild(buffer)
  buffer.select()
  document.execCommand('copy')
  document.body.removeChild(buffer)

  markCommandCopied()
  syncAll()
  return
}

async function openSelectedSkillInEditor() {
  if (!state.selectedSkillId) {
    throw new Error('请先选择一个 skill')
  }

  state.currentPage = 'editor'
  resetEditorSelection()
  syncAll()
  await loadTree(state.selectedSkillId)
}

function bindEvents() {
  app.addEventListener('input', event => {
    if (event.target.id === 'searchInput') {
      state.filters.query = event.target.value
      syncAll()
      return
    }

    if (event.target.id === 'createSkillId') {
      state.createSkill = nextSkillDraftState(state.createSkill, {
        type: 'edit',
        field: 'id',
        value: event.target.value
      })
      const formError = app.querySelector('.form-error')
      if (formError) {
        formError.remove()
      }
      syncActionUi()
      return
    }

    if (event.target.id === 'editorInput') {
      state.editor = nextEditorState(state.editor, {
        type: 'edit',
        value: event.target.value
      })
      syncActionUi()
      return
    }

    if (event.target.id === 'gitRepoUrl') {
      state.gitImportUrl = event.target.value
      syncActionUi()
      return
    }

    if (event.target.id === 'settingsWarehouse') {
      state.skillWarehouse = event.target.value
      syncActionUi()
      return
    }

    if (event.target.id === 'mcpProjectPath') {
      state.mcp.projectPath = event.target.value
      syncActionUi()
      return
    }

    if (event.target.id === 'mcpServerName') {
      state.mcp.editor = {
        ...state.mcp.editor,
        name: event.target.value
      }
      syncActionUi()
      return
    }

    if (event.target.id === 'mcpServerCommand') {
      state.mcp.editor = {
        ...state.mcp.editor,
        command: event.target.value
      }
      syncActionUi()
      return
    }

    if (event.target.id === 'mcpServerArgs') {
      state.mcp.editor = {
        ...state.mcp.editor,
        args: event.target.value
          .split(/\s+/)
          .map(item => item.trim())
          .filter(Boolean)
      }
      syncActionUi()
      return
    }

    if (event.target.id === 'mcpServerUrl') {
      state.mcp.editor = {
        ...state.mcp.editor,
        url: event.target.value
      }
      syncActionUi()
    }
  })

  app.addEventListener('change', event => {
    if (event.target.id === 'tagFilter') {
      state.filters.tag = event.target.value
      syncAll()
      return
    }

    if (event.target.matches('[data-skill-check]')) {
      toggleCheckedSkillId(Number(event.target.dataset.skillCheck), event.target.checked)
      resetGeneratedCommand()
      syncAll()
      return
    }

    if (event.target.id === 'clientSelect') {
      state.client = event.target.value
      resetGeneratedCommand()
      syncAll()
      return
    }

    if (event.target.id === 'modeSelect') {
      state.installMode = event.target.value
      resetGeneratedCommand()
      syncAll()
      return
    }

    if (event.target.id === 'mcpClientSelect') {
      state.mcp.client = event.target.value
      ensureCompatibleMcpScope()
      syncAll()
      runAction('loadMcp', loadMcpConfigForCurrentTarget)
      return
    }

    if (event.target.id === 'mcpScopeSelect') {
      state.mcp.scope = event.target.value
      syncAll()
      if (state.mcp.scope === 'project' && !state.mcp.projectPath.trim()) {
        return
      }
      runAction('loadMcp', loadMcpConfigForCurrentTarget)
      return
    }

    if (event.target.id === 'mcpTransportMode') {
      state.mcp.editor = {
        ...state.mcp.editor,
        transport: event.target.value
      }
      syncAll()
    }
  })

  app.addEventListener('click', event => {
    const pageLink = event.target.closest('[data-page-link]')
    if (pageLink) {
      if (state.currentPage === 'editor' && pageLink.dataset.pageLink !== 'editor' && !confirmDiscardEditorChanges('离开编辑器页面')) {
        return
      }
      state.currentPage = pageLink.dataset.pageLink
      syncAll()
      if (state.currentPage === 'mcp') {
        runAction('loadMcp', loadMcpConfigForCurrentTarget)
      }
      return
    }

    const button = event.target.closest('[data-skill-id]')
    if (!button) {
      const removeLibraryRootButton = event.target.closest('[data-remove-library-root]')
      if (removeLibraryRootButton) {
        removeLibraryRoot(Number(removeLibraryRootButton.dataset.removeLibraryRoot))
        return
      }

      const mcpServerButton = event.target.closest('[data-mcp-server]')
      if (mcpServerButton) {
        state.mcp.selectedServerName = mcpServerButton.dataset.mcpServer
        state.mcp.editor = createMcpEditorState(selectedMcpServer())
        syncAll()
        return
      }

      const treeButton = event.target.closest('[data-tree-path]')
      if (treeButton) {
        const path = treeButton.dataset.treePath
        const kind = treeButton.dataset.treeKind
        if (kind === 'file' && state.selectedPath === path) {
          return
        }
        if (kind === 'file' && state.selectedPath !== path && !confirmDiscardEditorChanges('切换到另一个文件')) {
          return
        }
        state.selectedPath = path
        syncTree()
        if (kind === 'file') {
          runAction('loadTree', () => openFile(path))
        }
        return
      }

      switch (event.target.id) {
        case 'toggleSkillsImport':
          state.skillsImportExpanded = !state.skillsImportExpanded
          syncAll()
          return
        case 'refresh':
          if (!confirmDiscardEditorChanges('刷新并重新加载当前 skill')) {
            return
          }
          runAction('refresh', loadSkills)
          return
        case 'openCreateSkill':
          state.currentPage = 'editor'
          state.createSkill = nextSkillDraftState(state.createSkill, { type: 'open' })
          syncAll()
          return
        case 'cancelCreateSkill':
          state.createSkill = nextSkillDraftState(state.createSkill, { type: 'close' })
          syncAll()
          return
        case 'createSkill':
          if (!state.createSkill.id.trim()) {
            state.createSkill = nextSkillDraftState(state.createSkill, {
              type: 'error',
              message: '请输入 Skill ID'
            })
            syncAll()
            return
          }
          if (!confirmDiscardEditorChanges('创建并打开新的 skill')) {
            return
          }
          runAction('createSkill', createSkillFromSidebar, {
            onError: error => {
              state.createSkill = nextSkillDraftState(state.createSkill, {
                type: 'error',
                message: error.message || String(error)
              })
              syncAll()
            }
          })
          return
        case 'saveMetadata':
          runAction('saveMetadata', saveMetadata)
          return
        case 'openEditor':
          runAction('loadTree', openSelectedSkillInEditor)
          return
        case 'saveFile':
          runAction('saveFile', saveFile)
          return
        case 'createFile':
          runAction('createPath', () => createPath('file'))
          return
        case 'createFolder':
          runAction('createPath', () => createPath('dir'))
          return
        case 'renamePath':
          if (!confirmDiscardEditorChanges('重命名当前路径')) {
            return
          }
          runAction('renamePath', renamePath)
          return
        case 'deletePath':
          if (!confirmDiscardEditorChanges('删除当前路径')) {
            return
          }
          runAction('deletePath', deletePath)
          return
        case 'migrate':
          if (!confirmDiscardEditorChanges('迁移并重新加载技能列表')) {
            return
          }
          runAction('migrate', migrateSkills, {
            onError: error => {
              state.migrationOutput = formatOutputPayload(error, 'error')
              syncAll()
            }
          })
          return
        case 'importGitSkills':
          if (!confirmDiscardEditorChanges('导入仓库并刷新技能列表')) {
            return
          }
          runAction('importGitSkills', importGitSkills, {
            onError: error => {
              state.gitImportOutput = formatOutputPayload(error, 'error')
              syncAll()
            }
          })
          return
        case 'pickSettingsWarehouse':
          runAction('pickFolder', pickSettingsWarehouse)
          return
        case 'resetSettingsWarehouse':
          state.skillWarehouse = state.defaultSkillWarehouse || state.skillWarehouse
          syncAll()
          return
        case 'addLibraryRoot':
          runAction('pickFolder', addLibraryRoot)
          return
        case 'saveSettings':
          runAction('saveSettings', saveSettings)
          return
        case 'syncSkills':
          runAction('sync', syncSkills)
          return
        case 'generateCommand':
          runAction('generateCommand', generateCommand)
          return
        case 'copyCommand':
          runAction('copyCommand', copyGeneratedCommand)
          return
        case 'reloadMcp':
          runAction('loadMcp', loadMcpConfigForCurrentTarget)
          return
        case 'pickMcpProject':
          runAction('pickFolder', async () => {
            const next = await pickFolder(state.mcp.projectPath)
            if (!next) {
              return
            }
            state.mcp.projectPath = next
            await loadMcpConfigForCurrentTarget()
          })
          return
        case 'newMcpServer':
          resetMcpEditor()
          return
        case 'applyBetterIconsDemo':
          applyMcpDemo(MCP_DEMOS.betterIcons)
          return
        case 'applyOpenAiDocsDemo':
          applyMcpDemo(MCP_DEMOS.openAiDocs)
          return
        case 'saveMcpServer':
          runAction('saveMcpServer', saveCurrentMcpServer)
          return
        case 'deleteMcpServer':
          runAction('saveMcpConfig', deleteCurrentMcpServer)
          return
        case 'saveMcpConfig':
          runAction('saveMcpConfig', saveMcpConfig)
          return
        default:
          return
      }
    }

    const nextSkillId = Number(button.dataset.skillId)
    if (state.currentPage === 'skills') {
      if (state.selectedSkillId === nextSkillId) {
        return
      }
      state.selectedSkillId = nextSkillId
      resetGeneratedCommand()
      resetEditorSelection()
      syncAll()
      return
    }

    if (state.selectedSkillId === nextSkillId) {
      state.currentPage = 'editor'
      syncAll()
      if (!state.tree) {
        runAction('loadTree', () => loadTree(state.selectedSkillId))
      }
      return
    }

    if (!confirmDiscardEditorChanges('切换到另一个 skill')) {
      return
    }

    state.selectedSkillId = nextSkillId
    state.currentPage = 'editor'
    resetGeneratedCommand()
    resetEditorSelection()
    syncAll()
    runAction('loadTree', () => loadTree(state.selectedSkillId))
  })
}

async function init() {
  renderBase()
  syncAll()
  bindEvents()

  await runAction('bootstrap', async () => {
    await Promise.all([loadSkills(), loadEditableSettings()])
    syncAll()
  })
}

init().catch(error => {
  app.textContent = String(error)
})
