/** Threshold above which audio is streamed via HTTP instead of blob fetch. */
export const STREAM_PLAYBACK_THRESHOLD_SECONDS = 120

export function shouldStreamPlayback(
  mode: 'paragraph' | 'chapter' | 'sequence' | null,
  clipDurationSeconds: number | null | undefined
): boolean {
  if (mode === 'chapter') return true
  if (clipDurationSeconds != null && clipDurationSeconds > STREAM_PLAYBACK_THRESHOLD_SECONDS) {
    return true
  }
  return false
}

/** Fetch server audio into a blob URL — only for short clips. */
export async function toPlayableAudioUrl(
  url: string,
  options?: { signal?: AbortSignal }
): Promise<string> {
  const response = await fetch(url, { signal: options?.signal })
  if (!response.ok) {
    throw new Error(`Audio fetch failed (${response.status})`)
  }
  const buffer = await response.arrayBuffer()
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
}

export function revokePlayableAudioUrl(objectUrl: string | null): void {
  if (objectUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(objectUrl)
  }
}

export function isDirectStreamUrl(src: string | null): boolean {
  return Boolean(src && !src.startsWith('blob:'))
}
