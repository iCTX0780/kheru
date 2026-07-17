import { describe, expect, it } from 'vitest'
import {
  estimateBulkGenerationMs,
  estimateParagraphMs,
  estimateRemainingMs,
  formatEta,
  STITCH_BUFFER_MS,
} from './generation-estimate'

describe('generation-estimate', () => {
  it('estimateParagraphMs scales with word count', () => {
    expect(estimateParagraphMs('')).toBe(8_000)
    expect(estimateParagraphMs('one two three')).toBe(8_000 + 3 * 400)
  })

  it('estimateBulkGenerationMs includes stitch buffer', () => {
    const total = estimateBulkGenerationMs(['hello world', 'foo'])
    expect(total).toBe(estimateParagraphMs('hello world') + estimateParagraphMs('foo') + STITCH_BUFFER_MS)
  })

  it('formatEta formats human-readable durations', () => {
    expect(formatEta(30)).toBe('less than 1 min')
    expect(formatEta(120)).toBe('about 2 min')
    expect(formatEta(3_600)).toBe('about 1 hr')
  })

  it('estimateRemainingMs uses rolling average after two completions', () => {
    const startedAt = Date.now() - 20_000
    const remaining = estimateRemainingMs({
      startedAt,
      completed: 2,
      total: 10,
      estimatedTotalMs: 100_000,
      isStitching: false,
    })
    expect(remaining).toBeGreaterThan(70_000)
    expect(remaining).toBeLessThan(90_000)
  })

  it('estimateRemainingMs returns stitch buffer while stitching', () => {
    expect(
      estimateRemainingMs({
        startedAt: Date.now(),
        completed: 5,
        total: 5,
        estimatedTotalMs: 50_000,
        isStitching: true,
      })
    ).toBe(STITCH_BUFFER_MS)
  })
})
