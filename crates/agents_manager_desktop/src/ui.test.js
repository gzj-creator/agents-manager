import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createActionState,
  createAppShellHtml,
  createEditorState,
  formatOutputPayload,
  groupSkillsByType,
  nextActionState,
  nextEditorState,
  renderMigrationSummary
} from './ui.js'

test('createAppShellHtml includes grouped navigator, editor, metadata, and migration panels', () => {
  const html = createAppShellHtml()

  assert.match(html, /data-role="status"/)
  assert.match(html, /data-role="skill-list"/)
  assert.match(html, /data-role="filter-bar"/)
  assert.match(html, /data-role="skill-tree"/)
  assert.match(html, /data-role="editor"/)
  assert.match(html, /data-role="metadata-panel"/)
  assert.match(html, /data-role="migration-panel"/)
  assert.match(html, /data-role="client-actions"/)
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

test('nextEditorState marks buffer dirty after text edit', () => {
  const next = nextEditorState(createEditorState(), { type: 'edit', value: 'changed' })
  assert.equal(next.dirty, true)
  assert.equal(next.value, 'changed')
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
