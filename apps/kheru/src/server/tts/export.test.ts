import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { exportConcat } from '@/server/tts/export'
import { audioPath, DATA_DIR } from '@/server/tts/paths'
import { writePcm16Wav } from '@/server/tts/wav'

const RUN_A = 'aabbcc01'
const RUN_B = 'aabbcc02'

describe('exportConcat', () => {
  beforeAll(() => {
    mkdirSync(DATA_DIR, { recursive: true })
    writePcm16Wav(audioPath(RUN_A), new Float32Array(2205).fill(0.1), 22050)
    writePcm16Wav(audioPath(RUN_B), new Float32Array(4410).fill(-0.1), 22050)
  })

  afterAll(() => {
    for (const runId of [RUN_A, RUN_B]) {
      if (existsSync(audioPath(runId))) rmSync(audioPath(runId))
    }
  })

  it('returns a single wav unchanged', () => {
    const result = exportConcat([RUN_A], 'wav')
    expect(result.contentType).toBe('audio/wav')
    expect(result.filename).toBe('full-mix.wav')
    expect(result.buffer.length).toBeGreaterThan(44)
  })

  it('concatenates multiple wav clips', () => {
    const single = exportConcat([RUN_A], 'wav')
    const merged = exportConcat([RUN_A, RUN_B], 'wav')
    expect(merged.buffer.length).toBeGreaterThan(single.buffer.length)
  })

  it('rejects missing clips', () => {
    expect(() => exportConcat(['00000000'], 'wav')).toThrow('Audio not found')
  })
})
