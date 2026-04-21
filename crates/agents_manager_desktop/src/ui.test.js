import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  createActionState,
  createAppShellHtml,
  createPathDraftState,
  createEditorPageHtml,
  createMemoryPageHtml,
  createMcpPageHtml,
  createEditorState,
  createSkillDraftState,
  createSettingsPageHtml,
  createSkillsPageHtml,
  formatOutputPayload,
  groupSkillsByType,
  groupSkillsByTag,
  isDroppedSkillAlreadyExistsError,
  normalizePageId,
  nextActionState,
  nextEditorState,
  nextPathDraftState,
  nextSkillDraftState,
  prioritizeDroppedSkillImportPaths,
  renderDroppedSkillImportConfirmHtml,
  renderMemoryRenameModalHtml,
  resolveDroppedSkillImportCollision,
  resolveEditorGroupKey,
  renderExplorerGroupListHtml,
  renderExplorerSkillListHtml,
  renderMemoryContextMenuHtml,
  renderSkillGroupsHtml,
  renderSkillContextMenuHtml,
  renderTreeHtml,
  renderTreeContextMenuHtml,
  renderWarehouseContextMenuHtml,
  resolveDistributionSkillIds,
  treeMenuActionNeedsDirtyConfirm,
  renderMigrationSummary
} from './ui.js'

test('createAppShellHtml includes desktop navigation and page shell', () => {
  const html = createAppShellHtml()

  assert.match(html, /data-role="status"/)
  assert.match(html, /class="status-chip"/)
  assert.match(html, /data-role="nav-rail"/)
  assert.match(html, /data-role="product-label"/)
  assert.match(html, /data-page-link="skills"/)
  assert.match(html, /data-page-link="editor"/)
  assert.match(html, /data-page-link="mcp"/)
  assert.doesNotMatch(html, /data-page-link="sync"/)
  assert.doesNotMatch(html, /data-page-link="migration"/)
  assert.match(html, /data-page-link="settings"/)
  assert.match(html, /data-role="page-header"/)
  assert.match(html, /data-role="page-body"/)
  assert.match(html, /data-role="app-modal-root"/)
  assert.doesNotMatch(html, /class="brand-mark"/)
  assert.doesNotMatch(html, /id="selectedSkillSummary"/)
  assert.doesNotMatch(html, /id="pageEyebrow"/)
  assert.doesNotMatch(html, /data-role="output"/)
})

test('createAppShellHtml includes Skills Editor MCP and Settings navigation', () => {
  const html = createAppShellHtml()

  assert.match(html, /data-page-link="skills"/)
  assert.match(html, /data-page-link="editor"/)
  assert.match(html, /data-page-link="memory"/)
  assert.match(html, /data-page-link="mcp"/)
  assert.match(html, /data-page-link="settings"/)
  assert.doesNotMatch(html, /data-page-link="migration"/)
})

test('createAppShellHtml keeps the default shell header copy compact', () => {
  const html = createAppShellHtml()

  assert.match(html, /<h2 id="pageTitle">Skills<\/h2>/)
  assert.match(html, /<p id="pageDescription" hidden><\/p>/)
  assert.doesNotMatch(html, /Warehouse Workspace/)
  assert.doesNotMatch(html, /浏览 warehouse 中的技能/)
})

test('main shell page metadata uses compact titles with empty descriptions', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /skills:\s*\{[\s\S]*title:\s*'Skills'[\s\S]*description:\s*''/)
  assert.match(source, /editor:\s*\{[\s\S]*title:\s*'Editor'[\s\S]*description:\s*''/)
  assert.match(source, /memory:\s*\{[\s\S]*title:\s*'Memory'[\s\S]*description:\s*''/)
  assert.match(source, /mcp:\s*\{[\s\S]*title:\s*'MCP'[\s\S]*description:\s*''/)
  assert.match(source, /settings:\s*\{[\s\S]*title:\s*'Settings'[\s\S]*description:\s*''/)
})

test('main.js wires inline tree path creation instead of prompt-based creation', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /createPath:\s*createPathDraftState\(\)/)
  assert.match(source, /createPathOpen:\s*state\.createPath\.open/)
  assert.match(source, /createPathKind:\s*state\.createPath\.kind/)
  assert.match(source, /createPathValue:\s*state\.createPath\.value/)
  assert.match(source, /createPathError:\s*state\.createPath\.error/)
  assert.match(source, /createPathTargetLabel:\s*state\.createPath\.targetLabel/)
  assert.match(source, /function openCreatePathDraft\(kind,\s*basePath = ''\)/)
  assert.match(source, /state\.createPath = nextPathDraftState\(state\.createPath,\s*\{\s*type:\s*'open'/)
  assert.match(source, /event\.target\.id === 'createPathValue'/)
  assert.match(source, /data-create-path-action/)
  assert.match(source, /case 'create-file':[\s\S]*openCreatePathDraft\('file', createBasePath\)/)
  assert.match(source, /case 'create-folder':[\s\S]*openCreatePathDraft\('dir', createBasePath\)/)
})

test('main.js createPath only creates the requested path and does not prompt for it', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /async function createPath\(kind,\s*relativePath\)/)
  assert.doesNotMatch(source, /window\.prompt\([\s\S]*输入新文件路径/)
  assert.doesNotMatch(source, /window\.prompt\([\s\S]*输入新文件夹路径/)
})

test('main.js wires inline tree path rename instead of prompt-based rename', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /createPathAction:\s*state\.createPath\.action/)
  assert.match(source, /function openRenamePathDraft\(targetPath,\s*pathKind = 'file'\)/)
  assert.match(source, /state\.createPath = nextPathDraftState\(state\.createPath,\s*\{\s*type:\s*'open'[\s\S]*action:\s*'rename'/)
  assert.match(source, /case 'rename-path':[\s\S]*openRenamePathDraft\(targetPath,\s*state\.treeContextMenu\.pathKind \|\| 'file'\)/)
})

test('main.js renamePath only renames between explicit paths and does not prompt for the destination', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /async function renamePath\(fromPath,\s*toPath(?:,\s*pathKind = 'file')?\)/)
  assert.doesNotMatch(source, /window\.prompt\('输入新的相对路径'/)
})

test('main.js wires inline tree path delete instead of confirm-based deletion', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /function openDeletePathDraft\(targetPath,\s*pathKind = 'file'\)/)
  assert.match(source, /state\.createPath = nextPathDraftState\(state\.createPath,\s*\{\s*type:\s*'open'[\s\S]*action:\s*'delete'/)
  assert.match(source, /case 'delete-path':[\s\S]*openDeletePathDraft\(targetPath,\s*state\.treeContextMenu\.pathKind \|\| 'file'\)/)
})

test('main.js deletePath only deletes the explicit target path and does not use confirm', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /async function deletePath\(targetPath\)/)
  assert.doesNotMatch(source, /window\.confirm\(`删除 \$\{targetPath\} \?`\)/)
})

