import { describe, expect, it } from 'vitest'
import { voiceColorIndex, voiceHighlightClass } from './voice-colors'

describe('voice-colors', () => {
  it('assigns stable indices per voice', () => {
    const voices = ['kokoro:am_michael', 'kokoro:af_heart']
    expect(voiceColorIndex('kokoro:am_michael', voices)).toBe(0)
    expect(voiceColorIndex('kokoro:af_heart', voices)).toBe(1)
  })

  it('returns different classes for different voices', () => {
    const voices = ['kokoro:am_michael', 'kokoro:af_heart']
    const a = voiceHighlightClass('kokoro:am_michael', voices, true)
    const b = voiceHighlightClass('kokoro:af_heart', voices, true)
    expect(a).not.toEqual(b)
  })
})
