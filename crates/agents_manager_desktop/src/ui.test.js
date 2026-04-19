import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createActionState,
  createAppShellHtml,
  createEditorPageHtml,
  createEditorState,
  createSkillDraftState,
  createSettingsPageHtml,
  createSkillsPageHtml,
  formatOutputPayload,
  groupSkillsByType,
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
  assert.doesNotMatch(html, /data-page-link="sync"/)
  assert.doesNotMatch(html, /data-page-link="migration"/)
  assert.match(html, /data-page-link="settings"/)
  assert.match(html, /data-role="page-header"/)
  assert.match(html, /data-role="page-body"/)
  assert.doesNotMatch(html, /id="selectedSkillSummary"/)
  assert.doesNotMatch(html, /id="pageEyebrow"/)
  assert.doesNotMatch(html, /data-role="output"/)
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

test('createSettingsPageHtml renders migration and git import tools', () => {
  const html = createSettingsPageHtml({
    migrationReport: {
      imported: 1,
      overwritten: 0,
      skipped: 0,
      removed: 0
    },
    migrationOutput: {
      tone: 'success',
      text: '{"imported":1}'
    },
    gitImportUrl: 'https://example.com/skills.git',
    gitImportReport: {
      discovered: 3,
      imported: 2,
      skipped: 1,
      conflicts: 0
    },
    gitImportOutput: {
      tone: 'success',
      text: '{"imported":2}'
    }
  })

  assert.match(html, /data-role="settings-migration"/)
  assert.match(html, /data-role="settings-git-import"/)
  assert.match(html, /id="migrate"/)
  assert.match(html, /id="gitRepoUrl"/)
  assert.match(html, /value="https:\/\/example.com\/skills\.git"/)
  assert.match(html, /id="importGitSkills"/)
  assert.match(html, /data-role="migration-output"/)
  assert.match(html, /data-role="git-import-output"/)
  assert.match(html, /data-role="output"/)
  assert.match(html, /<details class="output-disclosure"/)
  assert.doesNotMatch(html, /<details class="output-disclosure" open/)
  assert.match(html, /查看执行结果/)
})

test('createSettingsPageHtml keeps tool outputs hidden until results exist', () => {
  const html = createSettingsPageHtml()

  assert.match(html, /data-role="settings-migration"/)
  assert.match(html, /data-role="settings-git-import"/)
  assert.match(html, /id="gitRepoUrl"/)
  assert.match(html, /id="importGitSkills"/)
  assert.doesNotMatch(html, /data-role="migration-output"/)
  assert.doesNotMatch(html, /data-role="git-import-output"/)
  assert.doesNotMatch(html, /data-role="output"/)
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