test('normalizePageId keeps supported pages and falls back invalid values to skills', () => {
  assert.equal(normalizePageId('skills'), 'skills')
  assert.equal(normalizePageId('editor'), 'editor')
  assert.equal(normalizePageId('memory'), 'memory')
  assert.equal(normalizePageId('mcp'), 'mcp')
  assert.equal(normalizePageId('settings'), 'settings')
  assert.equal(normalizePageId('migration'), 'skills')
  assert.equal(normalizePageId(''), 'skills')
})

test('createMemoryPageHtml renders memory list, client selector, and generate command action', () => {
  const html = createMemoryPageHtml({
    memories: [{ stable_id: 7, id: 'team-default' }],
    selectedMemoryId: 7,
    client: 'claude',
    command: '',
    selectedMemory: { stable_id: 7, id: 'team-default' }
  })

  assert.match(html, /data-role="memory-list"/)
  assert.match(html, /data-role="memory-metadata-panel"/)
  assert.match(html, /data-role="memory-client"/)
  assert.match(html, /data-role="memory-generate-command"/)
  assert.match(html, /data-role="memory-selected-context"/)
  assert.match(html, /data-role="memory-create"/)
  assert.match(html, /data-role="memory-delete"/)
  assert.match(html, /data-role="memory-open-editor"/)
  assert.match(html, /Stable ID/)
  assert.match(html, /team-default/)
})

test('createMemoryPageHtml renders inline memory create and delete controls', () => {
  const html = createMemoryPageHtml({
    memories: [{ stable_id: 7, id: 'team-default' }],
    selectedMemoryId: 7,
    selectedMemory: { stable_id: 7, id: 'team-default' },
    createOpen: true,
    createId: 'team-next',
    createError: 'bad id',
    deleteOpen: true
  })

  assert.match(html, /data-role="memory-create-form"/)
  assert.match(html, /id="createMemoryId"/)
  assert.match(html, /team-next/)
  assert.match(html, /bad id/)
  assert.match(html, /data-role="memory-delete-confirm"/)
})

test('createMemoryPageHtml keeps the memory context menu out of the sidebar layout', () => {
  const html = createMemoryPageHtml({
    memories: [{ stable_id: 7, id: 'team-default' }],
    selectedMemoryId: 7,
    selectedMemory: { stable_id: 7, id: 'team-default' },
    memoryContextMenu: {
      open: true,
      x: 120,
      y: 80,
      memory: { stable_id: 7, id: 'team-default' }
    }
  })

  assert.doesNotMatch(html, /data-role="memory-context-menu"/)
})

test('main.js wires memory command generation through the Tauri bridge', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /generate_init_memory_command_cmd/)
})

test('main.js tracks an active editor entry kind and stable id', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /activeEditorEntry:\s*\{\s*kind:\s*null,\s*stableId:\s*null\s*\}/)
})

test('main.js can load a memory tree through the shared editor flow', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /function openSelectedMemoryInEditor\(/)
  assert.match(source, /activeEditorEntry\.kind === 'memory'/)
})

test('main.js routes list-page drops to skill or memory import based on current page', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /state\.currentPage === 'skills'/)
  assert.match(source, /state\.currentPage === 'memory'/)
  assert.match(source, /importDroppedMemoryFromPaths/)
})

test('main.js routes editor-root memory file drops through memory import', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /state\.currentPage === 'editor'/)
  assert.match(source, /function shouldImportDroppedPathsAsMemory\(/)
  assert.match(
    source,
    /state\.currentPage === 'editor'[\s\S]{0,400}?shouldImportDroppedPathsAsMemory\(event\.payload\.paths\)[\s\S]{0,400}?importDroppedMemoryFromPaths\(event\.payload\.paths\)/
  )
})

test('main.js opens imported memory directly in the editor tree', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(
    source,
    /async function importDroppedMemoryFromPaths\([\s\S]{0,1800}?state\.selectedMemoryId = imported\.stable_id[\s\S]{0,800}?openSelectedMemoryInEditor\(\)/
  )
})

test('main.js routes tree-page drops through the active editor entry', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /copyDroppedPathsIntoActiveEntry/)
})

test('main.js wires memory create and delete through the Tauri bridge', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /create_memory_cmd/)
  assert.match(source, /delete_memory_cmd/)
})

test('main.js wires memory rename through an in-app modal and memory context menus', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /rename_memory_cmd/)
  assert.match(source, /renderMemoryContextMenuHtml\(\{\s*\.\.\.state\.memoryContextMenu,\s*memory:\s*memoryContextMenuMemory\(\)\s*\}\)/)
  assert.match(source, /function openMemoryRenameDialog\(/)
  assert.match(source, /data-memory-menu-action/)
  assert.match(source, /renderMemoryRenameModalHtml\(state\.memoryRename\)/)
  assert.match(source, /event\.target\.id === 'memoryRenameInput'/)
  assert.match(source, /const memoryRenameAction = event\.target\.closest\('\[data-memory-rename-action\]'\)/)
  assert.match(source, /case 'rename-memory':[\s\S]*openMemoryRenameDialog\(/)
  assert.match(source, /case 'rename':[\s\S]*openMemoryRenameDialog\(/)
  assert.match(source, /case 'delete-memory':[\s\S]*runAction\('deleteMemory', deleteMemory\)/)
  assert.match(source, /case 'delete':[\s\S]*openDeleteMemoryConfirm\(\)/)
  assert.doesNotMatch(source, /window\.prompt\('输入新的 Memory ID'/)
})

test('main.js renders skill creation state and warehouse menu on the skills page', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /createOpen:\s*state\.createSkill\.open/)
  assert.match(source, /createId:\s*state\.createSkill\.id/)
  assert.match(source, /createError:\s*state\.createSkill\.error/)
  assert.match(source, /createTargetLabel:\s*state\.createSkillTargetLabel/)
  assert.match(source, /warehouseContextMenu:\s*state\.warehouseContextMenu/)
})

