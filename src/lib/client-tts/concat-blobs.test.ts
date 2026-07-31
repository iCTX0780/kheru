import { describe, expect, it } from 'vitest'
import { concatWavBlobs, concatWavBlobsDuration } from '@/lib/client-tts/concat-blobs'
import { CLIENT_TTS_SAMPLE_RATE } from '@/lib/client-tts/config'
import { writePcm16WavBuffer } from '@/lib/client-tts/wav'

function sineWavBlob(durationSec: number, sampleRate = CLIENT_TTS_SAMPLE_RATE): Blob {
  const samples = new Float32Array(Math.floor(durationSec * sampleRate))
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.sin((i / sampleRate) * Math.PI * 2 * 440) * 0.1
  }
  const buffer = writePcm16WavBuffer(samples, sampleRate)
  return new Blob([buffer], { type: 'audio/wav' })
}

describe('concatWavBlobs', () => {
  it('concatenates clips with silence gaps', async () => {
    const clips = [sineWavBlob(1), sineWavBlob(2)]
    const blob = await concatWavBlobs(clips, [0.4])
    const duration = await concatWavBlobsDuration(clips, [0.4])
    expect(duration).toBeCloseTo(3.4, 2)
    expect(blob.type).toBe('audio/wav')
    expect(blob.size).toBeGreaterThan(44)
  })

  it('returns a single clip unchanged in duration', async () => {
    const clips = [sineWavBlob(1.5)]
    const duration = await concatWavBlobsDuration(clips, [])
    expect(duration).toBeCloseTo(1.5, 2)
  })

  it('resamples mixed-rate clips to the target rate', async () => {
    // Simulates a legacy 22050 Hz clip cached in OPFS being concatenated
    // with a fresh 24000 Hz clip from the new Rust / worker pipeline.
    const clips = [sineWavBlob(1, 22_050), sineWavBlob(2, 24_000)]
    const duration = await concatWavBlobsDuration(clips, [0.4])
    expect(duration).toBeCloseTo(3.4, 2)
  })
})
