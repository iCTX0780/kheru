import { describe, expect, it } from 'vitest'
import { voiceForSpeaker, lengthScaleForSpeaker } from './voice-catalog'
import { fromDisplaySpeed } from './speed'
import { parseImportScript } from './parse-script'

describe('parseImportScript', () => {
  it('merges wrapped continuation lines after a speaker label', () => {
    const script = `INTERVIEWER: Thanks for joining. I'm a senior tech lead here — this round is more technical
and practical than the first one. To start… tell me about yourself, from an engineering
leadership angle.
YOU: Sure. I'm a technical lead, about a decade in, strongest in frontend but broad across
backend, UI/UX, CI/CD, and product.`

    expect(parseImportScript(script)).toEqual([
      {
        speaker: 'INTERVIEWER',
        text: "Thanks for joining. I'm a senior tech lead here — this round is more technical and practical than the first one. To start… tell me about yourself, from an engineering leadership angle.",
      },
      {
        speaker: 'YOU',
        text: "Sure. I'm a technical lead, about a decade in, strongest in frontend but broad across backend, UI/UX, CI/CD, and product.",
      },
    ])
  })

  it('keeps one line per paragraph when there are no speaker labels', () => {
    const script = `First paragraph on its own.

Second paragraph here.

Third one.`

    expect(parseImportScript(script)).toEqual([
      { text: 'First paragraph on its own.' },
      { text: 'Second paragraph here.' },
      { text: 'Third one.' },
    ])
  })

  it('strips Shadi: prefixes when each line is self-contained', () => {
    const script = `Shadi: Happy to make the time.
Interviewer: What interests you?`

    expect(parseImportScript(script)).toEqual([
      { speaker: 'Shadi', text: 'Happy to make the time.' },
      { speaker: 'Interviewer', text: 'What interests you?' },
    ])
  })

  it('merges multi-line Shadi blocks when dialogue wraps', () => {
    const script = `Shadi: Line one of a long answer
that continues on the next line.
Interviewer: Next question.`

    expect(parseImportScript(script)).toEqual([
      { speaker: 'Shadi', text: 'Line one of a long answer that continues on the next line.' },
      { speaker: 'Interviewer', text: 'Next question.' },
    ])
  })

  it('parses markdown rehearsal scripts with frontmatter and **SPEAKER:** labels', () => {
    const script = `---
type: audio-rehearsal-script
---

# Round 2

> Focused cut for rehearsal.

## PART 1

**INTERVIEWER:** Thanks for joining. I'm a senior tech lead here — this round is more technical
and practical than the first one.
**YOU:** Sure. I'm a technical lead, about a decade in, strongest in frontend but broad across
backend, UI/UX, CI/CD, and product.

## Delivery notes

- Pace: slightly slower than natural.
`

    expect(parseImportScript(script)).toEqual([
      { speaker: 'HEADLINE', text: 'Round 2' },
      { speaker: 'HEADLINE', text: 'PART 1' },
      {
        speaker: 'INTERVIEWER',
        text: "Thanks for joining. I'm a senior tech lead here — this round is more technical and practical than the first one.",
      },
      {
        speaker: 'YOU',
        text: "Sure. I'm a technical lead, about a decade in, strongest in frontend but broad across backend, UI/UX, CI/CD, and product.",
      },
    ])
  })
})

describe('voiceForSpeaker', () => {
  const voices = ['kokoro:af_heart', 'kokoro:am_michael', 'kokoro:am_adam', 'kokoro:am_fenrir']

  it('maps INTERVIEWER to Heart and YOU to Michael', () => {
    expect(voiceForSpeaker('INTERVIEWER', 'kokoro:am_fenrir', voices)).toBe('kokoro:af_heart')
    expect(voiceForSpeaker('YOU', 'kokoro:am_fenrir', voices)).toBe('kokoro:am_michael')
  })

  it('maps HEADLINE to Adam', () => {
    expect(voiceForSpeaker('HEADLINE', 'kokoro:am_michael', voices)).toBe('kokoro:am_adam')
  })

  it('slows HEADLINE to 0.8×', () => {
    expect(lengthScaleForSpeaker('HEADLINE', 1)).toBe(fromDisplaySpeed(0.8))
    expect(lengthScaleForSpeaker('YOU', 1)).toBe(1)
  })

  it('is case-insensitive', () => {
    expect(voiceForSpeaker('interviewer', 'kokoro:am_michael', voices)).toBe('kokoro:af_heart')
  })

  it('falls back when speaker is unknown or voice unavailable', () => {
    expect(voiceForSpeaker('Shadi', 'kokoro:am_michael', voices)).toBe('kokoro:am_michael')
    expect(voiceForSpeaker('INTERVIEWER', 'kokoro:am_michael', ['kokoro:am_michael'])).toBe(
      'kokoro:am_michael'
    )
  })
})
