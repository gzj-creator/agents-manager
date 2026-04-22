import test from 'node:test'
import assert from 'node:assert/strict'

import { createAppInfoPlist, createComponentPlist } from './macos-package.mjs'

test('createAppInfoPlist writes the expected bundle metadata for release apps', () => {
  const plist = createAppInfoPlist({ version: '0.2.0' })

  assert.match(plist, /<key>CFBundleIdentifier<\/key>\s*<string>com\.gongzhijie\.agentsmanager<\/string>/)
  assert.match(plist, /<key>CFBundleShortVersionString<\/key>\s*<string>0\.2\.0<\/string>/)
  assert.match(plist, /<key>CFBundleVersion<\/key>\s*<string>0\.2\.0<\/string>/)
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
