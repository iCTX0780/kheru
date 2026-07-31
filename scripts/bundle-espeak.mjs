#!/usr/bin/env node
// Copies the espeak-ng runtime (binary + shared library + data files) from
// the developer's system install into src-tauri/resources/espeak-ng/ so it
// gets bundled inside the packaged app. End users of the built .dmg / .msi /
// .AppImage should not need to install espeak-ng separately.
//
// Sources per platform:
//   macOS (Homebrew Apple Silicon): /opt/homebrew/opt/espeak-ng/
//   macOS (Homebrew Intel):         /usr/local/opt/espeak-ng/
//   Linux (apt):                    /usr/  (bin/espeak-ng, share/espeak-ng-data)
//   Windows:                        %ProgramFiles%\eSpeak NG\
//
// Idempotent: skips files that already exist with matching size. Invoked
// automatically by `pnpm build:tauri` (phase 5).

import { chmodSync, cpSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { platform } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '..', 'src-tauri', 'resources', 'espeak-ng')

function pickSource() {
  const candidates =
    platform() === 'darwin'
      ? ['/opt/homebrew/opt/espeak-ng', '/usr/local/opt/espeak-ng']
      : platform() === 'linux'
        ? ['/usr']
        : []
  for (const c of candidates) {
    if (existsSync(join(c, 'bin', 'espeak-ng'))) return c
  }
  throw new Error(
    `espeak-ng not found. Install it first (macOS: brew install espeak-ng; ` +
      `Linux: apt install espeak-ng). Looked in: ${candidates.join(', ')}`
  )
}

const platformPieces =
  platform() === 'darwin'
    ? [
        { from: 'bin/espeak-ng', to: 'bin/espeak-ng' },
        // Homebrew installs the versioned dylib alongside the unversioned symlink.
        // Copy both; the binary's LC_RPATH points at @loader_path/../lib.
        { from: 'lib/libespeak-ng.1.dylib', to: 'lib/libespeak-ng.1.dylib' },
        { from: 'share/espeak-ng-data', to: 'share/espeak-ng-data', dir: true },
      ]
    : platform() === 'linux'
      ? [
          { from: 'bin/espeak-ng', to: 'bin/espeak-ng' },
          { from: 'lib/x86_64-linux-gnu/libespeak-ng.so.1', to: 'lib/libespeak-ng.so.1' },
          { from: 'share/espeak-ng-data', to: 'share/espeak-ng-data', dir: true },
        ]
      : []

function skipIfMatch(src, dst) {
  if (!existsSync(dst)) return false
  try {
    return statSync(src).size === statSync(dst).size
  } catch {
    return false
  }
}

function main() {
  if (platformPieces.length === 0) {
    process.stderr.write(
      `bundle-espeak.mjs: platform ${platform()} not yet supported — skipping\n`
    )
    return
  }
  const source = pickSource()
  process.stdout.write(`espeak-ng → ${OUT_DIR}\n  from: ${source}\n`)
  mkdirSync(OUT_DIR, { recursive: true })

  for (const piece of platformPieces) {
    const src = join(source, piece.from)
    const dst = join(OUT_DIR, piece.to)
    if (!existsSync(src)) {
      process.stderr.write(`  MISSING: ${src}\n`)
      process.exit(1)
    }
    if (!piece.dir && skipIfMatch(src, dst)) {
      process.stdout.write(`  ok    ${piece.to}\n`)
      continue
    }
    mkdirSync(dirname(dst), { recursive: true })
    cpSync(src, dst, { recursive: true, dereference: true, force: true })
    // Homebrew installs binaries as -r-xr-xr-x (no owner write). Tauri's
    // build script re-stages resources into target/*/resources/ on each
    // build; without owner-write cargo can't overwrite the stale copy and
    // fails with "Permission denied (os error 13)". Add u+w.
    try {
      chmodSync(dst, 0o755)
    } catch {
      /* ignore — dir traversal already handled by cpSync */
    }
    process.stdout.write(`  copy  ${piece.to}\n`)
  }
  process.stdout.write('done\n')
}

main()
