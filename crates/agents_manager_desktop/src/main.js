import './styles.css'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  collectKnownTags,
  createActionState,
  createAppShellHtml,
  createEditorPageHtml,
  createMemoryDraftState,
  createMemoryPageHtml,
  createPathDraftState,
  createMcpPageHtml,
  createEditorState,
  createSkillDraftState,
  createSettingsPageHtml,
  createSkillsPageHtml,
  filterSkills,
  formatOutputPayload,
  groupSkillsByTag,
  normalizePageId,
  nextActionState,
  nextEditorState,
  nextMemoryDraftState,
  nextPathDraftState,
  nextSkillDraftState,
  isDroppedSkillAlreadyExistsError,
  prioritizeDroppedSkillImportPaths,
  renderDroppedSkillImportConfirmHtml,
  renderMemoryContextMenuHtml,
  renderMemoryRenameModalHtml,
  resolveDroppedSkillImportCollision,
  resolveEditorGroupKey,
  renderExplorerGroupListHtml,
  renderMemoryListHtml,
  resolveDistributionSkillIds,
  renderExplorerSkillListHtml,
  renderSkillGroupsHtml,
  renderTagOptionsHtml,
  renderTreeHtml,
  treeMenuActionNeedsDirtyConfirm
} from './ui.js'

const app = document.getElementById('app')
let copyFeedbackTimer = null
let memoryCopyFeedbackTimer = null
const ACTION_CANCELLED = Symbol('action-cancelled')

function createSkillInteractionState() {
  return {
    mode: null,
    skillId: null,
    draftId: ''
  }
}

function createTreeContextMenuState() {
  return {
    open: false,
    target: 'root',
    title: '',
    path: '',
    pathKind: '',
    x: 0,
    y: 0
  }
}

function createWarehouseContextMenuState() {
  return {
    open: false,
    title: 'WAREHOUSE',
    tagKey: '',
    x: 0,
    y: 0
  }
}

function createMemoryContextMenuState() {
  return {
    open: false,
    memoryId: null,
    x: 0,
    y: 0
  }
}

function createDroppedSkillImportConfirmState() {
  return {
    open: false,
    name: '',
    candidatePath: '',
    targetSkillId: null
  }
}

function createMemoryRenameState() {
  return {
    open: false,
    memoryId: null,
    draftId: '',
    error: ''
  }
}

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
  commandForce: false,
  generatedCommand: '',
  copyFeedback: 'idle',
  memories: [],
  selectedMemoryId: null,
  memoryClient: 'codex',
  memoryCommandForce: false,
  generatedMemoryCommand: '',
  memoryCopyFeedback: 'idle',
  memoryDraft: createMemoryDraftState(),
  memoryDeleteConfirmOpen: false,
  memoryContextMenu: createMemoryContextMenuState(),
  memoryRename: createMemoryRenameState(),
  droppedSkillImportConfirm: createDroppedSkillImportConfirmState(),
  appVersion: '',
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
  activeEditorEntry: { kind: null, stableId: null },
  editorSidebarMode: 'roots',
  editorGroupKey: '',
  collapsedEditorGroupKeys: [],
  createSkill: createSkillDraftState(),
  createSkillGroupKey: '',
  createSkillTargetLabel: '',
  createPath: createPathDraftState(),
  warehouseContextMenu: createWarehouseContextMenuState(),
  skillContextMenu: {
    open: false,
    skillId: null,
    x: 0,
    y: 0
  },
  skillInteraction: createSkillInteractionState(),
  treeContextMenu: createTreeContextMenuState(),
  tree: null,
  selectedPath: '',
  editor: createEditorState(),
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
    checkedServerNames: [],
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
  'generateMemoryCommand',
  'copyMemoryCommand',
  'openEditor',
  'openMemoryEditor',
  'createMemory',
  'createMemorySubmit',
  'cancelCreateMemory',
  'deleteMemory',
  'confirmDeleteMemory',
  'cancelDeleteMemory',
  'deleteSkill',
  'openCreateSkill',
  'createSkill',
  'cancelCreateSkill',
  'createTreePath',
  'cancelCreateTreePath',
  'showTagBrowser',
  'showWarehouseBrowser',
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
  'enableSelectedMcpServers',
  'disableSelectedMcpServers',
  'applyBetterIconsDemo',
  'applyOpenAiDocsDemo',
  'saveMcpServer',
  'deleteMcpServer',
  'saveMcpConfig'
]

const PAGE_META = {
  skills: {
    eyebrow: 'Skills',
    title: 'Skills',
    description: ''
  },
  editor: {
    eyebrow: 'Editor',
    title: 'Editor',
    description: ''
  },
  memory: {
    eyebrow: 'Memory',
    title: 'Memory',
    description: ''
  },
  mcp: {
    eyebrow: 'MCP',
    title: 'MCP',
    description: ''
  },
  settings: {
    eyebrow: 'Settings',
    title: 'Settings',
    description: ''
  }
}

function renderBase() {
  app.innerHTML = createAppShellHtml(state.appVersion)
}

function skillLabel(skill) {
  return skill ? skill.name || skill.id : '未选择'
}

function skillSummary(skill) {
  return skill ? `${skill.stable_id} · ${skillLabel(skill)}` : '未选择'
}

function memoryLabel(memory) {
  return memory ? memory.id || `Memory ${memory.stable_id}` : '未选择'
}

function memorySummary(memory) {
  return memory ? `${memory.stable_id} · ${memoryLabel(memory)}` : '未选择'
}

function activeEditorStableId() {
  return state.activeEditorEntry.stableId
}

function activeEditorEntryRecord() {
  if (state.activeEditorEntry.kind === 'memory') {
    return state.memories.find(memory => memory.stable_id === activeEditorStableId()) || null
  }
  if (state.activeEditorEntry.kind === 'skill') {
    return state.skills.find(skill => skill.stable_id === activeEditorStableId()) || null
  }
  return null
}

function activeEditorEntryLabel() {
  if (state.activeEditorEntry.kind === 'memory') {
    return memoryLabel(activeEditorEntryRecord())
  }
  return skillLabel(activeEditorEntryRecord())
}

function activeEditorEntrySummary() {
  if (state.activeEditorEntry.kind === 'memory') {
    return memorySummary(activeEditorEntryRecord())
  }
  return skillSummary(activeEditorEntryRecord())
}

function activeEditorEntryKindLabel() {
  return state.activeEditorEntry.kind === 'memory' ? 'memory' : 'skill'
}

function editorReturnPage() {
  return state.activeEditorEntry.kind === 'memory' ? 'memory' : 'skills'
}

function clearActiveEditorEntry() {
  state.activeEditorEntry = { kind: null, stableId: null }
}

function closeEditorSession() {
  closeCreatePathDraft()
  closeWarehouseContextMenu()
  closeMemoryContextMenu()
  closeSkillContextMenu()
  closeSkillInteraction()
  closeTreeContextMenu()
  state.editorSidebarMode = 'roots'
  clearActiveEditorEntry()
  resetEditorSelection()
}

function editorGroups() {
  return groupSkillsByTag(state.skills)
}

function editorGroupKeyForSkill(skill, preferredGroupKey = '') {
  return resolveEditorGroupKey(skill, preferredGroupKey)
}

function selectedEditorGroup() {
  return editorGroups().find(group => group.key === state.editorGroupKey) || null
}

function editorGroupLabel(groupKey = state.editorGroupKey) {
  return editorGroups().find(group => group.key === groupKey)?.label || 'WAREHOUSE'
}

function warehouseCreateTargetLabel(groupKey = '') {
  if (!groupKey || groupKey === 'uncategorized') {
    return 'UNCATEGORIZED'
  }
  return editorGroups().find(group => group.key === groupKey)?.label || groupKey
}

function openCreateSkillDraft(groupKey = '') {
  state.createSkill = nextSkillDraftState(state.createSkill, { type: 'open' })
  state.createSkillGroupKey = groupKey || 'uncategorized'
  state.createSkillTargetLabel = warehouseCreateTargetLabel(groupKey)
}

function closeCreateSkillDraft() {
  state.createSkill = nextSkillDraftState(state.createSkill, { type: 'close' })
  state.createSkillGroupKey = ''
  state.createSkillTargetLabel = ''
}

function openCreateMemoryDraft() {
  closeCreatePathDraft()
  closeWarehouseContextMenu()
  closeMemoryContextMenu()
  closeMemoryRenameDialog()
  closeSkillContextMenu()
  closeSkillInteraction()
  closeTreeContextMenu()
  state.memoryDeleteConfirmOpen = false
  state.memoryDraft = nextMemoryDraftState(state.memoryDraft, { type: 'open' })
}

function closeCreateMemoryDraft() {
  state.memoryDraft = nextMemoryDraftState(state.memoryDraft, { type: 'close' })
}

function openDeleteMemoryConfirm() {
  if (!state.selectedMemoryId) {
    return
  }

  closeCreateMemoryDraft()
  closeCreatePathDraft()
  closeWarehouseContextMenu()
  closeMemoryContextMenu()
  closeMemoryRenameDialog()
  closeSkillContextMenu()
  closeSkillInteraction()
  closeTreeContextMenu()
  state.memoryDeleteConfirmOpen = true
}

function closeDeleteMemoryConfirm() {
  state.memoryDeleteConfirmOpen = false
}

function createPathTargetLabel(basePath = '') {
  if (!basePath) {
    return activeEditorEntryLabel()
  }

  const segments = basePath.split('/').filter(Boolean)
  return segments.at(-1) || basePath
}

function openCreatePathDraft(kind, basePath = '') {
  const normalizedBasePath = basePath ? `${basePath.replace(/\/+$/, '')}/` : ''
  closeCreateSkillDraft()
  closeWarehouseContextMenu()
  closeSkillContextMenu()
  closeSkillInteraction()
  closeTreeContextMenu()
  state.createPath = nextPathDraftState(state.createPath, {
    type: 'open',
    action: 'create',
    kind,
    value: normalizedBasePath,
    basePath: normalizedBasePath,
    targetLabel: createPathTargetLabel(basePath)
  })
}

function openRenamePathDraft(targetPath, pathKind = 'file') {
  if (!targetPath) {
    return
  }

  closeCreateSkillDraft()
  closeWarehouseContextMenu()
  closeSkillContextMenu()
  closeSkillInteraction()
  closeTreeContextMenu()
  state.createPath = nextPathDraftState(state.createPath, {
    type: 'open',
    action: 'rename',
    kind: pathKind,
    value: targetPath,
    basePath: targetPath,
    targetLabel: createPathTargetLabel(targetPath)
  })
}

function openDeletePathDraft(targetPath, pathKind = 'file') {
  if (!targetPath) {
    return
  }

  closeCreateSkillDraft()
  closeWarehouseContextMenu()
  closeSkillContextMenu()
  closeSkillInteraction()
  closeTreeContextMenu()
  state.createPath = nextPathDraftState(state.createPath, {
    type: 'open',
    action: 'delete',
    kind: pathKind,
    value: '',
    basePath: targetPath,
    targetLabel: createPathTargetLabel(targetPath)
  })
}

