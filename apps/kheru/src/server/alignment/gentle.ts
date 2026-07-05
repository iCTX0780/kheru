import { readFileSync } from 'node:fs'
import type { WordTiming } from '@/lib/playback-words'

interface GentleWord {
  word?: string
  alignedWord?: string
  case?: string
  start?: number
  end?: number
}

interface GentleResponse {
  words?: GentleWord[]
}

const GENTLE_TIMEOUT_MS = 120_000

export function gentleUrl(): string | null {
  const url = process.env.GENTLE_URL?.trim()
  return url || null
}

/** Align a WAV clip to its transcript via Gentle. Returns clip-relative word timings. */
export async function alignWithGentle(
  audioPath: string,
  transcript: string,
  baseUrl: string
): Promise<WordTiming[]> {
  const trimmed = transcript.trim()
  if (!trimmed) return []

  const audioBytes = readFileSync(audioPath)
  const form = new FormData()
  form.append('audio', new Blob([audioBytes], { type: 'audio/wav' }), 'audio.wav')
  form.append('transcript', trimmed)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GENTLE_TIMEOUT_MS)

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/transcriptions?async=false`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Gentle HTTP ${response.status}`)
    }

    const data = (await response.json()) as GentleResponse
    return parseGentleWords(data.words ?? [])
  } finally {
    clearTimeout(timeout)
  }
}

export function parseGentleWords(words: GentleWord[]): WordTiming[] {
  const timings: WordTiming[] = []

  for (const entry of words) {
    if (entry.case && entry.case !== 'success') continue
    const start = entry.start
    const end = entry.end
    if (typeof start !== 'number' || typeof end !== 'number' || end <= start) continue

    const word = (entry.alignedWord ?? entry.word ?? '').trim()
    if (!word) continue

    timings.push({ word, start, end })
  }

  return timings
}
