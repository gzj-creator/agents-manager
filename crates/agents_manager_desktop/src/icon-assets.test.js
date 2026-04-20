import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const iconSvgUrl = new URL('../src-tauri/icons/agents-manager-mark.svg', import.meta.url)
const iconPngUrl = new URL('../src-tauri/icons/icon.png', import.meta.url)
const icon128Url = new URL('../src-tauri/icons/128x128.png', import.meta.url)

function readPngSize(fileUrl) {
  const data = readFileSync(fileUrl)
  assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20)
  }
}

test('desktop icon keeps a source svg for maintenance', () => {
  assert.equal(existsSync(iconSvgUrl), true)

  const svg = readFileSync(iconSvgUrl, 'utf8')
  assert.match(svg, /<svg\b/)
  assert.match(svg, /warm sparkle icon/i)
  assert.match(svg, /#F8C85A/i)
})

test('desktop icon set includes high-resolution png assets', () => {
  assert.equal(existsSync(icon128Url), true)

  const iconSize = readPngSize(iconPngUrl)
  assert.ok(iconSize.width >= 128)
  assert.ok(iconSize.height >= 128)
})