test('main.js opens inline skill creation from the skills page button', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /case 'openCreateSkill':[\s\S]*openCreateSkillDraft\(\)/)
})

test('main.js opens the warehouse context menu from blank space on the skills page', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /const browsePane = event\.target\.closest\('\[data-pane-role="browse"\]'\)/)
  assert.match(source, /if \(inSkillsPage && !browsePane\) \{\s*return\s*\}/)
  assert.match(source, /if \(inSkillsPage && !skillButton\) \{[\s\S]*openWarehouseContextMenu\(/)
})

test('main.js previews dropped skills and confirms overwrite for a single same-name match', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /invoke\('preview_dropped_skill_cmd'/)
  assert.match(source, /for \(const path of prioritizeDroppedSkillImportPaths\(paths\)\)/)
  assert.match(source, /resolveDroppedSkillImportCollision\(state\.skills,\s*droppedSkill\)/)
  assert.match(source, /case 'confirm-overwrite':[\s\S]*openDroppedSkillImportConfirm\(conflict,\s*candidate\)/)
  assert.match(source, /overwrite_stable_id:\s*conflict\.targetSkillId/)
})

test('main.js rejects dropped skills when the same name matches multiple warehouse skills', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /case 'ambiguous-name':[\s\S]*throw new Error\(/)
})

test('main.js retries dropped skill import as overwrite after reloading skills when the backend reports an existing directory', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /catch \(error\) \{[\s\S]*isDroppedSkillAlreadyExistsError\(error\)/)
  assert.match(source, /catch \(error\) \{[\s\S]*await loadSkills\(\)/)
  assert.match(source, /catch \(error\) \{[\s\S]*resolveDroppedSkillImportCollision\(state\.skills,\s*droppedSkill\)/)
  assert.match(source, /catch \(error\) \{[\s\S]*openDroppedSkillImportConfirm\(conflict,\s*candidate\)/)
})

test('main.js uses inline memory creation for create flow', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /memoryDraft:/)
  assert.match(source, /createOpen:\s*state\.memoryDraft\.open/)
  assert.match(source, /createId:\s*state\.memoryDraft\.id/)
  assert.match(source, /createError:\s*state\.memoryDraft\.error/)
  assert.match(source, /function openCreateMemoryDraft\(/)
  assert.match(source, /event\.target\.id === 'createMemoryId'/)
  assert.match(source, /data-create-memory-action/)
  assert.match(source, /case 'createMemory':[\s\S]*openCreateMemoryDraft\(\)/)
})

test('main.js uses inline memory deletion confirmation on the memory page', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /memoryDeleteConfirmOpen:/)
  assert.match(source, /deleteOpen:\s*state\.memoryDeleteConfirmOpen/)
  assert.match(source, /function openDeleteMemoryConfirm\(/)
  assert.match(source, /data-delete-memory-action/)
  assert.match(source, /case 'deleteMemory':[\s\S]*openDeleteMemoryConfirm\(\)/)
})

test('main.js keeps command copy feedback local instead of re-rendering the whole page', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(
    source,
    /function syncCommandCopyUi\(\) \{[\s\S]*?copyCommandButton\.dataset\.copyState = state\.copyFeedback[\s\S]*?copyMemoryCommandButton\.dataset\.copyState = state\.memoryCopyFeedback[\s\S]*?\n\}/
  )
  assert.match(
    source,
    /function markCommandCopied\(\) \{[\s\S]*?state\.copyFeedback = 'copied'[\s\S]*?syncCommandCopyUi\(\)[\s\S]*?state\.copyFeedback = 'idle'[\s\S]*?syncCommandCopyUi\(\)[\s\S]*?\n\}/
  )
  assert.match(
    source,
    /function markMemoryCommandCopied\(\) \{[\s\S]*?state\.memoryCopyFeedback = 'copied'[\s\S]*?syncCommandCopyUi\(\)[\s\S]*?state\.memoryCopyFeedback = 'idle'[\s\S]*?syncCommandCopyUi\(\)[\s\S]*?\n\}/
  )
})

test('main.js command copy handlers do not call syncAll after copying', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(
    source,
    /async function copyGeneratedCommand\(\) \{[\s\S]*?await copyTextToClipboard\(state\.generatedCommand\)[\s\S]*?markCommandCopied\(\)[\s\S]*?return[\s\S]*?\n\}/
  )
  assert.match(
    source,
    /async function copyGeneratedMemoryCommand\(\) \{[\s\S]*?await copyTextToClipboard\(state\.generatedMemoryCommand\)[\s\S]*?markMemoryCommandCopied\(\)[\s\S]*?\n\}/
  )
})

test('nextActionState marks an action as loading with matching status copy', () => {
  const next = nextActionState(createActionState(), { type: 'start', action: 'sync' })

  assert.equal(next.busy, true)
  assert.equal(next.activeAction, 'sync')
  assert.equal(next.statusTone, 'working')
  assert.match(next.statusText, /同步/)
})

test('treeMenuActionNeedsDirtyConfirm requires confirmation for destructive tree actions', () => {
  assert.equal(treeMenuActionNeedsDirtyConfirm('rename-skill'), true)
  assert.equal(treeMenuActionNeedsDirtyConfirm('delete-skill'), true)
  assert.equal(treeMenuActionNeedsDirtyConfirm('rename-path'), true)
  assert.equal(treeMenuActionNeedsDirtyConfirm('delete-path'), true)
  assert.equal(treeMenuActionNeedsDirtyConfirm('create-file'), false)
  assert.equal(treeMenuActionNeedsDirtyConfirm('create-folder'), false)
})

test('resolveEditorGroupKey preserves the current folder when the skill belongs to it', () => {
  const skill = {
    stable_id: 7,
    id: 'alpha',
    name: 'Alpha',
    tags: ['tooling', 'docs']
  }

  assert.equal(resolveEditorGroupKey(skill, 'tooling'), 'tooling')
  assert.equal(resolveEditorGroupKey(skill, 'docs'), 'docs')
})

