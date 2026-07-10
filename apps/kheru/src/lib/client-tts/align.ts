import type { WordTiming } from '@/lib/playback-words'

/** Align client-synthesized audio via server Gentle proxy. Returns null when unavailable. */
export async function alignParagraphAudio(
  blob: Blob,
  transcript: string
): Promise<WordTiming[] | null> {
  const trimmed = transcript.trim()
  if (!trimmed) return null

  const form = new FormData()
  form.append('audio', blob, 'audio.wav')
  form.append('transcript', trimmed)

  try {
    const response = await fetch('/api/align', {
      method: 'POST',
      body: form,
    })

    if (response.status === 503) return null
    if (!response.ok) {
      console.warn('Gentle align failed:', response.status, await response.text())
      return null
    }

    const data = (await response.json()) as { words?: WordTiming[] }
    const words = data.words ?? []
    return words.length > 0 ? words : null
  } catch (err) {
    console.warn('Gentle align request failed:', err)
    return null
  }
}
