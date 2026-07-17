import { describe, expect, it } from 'vitest'
import { isClipAtEnd, prepareAudioElementForPlay, sequenceClipKey } from './playback-clip'

describe('playback-clip', () => {
  it('sequenceClipKey includes audio url', () => {
    expect(sequenceClipKey(2, 'p1', 'blob:abcd1234')).toBe('seq:2:p1:blob:abcd1234')
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

  it('prepareAudioElementForPlay resets ended clips', () => {
    const audio = {
      ended: true,
      duration: 5,
      currentTime: 5,
    } as HTMLAudioElement
    prepareAudioElementForPlay(audio, 0)
    expect(audio.currentTime).toBe(0)
  })
})
