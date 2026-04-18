import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createActionState,
  createAppShellHtml,
  formatOutputPayload,
  nextActionState,
  renderSkillsHtml,
  validateProfileForm,
  validateProjectAction
} from './ui.js'

test('createAppShellHtml includes header, actions, and output regions', () => {
  const html = createAppShellHtml()

  assert.match(html, /agents-manager/)
  assert.match(html, /data-role="status"/)
  assert.match(html, /data-role="skills"/)
  assert.match(html, /data-role="output"/)
})

test('nextActionState marks an action as loading with matching status copy', () => {
  const next = nextActionState(createActionState(), { type: 'start', action: 'apply' })

  assert.equal(next.busy, true)
  assert.equal(next.activeAction, 'apply')
  assert.equal(next.statusTone, 'working')
  assert.match(next.statusText, /正在应用/)
})

test('nextActionState returns success and error tones after completion', () => {
  const working = nextActionState(createActionState(), { type: 'start', action: 'doctor' })
  const success = nextActionState(working, { type: 'success', action: 'doctor' })
  const failure = nextActionState(working, { type: 'error', action: 'doctor' })

  assert.equal(success.busy, false)
  assert.equal(success.statusTone, 'success')
  assert.match(success.statusText, /Doctor 已完成/)

  assert.equal(failure.busy, false)
  assert.equal(failure.statusTone, 'error')
  assert.match(failure.statusText, /Doctor 执行失败/)
})

test('renderSkillsHtml renders selectable skill cards', () => {
  const html = renderSkillsHtml([
    { id: 'skill-a', name: 'Skill A', description: 'First skill' }
  ])

  assert.match(html, /skill-card/)
  assert.match(html, /data-skill/)
  assert.match(html, /value="skill-a"/)
  assert.match(html, /Skill A/)
})

test('formatOutputPayload returns error tone for Error instances', () => {
  const payload = formatOutputPayload(new Error('boom'))

  assert.equal(payload.tone, 'error')
  assert.match(payload.text, /boom/)
})

test('validateProfileForm rejects missing id and skill root', () => {
  assert.deepEqual(validateProfileForm({ id: '', project_skill_root: '' }), [
    'profile id 不能为空',
    'project_skill_root 不能为空'
  ])
})

test('validateProjectAction rejects empty project path', () => {
  assert.deepEqual(validateProjectAction({ project: '' }), ['project 路径不能为空'])
})
