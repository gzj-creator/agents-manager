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

test('macOS package paths use the Tauri-built app bundle as pkg input', async () => {
  const macosPackage = await import('./macos-package.mjs')

  assert.equal(typeof macosPackage.createMacosPackagePaths, 'function')

  const paths = macosPackage.createMacosPackagePaths({
    repoRoot: '/repo',
    stagingDir: '/tmp/stage',
    productName: 'agents-manager',
    version: '0.4.2',
  })

  assert.equal(paths.tauriBundleAppPath, '/repo/target/release/bundle/macos/agents-manager.app')
  assert.equal(paths.stagedAppBundlePath, '/tmp/stage/root/Applications/agents-manager.app')
  assert.equal(paths.cliBinaryPath, '/repo/target/release/agents-manager')
  assert.equal(paths.stagedCliBinaryPath, '/tmp/stage/root/usr/local/bin/agents-manager')
  assert.equal(paths.packagePath, '/repo/target/release/stable-macos/agents-manager.pkg')
  assert.equal(paths.versionedPackagePath, '/repo/target/release/stable-macos/agents-manager-v0.4.2-macos.pkg')
})

test('macOS package paths respect a custom Cargo target directory', async () => {
  const macosPackage = await import('./macos-package.mjs')

  const paths = macosPackage.createMacosPackagePaths({
    repoRoot: '/repo',
    cargoTargetDir: '/custom-target',
    stagingDir: '/tmp/stage',
    productName: 'agents-manager',
    version: '0.4.2',
  })

  assert.equal(paths.tauriBundleAppPath, '/custom-target/release/bundle/macos/agents-manager.app')
  assert.equal(paths.cliBinaryPath, '/custom-target/release/agents-manager')
  assert.equal(paths.packagePath, '/repo/target/release/stable-macos/agents-manager.pkg')
})

test('CLI build command compiles the release agents-manager binary', async () => {
  const macosPackage = await import('./macos-package.mjs')

  assert.equal(typeof macosPackage.createCliBuildCommand, 'function')
  assert.deepEqual(macosPackage.createCliBuildCommand(), {
    command: 'cargo',
    args: ['build', '--release', '--package', 'agents_manager_cli'],
  })
})

test('tauri build environment normalizes CI values for the Tauri CLI', async () => {
  const macosPackage = await import('./macos-package.mjs')

  assert.equal(typeof macosPackage.createTauriBuildEnv, 'function')
  assert.equal(macosPackage.createTauriBuildEnv({ CI: '1' }).CI, 'true')
  assert.equal(macosPackage.createTauriBuildEnv({ CI: '0' }).CI, 'false')
  assert.equal(macosPackage.createTauriBuildEnv({ CI: 'true' }).CI, 'true')
})

test('tauri build command explicitly requests the macOS app bundle', async () => {
  const macosPackage = await import('./macos-package.mjs')

  assert.equal(typeof macosPackage.createTauriBuildCommand, 'function')
  assert.deepEqual(macosPackage.createTauriBuildCommand(), {
    command: 'npm',
    args: ['run', 'tauri:build', '--', '--bundles', 'app'],
  })
})
