const ACTION_COPY = {
  apply: {
    start: '正在应用到项目',
    success: 'Apply 已完成',
    error: 'Apply 执行失败'
  },
  doctor: {
    start: '正在运行 Doctor',
    success: 'Doctor 已完成',
    error: 'Doctor 执行失败'
  },
  refresh: {
    start: '正在刷新技能库',
    success: '技能库已刷新',
    error: '技能库刷新失败'
  },
  reloadProfiles: {
    start: '正在刷新 Profiles',
    success: 'Profiles 已刷新',
    error: 'Profiles 刷新失败'
  },
  saveProfile: {
    start: '正在保存 Profile',
    success: 'Profile 已保存',
    error: 'Profile 保存失败'
  },
  pickProject: {
    start: '正在选择项目目录',
    success: '项目目录已更新',
    error: '项目目录选择失败'
  },
  bootstrap: {
    start: '正在加载界面数据',
    success: '界面已准备就绪',
    error: '界面初始化失败'
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

export function renderSkillsHtml(skills, selectedSkillIds = []) {
  if (!skills.length) {
    return '<div class="skills-empty">未发现可用技能</div>'
  }

  const selected = new Set(selectedSkillIds)

  return skills.map(skill => {
    const id = escapeHtml(skill.id)
    const title = escapeHtml(skill.name || skill.id)
    const description = escapeHtml(skill.description || '暂无描述')
    const checked = selected.has(skill.id) ? ' checked' : ''

    return `
      <label class="skill-card">
        <input class="skill-checkbox" type="checkbox" data-skill value="${id}"${checked} />
        <span class="skill-marker" aria-hidden="true"></span>
        <span class="skill-copy">
          <strong>${title}</strong>
          <small>${description}</small>
        </span>
      </label>
    `
  }).join('')
}

export function formatSkillsCountLabel(count) {
  return count > 0 ? `已选 ${count} 项` : '未选择技能'
}

export function formatOutputPayload(payload, tone = 'info') {
  if (payload instanceof Error) {
    return {
      tone: 'error',
      text: payload.message || String(payload)
    }
  }

  if (typeof payload === 'string') {
    return {
      tone,
      text: payload
    }
  }

  return {
    tone,
    text: JSON.stringify(payload, null, 2)
  }
}

export function validateProfileForm(values) {
  const errors = []

  if (!values.id) {
    errors.push('profile id 不能为空')
  }

  if (!values.project_skill_root) {
    errors.push('project_skill_root 不能为空')
  }

  return errors
}

export function validateProjectAction(values) {
  return values.project ? [] : ['project 路径不能为空']
}

export function createAppShellHtml() {
  return `
    <main class="app-shell">
      <div class="app-backdrop" aria-hidden="true"></div>
      <section class="hero">
        <div>
          <p class="eyebrow">Desktop Workspace</p>
          <h1>agents-manager</h1>
          <p class="hero-copy">管理 Skills / CLAUDE.md / AGENTS.md（GUI + CLI 共用核心）</p>
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
        <div class="column stack">
          <article class="panel">
            <div class="panel-head">
              <div>
                <p class="panel-kicker">Profiles</p>
                <h2>Profile 配置</h2>
              </div>
            </div>

            <label class="field">
              <span>当前 Profile</span>
              <select id="profile"></select>
            </label>

            <div class="field-grid">
              <label class="field">
                <span>Profile ID</span>
                <input id="profileId" placeholder="e.g. claude" />
              </label>
              <label class="field">
                <span>Skill Root</span>
                <input id="profileSkillRoot" placeholder=".claude/skills" />
              </label>
            </div>

            <div class="field-grid">
              <label class="field">
                <span>CLAUDE.md Target</span>
                <input id="profileClaudeTarget" placeholder="CLAUDE.md" />
              </label>
              <label class="field">
                <span>AGENTS.md Target</span>
                <input id="profileAgentsTarget" placeholder="AGENTS.md" />
              </label>
            </div>

            <div class="button-row">
              <button id="saveProfile" class="secondary">保存/更新 Profile</button>
              <button id="reloadProfiles" class="ghost">刷新 Profiles</button>
            </div>
          </article>

          <article class="panel">
            <div class="panel-head">
              <div>
                <p class="panel-kicker">Project</p>
                <h2>项目与来源</h2>
              </div>
            </div>

            <label class="field">
              <span>Project 路径</span>
              <div class="inline-field">
                <input id="project" value="." />
                <button id="pickProject" class="secondary">选择目录</button>
              </div>
            </label>

            <div class="field-grid">
              <label class="field">
                <span>CLAUDE.md 源文件</span>
                <input id="claudeMd" placeholder="/path/to/CLAUDE.md" />
              </label>
              <label class="field">
                <span>AGENTS.md 源文件</span>
                <input id="agentsMd" placeholder="/path/to/AGENTS.md" />
              </label>
            </div>
          </article>
        </div>

        <div class="column stack">
          <article class="panel">
            <div class="panel-head">
              <div>
                <p class="panel-kicker">Skills</p>
                <h2>可用技能</h2>
              </div>
              <span class="selection-pill" id="skillsCount">未选择技能</span>
            </div>

            <div id="skills" class="skills-grid" data-role="skills"></div>

            <div class="button-row">
              <button id="refresh" class="ghost">刷新库</button>
              <button id="apply" class="primary">应用到项目</button>
              <button id="doctor" class="secondary">运行 doctor</button>
            </div>
          </article>

          <article class="panel output-panel">
            <div class="panel-head">
              <div>
                <p class="panel-kicker">Output</p>
                <h2>执行结果</h2>
              </div>
            </div>
            <pre id="output" class="output-console" data-role="output" data-tone="info">等待操作…</pre>
          </article>
        </div>
      </section>
    </main>
  `
}
