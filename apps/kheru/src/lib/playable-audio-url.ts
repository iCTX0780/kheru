/** Fetch server audio into a blob URL for reliable <audio> playback in dev browsers. */
export async function toPlayableAudioUrl(url: string): Promise<string> {
  const response = await fetch(url)
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
