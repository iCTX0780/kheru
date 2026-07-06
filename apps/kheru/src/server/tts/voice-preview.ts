import { existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'
import { voicePreviewFilename } from '@/lib/voice-catalog'
import { validateVoice } from '@/server/voices/catalog'
import { synthKokoro } from './kokoro'
import { DATA_DIR, TEMP_DIR } from './paths'

const PREVIEW_TEXT = 'Hello, this is a preview of my voice.'

export const VOICE_SAMPLES_DIR = resolve(DATA_DIR, 'voice-samples')
mkdirSync(VOICE_SAMPLES_DIR, { recursive: true })

export function voicePreviewPath(voiceId: string): string {
  return resolve(VOICE_SAMPLES_DIR, voicePreviewFilename(voiceId))
}

export function voiceIdFromSlug(slug: string): string | null {
  const match = /^([a-z]+)_([a-z0-9_]+)$/.exec(slug)
  if (!match) return null
  return `${match[1]}:${match[2]}`
}

export async function getOrCreateVoicePreview(voiceId: string): Promise<string> {
  const cached = voicePreviewPath(voiceId)
  if (existsSync(cached)) return cached

  const voice = validateVoice(voiceId)
  const tempPath = resolve(TEMP_DIR, `preview-${voicePreviewFilename(voiceId)}`)
  await synthKokoro(PREVIEW_TEXT, voice.voiceKey, tempPath, 1.0)
  renameSync(tempPath, cached)
  return cached
}

export function readVoicePreviewWav(path: string): Buffer {
  return readFileSync(path)
}
