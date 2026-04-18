import './styles.css'
import { invoke } from '@tauri-apps/api/core'
import {
  createActionState,
  createAppShellHtml,
  formatOutputPayload,
  formatSkillsCountLabel,
  nextActionState,
  renderSkillsHtml,
  validateProfileForm,
  validateProjectAction
} from './ui.js'

const app = document.getElementById('app')
const ACTION_BUTTON_IDS = ['refresh', 'reloadProfiles', 'pickProject', 'saveProfile', 'apply', 'doctor']
const BUSY_BUTTON_LABELS = {
  refresh: '刷新中…',
  reloadProfiles: '同步中…',
  pickProject: '选择中…',
  saveProfile: '保存中…',
  apply: '应用中…',
  doctor: '执行中…'
}
const state = {
  action: createActionState()
}

function renderBase() {
  app.innerHTML = createAppShellHtml()
}

function syncActionUi() {
  const status = document.querySelector('[data-role="status"]')
  const statusText = document.getElementById('statusText')
  status.dataset.tone = state.action.statusTone
  statusText.textContent = state.action.statusText

  ACTION_BUTTON_IDS.forEach(id => {
    const button = document.getElementById(id)
    if (!button) {
      return
    }

    button.dataset.label ||= button.textContent
    const busy = state.action.busy && state.action.activeAction === id
    button.disabled = state.action.busy
    button.classList.toggle('is-busy', busy)
    button.textContent = busy ? BUSY_BUTTON_LABELS[id] || '处理中…' : button.dataset.label
  })
}

function transitionAction(event) {
  state.action = nextActionState(state.action, event)
  syncActionUi()
}

function selectedSkills() {
  return [...document.querySelectorAll('input[data-skill]:checked')].map(i => i.value)
}

function updateSkillsSummary() {
  document.getElementById('skillsCount').textContent = formatSkillsCountLabel(selectedSkills().length)
}

function print(obj, tone = 'info') {
  const output = document.getElementById('output')
  const payload = formatOutputPayload(obj, tone)
  output.dataset.tone = payload.tone
  output.textContent = payload.text
  output.scrollTop = 0
}

async function runAction(action, task) {
  transitionAction({ type: 'start', action })

  try {
    const result = await task()
    transitionAction({ type: 'success', action })
    if (result !== undefined && result !== null) {
      print(result, 'success')
    }
    return result
  } catch (error) {
    transitionAction({ type: 'error', action })
    print(error, 'error')
    return null
  }
}

function setProfileForm(p) {
  document.getElementById('profileId').value = p?.id || ''
  document.getElementById('profileSkillRoot').value = p?.project_skill_root || ''
  document.getElementById('profileClaudeTarget').value = p?.claude_md_target || 'CLAUDE.md'
  document.getElementById('profileAgentsTarget').value = p?.agents_md_target || 'AGENTS.md'
}

async function loadProfiles() {
  const data = await invoke('list_profiles_cmd')
  const sel = document.getElementById('profile')
  const preferredId = sel.value
  sel.innerHTML = data.map(p => `<option value="${p.id}">${p.id}</option>`).join('')
  const selected = data.find(p => p.id === preferredId) || data[0]
  if (selected) {
    sel.value = selected.id
    setProfileForm(selected)
  }

  sel.onchange = () => {
    const p = data.find(x => x.id === sel.value)
    setProfileForm(p)
  }
}

async function loadSkills() {
  const selected = selectedSkills()
  const data = await invoke('scan_library_cmd')
  const node = document.getElementById('skills')
  node.innerHTML = renderSkillsHtml(data, selected)
  updateSkillsSummary()
}

async function apply() {
  const req = {
    project: document.getElementById('project').value,
    profile: document.getElementById('profile').value,
    skills: selectedSkills(),
    claude_md: document.getElementById('claudeMd').value || null,
    agents_md: document.getElementById('agentsMd').value || null,
    mode: 'symlink'
  }

  const errors = validateProjectAction(req)
  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }

  return invoke('apply_cmd', { req })
}

async function runDoctor() {
  const project = document.getElementById('project').value
  const profile = document.getElementById('profile').value

  const errors = validateProjectAction({ project })
  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }

  return invoke('doctor_cmd', { project, profile })
}

async function pickProject() {
  const path = await invoke('pick_project_dir_cmd')
  if (path) {
    document.getElementById('project').value = path
  }
}

async function saveProfile() {
  const req = {
    id: document.getElementById('profileId').value.trim(),
    project_skill_root: document.getElementById('profileSkillRoot').value.trim(),
    claude_md_target: document.getElementById('profileClaudeTarget').value.trim() || 'CLAUDE.md',
    agents_md_target: document.getElementById('profileAgentsTarget').value.trim() || 'AGENTS.md'
  }

  const errors = validateProfileForm(req)
  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }

  const saved = await invoke('save_profile_cmd', { req })
  await loadProfiles()
  document.getElementById('profile').value = saved.id
  setProfileForm(saved)
  return saved
}

async function init() {
  renderBase()
  syncActionUi()
  updateSkillsSummary()
  await runAction('bootstrap', async () => {
    await loadProfiles()
    await loadSkills()
  })

  document.getElementById('skills').addEventListener('change', event => {
    if (event.target.matches('input[data-skill]')) {
      updateSkillsSummary()
    }
  })
  document.getElementById('refresh').addEventListener('click', () => runAction('refresh', loadSkills))
  document.getElementById('reloadProfiles').addEventListener('click', () => runAction('reloadProfiles', loadProfiles))
  document.getElementById('pickProject').addEventListener('click', () => runAction('pickProject', pickProject))
  document.getElementById('saveProfile').addEventListener('click', () => runAction('saveProfile', saveProfile))
  document.getElementById('apply').addEventListener('click', () => runAction('apply', apply))
  document.getElementById('doctor').addEventListener('click', () => runAction('doctor', runDoctor))
}

init().catch(e => {
  app.textContent = String(e)
})
