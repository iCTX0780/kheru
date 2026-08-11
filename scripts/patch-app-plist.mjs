#!/usr/bin/env node
// Post-`tauri build` hook. Finds the packaged Kheru.app in target/release/bundle
// and merges CFBundleIconName=Icon into its Info.plist so macOS 26 Tahoe
// picks up the Liquid Glass Assets.car we bundled via scripts/compile-icon.mjs.
//
// No-op if Assets.car isn't present in the built app (Icon Composer output
// wasn't provided) — the .icns fallback keeps working.

import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
// Cargo places `target/` at the workspace root (repo root), not under the
// src-tauri crate. The old path was left over from before the root
// Cargo.toml declared a workspace — patching there silently no-ops.
const BUNDLE_ROOT = join(REPO, 'target/release/bundle/macos')

function findAppBundle() {
  if (!existsSync(BUNDLE_ROOT)) return null
  const apps = readdirSync(BUNDLE_ROOT).filter((e) => e.endsWith('.app'))
  if (apps.length === 0) return null
  // Sort by mtime desc, pick freshest — handles multi-arch or leftover bundles.
  apps.sort((a, b) => statSync(join(BUNDLE_ROOT, b)).mtimeMs - statSync(join(BUNDLE_ROOT, a)).mtimeMs)
  return join(BUNDLE_ROOT, apps[0])
}

const app = findAppBundle()
if (!app) {
  process.stdout.write(`patch-app-plist: no .app in ${BUNDLE_ROOT} — skipping\n`)
  process.exit(0)
}

const assetsCar = join(app, 'Contents/Resources/Assets.car')
if (!existsSync(assetsCar)) {
  process.stdout.write(
    `patch-app-plist: ${assetsCar} not present — nothing to point at, skipping\n`
  )
  process.exit(0)
}

const infoPlist = join(app, 'Contents/Info.plist')
if (!existsSync(infoPlist)) {
  process.stderr.write(`patch-app-plist: ${infoPlist} missing — malformed bundle?\n`)
  process.exit(1)
}

process.stdout.write(`patch-app-plist: setting CFBundleIconName=Icon in ${infoPlist}\n`)
// `Set` fails if the key doesn't exist yet; `Add` fails if it does. Try both.
spawnSync('/usr/libexec/PlistBuddy', ['-c', 'Set :CFBundleIconName Icon', infoPlist], {
  stdio: 'inherit',
})
spawnSync('/usr/libexec/PlistBuddy', ['-c', 'Add :CFBundleIconName string Icon', infoPlist], {
  stdio: 'ignore',
})

// Force LaunchServices to re-register this app so the Dock picks the new icon
// immediately without waiting for the periodic scan.
spawnSync(
  '/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister',
  ['-f', app],
  { stdio: 'ignore' }
)
process.stdout.write('patch-app-plist: done\n')
