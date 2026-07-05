import { describe, expect, it } from 'vitest'
import { parseGentleWords } from '@/server/alignment/gentle'

describe('parseGentleWords', () => {
  it('keeps successful alignments only', () => {
    const timings = parseGentleWords([
      { alignedWord: 'Thanks', case: 'success', start: 0.1, end: 0.4 },
      { alignedWord: 'for', case: 'not-found-in-audio', start: 0.4, end: 0.5 },
      { alignedWord: 'you', case: 'success', start: 0.5, end: 0.8 },
    ])

    expect(timings).toEqual([
      { word: 'Thanks', start: 0.1, end: 0.4 },
      { word: 'you', start: 0.5, end: 0.8 },
    ])
  })
})
