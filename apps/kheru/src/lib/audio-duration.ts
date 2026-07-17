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

/** Resolve clip duration from known metadata, falling back to client decode. */
export async function resolveClipDuration(
  audioUrl: string,
  knownDuration: number | null
): Promise<number> {
  if (knownDuration != null && knownDuration > 0) return knownDuration
  return getAudioDuration(audioUrl)
}
