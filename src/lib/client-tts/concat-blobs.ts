import { CLIENT_TTS_SAMPLE_RATE } from '@/lib/client-tts/config'
import { readWavBuffer, writePcm16WavBuffer } from '@/lib/client-tts/wav'

/** Concatenate WAV blobs with silence gaps (default 0.4s between clips). */
export async function concatWavBlobs(
  clips: Blob[],
  gaps: number[],
  sampleRate = CLIENT_TTS_SAMPLE_RATE
): Promise<Blob> {
  if (clips.length === 0) throw new Error('No clips to concatenate')

  const parts: Float32Array[] = []

  for (let i = 0; i < clips.length; i++) {
    const buffer = await clips[i].arrayBuffer()
    const { samples, sampleRate: clipRate } = readWavBuffer(buffer)
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

  const totalLen = parts.reduce((sum, part) => sum + part.length, 0)
  const merged = new Float32Array(totalLen)
  let offset = 0
  for (const part of parts) {
    merged.set(part, offset)
    offset += part.length
  }

  const wav = writePcm16WavBuffer(merged, sampleRate)
  return new Blob([wav], { type: 'audio/wav' })
}

export async function concatWavBlobsDuration(clips: Blob[], gaps: number[]): Promise<number> {
  const blob = await concatWavBlobs(clips, gaps)
  const buffer = await blob.arrayBuffer()
  const { samples, sampleRate } = readWavBuffer(buffer)
  return samples.length / sampleRate
}
