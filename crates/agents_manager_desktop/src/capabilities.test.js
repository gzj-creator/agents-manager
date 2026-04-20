import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('desktop tauri capability grants core default permissions to the main window', () => {
  const raw = readFileSync(
    new URL('../src-tauri/capabilities/default.json', import.meta.url),
    'utf8'
  )
  const capability = JSON.parse(raw)

  assert.equal(capability.identifier, 'main-capability')
  assert.deepEqual(capability.windows, ['main'])
  assert.ok(capability.permissions.includes('core:default'))
})