test('resolveEditorGroupKey falls back to a stable tag when the current folder is unrelated', () => {
  const taggedSkill = {
    stable_id: 7,
    id: 'alpha',
    name: 'Alpha',
    tags: ['tooling', 'docs']
  }
  const uncategorizedSkill = {
    stable_id: 8,
    id: 'beta',
    name: 'Beta',
    tags: []
  }

  assert.equal(resolveEditorGroupKey(taggedSkill, 'ops'), 'docs')
  assert.equal(resolveEditorGroupKey(uncategorizedSkill, 'tooling'), 'uncategorized')
  assert.equal(resolveEditorGroupKey(uncategorizedSkill, 'uncategorized'), 'uncategorized')
})

test('groupSkillsByType groups entries under their registry type', () => {
  const groups = groupSkillsByType([
    { stable_id: 1, id: 'a', skill_type: 'workflow', tags: [] },
    { stable_id: 2, id: 'b', skill_type: 'tooling', tags: [] },
    { stable_id: 3, id: 'c', skill_type: 'workflow', tags: [] }
  ])

  assert.equal(groups.length, 2)
  assert.equal(groups[0].label, 'TOOLING')
  assert.equal(groups[1].label, 'WORKFLOW')
  assert.equal(groups[1].items.length, 2)
})

test('groupSkillsByType merges mixed-case type values into one stable group', () => {
  const groups = groupSkillsByType([
    { stable_id: 1, id: 'a', name: 'Alpha', skill_type: 'WORK', tags: [] },
    { stable_id: 2, id: 'b', name: 'Beta', skill_type: ' work ', tags: [] },
    { stable_id: 3, id: 'c', name: 'Gamma', skill_type: 'Work', tags: [] },
    { stable_id: 4, id: 'd', name: 'Delta', skill_type: '', tags: [] }
  ])

  assert.equal(groups.length, 2)
  assert.equal(groups[0].label, 'UNCATEGORIZED')
  assert.equal(groups[0].items.length, 1)
  assert.equal(groups[1].label, 'WORK')
  assert.equal(groups[1].items.length, 3)
  assert.deepEqual(
    groups[1].items.map(skill => skill.name),
    ['Alpha', 'Beta', 'Gamma']
  )
})

test('resolveDroppedSkillImportCollision skips overwrite handling when the dropped skill has no matching name or id', () => {
  const resolution = resolveDroppedSkillImportCollision(
    [{ stable_id: 1, id: 'alpha', name: 'Shared Name' }],
    { id: 'incoming', name: '' }
  )

  assert.deepEqual(resolution, { mode: 'import' })
})

test('resolveDroppedSkillImportCollision requests overwrite when exactly one skill has the same name ignoring case', () => {
  const resolution = resolveDroppedSkillImportCollision(
    [
      { stable_id: 1, id: 'alpha', name: 'Shared Name' },
      { stable_id: 2, id: 'beta', name: 'Other Name' }
    ],
    { id: 'incoming', name: ' shared name ' }
  )

  assert.deepEqual(resolution, {
    mode: 'confirm-overwrite',
    targetSkillId: 1,
    name: 'Shared Name'
  })
})

test('resolveDroppedSkillImportCollision requests overwrite when the dropped skill id matches ignoring case and names are missing', () => {
  const resolution = resolveDroppedSkillImportCollision(
    [
      { stable_id: 1, id: 'mock-common-usage', name: '' },
      { stable_id: 2, id: 'beta', name: 'Other Name' }
    ],
    { id: ' MOCK-COMMON-USAGE ', name: '' }
  )

  assert.deepEqual(resolution, {
    mode: 'confirm-overwrite',
    targetSkillId: 1,
    name: 'mock-common-usage'
  })
})

test('resolveDroppedSkillImportCollision rejects ambiguous same-name matches ignoring case', () => {
  const resolution = resolveDroppedSkillImportCollision(
    [
      { stable_id: 1, id: 'alpha', name: 'Shared Name' },
      { stable_id: 2, id: 'beta', name: 'shared name' }
    ],
    { id: 'incoming', name: 'SHARED NAME' }
  )

  assert.deepEqual(resolution, {
    mode: 'ambiguous-name',
    name: 'Shared Name',
    targetSkillIds: [1, 2]
  })
})

test('isDroppedSkillAlreadyExistsError recognizes common duplicate-directory errors from import', () => {
  assert.equal(isDroppedSkillAlreadyExistsError(new Error('File exists (os error 17)')), true)
  assert.equal(isDroppedSkillAlreadyExistsError('skill already exists'), true)
  assert.equal(isDroppedSkillAlreadyExistsError(new Error('permission denied')), false)
})

test('prioritizeDroppedSkillImportPaths prefers the dropped skill root before nested files', () => {
  const ordered = prioritizeDroppedSkillImportPaths([
    '/tmp/mock-common-usage/references',
    '/tmp/mock-common-usage/SKILL.md',
    '/tmp/mock-common-usage'
  ])

  assert.deepEqual(ordered, [
    '/tmp/mock-common-usage',
    '/tmp/mock-common-usage/SKILL.md',
    '/tmp/mock-common-usage/references'
  ])
})

test('renderDroppedSkillImportConfirmHtml renders an in-app overwrite confirmation modal', () => {
  const html = renderDroppedSkillImportConfirmHtml({
    open: true,
    name: 'mock-common-usage'
  })

  assert.match(html, /data-role="dropped-skill-import-confirm"/)
  assert.match(html, /mock-common-usage/)
  assert.match(html, /data-dropped-skill-confirm-action="confirm"/)
  assert.match(html, /data-dropped-skill-confirm-action="cancel"/)
})

test('renderMemoryRenameModalHtml renders an in-app rename modal for memory ids', () => {
  const html = renderMemoryRenameModalHtml({
    open: true,
    draftId: 'itp_api_wrapper',
    error: 'duplicate memory id'
  })

  assert.match(html, /data-role="memory-rename-modal"/)
  assert.match(html, /id="memoryRenameInput"/)
  assert.match(html, /value="itp_api_wrapper"/)
  assert.match(html, /duplicate memory id/)
  assert.match(html, /data-memory-rename-action="confirm"/)
  assert.match(html, /data-memory-rename-action="cancel"/)
})

