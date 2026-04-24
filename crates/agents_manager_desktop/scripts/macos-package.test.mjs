import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { createAppInfoPlist, createComponentPlist } from './macos-package.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const desktopVersion = JSON.parse(
  readFileSync(path.join(scriptDir, '..', 'package.json'), 'utf8'),
).version
const desktopVersionRe = desktopVersion.replaceAll('.', String.raw`\.`)

test('createAppInfoPlist writes the expected bundle metadata for release apps', () => {
  const plist = createAppInfoPlist({ version: desktopVersion })

  assert.match(plist, /<key>CFBundleIdentifier<\/key>\s*<string>com\.gongzhijie\.agentsmanager<\/string>/)
  assert.match(
    plist,
    new RegExp(
      `<key>CFBundleShortVersionString</key>\\s*<string>${desktopVersionRe}</string>`,
    ),
  )
  assert.match(
    plist,
    new RegExp(`<key>CFBundleVersion</key>\\s*<string>${desktopVersionRe}</string>`),
  )
  assert.match(plist, /<key>CFBundleExecutable<\/key>\s*<string>agents_manager_desktop<\/string>/)
  assert.match(plist, /<key>CFBundlePackageType<\/key>\s*<string>APPL<\/string>/)
})

test('createComponentPlist targets /Applications and disables bundle relocation', () => {
  const plist = createComponentPlist()

  assert.match(plist, /<key>RootRelativeBundlePath<\/key>\s*<string>Applications\/agents-manager\.app<\/string>/)
  assert.match(plist, /<key>BundleIsRelocatable<\/key>\s*<false\/>/)
  assert.match(plist, /<key>BundleHasStrictIdentifier<\/key>\s*<true\/>/)
  assert.match(plist, /<key>BundleOverwriteAction<\/key>\s*<string>upgrade<\/string>/)
})
