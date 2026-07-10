import { describe, expect, it } from 'vitest'
import { isClipAtEnd, sequenceClipKey } from './playback-clip'

describe('playback-clip', () => {
  it('sequenceClipKey includes audio url', () => {
    expect(sequenceClipKey(2, 'p1', '/api/audio/abcd1234')).toBe(
      'seq:2:p1:/api/audio/abcd1234'
    )
  })

  it('isClipAtEnd uses fallback when duration is missing', () => {
    const audio = {
      ended: false,
      duration: NaN,
      currentTime: 4.95,
    } as HTMLAudioElement
    expect(isClipAtEnd(audio, 5)).toBe(true)
    expect(isClipAtEnd(audio, 10)).toBe(false)
  })
})
