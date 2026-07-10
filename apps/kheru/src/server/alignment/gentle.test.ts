import { describe, expect, it, vi, afterEach } from 'vitest'
import { alignWithGentleBytes, parseGentleWords } from '@/server/alignment/gentle'

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

describe('alignWithGentleBytes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('posts audio and transcript to Gentle and parses words', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          words: [{ alignedWord: 'Hello', case: 'success', start: 0, end: 0.5 }],
        }),
        { status: 200 }
      )
    )

    const audio = new Uint8Array([1, 2, 3])
    const words = await alignWithGentleBytes(audio, 'Hello world', 'http://127.0.0.1:8765')

    expect(words).toEqual([{ word: 'Hello', start: 0, end: 0.5 }])
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8765/transcriptions?async=false',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('returns empty array for blank transcript', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const words = await alignWithGentleBytes(new Uint8Array([1]), '   ', 'http://127.0.0.1:8765')
    expect(words).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
