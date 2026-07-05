import { describe, expect, it } from 'vitest'
import { activeTextWordIndex, alignTimingsToText, splitWords } from './playback-words'

const LONG_TEXT =
  "It's layered, and it has to survive AI velocity. Automated gates first — lint, pre-commit hooks, Conventional Commits, unit-testable code, all enforced in CI. Then code review — I designed an AI-assisted review flow so even a high PR volume gets real scrutiny; I reviewed a hundred and forty-five PRs in six months. Then observability — Sentry with source maps, Dockerized builds with version metadata, so we catch what slips. And the human part — I set the standard, and I say no to scope creep, including AI-suggested work that doesn't serve the user story. The whole point is: speed shouldn't cost you quality. Steering that is the job."

describe('alignTimingsToText', () => {
  it('maps gentle timings onto later words in long text', () => {
    const words = splitWords(LONG_TEXT)
    const timings = [
      { word: "it's", start: 0.39, end: 0.61 },
      { word: 'layered', start: 0.61, end: 1.13 },
      { word: 'Steering', start: 28.5, end: 29.0 },
      { word: 'job.', start: 29.2, end: 29.5 },
    ]

    const aligned = alignTimingsToText(words, timings)
    expect(aligned[0]?.textIndex).toBe(0)
    expect(aligned.at(-1)?.textIndex).toBe(words.length - 1)
  })
})

describe('activeTextWordIndex', () => {
  it('continues through the full text after gentle timings end', () => {
    const words = splitWords(LONG_TEXT)
    const lastAlignedEnd = 29.28
    const speechDuration = 29.52
    const timings = Array.from({ length: 72 }, (_, i) => ({
      word: words[Math.min(i, words.length - 1)],
      start: (i / 72) * lastAlignedEnd,
      end: ((i + 1) / 72) * lastAlignedEnd,
    }))

    const nearEnd = activeTextWordIndex(LONG_TEXT, speechDuration - 0.1, speechDuration, timings)
    expect(nearEnd).toBeGreaterThan(100)
  })

  it('holds highlight during short gaps between aligned words', () => {
    const text = 'one two three'
    const timings = [
      { word: 'one', start: 0, end: 0.4 },
      { word: 'three', start: 0.8, end: 1.2 },
    ]

    expect(activeTextWordIndex(text, 0.5, 1.2, timings)).toBe(0)
  })
})