function closeCreatePathDraft() {
  state.createPath = nextPathDraftState(state.createPath, { type: 'close' })
}

function toggleEditorGroupCollapse(groupKey) {
  if (!groupKey) {
    return
  }

  const next = new Set(state.collapsedEditorGroupKeys)
  if (next.has(groupKey)) {
    next.delete(groupKey)
  } else {
    next.add(groupKey)
  }
  state.collapsedEditorGroupKeys = [...next]
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

function clientDisplayName(client = state.client) {
  return {
    codex: 'Codex',
    claude: 'Claude',
    cursor: 'Cursor'
  }[client] || client
}

function formatSyncSkillsSuccessMessage(result = {}, client = state.client) {
  const syncedCount = (result.synced_skill_ids || []).length
  const overwrittenCount = (result.overwritten_skill_ids || []).length
  const skippedCount = (result.skipped_skill_ids || []).length
  const invalidCount = (result.invalid_skill_ids || []).length
  const totalCount = syncedCount + overwrittenCount
  const parts = [
    totalCount
      ? `已同步 ${totalCount} 个 Skill 到 ${clientDisplayName(client)}`
      : `${clientDisplayName(client)} 已是最新`
  ]

  if (overwrittenCount) {
    parts.push(`覆盖 ${overwrittenCount} 个`)
  }
  if (skippedCount) {
    parts.push(`已存在且无需处理 ${skippedCount} 个`)
  }
  if (invalidCount) {
    parts.push(`忽略 ${invalidCount} 个无效项`)
  }

  return `${parts.join('，')}。`
}

function resetEditorSelection() {
  state.tree = null
  state.selectedPath = ''
  state.editor = createEditorState()
}

function closeSkillContextMenu() {
  state.skillContextMenu = {
    open: false,
    skillId: null,
    x: 0,
    y: 0
  }
}

function closeWarehouseContextMenu() {
  state.warehouseContextMenu = createWarehouseContextMenuState()
}

function closeMemoryContextMenu() {
  state.memoryContextMenu = createMemoryContextMenuState()
}

function closeSkillInteraction() {
  state.skillInteraction = createSkillInteractionState()
}

function closeTreeContextMenu() {
  state.treeContextMenu = createTreeContextMenuState()
}

function closeDroppedSkillImportConfirm() {
  state.droppedSkillImportConfirm = createDroppedSkillImportConfirmState()
}

function closeMemoryRenameDialog() {
  state.memoryRename = createMemoryRenameState()
}

function openDroppedSkillImportConfirm(conflict, candidatePath) {
  state.droppedSkillImportConfirm = {
    open: true,
    name: conflict?.name || '',
    candidatePath: candidatePath || '',
    targetSkillId: conflict?.targetSkillId || null
  }
}

function openMemoryRenameDialog(memoryId = state.memoryContextMenu.memoryId || state.selectedMemoryId) {
  if (!memoryId) {
    return
  }

  const memory = state.memories.find(entry => entry.stable_id === memoryId) || selectedMemory()
  if (!memory) {
    return
  }

  closeMemoryContextMenu()
  closeTreeContextMenu()
  state.selectedMemoryId = memory.stable_id
  state.memoryRename = {
    open: true,
    memoryId: memory.stable_id,
    draftId: memory.id,
    error: ''
  }
}

function skillContextMenuSkill() {
  return state.skills.find(skill => skill.stable_id === state.skillContextMenu.skillId) || null
}

function memoryContextMenuMemory() {
  return state.memories.find(memory => memory.stable_id === state.memoryContextMenu.memoryId) || null
}

function openSkillContextMenu(stableId, x, y) {
  state.selectedSkillId = stableId
  closeCreateSkillDraft()
  closeCreatePathDraft()
  closeWarehouseContextMenu()
  closeMemoryContextMenu()
  closeSkillInteraction()
  closeTreeContextMenu()
  state.skillContextMenu = {
    open: true,
    skillId: stableId,
    x: Math.max(12, Math.round(x)),
    y: Math.max(12, Math.round(y))
  }
}

function openMemoryContextMenu(stableId, x, y) {
  state.selectedMemoryId = stableId
  closeCreateMemoryDraft()
  closeCreatePathDraft()
  closeWarehouseContextMenu()
  closeSkillContextMenu()
  closeSkillInteraction()
  closeTreeContextMenu()
  state.memoryContextMenu = {
    open: true,
    memoryId: stableId,
    x: Math.max(12, Math.round(x)),
    y: Math.max(12, Math.round(y))
  }
}

function openTreeContextMenu(context = {}, x, y) {
  closeCreateSkillDraft()
  closeCreatePathDraft()
  closeWarehouseContextMenu()
  closeMemoryContextMenu()
  closeSkillContextMenu()
  closeSkillInteraction()
  state.treeContextMenu = {
    ...createTreeContextMenuState(),
    ...context,
    open: true,
    x: Math.max(12, Math.round(x)),
    y: Math.max(12, Math.round(y))
  }
}

function openWarehouseContextMenu(context = {}, x, y) {
  closeCreateSkillDraft()
  closeCreatePathDraft()
  closeMemoryContextMenu()
  closeSkillContextMenu()
  closeSkillInteraction()
  closeTreeContextMenu()
  state.warehouseContextMenu = {
    ...createWarehouseContextMenuState(),
    ...context,
    open: true,
    x: Math.max(12, Math.round(x)),
    y: Math.max(12, Math.round(y))
  }
}

function beginSkillRename(stableId = state.selectedSkillId) {
  if (!stableId) {
    return
  }

  const skill = state.skills.find(entry => entry.stable_id === stableId)
  if (!skill) {
    return
  }

  state.selectedSkillId = stableId
  closeCreateSkillDraft()
  closeCreatePathDraft()
  closeWarehouseContextMenu()
  closeMemoryContextMenu()
  closeSkillContextMenu()
  closeTreeContextMenu()
  state.skillInteraction = {
    mode: 'rename',
    skillId: stableId,
    draftId: skill.id || ''
  }
}

function beginSkillDelete(stableId = state.selectedSkillId) {
  if (!stableId) {
    return
  }

  const skill = state.skills.find(entry => entry.stable_id === stableId)
  if (!skill) {
    return
  }

  state.selectedSkillId = stableId
  closeCreateSkillDraft()
  closeCreatePathDraft()
  closeWarehouseContextMenu()
  closeMemoryContextMenu()
  closeSkillContextMenu()
  closeTreeContextMenu()
  state.skillInteraction = {
    mode: 'delete',
    skillId: stableId,
    draftId: ''
  }
}

function showingEditorTree() {
  return state.currentPage === 'editor' &&
    state.editorSidebarMode === 'tree' &&
    !!activeEditorStableId()
}

function showingEditorGroupBrowser() {
  return state.currentPage === 'editor' && state.editorSidebarMode === 'skills'
}

function showingEditorRootBrowser() {
  return state.currentPage === 'editor' && state.editorSidebarMode === 'roots'
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

function resetGeneratedMemoryCommand() {
  if (memoryCopyFeedbackTimer) {
    window.clearTimeout(memoryCopyFeedbackTimer)
    memoryCopyFeedbackTimer = null
  }
  state.generatedMemoryCommand = ''
  state.memoryCopyFeedback = 'idle'
}

function memoryCopyFeedbackLabel() {
  return state.memoryCopyFeedback === 'copied' ? '已复制' : '复制'
}

function syncCommandCopyUi() {
  const copyCommandButton = document.getElementById('copyCommand')
  if (copyCommandButton) {
    copyCommandButton.textContent = copyFeedbackLabel()
    copyCommandButton.dataset.copyState = state.copyFeedback
    copyCommandButton.disabled = state.action.busy || !state.generatedCommand
  }

  const copyMemoryCommandButton = document.getElementById('copyMemoryCommand')
  if (copyMemoryCommandButton) {
    copyMemoryCommandButton.textContent = memoryCopyFeedbackLabel()
    copyMemoryCommandButton.dataset.copyState = state.memoryCopyFeedback
    copyMemoryCommandButton.disabled = state.action.busy || !state.generatedMemoryCommand
  }
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

function sortMcpServers(servers = []) {
  return [...servers].sort((left, right) => left.name.localeCompare(right.name))
}

function applyMcpServers(servers = []) {
  state.mcp.servers = sortMcpServers(servers)
  const availableNames = new Set(state.mcp.servers.map(server => server.name))
  state.mcp.checkedServerNames = state.mcp.checkedServerNames.filter(name => availableNames.has(name))
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

function checkedMcpServers() {
  const checkedNames = new Set(state.mcp.checkedServerNames)
  return state.mcp.servers.filter(server => checkedNames.has(server.name))
}

function toggleCheckedMcpServerName(name, checked) {
  const next = new Set(state.mcp.checkedServerNames)
  if (checked) {
    next.add(name)
  } else {
    next.delete(name)
  }
  state.mcp.checkedServerNames = [...next]
}

function setEnabledStateForCheckedMcpServers(enabled) {
  const checkedNames = new Set(state.mcp.checkedServerNames)
  if (!checkedNames.size) {
    return
  }

  state.mcp.servers = sortMcpServers(
    state.mcp.servers.map(server => (
      checkedNames.has(server.name)
        ? { ...server, enabled }
        : server
    ))
  )
}

function markCommandCopied() {
  if (copyFeedbackTimer) {
    window.clearTimeout(copyFeedbackTimer)
  }
  state.copyFeedback = 'copied'
  syncCommandCopyUi()
  copyFeedbackTimer = window.setTimeout(() => {
    state.copyFeedback = 'idle'
    copyFeedbackTimer = null
    syncCommandCopyUi()
  }, 1400)
}

function markMemoryCommandCopied() {
  if (memoryCopyFeedbackTimer) {
    window.clearTimeout(memoryCopyFeedbackTimer)
  }
  state.memoryCopyFeedback = 'copied'
  syncCommandCopyUi()
  memoryCopyFeedbackTimer = window.setTimeout(() => {
    state.memoryCopyFeedback = 'idle'
    memoryCopyFeedbackTimer = null
    syncCommandCopyUi()
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
  const activeSkillContextMenu = {
    ...state.skillContextMenu,
    skill: skillContextMenuSkill()
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
      force: state.commandForce,
      command: state.generatedCommand,
      copyLabel: copyFeedbackLabel(),
      copyState: state.copyFeedback,
      importExpanded: state.skillsImportExpanded,
      gitImportUrl: state.gitImportUrl,
      migrationResult: state.migrationResult,
      migrationOutput: state.migrationOutput,
      gitImportResult: state.gitImportResult,
      gitImportOutput: state.gitImportOutput,
      createOpen: state.createSkill.open,
      createId: state.createSkill.id,
      createError: state.createSkill.error,
      createTargetLabel: state.createSkillTargetLabel,
      skillContextMenu: activeSkillContextMenu,
      warehouseContextMenu: state.warehouseContextMenu,
      skillInteraction: state.skillInteraction
    })
    return
  }

  if (state.currentPage === 'editor') {
    const entry = activeEditorEntryRecord()
    const inMemoryEditor = state.activeEditorEntry.kind === 'memory'
    const hasActiveEditorEntry = !!state.activeEditorEntry.kind && !!activeEditorStableId()
    pageBody.innerHTML = createEditorPageHtml({
      selectedSkillName: hasActiveEditorEntry ? activeEditorEntryLabel() : '',
      selectedTagName: editorGroupLabel(),
      browserMode: state.editorSidebarMode,
      createOpen: state.createSkill.open && state.editorSidebarMode !== 'tree',
      createError: state.createSkill.error,
      createId: state.createSkill.id,
      createTargetLabel: state.createSkillTargetLabel,
      createPathOpen: state.createPath.open && state.editorSidebarMode === 'tree',
      createPathAction: state.createPath.action,
      createPathKind: state.createPath.kind,
      createPathValue: state.createPath.value,
      createPathError: state.createPath.error,
      createPathTargetLabel: state.createPath.targetLabel,
      explorerBackLabel: inMemoryEditor ? 'Memory' : 'Skills',
      rootEntryLabel: inMemoryEditor ? 'Memory' : 'Skill',
      showRootEntryActions: !inMemoryEditor,
      editorHint: !hasActiveEditorEntry
        ? '从 Skills 或 Memory 页面打开一个条目后，再在这里继续编辑文本文件。'
        : (inMemoryEditor
            ? '适合修改 MEMORY.md 和该 memory 目录里的其他文本文件。'
            : '适合修改现有 SKILL.md 和目录里的其他文本文件。'),
      refreshLabel: inMemoryEditor ? '刷新当前 memory' : '刷新当前 skill',
      skillContextMenu: activeSkillContextMenu,
      skillInteraction: state.skillInteraction,
      treeContextMenu: {
        ...state.treeContextMenu,
        entryKind: state.activeEditorEntry.kind || 'skill',
        title: state.treeContextMenu.title || (
          inMemoryEditor ? memoryLabel(entry) : skillLabel(entry)
        )
      },
      warehouseContextMenu: state.warehouseContextMenu
    })
    return
  }

  if (state.currentPage === 'memory') {
    pageBody.innerHTML = createMemoryPageHtml({
      memories: state.memories,
      selectedMemoryId: state.selectedMemoryId,
      selectedMemory: selectedMemory(),
      client: state.memoryClient,
      force: state.memoryCommandForce,
      command: state.generatedMemoryCommand,
      copyLabel: memoryCopyFeedbackLabel(),
      copyState: state.memoryCopyFeedback,
      createOpen: state.memoryDraft.open,
      createId: state.memoryDraft.id,
      createError: state.memoryDraft.error,
      deleteOpen: state.memoryDeleteConfirmOpen
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
      checkedServerNames: state.mcp.checkedServerNames,
      selectedServerName: state.mcp.selectedServerName,
      editor: state.mcp.editor,
      disabledProjectScope: mcpProjectScopeDisabled()
    })
    return
  }

  if (state.currentPage === 'settings') {
    pageBody.innerHTML = createSettingsPageHtml({
      appVersion: state.appVersion,
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
    description.hidden = !pageMeta.description
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

  const refresh = document.getElementById('refresh')
  if (refresh) {
    refresh.disabled = state.action.busy || !showingEditorTree() || !activeEditorStableId()
  }

  const saveMetadata = document.getElementById('saveMetadata')
  if (saveMetadata) {
    saveMetadata.disabled = state.action.busy || !state.selectedSkillId
  }

  const createFile = document.getElementById('createFile')
  const createFolder = document.getElementById('createFolder')
  if (createFile) {
    createFile.disabled = state.action.busy || !activeEditorStableId()
  }
  if (createFolder) {
    createFolder.disabled = state.action.busy || !activeEditorStableId()
  }

  const renamePath = document.getElementById('renamePath')
  const deletePath = document.getElementById('deletePath')
  if (renamePath) {
    renamePath.disabled = state.action.busy || !activeEditorStableId() || !state.selectedPath
  }
  if (deletePath) {
    deletePath.disabled = state.action.busy || !activeEditorStableId() || !state.selectedPath
  }

  const openEditor = document.getElementById('openEditor')
  if (openEditor) {
    openEditor.disabled = state.action.busy || !state.selectedSkillId
  }

  const createSkill = document.getElementById('createSkill')
  if (createSkill) {
    createSkill.disabled = state.action.busy || !state.createSkill.id.trim()
  }

  const openCreateSkill = document.getElementById('openCreateSkill')
  if (openCreateSkill) {
    openCreateSkill.disabled = state.action.busy || state.createSkill.open
  }

  const createTreePath = document.getElementById('createTreePath')
  if (createTreePath) {
    createTreePath.disabled = state.action.busy || (
      state.createPath.action === 'delete'
        ? !state.createPath.basePath
        : !state.createPath.value.trim()
    )
  }

  const deleteSkill = document.getElementById('deleteSkill')
  if (deleteSkill) {
    deleteSkill.disabled =
      state.action.busy || state.activeEditorEntry.kind !== 'skill' || !state.selectedSkillId
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

  const generateMemoryCommandButton = document.getElementById('generateMemoryCommand')
  if (generateMemoryCommandButton) {
    generateMemoryCommandButton.disabled = state.action.busy || !state.selectedMemoryId
  }

  const openMemoryEditorButton = document.getElementById('openMemoryEditor')
  if (openMemoryEditorButton) {
    openMemoryEditorButton.disabled = state.action.busy || !state.selectedMemoryId
  }

  const createMemoryButton = document.getElementById('createMemory')
  if (createMemoryButton) {
    createMemoryButton.disabled = state.action.busy || state.memoryDraft.open
  }

  const createMemorySubmitButton = document.getElementById('createMemorySubmit')
  if (createMemorySubmitButton) {
    createMemorySubmitButton.disabled = state.action.busy || !state.memoryDraft.id.trim()
  }

  const deleteMemoryButton = document.getElementById('deleteMemory')
  if (deleteMemoryButton) {
    deleteMemoryButton.disabled =
      state.action.busy || !state.selectedMemoryId || state.memoryDeleteConfirmOpen
  }

  const confirmDeleteMemoryButton = document.getElementById('confirmDeleteMemory')
  if (confirmDeleteMemoryButton) {
    confirmDeleteMemoryButton.disabled = state.action.busy || !state.selectedMemoryId
  }

  const copyMemoryCommandButton = document.getElementById('copyMemoryCommand')
  if (copyMemoryCommandButton) {
    copyMemoryCommandButton.disabled = state.action.busy || !state.generatedMemoryCommand
  }

  syncCommandCopyUi()

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

  const enableSelectedMcpServers = document.getElementById('enableSelectedMcpServers')
  if (enableSelectedMcpServers) {
    enableSelectedMcpServers.disabled =
      state.action.busy || !checkedMcpServers().some(server => server.enabled === false)
  }

  const disableSelectedMcpServers = document.getElementById('disableSelectedMcpServers')
  if (disableSelectedMcpServers) {
    disableSelectedMcpServers.disabled =
      state.action.busy || !checkedMcpServers().some(server => server.enabled !== false)
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
    if (result === ACTION_CANCELLED) {
      state.action = createActionState()
      syncActionUi()
      return null
    }
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

function selectedMemory() {
  return state.memories.find(memory => memory.stable_id === state.selectedMemoryId) || null
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
    state.checkedSkillIds,
    state.skillInteraction
  )
  tagFilter.innerHTML = renderTagOptionsHtml(
    collectKnownTags(state.skills),
    state.filters.tag
  )
}

function syncEditorExplorer() {
  const explorerGroupList = document.getElementById('explorerGroupList')
  if (explorerGroupList) {
    explorerGroupList.innerHTML = renderExplorerGroupListHtml(
      editorGroups(),
      state.selectedSkillId,
      state.skillInteraction,
      state.collapsedEditorGroupKeys
    )
  }

  const editorMemoryList = document.getElementById('editorMemoryList')
  if (editorMemoryList) {
    editorMemoryList.innerHTML = renderMemoryListHtml(
      state.memories,
      state.selectedMemoryId
    )
  }

  const explorerSkillList = document.getElementById('explorerSkillList')
  if (!explorerSkillList) {
    return
  }

  explorerSkillList.innerHTML = renderExplorerSkillListHtml(
    selectedEditorGroup()?.items || [],
    state.selectedSkillId,
    state.skillInteraction
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
  const entry = activeEditorEntryRecord()
  const entryLabel = activeEditorEntryLabel()
  const entrySummary = activeEditorEntrySummary()
  const entryKind = activeEditorEntryKindLabel()

  if (!title || !editor) {
    return
  }

  title.textContent = state.editor.path || (showingEditorTree() ? entryLabel : '文本编辑器')
  if (context) {
    if (!showingEditorTree()) {
      context.textContent = ''
      context.hidden = true
    } else if (!entry) {
      context.textContent = `先从左侧进入一个 ${entryKind}。`
      context.hidden = false
    } else if (!state.editor.path) {
      context.textContent = `${entrySummary} · 目录已就绪`
      context.hidden = false
    } else {
      context.textContent = `${entrySummary} · ${state.editor.path}`
      context.hidden = false
    }
  }
  if (dirtyState) {
    dirtyState.textContent = state.editor.dirty ? '未保存' : '已保存'
    dirtyState.classList.toggle('is-dirty', state.editor.dirty)
  }
  editor.value = state.editor.value
  editor.placeholder = showingEditorTree()
    ? '从左侧新建文件，或打开已有文件后开始编辑'
    : '从 Skills 或 Memory 页面打开一个条目后开始编辑'
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

function syncAppOverlayUi() {
  const modalRoot = document.getElementById('appModalRoot')
  if (!modalRoot) {
    return
  }

  modalRoot.innerHTML = [
    renderDroppedSkillImportConfirmHtml(state.droppedSkillImportConfirm),
    renderMemoryRenameModalHtml(state.memoryRename),
    renderMemoryContextMenuHtml({
      ...state.memoryContextMenu,
      memory: memoryContextMenuMemory()
    })
  ].join('')
}

function syncAll() {
  state.currentPage = normalizePageId(state.currentPage)
  syncShell()
  renderCurrentPage()
  syncAppOverlayUi()
  syncActionUi()
  syncSkillsPage()
  syncEditorExplorer()
  syncTree()
  syncEditor()
  syncSkillMetadata()
  syncSkillInteractionUi()
  syncCreateSkillUi()
  syncMemoryRenameUi()
  syncCreatePathUi()
}

function syncSkillInteractionUi() {
  if (state.skillInteraction.mode !== 'rename') {
    return
  }

  const input = document.getElementById('skillRenameInput')
  if (!input || document.activeElement === input) {
    return
  }

  input.focus()
  input.select()
}

function syncCreateSkillUi() {
  if (!state.createSkill.open) {
    return
  }

  const input = document.getElementById('createSkillId')
  if (!input || document.activeElement === input) {
    return
  }

  input.focus()
  input.select()
}

function syncMemoryRenameUi() {
  if (!state.memoryRename.open) {
    return
  }

  const input = document.getElementById('memoryRenameInput')
  if (!input || document.activeElement === input) {
    return
  }

  input.focus()
  input.select()
}

function syncCreatePathUi() {
  if (!state.createPath.open) {
    return
  }

  const input = document.getElementById('createPathValue')
  if (!input || document.activeElement === input) {
    return
  }

  input.focus()
  input.select()
}

async function loadSkills() {
  const previousSelectedSkillId = state.selectedSkillId
  const previousCheckedSkillIds = [...state.checkedSkillIds]
  const data = await invoke('list_warehouse_skills_cmd')
  state.skills = data

  if (!state.selectedSkillId && data.length && state.currentPage === 'skills') {
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
  if (state.skillContextMenu.open && !availableIds.has(state.skillContextMenu.skillId)) {
    closeSkillContextMenu()
  }
  if (state.warehouseContextMenu.open) {
    const activeGroupExists = !state.warehouseContextMenu.tagKey ||
      editorGroups().some(group => group.key === state.warehouseContextMenu.tagKey)
    if (!activeGroupExists) {
      closeWarehouseContextMenu()
    }
  }
  if (state.treeContextMenu.open && state.activeEditorEntry.kind === 'skill' && !state.selectedSkillId) {
    closeTreeContextMenu()
  }
  if (state.createPath.open && state.activeEditorEntry.kind === 'skill' && !state.selectedSkillId) {
    closeCreatePathDraft()
  }
  if (state.skillInteraction.skillId && !availableIds.has(state.skillInteraction.skillId)) {
    closeSkillInteraction()
  }

  const groups = editorGroups()
  const groupKeys = new Set(groups.map(group => group.key))
  state.collapsedEditorGroupKeys = state.collapsedEditorGroupKeys.filter(key => groupKeys.has(key))
  if (state.editorSidebarMode === 'skills' && !groupKeys.has(state.editorGroupKey)) {
    closeCreatePathDraft()
    state.editorSidebarMode = 'roots'
    state.editorGroupKey = ''
  }
  if (state.editorSidebarMode === 'tree') {
    if (state.activeEditorEntry.kind === 'skill' && !state.selectedSkillId) {
      clearActiveEditorEntry()
      closeCreatePathDraft()
      state.editorSidebarMode = 'roots'
      state.editorGroupKey = ''
      resetEditorSelection()
    } else if (state.activeEditorEntry.kind === 'skill') {
      const skill = selectedSkill()
      state.editorGroupKey = editorGroupKeyForSkill(skill, state.editorGroupKey)
    }
  }

  syncSkillsPage()
  syncEditorExplorer()

  if (state.activeEditorEntry.kind === 'skill' && activeEditorStableId() && showingEditorTree()) {
    await loadTree(activeEditorStableId())
  } else if (state.activeEditorEntry.kind === 'skill' && !state.selectedSkillId) {
    resetEditorSelection()
  }
}

async function loadMemories() {
  const previousSelectedMemoryId = state.selectedMemoryId
  const data = await invoke('list_warehouse_memories_cmd')
  state.memories = data
  const availableIds = new Set(data.map(memory => memory.stable_id))

  if (!state.selectedMemoryId && data.length) {
    state.selectedMemoryId = data[0].stable_id
  }

  if (state.selectedMemoryId && !data.some(memory => memory.stable_id === state.selectedMemoryId)) {
    state.selectedMemoryId = data[0]?.stable_id ?? null
  }

  if (previousSelectedMemoryId !== state.selectedMemoryId) {
    resetGeneratedMemoryCommand()
    closeDeleteMemoryConfirm()
  }

  if (state.memoryContextMenu.open && !availableIds.has(state.memoryContextMenu.memoryId)) {
    closeMemoryContextMenu()
  }
  if (state.memoryRename.open && !availableIds.has(state.memoryRename.memoryId)) {
    closeMemoryRenameDialog()
  }

  if (state.activeEditorEntry.kind === 'memory' && !state.selectedMemoryId) {
    clearActiveEditorEntry()
    closeCreatePathDraft()
    resetEditorSelection()
  }

  if (!state.selectedMemoryId) {
    closeDeleteMemoryConfirm()
  }

  if (state.activeEditorEntry.kind === 'memory' && activeEditorStableId() && showingEditorTree()) {
    await loadTree(activeEditorStableId())
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

async function loadAppVersion() {
  const version = await invoke('app_version_cmd')
  state.appVersion = version ? `v${version}` : ''
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
      enabled: selectedMcpServer()?.enabled ?? true,
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
    enabled: selectedMcpServer()?.enabled ?? true,
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
    state.mcp.checkedServerNames = []
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

function findTreePath(node, target) {
  if (!node) {
    return false
  }
  if (node.path === target) {
    return true
  }
  return (node.children || []).some(child => findTreePath(child, target))
}

function findTreeNode(node, target) {
  if (!node) {
    return null
  }
  if (node.path === target) {
    return node
  }
  for (const child of node.children || []) {
    const found = findTreeNode(child, target)
    if (found) {
      return found
    }
  }
  return null
}

function activeTreeCommandName(prefix) {
  return state.activeEditorEntry.kind === 'memory'
    ? `${prefix}_memory`
    : `${prefix}_skill`
}

function activeTreeReadCommand() {
  return state.activeEditorEntry.kind === 'memory'
    ? 'read_memory_file_cmd'
    : 'read_skill_file_cmd'
}

function activeTreeWriteCommand() {
  return state.activeEditorEntry.kind === 'memory'
    ? 'write_memory_file_cmd'
    : 'write_skill_file_cmd'
}

function activeTreeInspectCommand() {
  return state.activeEditorEntry.kind === 'memory'
    ? 'inspect_memory_tree_cmd'
    : 'inspect_skill_tree_cmd'
}

function activeEntryDefaultPath(stableId) {
  if (state.activeEditorEntry.kind === 'memory') {
    const memory = state.memories.find(entry => entry.stable_id === stableId)
    return memory?.memory_md_path
      ? memory.memory_md_path.split(/[\\/]/).pop()
      : 'MEMORY.md'
  }

  const skill = state.skills.find(entry => entry.stable_id === stableId)
  return skill?.skill_md_path
    ? skill.skill_md_path.split('/').pop()
    : ''
}

function activeEditorEntryPathError() {
  return `请先打开一个 ${activeEditorEntryKindLabel()}`
}

async function refreshTree(stableId = activeEditorStableId()) {
  if (!stableId || !state.activeEditorEntry.kind) {
    return null
  }

  const tree = await invoke(activeTreeInspectCommand(), { stableId })
  state.tree = tree

  if (state.selectedPath && !findTreePath(tree, state.selectedPath)) {
    state.selectedPath = ''
    state.editor = createEditorState()
  }

  syncTree()
  syncEditor()
  return tree
}

async function loadTree(stableId) {
  const tree = await refreshTree(stableId)
  if (!tree || state.selectedPath) {
    return
  }

  const defaultPath = activeEntryDefaultPath(stableId)

  if (defaultPath && findTreePath(tree, defaultPath)) {
    await openFile(defaultPath)
    return
  }

  state.selectedPath = ''
  state.editor = createEditorState()
  syncTree()
  syncEditor()
}

async function openFile(relativePath) {
  if (!activeEditorStableId() || !state.activeEditorEntry.kind) {
    return
  }

  const content = await invoke(activeTreeReadCommand(), {
    req: {
      stable_id: activeEditorStableId(),
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

async function createSkillFromDraft() {
  const draftId = state.createSkill.id.trim()
  if (!draftId) {
    throw new Error('请输入 Skill ID')
  }

  const created = await invoke('create_skill_cmd', {
    req: {
      id: draftId,
      name: null,
      description: null
    }
  })

  const nextTagKey = state.createSkillGroupKey || 'uncategorized'
  if (nextTagKey !== 'uncategorized') {
    await invoke('update_skill_metadata_cmd', {
      req: {
        stable_id: created.stable_id,
        skill_type: null,
        tags: [nextTagKey]
      }
    })
  }

  state.currentPage = 'editor'
  state.editorSidebarMode = 'tree'
  state.editorGroupKey = nextTagKey
  state.selectedSkillId = created.stable_id
  state.activeEditorEntry = { kind: 'skill', stableId: created.stable_id }
  closeCreateSkillDraft()
  closeCreatePathDraft()
  closeWarehouseContextMenu()
  closeSkillInteraction()
  closeSkillContextMenu()
  closeTreeContextMenu()
  resetGeneratedCommand()
  resetEditorSelection()
  await loadSkills()
  syncAll()
  print(`目录 ${created.id} 已创建，文件树已打开。现在可以直接新建 SKILL.md。`, 'success')
}

async function deleteSkill() {
  const targetSkillId = state.skillInteraction.skillId || state.selectedSkillId
  if (!targetSkillId) {
    throw new Error('请先选择一个 skill')
  }

  const skill =
    state.skills.find(entry => entry.stable_id === targetSkillId) || selectedSkill()
  const label = skill?.id || skillLabel(skill)
  const inlineConfirmed =
    state.skillInteraction.mode === 'delete' && state.skillInteraction.skillId === targetSkillId
  if (!inlineConfirmed) {
    const confirmed = window.confirm(`删除整个 skill ${label} ?`)
    if (!confirmed) {
      return
    }
  }

  await invoke('delete_skill_cmd', {
    req: {
      stable_id: targetSkillId
    }
  })

  const nextGroupKey = editorGroupKeyForSkill(skill, state.editorGroupKey)
  closeCreatePathDraft()
  closeWarehouseContextMenu()
  closeSkillInteraction()
  closeSkillContextMenu()
  closeTreeContextMenu()
  state.editorSidebarMode = 'skills'
  state.editorGroupKey = nextGroupKey
  state.selectedSkillId = null
  clearActiveEditorEntry()
  resetEditorSelection()
  resetGeneratedCommand()
  await loadSkills()
  syncAll()
  print(`Skill ${label} 已删除。`, 'success')
}

async function renameSkill() {
  const targetSkillId = state.skillInteraction.skillId || state.selectedSkillId
  if (!targetSkillId) {
    throw new Error('请先选择一个 skill')
  }

  const skill = state.skills.find(entry => entry.stable_id === targetSkillId) || selectedSkill()
  if (!skill) {
    throw new Error('当前 skill 不存在')
  }

  const inlineDraft =
    state.skillInteraction.mode === 'rename' && state.skillInteraction.skillId === targetSkillId
      ? state.skillInteraction.draftId
      : null
  const nextId = inlineDraft ?? window.prompt('输入新的 Skill ID', skill.id)
  if (nextId == null) {
    closeSkillInteraction()
    return
  }
  if (!nextId.trim()) {
    throw new Error('请输入 Skill ID')
  }
  if (nextId.trim() === skill.id) {
    closeSkillInteraction()
    return
  }

  const renamed = await invoke('rename_skill_cmd', {
    req: {
      stable_id: targetSkillId,
      id: nextId.trim()
    }
  })

  closeSkillInteraction()
  closeCreatePathDraft()
  closeSkillContextMenu()
  closeTreeContextMenu()
  resetGeneratedCommand()
  await loadSkills()
  syncAll()
  print(`Skill ${skill.id} 已重命名为 ${renamed.id}。`, 'success')
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
  if (!activeEditorStableId() || !state.editor.path) {
    throw new Error('请选择一个文件')
  }

  await invoke(activeTreeWriteCommand(), {
    req: {
      stable_id: activeEditorStableId(),
      relative_path: state.editor.path,
      content: state.editor.value
    }
  })
  state.editor = nextEditorState(state.editor, { type: 'saved' })
  syncActionUi()
  print({ saved: state.editor.path }, 'success')
}

async function createPathFromDraft() {
  if (state.createPath.action === 'rename') {
    return renamePathFromDraft()
  }
  if (state.createPath.action === 'delete') {
    return deletePathFromDraft()
  }

  const kind = state.createPath.kind
  const relativePath = state.createPath.value.trim().replace(/^\/+/, '')

  if (!relativePath) {
    throw new Error(kind === 'dir' ? '请输入文件夹路径' : '请输入文件路径')
  }

  await createPath(kind, relativePath)
  closeCreatePathDraft()
  syncAll()
}

async function renamePathFromDraft() {
  const fromPath = state.createPath.basePath || state.selectedPath
  const toPath = state.createPath.value.trim().replace(/^\/+/, '')
  const pathKind = state.createPath.kind || 'file'

  if (!fromPath) {
    throw new Error('请先选择一个路径')
  }
  if (!toPath) {
    throw new Error('请输入新的相对路径')
  }

  await renamePath(fromPath, toPath, pathKind)
  closeCreatePathDraft()
  syncAll()
}

async function deletePathFromDraft() {
  const targetPath = state.createPath.basePath || state.selectedPath

  if (!targetPath) {
    throw new Error('请先选择一个路径')
  }

  await deletePath(targetPath)
  closeCreatePathDraft()
  syncAll()
}

async function createPath(kind, relativePath) {
  if (!activeEditorStableId() || !state.activeEditorEntry.kind) {
    throw new Error(activeEditorEntryPathError())
  }

  const nextPath = relativePath.trim().replace(/^\/+/, '')
  if (!nextPath) {
    throw new Error(kind === 'dir' ? '请输入文件夹路径' : '请输入文件路径')
  }

  await invoke(`${activeTreeCommandName('create')}_path_cmd`, {
    req: {
      stable_id: activeEditorStableId(),
      relative_path: nextPath,
      kind
    }
  })

  const shouldOpenCreatedFile =
    kind === 'file' &&
    (
      !state.editor.dirty ||
      state.editor.path === nextPath ||
      confirmDiscardEditorChanges('打开新建文件')
    )

  await refreshTree(activeEditorStableId())
  if (kind === 'file' && shouldOpenCreatedFile) {
    await openFile(nextPath)
  }

  print({ created: nextPath, kind }, 'success')
}

async function renamePath(fromPath, toPath, pathKind = 'file') {
  if (!activeEditorStableId() || !fromPath || !state.activeEditorEntry.kind) {
    throw new Error('请先选择一个路径')
  }
  const nextPath = toPath.trim().replace(/^\/+/, '')
  if (!nextPath || nextPath === fromPath) {
    return
  }

  const nextSelectedPath = state.selectedPath === fromPath
    ? nextPath
    : (
        state.selectedPath.startsWith(`${fromPath}/`)
          ? `${nextPath}${state.selectedPath.slice(fromPath.length)}`
          : ''
      )
  const nextOpenedFilePath = nextSelectedPath && (
    state.selectedPath.startsWith(`${fromPath}/`) || pathKind === 'file'
  )
    ? nextSelectedPath
    : ''

  await invoke(`${activeTreeCommandName('rename')}_path_cmd`, {
    req: {
      stable_id: activeEditorStableId(),
      from: fromPath,
      to: nextPath
    }
  })

  if (!nextSelectedPath) {
    state.selectedPath = ''
    state.editor = createEditorState()
  } else if (!nextOpenedFilePath) {
    state.selectedPath = nextSelectedPath
    state.editor = createEditorState()
  }

  await refreshTree(activeEditorStableId())
  if (nextOpenedFilePath) {
    await openFile(nextOpenedFilePath)
  }

  print({ renamed: nextPath }, 'success')
}

function pathDraftActionName() {
  if (state.createPath.action === 'rename') {
    return 'renamePath'
  }
  if (state.createPath.action === 'delete') {
    return 'deletePath'
  }
  return 'createPath'
}

function submitPathDraft() {
  runAction(pathDraftActionName(), createPathFromDraft, {
    onError: error => {
      state.createPath = nextPathDraftState(state.createPath, {
        type: 'error',
        message: error.message || String(error)
      })
      syncAll()
    }
  })
}

async function deletePath(targetPath) {
  if (!activeEditorStableId() || !targetPath || !state.activeEditorEntry.kind) {
    throw new Error('请先选择一个路径')
  }
  await invoke(`delete_${activeEditorEntryKindLabel()}_path_cmd`, {
    req: {
      stable_id: activeEditorStableId(),
      relative_path: targetPath
    }
  })

  const shouldClearEditor =
    state.selectedPath === targetPath || state.selectedPath.startsWith(`${targetPath}/`)
  if (shouldClearEditor) {
    state.selectedPath = ''
    state.editor = createEditorState()
  }

  await refreshTree(activeEditorStableId())
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

async function completeDroppedSkillImport(imported, conflict = {}) {
  closeDroppedSkillImportConfirm()
  state.currentPage = 'editor'
  state.editorSidebarMode = 'tree'
  state.editorGroupKey = editorGroupKeyForSkill(imported)
  state.selectedSkillId = imported.stable_id
  state.activeEditorEntry = { kind: 'skill', stableId: imported.stable_id }
  closeCreatePathDraft()
  closeWarehouseContextMenu()
  resetGeneratedCommand()
  resetEditorSelection()
  await loadSkills()
  syncAll()
  print(
    conflict.mode === 'confirm-overwrite'
      ? `已覆盖同名 Skill ${conflict.name}，文件树已打开。`
      : `已导入 ${imported.id}，文件树已打开。`,
    'success'
  )
}

async function confirmDroppedSkillImport() {
  const { candidatePath, targetSkillId, name } = state.droppedSkillImportConfirm
  if (!candidatePath || !targetSkillId) {
    closeDroppedSkillImportConfirm()
    syncAll()
    return ACTION_CANCELLED
  }

  const imported = await invoke('import_dropped_skill_cmd', {
    req: {
      path: candidatePath,
      overwrite_stable_id: targetSkillId
    }
  })

  await completeDroppedSkillImport(imported, {
    mode: 'confirm-overwrite',
    name,
    targetSkillId
  })
}

async function importDroppedSkillFromPaths(paths = []) {
  let candidate = ''
  let droppedSkill = null
  let lastPreviewError = null
  for (const path of prioritizeDroppedSkillImportPaths(paths)) {
    try {
      droppedSkill = await invoke('preview_dropped_skill_cmd', {
        req: {
          path
        }
      })
      candidate = path
      break
    } catch (error) {
      lastPreviewError = error
    }
  }
  if (!candidate || !droppedSkill) {
    throw lastPreviewError || new Error('没有检测到可导入的 skill 路径')
  }

  let conflict = resolveDroppedSkillImportCollision(state.skills, droppedSkill)
  switch (conflict.mode) {
    case 'confirm-overwrite': {
      openDroppedSkillImportConfirm(conflict, candidate)
      syncAll()
      return ACTION_CANCELLED
    }
    case 'ambiguous-name':
      throw new Error(`存在多个同名 Skill「${conflict.name}」，请先手动整理后再导入`)
    default:
      break
  }

  let imported
  try {
    imported = await invoke('import_dropped_skill_cmd', {
      req: {
        path: candidate,
        overwrite_stable_id: conflict.targetSkillId || null
      }
    })
  } catch (error) {
    if (!conflict.targetSkillId && isDroppedSkillAlreadyExistsError(error)) {
      await loadSkills()
      conflict = resolveDroppedSkillImportCollision(state.skills, droppedSkill)
      switch (conflict.mode) {
        case 'confirm-overwrite': {
          openDroppedSkillImportConfirm(conflict, candidate)
          syncAll()
          return ACTION_CANCELLED
        }
        case 'ambiguous-name':
          throw new Error(`存在多个同名 Skill「${conflict.name}」，请先手动整理后再导入`)
        default:
          throw error
      }
    } else {
      throw error
    }
  }

  await completeDroppedSkillImport(imported, conflict)
}

function shouldImportDroppedPathsAsMemory(paths = []) {
  return paths.some(path => /(?:^|[\\/])(MEMORY|AGENTS|CLAUDE)\.md$/i.test(path))
}

async function importDroppedMemoryFromPaths(paths = []) {
  const candidate = paths.find(path => /(?:^|[\\/])(MEMORY|AGENTS|CLAUDE)\.md$/i.test(path)) || paths[0]
  if (!candidate) {
    throw new Error('没有检测到可导入的 memory 路径')
  }

  const imported = await invoke('import_dropped_memory_cmd', {
    req: {
      path: candidate
    }
  })

  state.selectedMemoryId = imported.stable_id
  clearActiveEditorEntry()
  closeCreateMemoryDraft()
  closeDeleteMemoryConfirm()
  closeMemoryContextMenu()
  closeCreatePathDraft()
  closeWarehouseContextMenu()
  closeTreeContextMenu()
  resetGeneratedMemoryCommand()
  resetEditorSelection()
  await loadMemories()
  await openSelectedMemoryInEditor()
  print(`已导入 ${imported.id}，内容已在编辑器中打开。`, 'success')
}

async function createMemory() {
  const nextId = state.memoryDraft.id.trim()
  if (!nextId) {
    throw new Error('请输入 Memory ID')
  }

  const created = await invoke('create_memory_cmd', {
    req: {
      id: nextId
    }
  })

  state.memoryDraft = nextMemoryDraftState(state.memoryDraft, { type: 'created' })
  closeDeleteMemoryConfirm()
  closeMemoryContextMenu()
  state.selectedMemoryId = created.stable_id
  resetGeneratedMemoryCommand()
  await loadMemories()
  syncAll()
  print(`Memory ${created.id} 已创建。`, 'success')
}

async function deleteMemory() {
  const memory = selectedMemory()
  if (!memory) {
    throw new Error('请先选择一个 memory')
  }

  await invoke('delete_memory_cmd', {
    req: {
      stable_id: memory.stable_id
    }
  })

  closeMemoryContextMenu()
  closeDeleteMemoryConfirm()
  if (state.activeEditorEntry.kind === 'memory' && activeEditorStableId() === memory.stable_id) {
    clearActiveEditorEntry()
    resetEditorSelection()
  }
  resetGeneratedMemoryCommand()
  await loadMemories()
  syncAll()
  print(`Memory ${memory.id} 已删除。`, 'success')
}

async function renameMemory() {
  const targetMemoryId = state.memoryRename.memoryId || state.memoryContextMenu.memoryId || state.selectedMemoryId
  if (!targetMemoryId) {
    throw new Error('请先选择一个 memory')
  }

  const memory =
    state.memories.find(entry => entry.stable_id === targetMemoryId) || selectedMemory()
  if (!memory) {
    throw new Error('当前 memory 不存在')
  }

  const nextId = state.memoryRename.draftId.trim()
  closeMemoryContextMenu()
  closeTreeContextMenu()

  if (!nextId) {
    throw new Error('请输入 Memory ID')
  }

  if (nextId === memory.id) {
    closeMemoryRenameDialog()
    syncAll()
    return
  }

  const renamed = await invoke('rename_memory_cmd', {
    req: {
      stable_id: targetMemoryId,
      id: nextId
    }
  })

  closeDeleteMemoryConfirm()
  closeMemoryRenameDialog()
  resetGeneratedMemoryCommand()
  await loadMemories()
  if (
    state.activeEditorEntry.kind === 'memory' &&
    activeEditorStableId() === targetMemoryId &&
    showingEditorTree()
  ) {
    await loadTree(activeEditorStableId())
  }
  syncAll()
  print(`Memory ${memory.id} 已重命名为 ${renamed.id}。`, 'success')
}

async function syncSkills() {
  const skillIds = distributionSkillIds()
  if (!skillIds.length) {
    throw new Error('请先选择一个 skill')
  }

  let result = await invoke('sync_global_skills_cmd', {
    req: {
      client: state.client,
      skill_ids: skillIds,
      overwrite_skill_ids: [],
      mode: state.installMode
    }
  })

  if (result.conflicts?.length) {
    const conflictIds = new Set(result.conflicts.map(conflict => conflict.stable_id))
    const overwriteSkillIds = []

    for (const conflict of result.conflicts) {
      const confirmed = window.confirm(`客户端里已存在 Skill ${conflict.id}，是否覆盖？`)
      if (confirmed) {
        overwriteSkillIds.push(conflict.stable_id)
      }
    }

    const nextSkillIds = skillIds.filter(skillId =>
      !conflictIds.has(skillId) || overwriteSkillIds.includes(skillId)
    )
    if (!nextSkillIds.length) {
      print('已取消覆盖，未同步任何 Skill。')
      return ACTION_CANCELLED
    }

    result = await invoke('sync_global_skills_cmd', {
      req: {
        client: state.client,
        skill_ids: nextSkillIds,
        overwrite_skill_ids: overwriteSkillIds,
        mode: state.installMode
      }
    })

    if (result.conflicts?.length) {
      throw new Error('同步时仍检测到冲突，请重新尝试。')
    }
  }

  print(formatSyncSkillsSuccessMessage(result, state.client), 'success')
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
      mode: state.installMode,
      force: state.commandForce
    }
  })
  state.generatedCommand = command
  const commandOutput = document.getElementById('generatedCommand')
  if (commandOutput) {
    commandOutput.value = command
  }
  print(command, 'success')
}

async function generateMemoryCommand() {
  if (!state.selectedMemoryId) {
    throw new Error('请先选择一个 memory')
  }

  const forceToggle = document.getElementById('memoryCommandForceToggle')
  const force = forceToggle ? !!forceToggle.checked : !!state.memoryCommandForce
  state.memoryCommandForce = force

  const command = await invoke('generate_init_memory_command_cmd', {
    req: {
      client: state.memoryClient,
      memory: state.selectedMemoryId,
      force
    }
  })
  state.generatedMemoryCommand = command
  const commandOutput = document.getElementById('generatedMemoryCommand')
  if (commandOutput) {
    commandOutput.value = command
  }
  print(command, 'success')
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const buffer = document.createElement('textarea')
  buffer.value = text
  buffer.setAttribute('readonly', 'true')
  buffer.style.position = 'absolute'
  buffer.style.left = '-9999px'
  document.body.appendChild(buffer)
  buffer.select()
  document.execCommand('copy')
  document.body.removeChild(buffer)
}

async function copyGeneratedCommand() {
  if (!state.generatedCommand) {
    throw new Error('请先生成命令')
  }

  await copyTextToClipboard(state.generatedCommand)
  markCommandCopied()
  return
}

async function copyGeneratedMemoryCommand() {
  if (!state.generatedMemoryCommand) {
    throw new Error('请先生成命令')
  }

  await copyTextToClipboard(state.generatedMemoryCommand)
  markMemoryCommandCopied()
}

async function openSelectedSkillInEditor() {
  if (!state.selectedSkillId) {
    throw new Error('请先选择一个 skill')
  }

  const skill = selectedSkill()
  state.editorGroupKey = editorGroupKeyForSkill(skill, state.editorGroupKey)
  state.activeEditorEntry = { kind: 'skill', stableId: state.selectedSkillId }
  closeCreateMemoryDraft()
  closeDeleteMemoryConfirm()
  closeCreateSkillDraft()
  closeCreatePathDraft()
  closeWarehouseContextMenu()
  closeSkillInteraction()
  closeSkillContextMenu()
  closeTreeContextMenu()
  state.currentPage = 'editor'
  state.editorSidebarMode = 'tree'
  resetEditorSelection()
  syncAll()
  await loadTree(activeEditorStableId())
}

async function openSelectedMemoryInEditor() {
  if (!state.selectedMemoryId) {
    throw new Error('请先选择一个 memory')
  }

  state.activeEditorEntry = { kind: 'memory', stableId: state.selectedMemoryId }
  closeCreateMemoryDraft()
  closeDeleteMemoryConfirm()
  closeMemoryContextMenu()
  closeCreateSkillDraft()
  closeCreatePathDraft()
  closeWarehouseContextMenu()
  closeSkillInteraction()
  closeSkillContextMenu()
  closeTreeContextMenu()
  state.currentPage = 'editor'
  state.editorSidebarMode = 'tree'
  resetEditorSelection()
  syncAll()
  await loadTree(activeEditorStableId())
}

function parentRelativePath(path = '') {
  const segments = path.split('/').filter(Boolean)
  segments.pop()
  return segments.join('/')
}

function dropTargetDirectory(position) {
  if (!position || !showingEditorTree()) {
    return ''
  }

  const scale = window.devicePixelRatio || 1
  const target = document.elementFromPoint(position.x / scale, position.y / scale)
  const treeButton = target?.closest('[data-tree-path]')
  if (!treeButton) {
    return ''
  }

  const treePath = treeButton.dataset.treePath || ''
  return treeButton.dataset.treeKind === 'dir' ? treePath : parentRelativePath(treePath)
}

function looksLikeTextFile(path = '') {
  return /\.(md|txt|json|toml|yaml|yml|js|mjs|cjs|ts|tsx|jsx|css|html|xml|rs|py|sh)$/i.test(path)
}

async function copyDroppedPathsIntoActiveEntry(paths = [], relativeTargetDir = '') {
  if (!activeEditorStableId() || !state.activeEditorEntry.kind) {
    throw new Error(activeEditorEntryPathError())
  }
  if (!paths.length) {
    throw new Error('没有检测到可复制的路径')
  }

  const copied = await invoke(`copy_paths_into_${activeEditorEntryKindLabel()}_cmd`, {
    req: {
      stable_id: activeEditorStableId(),
      relative_target_dir: relativeTargetDir,
      paths
    }
  })

  const tree = await refreshTree(activeEditorStableId())
  const firstCopied = copied[0] || ''
  const copiedNode = firstCopied ? findTreeNode(tree, firstCopied) : null
  if (
    copied.length === 1 &&
    copiedNode?.kind === 'file' &&
    looksLikeTextFile(firstCopied) &&
    (
      !state.editor.dirty ||
      state.editor.path === firstCopied ||
      confirmDiscardEditorChanges('打开拖入的文件')
    )
  ) {
    await openFile(firstCopied)
  }

  print({ copied }, 'success')
}

async function bindDropImport() {
  await getCurrentWindow().onDragDropEvent(event => {
    if (event.payload.type !== 'drop') {
      return
    }

    if (showingEditorTree()) {
      runAction('copyDroppedPaths', () =>
        copyDroppedPathsIntoActiveEntry(
          event.payload.paths,
          dropTargetDirectory(event.payload.position)
        )
      )
      return
    }

    if (state.currentPage === 'skills') {
      runAction('importDroppedSkill', () => importDroppedSkillFromPaths(event.payload.paths))
      return
    }

    if (state.currentPage === 'memory') {
      runAction('importDroppedMemory', () => importDroppedMemoryFromPaths(event.payload.paths))
      return
    }

    if (state.currentPage === 'editor') {
      if (shouldImportDroppedPathsAsMemory(event.payload.paths)) {
        runAction('importDroppedMemory', () => importDroppedMemoryFromPaths(event.payload.paths))
        return
      }

      runAction('importDroppedSkill', () => importDroppedSkillFromPaths(event.payload.paths))
    }
  })
}

function bindEvents() {
  window.addEventListener('click', event => {
    let shouldSync = false

    if (
      state.memoryContextMenu.open &&
      !event.target.closest('[data-role="memory-context-menu"]')
    ) {
      closeMemoryContextMenu()
      shouldSync = true
    }

    if (
      state.skillContextMenu.open &&
      !event.target.closest('[data-role="skill-context-menu"]')
    ) {
      closeSkillContextMenu()
      shouldSync = true
    }

    if (
      state.treeContextMenu.open &&
      !event.target.closest('[data-role="tree-context-menu"]')
    ) {
      closeTreeContextMenu()
      shouldSync = true
    }

    if (
      state.warehouseContextMenu.open &&
      !event.target.closest('[data-role="warehouse-context-menu"]')
    ) {
      closeWarehouseContextMenu()
      shouldSync = true
    }

    if (shouldSync) {
      syncAll()
    }
  })

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
      syncActionUi()
      return
    }

    if (event.target.id === 'createMemoryId') {
      state.memoryDraft = nextMemoryDraftState(state.memoryDraft, {
        type: 'edit',
        field: 'id',
        value: event.target.value
      })
      syncActionUi()
      return
    }

    if (event.target.id === 'memoryRenameInput') {
      state.memoryRename = {
        ...state.memoryRename,
        draftId: event.target.value,
        error: ''
      }
      syncActionUi()
      return
    }

    if (event.target.id === 'createPathValue') {
      state.createPath = nextPathDraftState(state.createPath, {
        type: 'edit',
        value: event.target.value
      })
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

    if (event.target.id === 'skillRenameInput') {
      state.skillInteraction = {
        ...state.skillInteraction,
        draftId: event.target.value
      }
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

    if (event.target.matches('[data-mcp-check]')) {
      toggleCheckedMcpServerName(event.target.dataset.mcpCheck, event.target.checked)
      syncAll()
      return
    }

    if (event.target.id === 'clientSelect') {
      state.client = event.target.value
      resetGeneratedCommand()
      syncAll()
      return
    }

    if (event.target.id === 'memoryClientSelect') {
      state.memoryClient = event.target.value
      resetGeneratedMemoryCommand()
      syncAll()
      return
    }

    if (event.target.id === 'memoryCommandForceToggle') {
      state.memoryCommandForce = event.target.checked
      resetGeneratedMemoryCommand()
      syncAll()
      return
    }

    if (event.target.id === 'modeSelect') {
      state.installMode = event.target.value
      resetGeneratedCommand()
      syncAll()
      return
    }

    if (event.target.id === 'commandForceToggle') {
      state.commandForce = event.target.checked
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

  app.addEventListener('keydown', event => {
    if (event.key === 'Escape' && state.treeContextMenu.open) {
      closeTreeContextMenu()
      syncAll()
      return
    }

    if (event.target.id === 'createSkillId') {
      if (event.key === 'Enter') {
        event.preventDefault()
        runAction('createSkill', createSkillFromDraft, {
          onError: error => {
            state.createSkill = nextSkillDraftState(state.createSkill, {
              type: 'error',
              message: error.message || String(error)
            })
            syncAll()
          }
        })
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        closeCreateSkillDraft()
        syncAll()
      }
      return
    }

    if (event.target.id === 'createMemoryId') {
      if (event.key === 'Enter') {
        event.preventDefault()
        runAction('createMemory', createMemory, {
          onError: error => {
            state.memoryDraft = nextMemoryDraftState(state.memoryDraft, {
              type: 'error',
              message: error.message || String(error)
            })
            syncAll()
          }
        })
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        closeCreateMemoryDraft()
        syncAll()
      }
      return
    }

    if (event.target.id === 'memoryRenameInput') {
      if (event.key === 'Enter') {
        event.preventDefault()
        runAction('renameMemory', renameMemory, {
          onError: error => {
            state.memoryRename = {
              ...state.memoryRename,
              error: error.message || String(error)
            }
            syncAll()
          }
        })
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        closeMemoryRenameDialog()
        syncAll()
      }
      return
    }

    if (event.target.id === 'createPathValue') {
      if (event.key === 'Enter') {
        event.preventDefault()
        submitPathDraft()
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        closeCreatePathDraft()
        syncAll()
      }
      return
    }

    if (event.target.id !== 'skillRenameInput') {
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      runAction('renameSkill', renameSkill)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeSkillInteraction()
      syncAll()
    }
  })

  app.addEventListener('click', event => {
    const inlineAction = event.target.closest('[data-skill-inline-action]')
    if (inlineAction) {
      switch (inlineAction.dataset.skillInlineAction) {
        case 'rename-submit':
          runAction('renameSkill', renameSkill)
          return
        case 'rename-cancel':
        case 'delete-cancel':
          closeSkillInteraction()
          syncAll()
          return
        case 'delete-confirm':
          runAction('deleteSkill', deleteSkill)
          return
        default:
          return
      }
    }

    const createSkillAction = event.target.closest('[data-create-skill-action]')
    if (createSkillAction) {
      switch (createSkillAction.dataset.createSkillAction) {
        case 'submit':
          runAction('createSkill', createSkillFromDraft, {
            onError: error => {
              state.createSkill = nextSkillDraftState(state.createSkill, {
                type: 'error',
                message: error.message || String(error)
              })
              syncAll()
            }
          })
          return
        case 'cancel':
          closeCreateSkillDraft()
          syncAll()
          return
        default:
          return
      }
    }

    const createPathAction = event.target.closest('[data-create-path-action]')
    if (createPathAction) {
      switch (createPathAction.dataset.createPathAction) {
        case 'submit':
          submitPathDraft()
          return
        case 'cancel':
          closeCreatePathDraft()
          syncAll()
          return
        default:
          return
      }
    }

    const createMemoryAction = event.target.closest('[data-create-memory-action]')
    if (createMemoryAction) {
      switch (createMemoryAction.dataset.createMemoryAction) {
        case 'submit':
          runAction('createMemory', createMemory, {
            onError: error => {
              state.memoryDraft = nextMemoryDraftState(state.memoryDraft, {
                type: 'error',
                message: error.message || String(error)
              })
              syncAll()
            }
          })
          return
        case 'cancel':
          closeCreateMemoryDraft()
          syncAll()
          return
        default:
          return
      }
    }

    const deleteMemoryAction = event.target.closest('[data-delete-memory-action]')
    if (deleteMemoryAction) {
      switch (deleteMemoryAction.dataset.deleteMemoryAction) {
        case 'confirm':
          runAction('deleteMemory', deleteMemory)
          return
        case 'cancel':
          closeDeleteMemoryConfirm()
          syncAll()
          return
        default:
          return
      }
    }

    const memoryRenameAction = event.target.closest('[data-memory-rename-action]')
    if (memoryRenameAction) {
      switch (memoryRenameAction.dataset.memoryRenameAction) {
        case 'confirm':
          runAction('renameMemory', renameMemory, {
            onError: error => {
              state.memoryRename = {
                ...state.memoryRename,
                error: error.message || String(error)
              }
              syncAll()
            }
          })
          return
        case 'cancel':
          closeMemoryRenameDialog()
          syncAll()
          return
        default:
          return
      }
    }

    const droppedSkillConfirmAction = event.target.closest('[data-dropped-skill-confirm-action]')
    if (droppedSkillConfirmAction) {
      switch (droppedSkillConfirmAction.dataset.droppedSkillConfirmAction) {
        case 'confirm':
          runAction('importDroppedSkill', confirmDroppedSkillImport)
          return
        case 'cancel':
          closeDroppedSkillImportConfirm()
          syncAll()
          return
        default:
          return
      }
    }

    const treeMenuAction = event.target.closest('[data-tree-menu-action]')
    if (treeMenuAction) {
      const targetPath = state.treeContextMenu.path || ''
      const createBasePath =
        state.treeContextMenu.target === 'dir' ? targetPath : ''

      const actionName = treeMenuAction.dataset.treeMenuAction
      const dirtyConfirmLabel = {
        'rename-skill': '重命名当前 skill',
        'delete-skill': '删除当前 skill',
        'rename-memory': '重命名当前 memory',
        'delete-memory': '删除当前 memory',
        'rename-path': '重命名当前路径',
        'delete-path': '删除当前路径'
      }

      if (
        treeMenuActionNeedsDirtyConfirm(actionName) &&
        !confirmDiscardEditorChanges(dirtyConfirmLabel[actionName])
      ) {
        return
      }

      switch (actionName) {
        case 'create-file':
          openCreatePathDraft('file', createBasePath)
          syncAll()
          return
        case 'create-folder':
          openCreatePathDraft('dir', createBasePath)
          syncAll()
          return
        case 'rename-skill':
          beginSkillRename(state.selectedSkillId)
          syncAll()
          return
        case 'delete-skill':
          beginSkillDelete(state.selectedSkillId)
          syncAll()
          return
        case 'rename-memory':
          openMemoryRenameDialog()
          syncAll()
          return
        case 'delete-memory':
          if (!window.confirm(`删除整个 memory ${memoryLabel(selectedMemory())} ?`)) {
            closeTreeContextMenu()
            syncAll()
            return
          }
          runAction('deleteMemory', deleteMemory)
          return
        case 'rename-path':
          openRenamePathDraft(targetPath, state.treeContextMenu.pathKind || 'file')
          syncAll()
          return
        case 'delete-path':
          openDeletePathDraft(targetPath, state.treeContextMenu.pathKind || 'file')
          syncAll()
          return
        default:
          return
      }
    }

    const skillMenuAction = event.target.closest('[data-skill-menu-action]')
    if (skillMenuAction) {
      const targetSkillId = state.skillContextMenu.skillId || state.selectedSkillId
      switch (skillMenuAction.dataset.skillMenuAction) {
        case 'rename':
          beginSkillRename(targetSkillId)
          syncAll()
          return
        case 'delete':
          if (!confirmDiscardEditorChanges('删除当前 skill')) {
            return
          }
          beginSkillDelete(targetSkillId)
          syncAll()
          return
        default:
          return
      }
    }

    const memoryMenuAction = event.target.closest('[data-memory-menu-action]')
    if (memoryMenuAction) {
      switch (memoryMenuAction.dataset.memoryMenuAction) {
        case 'rename':
          openMemoryRenameDialog()
          syncAll()
          return
        case 'delete':
          openDeleteMemoryConfirm()
          syncAll()
          return
        default:
          return
      }
    }

    const warehouseMenuAction = event.target.closest('[data-warehouse-menu-action]')
    if (warehouseMenuAction) {
      switch (warehouseMenuAction.dataset.warehouseMenuAction) {
        case 'create-skill': {
          const targetTagKey = state.warehouseContextMenu.tagKey ||
            (showingEditorGroupBrowser() ? state.editorGroupKey : '')
          if (!confirmDiscardEditorChanges('创建并打开新的 skill')) {
            return
          }
          closeWarehouseContextMenu()
          openCreateSkillDraft(targetTagKey)
          syncAll()
          return
        }
        default:
          return
        }
    }

    const pageLink = event.target.closest('[data-page-link]')
    if (pageLink) {
      const nextPage = pageLink.dataset.pageLink
      if (state.currentPage === 'editor' && nextPage !== 'editor' && !confirmDiscardEditorChanges('离开编辑器页面')) {
        return
      }
      closeCreateSkillDraft()
      closeCreateMemoryDraft()
      closeDeleteMemoryConfirm()
      closeCreatePathDraft()
      closeWarehouseContextMenu()
      closeSkillContextMenu()
      closeSkillInteraction()
      closeTreeContextMenu()
      if (state.currentPage === 'editor' && nextPage !== 'editor') {
        closeEditorSession()
      }
      state.currentPage = nextPage
      syncAll()
      if (state.currentPage === 'mcp') {
        runAction('loadMcp', loadMcpConfigForCurrentTarget)
      }
      return
    }

    const memoryButton = event.target.closest('[data-memory-id]')
    if (memoryButton) {
      const nextMemoryId = Number(memoryButton.dataset.memoryId)
      if (state.currentPage === 'editor' && !showingEditorTree()) {
        if (
          state.selectedMemoryId !== nextMemoryId &&
          !confirmDiscardEditorChanges('切换到另一个 memory')
        ) {
          return
        }

        state.selectedMemoryId = nextMemoryId
        closeCreateMemoryDraft()
        closeDeleteMemoryConfirm()
        closeMemoryContextMenu()
        closeCreatePathDraft()
        closeWarehouseContextMenu()
        closeSkillContextMenu()
        closeSkillInteraction()
        closeTreeContextMenu()
        state.currentPage = 'editor'
        state.editorSidebarMode = 'tree'
        state.activeEditorEntry = { kind: 'memory', stableId: nextMemoryId }
        resetGeneratedMemoryCommand()
        resetEditorSelection()
        syncAll()
        runAction('loadTree', () => loadTree(activeEditorStableId()))
        return
      }

      if (state.selectedMemoryId === nextMemoryId) {
        return
      }
      state.selectedMemoryId = nextMemoryId
      closeCreateMemoryDraft()
      closeDeleteMemoryConfirm()
      closeMemoryContextMenu()
      resetGeneratedMemoryCommand()
      syncAll()
      return
    }

    const groupToggle = event.target.closest('[data-explorer-group-toggle]')
    if (groupToggle) {
      toggleEditorGroupCollapse(groupToggle.dataset.explorerGroupToggle)
      syncAll()
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
          if (!showingEditorTree() || !activeEditorStableId()) {
            return
          }
          if (!confirmDiscardEditorChanges(`刷新并重新加载当前 ${activeEditorEntryKindLabel()}`)) {
            return
          }
          runAction('refresh', () => refreshTree(activeEditorStableId()))
          return
        case 'saveMetadata':
          runAction('saveMetadata', saveMetadata)
          return
        case 'openEditor':
          runAction('loadTree', openSelectedSkillInEditor)
          return
        case 'openMemoryEditor':
          runAction('loadTree', openSelectedMemoryInEditor)
          return
        case 'createMemory':
          openCreateMemoryDraft()
          syncAll()
          return
        case 'deleteMemory':
          openDeleteMemoryConfirm()
          syncAll()
          return
        case 'openCreateSkill':
          closeWarehouseContextMenu()
          closeSkillContextMenu()
          closeSkillInteraction()
          closeTreeContextMenu()
          openCreateSkillDraft()
          syncAll()
          return
        case 'deleteSkill':
          if (!confirmDiscardEditorChanges('删除当前 skill')) {
            return
          }
          if (showingEditorTree()) {
            runAction('deleteSkill', deleteSkill)
            return
          }
          beginSkillDelete(state.selectedSkillId)
          syncAll()
          return
        case 'showTagBrowser':
          if (!confirmDiscardEditorChanges(`切换回 ${editorGroupLabel()}`)) {
            return
          }
          closeCreatePathDraft()
          closeWarehouseContextMenu()
          closeSkillContextMenu()
          closeSkillInteraction()
          closeTreeContextMenu()
          state.editorSidebarMode = 'skills'
          resetEditorSelection()
          syncAll()
          return
        case 'showWarehouseBrowser':
          if (!confirmDiscardEditorChanges(`返回 ${editorReturnPage() === 'memory' ? 'Memory' : 'Skills'}`)) {
            return
          }
          closeCreateSkillDraft()
          closeCreateMemoryDraft()
          closeDeleteMemoryConfirm()
          state.currentPage = editorReturnPage()
          closeEditorSession()
          syncAll()
          return
        case 'saveFile':
          runAction('saveFile', saveFile)
          return
        case 'createFile':
          openCreatePathDraft('file')
          syncAll()
          return
        case 'createFolder':
          openCreatePathDraft('dir')
          syncAll()
          return
        case 'renamePath':
          if (!confirmDiscardEditorChanges('重命名当前路径')) {
            return
          }
          openRenamePathDraft(state.selectedPath)
          syncAll()
          return
        case 'deletePath':
          if (!confirmDiscardEditorChanges('删除当前路径')) {
            return
          }
          openDeletePathDraft(state.selectedPath)
          syncAll()
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
        case 'generateMemoryCommand':
          runAction('generateMemoryCommand', generateMemoryCommand)
          return
        case 'copyMemoryCommand':
          runAction('copyMemoryCommand', copyGeneratedMemoryCommand)
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
        case 'enableSelectedMcpServers':
          setEnabledStateForCheckedMcpServers(true)
          syncAll()
          return
        case 'disableSelectedMcpServers':
          setEnabledStateForCheckedMcpServers(false)
          syncAll()
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
      closeCreateSkillDraft()
      closeCreatePathDraft()
      closeWarehouseContextMenu()
      closeSkillContextMenu()
      closeSkillInteraction()
      closeTreeContextMenu()
      state.selectedSkillId = nextSkillId
      resetGeneratedCommand()
      resetEditorSelection()
      syncAll()
      return
    }

    if (state.selectedSkillId === nextSkillId) {
      const skill = state.skills.find(entry => entry.stable_id === nextSkillId)
      const switchingEntry =
        state.activeEditorEntry.kind !== 'skill' || activeEditorStableId() !== nextSkillId
      state.editorGroupKey = editorGroupKeyForSkill(skill, state.editorGroupKey)
      closeCreateSkillDraft()
      closeCreateMemoryDraft()
      closeDeleteMemoryConfirm()
      closeCreatePathDraft()
      closeWarehouseContextMenu()
      closeSkillContextMenu()
      closeSkillInteraction()
      closeTreeContextMenu()
      state.currentPage = 'editor'
      state.editorSidebarMode = 'tree'
      state.activeEditorEntry = { kind: 'skill', stableId: nextSkillId }
      if (switchingEntry) {
        resetEditorSelection()
      }
      syncAll()
      runAction('loadTree', () => loadTree(activeEditorStableId()))
      return
    }

    if (!confirmDiscardEditorChanges('切换到另一个 skill')) {
      return
    }

    const skill = state.skills.find(entry => entry.stable_id === nextSkillId)
    state.editorGroupKey = editorGroupKeyForSkill(skill, state.editorGroupKey)
    closeCreateSkillDraft()
    closeCreateMemoryDraft()
    closeDeleteMemoryConfirm()
    closeCreatePathDraft()
    closeWarehouseContextMenu()
    closeSkillContextMenu()
    closeSkillInteraction()
    closeTreeContextMenu()
    state.selectedSkillId = nextSkillId
    state.currentPage = 'editor'
    state.editorSidebarMode = 'tree'
    state.activeEditorEntry = { kind: 'skill', stableId: nextSkillId }
    resetGeneratedCommand()
    resetEditorSelection()
    syncAll()
    runAction('loadTree', () => loadTree(activeEditorStableId()))
  })

  app.addEventListener('contextmenu', event => {
    if (showingEditorTree()) {
      const editorExplorer = event.target.closest('[data-role="editor-explorer"]')
      if (!editorExplorer) {
        return
      }
      if (
        event.target.closest('[data-role="tree-context-menu"]') ||
        event.target.closest('[data-role="skill-rename-form"]') ||
        event.target.closest('[data-role="skill-delete-confirm"]')
      ) {
        return
      }

      const treeButton = event.target.closest('[data-tree-path]')
      if (treeButton) {
        const path = treeButton.dataset.treePath
        const pathKind = treeButton.dataset.treeKind
        const title = path.split('/').pop() || path

        event.preventDefault()
        openTreeContextMenu(
          {
            target: pathKind,
            title,
            path,
            pathKind
          },
          event.clientX,
          event.clientY
        )
        syncAll()
        return
      }

      event.preventDefault()
      openTreeContextMenu(
        {
          target: 'root',
          title: activeEditorEntryLabel(),
          entryKind: state.activeEditorEntry.kind || 'skill'
        },
        event.clientX,
        event.clientY
      )
      syncAll()
      return
    }

    if (state.currentPage === 'memory') {
      if (event.target.closest('[data-role="memory-context-menu"]')) {
        return
      }

      const memoryButton = event.target.closest('[data-memory-id]')
      if (!memoryButton) {
        return
      }

      event.preventDefault()
      openMemoryContextMenu(
        Number(memoryButton.dataset.memoryId),
        event.clientX,
        event.clientY
      )
      syncAll()
      return
    }

    const inEditorWarehouse = state.currentPage === 'editor' && !showingEditorTree()
    const inSkillsPage = state.currentPage === 'skills'
    const browsePane = event.target.closest('[data-pane-role="browse"]')
    if (!inEditorWarehouse && !inSkillsPage) {
      return
    }
    if (inSkillsPage && !browsePane) {
      return
    }

    const skillButton = event.target.closest('[data-skill-id]')
    if (
      skillButton &&
      (
        skillButton.closest('[data-role="editor-explorer"]') ||
        skillButton.closest('[data-role="skill-list"]')
      )
    ) {
      event.preventDefault()
      openSkillContextMenu(
        Number(skillButton.dataset.skillId),
        event.clientX,
        event.clientY
      )
      syncAll()
      return
    }

    if (inSkillsPage && !skillButton) {
      const blockedControl = event.target.closest('input, textarea, select, option, button, label')
      if (blockedControl) {
        return
      }

      event.preventDefault()
      openWarehouseContextMenu(
        {
          title: 'WAREHOUSE',
          tagKey: ''
        },
        event.clientX,
        event.clientY
      )
      syncAll()
      return
    }

    if (!inEditorWarehouse) {
      return
    }

    const groupButton = event.target.closest('[data-explorer-group]')
    const explorerGroupList = event.target.closest('[data-role="explorer-group-list"]')
    const explorerSkillList = event.target.closest('[data-role="explorer-skill-list"]')
    if (!groupButton && !explorerGroupList && !explorerSkillList) {
      return
    }

    event.preventDefault()
    if (groupButton) {
      openWarehouseContextMenu(
        {
          title: editorGroups().find(group => group.key === groupButton.dataset.explorerGroup)?.label || 'WAREHOUSE',
          tagKey: groupButton.dataset.explorerGroup
        },
        event.clientX,
        event.clientY
      )
    } else {
      openWarehouseContextMenu(
        {
          title: showingEditorGroupBrowser() ? editorGroupLabel() : 'WAREHOUSE',
          tagKey: showingEditorGroupBrowser() ? state.editorGroupKey : ''
        },
        event.clientX,
        event.clientY
      )
    }
    syncAll()
  })
}

async function init() {
  renderBase()
  syncAll()
  bindEvents()
  await bindDropImport()

  await runAction('bootstrap', async () => {
    await Promise.all([loadSkills(), loadMemories(), loadEditableSettings(), loadAppVersion()])
    renderBase()
    syncAll()
  })
}

init().catch(error => {
  app.textContent = String(error)
})
