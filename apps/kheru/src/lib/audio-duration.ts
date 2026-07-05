export async function getAudioDuration(url: string): Promise<number> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Audio fetch failed (${response.status})`)
  }
  const buffer = await response.arrayBuffer()
  const ctx = new AudioContext()
  try {
    const audioBuffer = await ctx.decodeAudioData(buffer.slice(0))
    return audioBuffer.duration
  } finally {
    await ctx.close()
  }
}

/** Resolve clip duration from server metadata, falling back to client decode. */
export async function resolveClipDuration(
  audioUrl: string,
  serverDuration: number | null
): Promise<number> {
  if (serverDuration != null && serverDuration > 0) return serverDuration
  return getAudioDuration(audioUrl)
}
