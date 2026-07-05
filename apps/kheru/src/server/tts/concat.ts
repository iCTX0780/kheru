import { readWav, writePcm16Wav } from './wav'

export function concatWavs(clips: string[], outputFile: string, gaps: number[], sampleRate: number): void {
  if (clips.length === 0) throw new Error('No clips to concatenate')

  const parts: Float32Array[] = []
  for (let i = 0; i < clips.length; i++) {
    const { samples, sampleRate: clipRate } = readWav(clips[i])
    if (clipRate !== sampleRate) {
      throw new Error(`Sample rate mismatch: expected ${sampleRate}, got ${clipRate}`)
    }
    parts.push(samples)
    if (i < clips.length - 1) {
      const gap = gaps[i] ?? 0.4
      const silenceLen = Math.floor(gap * sampleRate)
      parts.push(new Float32Array(silenceLen))
    }
  }

  const totalLen = parts.reduce((sum, p) => sum + p.length, 0)
  const merged = new Float32Array(totalLen)
  let offset = 0
  for (const part of parts) {
    merged.set(part, offset)
    offset += part.length
  }

  writePcm16Wav(outputFile, merged, sampleRate)
}
