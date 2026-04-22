import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'

const scriptPath = fileURLToPath(import.meta.url)
const scriptDir = path.dirname(scriptPath)
const projectDir = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(projectDir, '..', '..')

const EXECUTABLE_NAME = 'agents_manager_desktop'
const APP_ICON_NAME = 'icon.icns'

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function createAppInfoPlist({
  version,
  bundleIdentifier = 'com.gongzhijie.agentsmanager',
  productName = 'agents-manager',
  executableName = EXECUTABLE_NAME,
  iconName = APP_ICON_NAME,
}) {
  const safeVersion = escapeXml(version)
  const safeBundleIdentifier = escapeXml(bundleIdentifier)
  const safeProductName = escapeXml(productName)
  const safeExecutableName = escapeXml(executableName)
  const safeIconName = escapeXml(iconName)

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>English</string>
  <key>CFBundleDisplayName</key>
  <string>${safeProductName}</string>
  <key>CFBundleExecutable</key>
  <string>${safeExecutableName}</string>
  <key>CFBundleIconFile</key>
  <string>${safeIconName}</string>
  <key>CFBundleIconName</key>
  <string>${safeIconName.replace(/\.icns$/u, '')}</string>
  <key>CFBundleIdentifier</key>
  <string>${safeBundleIdentifier}</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${safeProductName}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${safeVersion}</string>
  <key>CFBundleVersion</key>
  <string>${safeVersion}</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.13</string>
  <key>LSRequiresCarbon</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
`
}

export function createComponentPlist({
  rootRelativeBundlePath = 'Applications/agents-manager.app',
} = {}) {
  const safeBundlePath = escapeXml(rootRelativeBundlePath)

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<array>
  <dict>
    <key>RootRelativeBundlePath</key>
    <string>${safeBundlePath}</string>
    <key>BundleIsRelocatable</key>
    <false/>
    <key>BundleHasStrictIdentifier</key>
    <true/>
    <key>BundleIsVersionChecked</key>
    <true/>
    <key>BundleOverwriteAction</key>
    <string>upgrade</string>
  </dict>
</array>
</plist>
`
}

function run(command, args, { cwd = repoRoot } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  })

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`${command} ${args.join(' ')} failed${details ? `\n${details}` : ''}`)
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

export async function buildMacosPackage() {
  if (process.platform !== 'darwin') {
    throw new Error('macOS packaging is only supported on darwin hosts')
  }

  const packageJson = await readJson(path.join(projectDir, 'package.json'))
  const tauriConfig = await readJson(path.join(projectDir, 'src-tauri', 'tauri.conf.json'))

  const version = packageJson.version
  const productName = tauriConfig.productName
  const bundleIdentifier = tauriConfig.identifier

  const binaryPath = path.join(repoRoot, 'target', 'release', EXECUTABLE_NAME)
  const iconPath = path.join(projectDir, 'src-tauri', 'icons', APP_ICON_NAME)
  const stableOutputDir = path.join(repoRoot, 'target', 'release', 'stable-macos')
  const packagePath = path.join(stableOutputDir, 'agents-manager.pkg')
  const versionedPackagePath = path.join(
    stableOutputDir,
    `agents-manager-v${version}-macos.pkg`,
  )

  run('npm', ['run', 'build'], { cwd: projectDir })
  run('cargo', ['build', '--release', '--manifest-path', 'crates/agents_manager_desktop/src-tauri/Cargo.toml'])

  const stagingDir = await mkdtemp(path.join(os.tmpdir(), 'agents-manager-macos-package-'))

  try {
    const stageRoot = path.join(stagingDir, 'root')
    const appBundlePath = path.join(stageRoot, 'Applications', `${productName}.app`)
    const contentsDir = path.join(appBundlePath, 'Contents')
    const macosDir = path.join(contentsDir, 'MacOS')
    const resourcesDir = path.join(contentsDir, 'Resources')
    const componentPlistPath = path.join(stagingDir, 'component.plist')

    await mkdir(macosDir, { recursive: true })
    await mkdir(resourcesDir, { recursive: true })

    const stagedBinaryPath = path.join(macosDir, EXECUTABLE_NAME)
    await copyFile(binaryPath, stagedBinaryPath)
    await chmod(stagedBinaryPath, 0o755)
    await copyFile(iconPath, path.join(resourcesDir, APP_ICON_NAME))
    await writeFile(
      path.join(contentsDir, 'Info.plist'),
      createAppInfoPlist({ version, bundleIdentifier, productName }),
      'utf8',
    )
    await writeFile(
      componentPlistPath,
      createComponentPlist({
        rootRelativeBundlePath: `Applications/${productName}.app`,
      }),
      'utf8',
    )

    run('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', appBundlePath])

    await mkdir(stableOutputDir, { recursive: true })
    await rm(packagePath, { force: true })
    await rm(versionedPackagePath, { force: true })

    run('/usr/bin/pkgbuild', [
      '--root',
      stageRoot,
      '--install-location',
      '/',
      '--component-plist',
      componentPlistPath,
      '--identifier',
      bundleIdentifier,
      '--version',
      version,
      packagePath,
    ])

    await copyFile(packagePath, versionedPackagePath)

    return {
      packagePath,
      versionedPackagePath,
      version,
    }
  } finally {
    await rm(stagingDir, { recursive: true, force: true })
  }
}

if (path.resolve(process.argv[1] ?? '') === scriptPath) {
  buildMacosPackage()
    .then(({ packagePath, versionedPackagePath, version }) => {
      console.log(`Built macOS pkg ${version}`)
      console.log(packagePath)
      console.log(versionedPackagePath)
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
