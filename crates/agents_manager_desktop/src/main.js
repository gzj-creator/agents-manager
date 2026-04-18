import './styles.css'
import { invoke } from '@tauri-apps/api/core'
import {
  collectKnownTags,
  createActionState,
  createAppShellHtml,
  createEditorState,
  filterSkills,
  formatOutputPayload,
  nextActionState,
  nextEditorState,
  renderMigrationSummary,
  renderSkillGroupsHtml,
  renderTagOptionsHtml,
  renderTreeHtml
} from './ui.js'

const app = document.getElementById('app')

const state = {
  action: createActionState(),
  skills: [],
  filters: {
    query: '',
    tag: ''
  },
  selectedSkillId: null,
  tree: null,
  selectedPath: '',
  editor: createEditorState(),
  migrationResult: null
}

const ACTION_BUTTON_IDS = [
  'refresh',
  'saveFile',
  'saveMetadata',
  'migrate',
  'syncSkills',
  'generateCommand',
  'createFile',
  'createFolder',
  'renamePath',
  'deletePath'
]

function renderBase() {
  app.innerHTML = createAppShellHtml()
}

function transitionAction(event) {
  state.action = nextActionState(state.action, event)
  syncActionUi()
}

function syncActionUi() {
  const status = document.querySelector('[data-role="status"]')
  const statusText = document.getElementById('statusText')
  status.dataset.tone = state.action.statusTone
  statusText.textContent = state.action.statusText

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
}

function print(payload, tone = 'info') {
  const output = document.getElementById('output')
  const formatted = formatOutputPayload(payload, tone)
  output.dataset.tone = formatted.tone
  output.textContent = formatted.text
}

async function runAction(action, task) {
  transitionAction({ type: 'start', action })
  try {
    const result = await task()
    transitionAction({ type: 'success', action })
    return result
  } catch (error) {
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

function syncNavigator() {
  document.getElementById('skillList').innerHTML = renderSkillGroupsHtml(
    filteredSkills(),
    state.selectedSkillId
  )
  document.getElementById('tagFilter').innerHTML = renderTagOptionsHtml(
    collectKnownTags(state.skills),
    state.filters.tag
  )
}

function syncTree() {
  document.getElementById('skillTree').innerHTML = renderTreeHtml(state.tree, state.selectedPath)
}

function syncEditor() {
  const title = document.getElementById('editorTitle')
  const editor = document.getElementById('editorInput')
  const skill = selectedSkill()

  title.textContent = skill ? `${skill.name || skill.id} · Files` : 'Skill Files'
  editor.value = state.editor.value
  editor.placeholder = state.editor.path ? '' : '选择文本文件后开始编辑'

  document.getElementById('skillStableId').textContent = skill ? `#${skill.stable_id}` : '-'
  document.getElementById('skillType').value = skill?.skill_type || ''
  document.getElementById('skillTags').value = (skill?.tags || []).join(', ')
  document.getElementById('migrationResult').innerHTML = renderMigrationSummary(state.migrationResult)
}

function syncAll() {
  syncActionUi()
  syncNavigator()
  syncTree()
  syncEditor()
}

async function loadSkills() {
  const data = await invoke('list_warehouse_skills_cmd')
  state.skills = data

  if (!state.selectedSkillId && data.length) {
    state.selectedSkillId = data[0].stable_id
  }

  if (state.selectedSkillId && !data.some(skill => skill.stable_id === state.selectedSkillId)) {
    state.selectedSkillId = data[0]?.stable_id ?? null
  }

  syncNavigator()

  if (state.selectedSkillId) {
    await loadTree(state.selectedSkillId)
  } else {
    state.tree = null
    state.selectedPath = ''
    state.editor = createEditorState()
  }
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
  state.migrationResult = result
  await loadSkills()
  syncEditor()
  print(result, 'success')
}

async function syncSkills() {
  if (!state.selectedSkillId) {
    throw new Error('请先选择一个 skill')
  }

  const result = await invoke('sync_global_skills_cmd', {
    req: {
      client: document.getElementById('clientSelect').value,
      skill_ids: [state.selectedSkillId],
      mode: document.getElementById('modeSelect').value
    }
  })
  print(result, 'success')
}

async function generateCommand() {
  if (!state.selectedSkillId) {
    throw new Error('请先选择一个 skill')
  }

  const command = await invoke('generate_init_project_command_cmd', {
    req: {
      client: document.getElementById('clientSelect').value,
      skill_ids: [state.selectedSkillId],
      mode: document.getElementById('modeSelect').value
    }
  })
  document.getElementById('generatedCommand').value = command
  print(command, 'success')
}

function bindEvents() {
  document.getElementById('searchInput').addEventListener('input', event => {
    state.filters.query = event.target.value
    syncNavigator()
  })

  document.getElementById('tagFilter').addEventListener('change', event => {
    state.filters.tag = event.target.value
    syncNavigator()
  })

  document.getElementById('skillList').addEventListener('click', event => {
    const button = event.target.closest('[data-skill-id]')
    if (!button) {
      return
    }
    state.selectedSkillId = Number(button.dataset.skillId)
    runAction('loadTree', () => loadTree(state.selectedSkillId))
  })

  document.getElementById('skillTree').addEventListener('click', event => {
    const button = event.target.closest('[data-tree-path]')
    if (!button) {
      return
    }
    const path = button.dataset.treePath
    const kind = button.dataset.treeKind
    state.selectedPath = path
    syncTree()
    if (kind === 'file') {
      runAction('loadTree', () => openFile(path))
    }
  })

  document.getElementById('editorInput').addEventListener('input', event => {
    state.editor = nextEditorState(state.editor, {
      type: 'edit',
      value: event.target.value
    })
    syncActionUi()
  })

  document.getElementById('refresh').addEventListener('click', () => runAction('refresh', loadSkills))
  document.getElementById('saveMetadata').addEventListener('click', () => runAction('saveMetadata', saveMetadata))
  document.getElementById('saveFile').addEventListener('click', () => runAction('saveFile', saveFile))
  document.getElementById('createFile').addEventListener('click', () => runAction('createPath', () => createPath('file')))
  document.getElementById('createFolder').addEventListener('click', () => runAction('createPath', () => createPath('dir')))
  document.getElementById('renamePath').addEventListener('click', () => runAction('renamePath', renamePath))
  document.getElementById('deletePath').addEventListener('click', () => runAction('deletePath', deletePath))
  document.getElementById('migrate').addEventListener('click', () => runAction('migrate', migrateSkills))
  document.getElementById('syncSkills').addEventListener('click', () => runAction('sync', syncSkills))
  document.getElementById('generateCommand').addEventListener('click', () => runAction('generateCommand', generateCommand))
}

async function init() {
  renderBase()
  syncAll()
  bindEvents()

  await runAction('bootstrap', async () => {
    await loadSkills()
    syncAll()
  })
}

init().catch(error => {
  app.textContent = String(error)
})
