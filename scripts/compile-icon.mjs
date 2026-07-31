#!/usr/bin/env node
// Compiles Kheru.icon (produced by Xcode 26's Icon Composer, saved as a
// Multiplatform bundle) into per-platform Assets.car files.
//
// Only the macOS Assets.car is copied to src-tauri/Assets.car for the current
// Tauri build — but iOS, iPadOS, and watchOS variants are also compiled and
// stashed under src-tauri/icons/.compiled/<platform>/Assets.car so a future
// companion app (Apple Watch face, iPhone remote, etc.) has ready-to-ship
// icon assets without needing to reopen Icon Composer.
//
// Requires: Xcode 26 command-line tools (`actool` at /usr/bin/actool).
// Kheru.icon lives in the sibling kheru-docs brand assets repo (single
// source of truth for design work); this script skips silently if it's
// missing so a developer without the docs repo cloned can still build.

import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const ICON_SRC = resolve(REPO, '..', 'kheru-docs', 'brand', 'logos', 'Kheru.icon')
const COMPILED_ROOT = join(REPO, 'src-tauri/icons/.compiled')
// The Tauri build (macOS only for now) reads from here — bundle.resources
// places it at Contents/Resources/Assets.car.
const FINAL_MACOS_ASSETS = join(REPO, 'src-tauri/Assets.car')

// Ordered by likelihood of shipping. macOS first because that's the active
// build target; others are future-proofing so a companion app can grab a
// pre-compiled Assets.car without needing Xcode on the CI runner.
const TARGETS = [
  { name: 'macos', platform: 'macosx', device: 'mac', minVersion: '26.0' },
  { name: 'ios', platform: 'iphoneos', device: 'iphone', minVersion: '26.0' },
  { name: 'ipados', platform: 'iphoneos', device: 'ipad', minVersion: '26.0' },
  { name: 'watchos', platform: 'watchos', device: 'watch', minVersion: '26.0' },
]

if (!existsSync(ICON_SRC)) {
  process.stdout.write(
    `compile-icon: ${ICON_SRC} not found — skipping ` +
      `(design in Icon Composer.app and save to ../kheru-docs/brand/logos/Kheru.icon ` +
      `to enable Tahoe-native icon rendering).\n`
  )
  process.exit(0)
}

function compileFor({ name, platform, device, minVersion }) {
  const outDir = join(COMPILED_ROOT, name)
  mkdirSync(outDir, { recursive: true })
  const partialPlist = join(outDir, 'assetcatalog_generated_info.plist')

  const r = spawnSync(
    '/usr/bin/actool',
    [
      ICON_SRC,
      '--compile',
      outDir,
      '--output-format',
      'human-readable-text',
      '--notices',
      '--warnings',
      '--errors',
      '--output-partial-info-plist',
      partialPlist,
      '--app-icon',
      'Icon',
      '--include-all-app-icons',
      '--enable-on-demand-resources',
      'NO',
      '--development-region',
      'en',
      '--target-device',
      device,
      '--minimum-deployment-target',
      minVersion,
      '--platform',
      platform,
    ],
    { stdio: 'inherit' }
  )

  if (existsSync(partialPlist)) rmSync(partialPlist)

  if (r.status !== 0) {
    // Non-fatal per-platform. If the .icon bundle doesn't contain artwork
    // for this platform, actool errors — we skip and move on so at least
    // the macOS build still succeeds.
    process.stderr.write(`compile-icon: ${name} skipped (actool exit ${r.status})\n`)
    return null
  }
  const car = join(outDir, 'Assets.car')
  if (!existsSync(car)) {
    process.stderr.write(`compile-icon: ${name} produced no Assets.car\n`)
    return null
  }
  return car
}

process.stdout.write(`compile-icon: actool ${ICON_SRC} → ${COMPILED_ROOT}/{macos,ios,ipados,watchos}/Assets.car\n`)

let macosCar = null
for (const target of TARGETS) {
  process.stdout.write(`  → ${target.name} (${target.platform}, min ${target.minVersion})\n`)
  const car = compileFor(target)
  if (target.name === 'macos') macosCar = car
}

if (!macosCar) {
  process.stderr.write(
    `compile-icon: macOS Assets.car wasn't produced — check that Kheru.icon ` +
      `contains a Mac (or Multiplatform) icon named "Icon"\n`
  )
  process.exit(1)
}

copyFileSync(macosCar, FINAL_MACOS_ASSETS)
process.stdout.write(`compile-icon: staged ${FINAL_MACOS_ASSETS} (macos)\n`)
process.stdout.write(`compile-icon: other platforms available under ${COMPILED_ROOT}/\n`)