test('createSkillsPageHtml includes search, tag filter, and grouped result list', () => {
  const html = createSkillsPageHtml({
    skills: [{ stable_id: 1, id: 'demo', name: 'Demo', skill_type: 'workflow', tags: ['rust'] }],
    selectedSkill: {
      stable_id: 1,
      id: 'demo',
      name: 'Demo',
      skill_type: 'workflow',
      tags: ['rust']
    },
    checkedSkillIds: [1],
    distributionSummary: '已勾选 1 个 skill',
    client: 'codex',
    mode: 'symlink',
    command: 'codex init-project --skill demo',
    copyLabel: '已复制',
    copyState: 'copied',
    query: '',
    tag: ''
  })

  assert.match(html, /data-role="skills-workspace"/)
  assert.match(html, /data-pane-role="browse"/)
  assert.match(html, /data-pane-role="details"/)
  assert.match(html, /data-role="skills-search"/)
  assert.match(html, /data-role="skills-tag-filter"/)
  assert.match(html, /data-role="skill-list"/)
  assert.match(html, /data-role="skills-metadata-panel"/)
  assert.match(html, /data-role="open-editor"/)
  assert.match(html, /id="skillStableId">1</)
  assert.match(html, /data-role="sync-client"/)
  assert.match(html, /data-role="sync-command"/)
  assert.match(html, /data-skill-check="1"/)
  assert.match(html, /已勾选 1 个 skill/)
  assert.match(html, /id="copyCommand"/)
  assert.match(html, /data-copy-state="copied"/)
  assert.match(html, />已复制</)
  assert.match(html, /同步到客户端/)
  assert.doesNotMatch(html, /#1/)
})

test('createSkillsPageHtml uses a compact warehouse heading in the browse pane', () => {
  const html = createSkillsPageHtml()

  assert.match(html, /<h2>Warehouse<\/h2>/)
  assert.match(html, /id="openCreateSkill"/)
  assert.match(html, /data-role="open-create-skill"/)
  assert.match(html, />新建 Skill</)
  assert.doesNotMatch(html, /<h2>Warehouse Skills<\/h2>/)
})

test('createSkillsPageHtml renders compact import actions for warehouse management', () => {
  const html = createSkillsPageHtml({
    skills: [],
    importExpanded: true,
    gitImportUrl: 'https://github.com/org/repo.git'
  })

  assert.match(html, /data-role="skills-import-trigger"/)
  assert.match(html, /data-role="skills-import-panel"/)
  assert.match(html, /导入旧 Skills/)
  assert.match(html, /导入仓库中的 Skills/)
  assert.match(html, /id="gitRepoUrl"/)
})

test('createSkillsPageHtml can render inline skill creation and warehouse context menu', () => {
  const html = createSkillsPageHtml({
    skills: [],
    createOpen: true,
    createId: 'alpha',
    createError: 'duplicate',
    createTargetLabel: 'WAREHOUSE',
    warehouseContextMenu: {
      open: true,
      title: 'WAREHOUSE'
    }
  })

  assert.match(html, /data-role="create-skill-form"/)
  assert.match(html, /id="createSkillId"/)
  assert.match(html, /alpha/)
  assert.match(html, /duplicate/)
  assert.match(html, /data-role="warehouse-context-menu"/)
})

test('resolveDistributionSkillIds prefers checked skills and falls back to current selection', () => {
  assert.deepEqual(resolveDistributionSkillIds([], 3), [3])
  assert.deepEqual(resolveDistributionSkillIds([2, 5, 2], 3), [2, 5])
  assert.deepEqual(resolveDistributionSkillIds([], null), [])
})

test('createEditorPageHtml keeps the editor shell focused when no entry is open', () => {
  const html = createEditorPageHtml({
    selectedSkillName: 'alpha',
    browserMode: 'roots'
  })

  assert.match(html, /class="editor-workspace editor-workspace--solo"/)
  assert.match(html, /data-role="editor-workbench"/)
  assert.match(html, /data-role="editor-toolbar"/)
  assert.match(html, /文本编辑器/)
  assert.doesNotMatch(html, /data-role="editor-explorer"/)
  assert.doesNotMatch(html, /data-role="editor-root-browser"/)
  assert.doesNotMatch(html, /data-role="editor-root-skills"/)
  assert.doesNotMatch(html, /data-role="editor-root-memories"/)
  assert.doesNotMatch(html, /data-role="explorer-group-list"/)
  assert.doesNotMatch(html, /data-role="editor-memory-list"/)
  assert.doesNotMatch(html, /data-role="skill-tree"/)
  assert.doesNotMatch(html, /data-role="create-skill-form"/)
  assert.doesNotMatch(html, /data-role="create-skill-entry"/)
  assert.doesNotMatch(html, /data-role="metadata-panel"/)
  assert.doesNotMatch(html, /panel-kicker">Editor/)
})

test('createEditorPageHtml renders workbench shell with no args', () => {
  const html = createEditorPageHtml()

  assert.match(html, /class="editor-workspace editor-workspace--solo"/)
  assert.match(html, /data-role="editor-workbench"/)
  assert.doesNotMatch(html, /data-role="editor-explorer"/)
  assert.doesNotMatch(html, /data-role="metadata-panel"/)
  assert.doesNotMatch(html, /data-role="skill-tree"/)
  assert.doesNotMatch(html, /data-role="create-skill-form"/)
  assert.doesNotMatch(html, /data-role="create-skill-entry"/)
})

test('createEditorPageHtml ignores warehouse browser state once the editor is simplified', () => {
  const html = createEditorPageHtml({
    browserMode: 'skills',
    selectedTagName: 'tooling',
    createOpen: true,
    createId: 'alpha',
    createError: 'duplicate',
    createTargetLabel: 'tooling'
  })

  assert.match(html, /class="editor-workspace editor-workspace--solo"/)
  assert.doesNotMatch(html, /data-role="editor-explorer"/)
  assert.doesNotMatch(html, /data-role="skill-context-menu"/)
  assert.doesNotMatch(html, /data-role="create-skill-form"/)
  assert.doesNotMatch(html, /data-role="explorer-skill-list"/)
})

test('createEditorPageHtml shows the file tree only in tree mode', () => {
  const html = createEditorPageHtml({
    selectedSkillName: 'alpha',
    selectedTagName: 'tooling',
    browserMode: 'tree',
    explorerBackLabel: 'Skills'
  })

  assert.match(html, /data-role="skill-tree"/)
  assert.match(html, /class="tree-view tree-view--explorer"/)
  assert.match(html, /id="showWarehouseBrowser"/)
  assert.match(html, /data-role="explorer-back"/)
  assert.match(html, /class="explorer-back explorer-back--prominent"/)
  assert.match(html, /返回 Skills/)
  assert.match(html, /<h2>alpha<\/h2>/)
  assert.doesNotMatch(html, /Explorer/)
  assert.doesNotMatch(html, /id="createFile"/)
  assert.doesNotMatch(html, /id="createFolder"/)
  assert.doesNotMatch(html, /id="renamePath"/)
  assert.doesNotMatch(html, /id="deletePath"/)
  assert.doesNotMatch(html, /id="deleteSkill"/)
  assert.doesNotMatch(html, /data-role="create-skill-entry"/)
  assert.doesNotMatch(html, /data-role="explorer-skill-list"/)
})

test('createEditorPageHtml renders inline create path controls in tree mode', () => {
  const html = createEditorPageHtml({
    selectedSkillName: 'alpha',
    browserMode: 'tree',
    createPathOpen: true,
    createPathKind: 'file',
    createPathValue: 'docs/new-file.md',
    createPathTargetLabel: 'docs',
    createPathError: 'duplicate path'
  })

  assert.match(html, /data-role="create-path-form"/)
  assert.match(html, /id="createPathValue"/)
  assert.match(html, /value="docs\/new-file\.md"/)
  assert.match(html, /新建文件/)
  assert.match(html, /docs/)
  assert.match(html, /duplicate path/)
  assert.match(html, /data-create-path-action="submit"/)
  assert.match(html, /data-create-path-action="cancel"/)
})

test('createEditorPageHtml renders inline rename path controls in tree mode', () => {
  const html = createEditorPageHtml({
    selectedSkillName: 'alpha',
    browserMode: 'tree',
    createPathOpen: true,
    createPathAction: 'rename',
    createPathKind: 'file',
    createPathValue: 'docs/SKILL.md',
    createPathTargetLabel: 'SKILL.md'
  })

  assert.match(html, /data-role="create-path-form"/)
  assert.match(html, /重命名/)
  assert.match(html, />重命名</)
  assert.doesNotMatch(html, /新建文件/)
})

test('createEditorPageHtml renders inline delete path controls in tree mode', () => {
  const html = createEditorPageHtml({
    selectedSkillName: 'alpha',
    browserMode: 'tree',
    createPathOpen: true,
    createPathAction: 'delete',
    createPathKind: 'file',
    createPathTargetLabel: 'SKILL.md'
  })

  assert.match(html, /data-role="create-path-form"/)
  assert.match(html, /删除/)
  assert.match(html, /SKILL\.md/)
  assert.match(html, /data-create-path-action="submit"/)
  assert.doesNotMatch(html, /id="createPathValue"/)
  assert.doesNotMatch(html, /新建文件/)
})

test('main.js returns from editor tree to the originating page and closes the editor session', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

  assert.match(source, /function editorReturnPage\(\)/)
  assert.match(source, /case 'showWarehouseBrowser':[\s\S]*state\.currentPage = editorReturnPage\(\)/)
  assert.match(source, /case 'showWarehouseBrowser':[\s\S]*closeEditorSession\(\)/)
})

test('renderTreeHtml uses a plain empty workspace hint instead of a card', () => {
  const html = renderTreeHtml({
    kind: 'dir',
    path: '',
    name: '',
    children: []
  })

  assert.equal(html, '')
})

test('styles keep the shell rail and header compact', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

  assert.match(css, /\.app-shell\s*\{[^}]*width:\s*100%;/)
  assert.doesNotMatch(css, /\.app-shell\s*\{[^}]*width:\s*calc\(100vw - 16px\);/)
  assert.match(css, /\.app-shell\s*\{[\s\S]*margin:\s*0;/)
  assert.doesNotMatch(css, /\.app-shell\s*\{[\s\S]*margin:\s*0 auto;/)
  assert.match(css, /\.app-shell\s*\{[\s\S]*grid-template-columns:\s*104px minmax\(0, 1fr\);/)
  assert.match(css, /\.nav-rail\s*\{[\s\S]*border:\s*0;/)
  assert.match(css, /\.nav-rail\s*\{[\s\S]*border-right:\s*1px solid rgba\(74, 57, 36, 0\.12\);/)
  assert.match(css, /\.nav-rail\s*\{[\s\S]*border-radius:\s*0;/)
  assert.match(css, /\.nav-rail\s*\{[\s\S]*box-shadow:\s*none;/)
  assert.match(css, /\.page-header\s*\{[\s\S]*margin-bottom:\s*10px;/)
  assert.match(css, /\.page-header\s*\{[\s\S]*padding-bottom:\s*8px;/)
  assert.match(css, /\.page-header\s*\{[\s\S]*border-bottom:\s*1px solid rgba\(74, 57, 36, 0\.1\);/)
  assert.match(css, /\.page-copy h2\s*\{[\s\S]*font-size:\s*clamp\(1\.3rem, 2vw, 1\.65rem\);/)
})

test('styles render the skills page as a continuous split workspace', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

  assert.match(css, /\.page-grid--skills\s*\{[\s\S]*gap:\s*0;/)
  assert.match(css, /\.page-grid--skills\s*\{[\s\S]*min-height:\s*100%;/)
  assert.match(css, /\.page-grid--skills\s*\{[\s\S]*border:\s*1px solid rgba\(74, 57, 36, 0\.12\);/)
  assert.match(css, /\.page-grid--skills\s*\{[\s\S]*border-radius:\s*20px;/)
  assert.match(css, /\.page-grid--skills\s*\{[\s\S]*overflow:\s*hidden;/)
  assert.match(css, /\.page-grid--skills\s*\{[\s\S]*background:\s*var\(--workbench-bg\);/)
  assert.match(css, /\.page-body > \.page-grid--skills\s*\{[\s\S]*flex:\s*1;/)
  assert.match(css, /\.page-body > \.page-grid--skills\s*\{[\s\S]*min-height:\s*0;/)
  assert.match(css, /\.page-grid--skills > \.panel\s*\{[\s\S]*border:\s*0;/)
  assert.match(css, /\.page-grid--skills > \.panel\s*\{[\s\S]*border-radius:\s*0;/)
  assert.match(css, /\.page-grid--skills > \.panel\s*\{[\s\S]*box-shadow:\s*none;/)
  assert.match(css, /\.page-grid--skills > \.panel\s*\{[\s\S]*background:\s*transparent;/)
  assert.match(css, /\.page-grid--skills > \[data-pane-role="details"\]\s*\{[\s\S]*border-left:\s*1px solid rgba\(74, 57, 36, 0\.12\);/)
})

test('styles keep memory panels from capturing fixed-position context menus', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

  assert.match(css, /\.page-grid--memory > \[data-role="memory-sidebar"\]\s*\{[\s\S]*backdrop-filter:\s*none;/)
  assert.match(css, /\.page-grid--memory > \[data-role="memory-metadata-panel"\]\s*\{[\s\S]*backdrop-filter:\s*none;/)
})

test('styles keep the memory sidebar stacked without stretching delete confirmation cards', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

  assert.match(css, /\.memory-sidebar\s*\{[\s\S]*display:\s*flex;/)
  assert.match(css, /\.memory-sidebar\s*\{[\s\S]*flex-direction:\s*column;/)
  assert.match(css, /\.memory-list\s*\{[\s\S]*flex:\s*1;/)
})

test('groupSkillsByTag creates warehouse folders from tags and uncategorized skills', () => {
  const groups = groupSkillsByTag([
    {
      stable_id: 1,
      id: 'alpha',
      name: 'Alpha',
      tags: ['tooling', 'docs']
    },
    {
      stable_id: 2,
      id: 'beta',
      name: 'Beta',
      tags: []
    }
  ])

  assert.equal(groups.length, 3)
  assert.equal(groups[0].key, 'docs')
  assert.equal(groups[0].items[0].stable_id, 1)
  assert.equal(groups[1].key, 'tooling')
  assert.equal(groups[1].items[0].stable_id, 1)
  assert.equal(groups[2].key, 'uncategorized')
  assert.equal(groups[2].items[0].stable_id, 2)
})

test('renderExplorerGroupListHtml renders tag folders expanded with nested skills', () => {
  const html = renderExplorerGroupListHtml([
    {
      key: 'tooling',
      label: 'tooling',
      items: [
        {
          stable_id: 7,
          id: 'alpha',
          name: 'Alpha'
        }
      ]
    }
  ], 7)

  assert.match(html, /data-explorer-group="tooling"/)
  assert.match(html, /data-explorer-group-toggle="tooling"/)
  assert.match(html, /aria-expanded="true"/)
  assert.match(html, /tooling/)
  assert.match(html, /1 个 skill/)
  assert.match(html, /data-role="explorer-group-skill-list"/)
  assert.match(html, /data-skill-id="7"/)
  assert.match(html, /Alpha/)
})

test('renderExplorerGroupListHtml hides nested skills when a group is collapsed', () => {
  const html = renderExplorerGroupListHtml([
    {
      key: 'tooling',
      label: 'tooling',
      items: [
        {
          stable_id: 7,
          id: 'alpha',
          name: 'Alpha'
        }
      ]
    }
  ], null, null, ['tooling'])

  assert.match(html, /data-explorer-group-toggle="tooling"/)
  assert.match(html, /aria-expanded="false"/)
  assert.match(html, /data-role="explorer-group-skill-list"/)
  assert.match(html, /hidden/)
  assert.doesNotMatch(html, /data-skill-id="7"/)
})

test('renderExplorerSkillListHtml shows compact rows without descriptions or action buttons', () => {
  const html = renderExplorerSkillListHtml([
    {
      stable_id: 7,
      id: 'alpha',
      name: 'Alpha',
      description: 'This is the description',
      skill_type: 'workflow',
      tags: []
    }
  ], 7)

  assert.match(html, /data-skill-id="7"/)
  assert.match(html, /Alpha/)
  assert.doesNotMatch(html, /This is the description/)
  assert.doesNotMatch(html, /data-skill-actions="7"/)
})

test('renderExplorerSkillListHtml shows inline rename controls for the active skill', () => {
  const html = renderExplorerSkillListHtml(
    [
      {
        stable_id: 7,
        id: 'alpha',
        name: 'Alpha',
        description: 'This is the description',
        skill_type: 'workflow',
        tags: []
      }
    ],
    7,
    {
      mode: 'rename',
      skillId: 7,
      draftId: 'alpha-renamed'
    }
  )

  assert.match(html, /data-role="skill-rename-form"/)
  assert.match(html, /id="skillRenameInput"/)
  assert.match(html, /value="alpha-renamed"/)
  assert.match(html, /data-skill-inline-action="rename-submit"/)
  assert.match(html, /data-skill-inline-action="rename-cancel"/)
})

test('renderSkillGroupsHtml shows inline delete confirmation for the active skill', () => {
  const html = renderSkillGroupsHtml(
    [
      {
        stable_id: 7,
        id: 'alpha',
        name: 'Alpha',
        description: 'This is the description',
        skill_type: 'workflow',
        tags: []
      }
    ],
    7,
    [],
    {
      mode: 'delete',
      skillId: 7
    }
  )

  assert.match(html, /data-role="skill-delete-confirm"/)
  assert.match(html, /删除 Alpha/)
  assert.match(html, /data-skill-inline-action="delete-confirm"/)
  assert.match(html, /data-skill-inline-action="delete-cancel"/)
})

test('renderSkillContextMenuHtml includes rename and delete actions for a skill', () => {
  const html = renderSkillContextMenuHtml({
    open: true,
    skill: {
      stable_id: 7,
      id: 'alpha',
      name: 'Alpha'
    }
  })

  assert.match(html, /data-role="skill-context-menu"/)
  assert.match(html, /data-skill-menu-action="rename"/)
  assert.match(html, /data-skill-menu-action="delete"/)
  assert.match(html, /Alpha/)
})

test('renderMemoryContextMenuHtml includes rename and delete actions for a memory', () => {
  const html = renderMemoryContextMenuHtml({
    open: true,
    memory: {
      stable_id: 7,
      id: 'team-default'
    }
  })

  assert.match(html, /data-role="memory-context-menu"/)
  assert.match(html, /data-memory-menu-action="rename"/)
  assert.match(html, /data-memory-menu-action="delete"/)
  assert.match(html, /team-default/)
})

test('renderWarehouseContextMenuHtml includes create action for warehouse browser', () => {
  const html = renderWarehouseContextMenuHtml({
    open: true,
    title: 'tooling'
  })

  assert.match(html, /data-role="warehouse-context-menu"/)
  assert.match(html, /data-warehouse-menu-action="create-skill"/)
  assert.match(html, /tooling/)
})

test('renderTreeContextMenuHtml renders root-level explorer actions', () => {
  const html = renderTreeContextMenuHtml({
    open: true,
    title: 'alpha',
    target: 'root',
    entryKind: 'skill'
  })

  assert.match(html, /data-role="tree-context-menu"/)
  assert.match(html, /data-tree-menu-action="create-file"/)
  assert.match(html, /data-tree-menu-action="create-folder"/)
  assert.match(html, /data-tree-menu-action="rename-skill"/)
  assert.match(html, /data-tree-menu-action="delete-skill"/)
})

test('renderTreeContextMenuHtml renders root-level memory actions', () => {
  const html = renderTreeContextMenuHtml({
    open: true,
    title: 'team-default',
    target: 'root',
    entryKind: 'memory'
  })

  assert.match(html, /data-role="tree-context-menu"/)
  assert.match(html, /data-tree-menu-action="create-file"/)
  assert.match(html, /data-tree-menu-action="create-folder"/)
  assert.match(html, /data-tree-menu-action="rename-memory"/)
  assert.match(html, /data-tree-menu-action="delete-memory"/)
  assert.doesNotMatch(html, /data-tree-menu-action="rename-skill"/)
  assert.doesNotMatch(html, /data-tree-menu-action="delete-skill"/)
})

test('renderTreeContextMenuHtml renders file actions without create entries', () => {
  const html = renderTreeContextMenuHtml({
    open: true,
    title: 'SKILL.md',
    target: 'file'
  })

  assert.match(html, /data-tree-menu-action="rename-path"/)
  assert.match(html, /data-tree-menu-action="delete-path"/)
  assert.doesNotMatch(html, /data-tree-menu-action="create-file"/)
  assert.doesNotMatch(html, /data-tree-menu-action="create-folder"/)
})

test('createSettingsPageHtml renders editable app settings only', () => {
  const html = createSettingsPageHtml({
    skillWarehouse: '/tmp/warehouse',
    libraryRoots: ['/tmp/lib-a']
  })

  assert.match(html, /data-role="settings-warehouse"/)
  assert.match(html, /data-role="settings-library-roots"/)
  assert.doesNotMatch(html, /settings-migration/)
  assert.doesNotMatch(html, /settings-git-import/)
})

test('createMcpPageHtml renders agent scope server list and editor surface', () => {
  const html = createMcpPageHtml({
    client: 'claude',
    scope: 'project',
    projectPath: '/tmp/project',
    servers: [
      {
        name: 'better-icons',
        command: 'npx',
        args: ['-y', 'better-icons']
      }
    ],
    selectedServerName: 'better-icons'
  })

  assert.match(html, /data-role="mcp-client-select"/)
  assert.match(html, /data-role="mcp-scope-select"/)
  assert.match(html, /data-role="mcp-target-controls"/)
  assert.match(html, /data-role="mcp-server-list"/)
  assert.match(html, /data-role="mcp-editor"/)
  assert.match(html, /better-icons/)
  assert.doesNotMatch(html, /MCP Target/)
  assert.doesNotMatch(html, /Server Editor/)
})

test('createSettingsPageHtml renders warehouse path and advanced source controls', () => {
  const html = createSettingsPageHtml({
    skillWarehouse: '/tmp/warehouse',
    libraryRoots: ['/tmp/lib-a', '/tmp/lib-b']
  })

  assert.match(html, /选择文件夹/)
  assert.match(html, /恢复默认/)
  assert.match(html, /添加目录/)
})

test('nextEditorState marks buffer dirty after text edit', () => {
  const next = nextEditorState(createEditorState(), { type: 'edit', value: 'changed' })
  assert.equal(next.dirty, true)
  assert.equal(next.value, 'changed')
})

test('nextSkillDraftState preserves draft values across errors and resets after create', () => {
  let next = nextSkillDraftState(createSkillDraftState(), { type: 'open' })
  next = nextSkillDraftState(next, { type: 'edit', field: 'id', value: 'alpha' })
  next = nextSkillDraftState(next, { type: 'edit', field: 'name', value: 'Alpha Skill' })
  next = nextSkillDraftState(next, {
    type: 'edit',
    field: 'description',
    value: 'starter description'
  })
  next = nextSkillDraftState(next, { type: 'error', message: 'duplicate skill id' })

  assert.equal(next.open, true)
  assert.equal(next.id, 'alpha')
  assert.equal(next.name, 'Alpha Skill')
  assert.equal(next.description, 'starter description')
  assert.equal(next.error, 'duplicate skill id')

  next = nextSkillDraftState(next, { type: 'created' })

  assert.deepEqual(next, createSkillDraftState())
})

test('nextPathDraftState preserves draft values across errors and resets after create', () => {
  let next = nextPathDraftState(createPathDraftState(), {
    type: 'open',
    kind: 'dir',
    value: 'docs/',
    basePath: 'docs/',
    targetLabel: 'docs'
  })
  next = nextPathDraftState(next, { type: 'edit', value: 'docs/examples' })
  next = nextPathDraftState(next, { type: 'error', message: 'duplicate path' })

  assert.equal(next.open, true)
  assert.equal(next.kind, 'dir')
  assert.equal(next.value, 'docs/examples')
  assert.equal(next.basePath, 'docs/')
  assert.equal(next.targetLabel, 'docs')
  assert.equal(next.error, 'duplicate path')

  next = nextPathDraftState(next, { type: 'created' })

  assert.deepEqual(next, createPathDraftState())
})

test('renderMigrationSummary renders imported and overwritten counts', () => {
  const html = renderMigrationSummary({
    imported: 2,
    overwritten: 1,
    skipped: 0,
    removed: 3
  })

  assert.match(html, /迁移完成/)
  assert.match(html, /新增 2/)
  assert.match(html, /覆盖 1/)
})

test('formatOutputPayload returns error tone for Error instances', () => {
  const payload = formatOutputPayload(new Error('boom'))

  assert.equal(payload.tone, 'error')
  assert.match(payload.text, /boom/)
})
