import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function resolveKheruRoot(): string {
  if (process.env.KHERU_ROOT) return resolve(process.env.KHERU_ROOT)

  const cwd = process.cwd()
  const monorepoKheru = resolve(cwd, 'apps/kheru')
  if (existsSync(resolve(monorepoKheru, 'package.json'))) return monorepoKheru

  if (existsSync(resolve(cwd, 'package.json'))) {
    try {
      const pkg = JSON.parse(readFileSync(resolve(cwd, 'package.json'), 'utf8')) as { name?: string }
      if (pkg.name === 'kheru') return cwd
    } catch {
      /* ignore */
    }
  }

  // Unbundled source (tests) — paths.ts lives at src/server/tts/paths.ts
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
}

const KHERU_ROOT = resolveKheruRoot()

export const TARGET_SAMPLE_RATE = 22_050
export const DEFAULT_GAP_SECONDS = 0.4

export const DATA_DIR = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : resolve(KHERU_ROOT, 'data')

export const AUDIO_DIR = resolve(DATA_DIR, 'audio')
export const TEMP_DIR = resolve(DATA_DIR, 'temp')

mkdirSync(AUDIO_DIR, { recursive: true })
mkdirSync(TEMP_DIR, { recursive: true })

export function audioPath(runId: string): string {
  return resolve(AUDIO_DIR, `${runId}.wav`)
}

export function tempClipPath(runId: string, index: number): string {
  return resolve(TEMP_DIR, `${runId}_${String(index).padStart(3, '0')}.wav`)
}
