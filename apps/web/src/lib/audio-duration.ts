export async function getAudioDuration(url: string): Promise<number> {
  const response = await fetch(url)
  const buffer = await response.arrayBuffer()
  const ctx = new AudioContext()
  try {
    const audioBuffer = await ctx.decodeAudioData(buffer.slice(0))
    return audioBuffer.duration
  } finally {
    await ctx.close()
  }
}
