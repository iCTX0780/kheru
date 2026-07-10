import { describe, expect, it } from 'vitest'
import { segmentDurationFromResult } from './api'

describe('segmentDurationFromResult', () => {
  it('returns segment length for the requested turn', () => {
    const duration = segmentDurationFromResult(
      {
        run_id: 'abc',
        audio_url: '/api/audio/abc',
        segments: [{ index: 0, start: 0, end: 29.5 }],
        words: [],
        clips: [],
      },
      0
    )
    expect(duration).toBe(29.5)
  })

  it('returns null when the segment is missing or empty', () => {
    expect(
      segmentDurationFromResult(
        {
          run_id: 'abc',
          audio_url: '/api/audio/abc',
          segments: [],
          words: [],
          clips: [],
        },
        0
      )
    ).toBeNull()
  })
})
