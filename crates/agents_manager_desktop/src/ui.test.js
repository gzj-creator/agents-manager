import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createActionState,
  createAppShellHtml,
  createEditorPageHtml,
  createMcpPageHtml,
  createEditorState,
  createSkillDraftState,
  createSettingsPageHtml,
  createSkillsPageHtml,
  formatOutputPayload,
  groupSkillsByType,
  normalizePageId,
  nextActionState,
  nextEditorState,
  nextSkillDraftState,
  resolveDistributionSkillIds,
  renderMigrationSummary
} from './ui.js'

test('createAppShellHtml includes desktop navigation and page shell', () => {
  const html = createAppShellHtml()

  assert.match(html, /data-role="status"/)
  assert.match(html, /class="status-chip"/)
  assert.match(html, /data-role="nav-rail"/)
  assert.match(html, /data-page-link="skills"/)
  assert.match(html, /data-page-link="editor"/)
  assert.match(html, /data-page-link="mcp"/)
  assert.doesNotMatch(html, /data-page-link="sync"/)
  assert.doesNotMatch(html, /data-page-link="migration"/)
  assert.match(html, /data-page-link="settings"/)
  assert.match(html, /data-role="page-header"/)
  assert.match(html, /data-role="page-body"/)
  assert.doesNotMatch(html, /id="selectedSkillSummary"/)
  assert.doesNotMatch(html, /id="pageEyebrow"/)
  assert.doesNotMatch(html, /data-role="output"/)
})

test('createAppShellHtml includes Skills Editor MCP and Settings navigation', () => {
  const html = createAppShellHtml()

  assert.match(html, /data-page-link="skills"/)
  assert.match(html, /data-page-link="editor"/)
  assert.match(html, /data-page-link="mcp"/)
  assert.match(html, /data-page-link="settings"/)
  assert.doesNotMatch(html, /data-page-link="migration"/)
})

test('normalizePageId keeps supported pages and falls back invalid values to skills', () => {
  assert.equal(normalizePageId('skills'), 'skills')
  assert.equal(normalizePageId('editor'), 'editor')
  assert.equal(normalizePageId('mcp'), 'mcp')
  assert.equal(normalizePageId('settings'), 'settings')
  assert.equal(normalizePageId('migration'), 'skills')
  assert.equal(normalizePageId(''), 'skills')
})

test('nextActionState marks an action as loading with matching status copy', () => {
  const next = nextActionState(createActionState(), { type: 'start', action: 'sync' })

  assert.equal(next.busy, true)
  assert.equal(next.activeAction, 'sync')
  assert.equal(next.statusTone, 'working')
  assert.match(next.statusText, /同步/)
})

test('groupSkillsByType groups entries under their registry type', () => {
  const groups = groupSkillsByType([
    { stable_id: 1, id: 'a', skill_type: 'workflow', tags: [] },
    { stable_id: 2, id: 'b', skill_type: 'tooling', tags: [] },
    { stable_id: 3, id: 'c', skill_type: 'workflow', tags: [] }
  ])

  assert.equal(groups.length, 2)
  assert.equal(groups[0].label, 'tooling')
  assert.equal(groups[1].label, 'workflow')
  assert.equal(groups[1].items.length, 2)
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

test('resolveDistributionSkillIds prefers checked skills and falls back to current selection', () => {
  assert.deepEqual(resolveDistributionSkillIds([], 3), [3])
  assert.deepEqual(resolveDistributionSkillIds([2, 5, 2], 3), [2, 5])
  assert.deepEqual(resolveDistributionSkillIds([], null), [])
})

test('createEditorPageHtml includes explorer, workbench editor, and inspector regions', () => {
  const html = createEditorPageHtml({
    selectedSkillName: 'alpha',
    createOpen: true,
    createError: 'duplicate',
    createId: 'alpha'
  })

  assert.match(html, /data-role="editor-explorer"/)
  assert.match(html, /data-role="create-skill-form"/)
  assert.match(html, /data-role="explorer-skill-list"/)
  assert.match(html, /data-role="editor-workbench"/)
  assert.match(html, /value="alpha"/)
  assert.match(html, /只创建目录/)
  assert.doesNotMatch(html, /createSkillName/)
  assert.doesNotMatch(html, /createSkillDescription/)
  assert.doesNotMatch(html, /data-role="metadata-panel"/)
})

test('createEditorPageHtml renders workbench shell with no args', () => {
  const html = createEditorPageHtml()

  assert.match(html, /data-role="editor-explorer"/)
  assert.match(html, /data-role="create-skill-entry"/)
  assert.match(html, /data-role="editor-workbench"/)
  assert.doesNotMatch(html, /data-role="metadata-panel"/)
  assert.doesNotMatch(html, /data-role="create-skill-form"/)
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
  assert.match(html, /data-role="mcp-server-list"/)
  assert.match(html, /data-role="mcp-editor"/)
  assert.match(html, /better-icons/)
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
