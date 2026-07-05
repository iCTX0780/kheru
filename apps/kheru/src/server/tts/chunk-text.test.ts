import { describe, expect, it } from 'vitest'
import { splitTextForTts, shouldRetryChunkedSynth } from './chunk-text'

const INTEGRANT_TEXT =
  "It's layered, and it has to survive AI velocity. Automated gates first — lint, pre-commit hooks, Conventional Commits, unit-testable code, all enforced in CI. Then code review — I designed an AI-assisted review flow so even a high PR volume gets real scrutiny; I reviewed a hundred and forty-five PRs in six months. Then observability — Sentry with source maps, Dockerized builds with version metadata, so we catch what slips. And the human part — I set the standard, and I say no to scope creep, including AI-suggested work that doesn't serve the user story. The whole point is: speed shouldn't cost you quality. Steering that is the job."

describe('splitTextForTts', () => {
  it('keeps short text in one chunk', () => {
    expect(splitTextForTts('Hello world.')).toEqual(['Hello world.'])
  })

  it('splits the integrant monologue before the human-part section', () => {
    const chunks = splitTextForTts(INTEGRANT_TEXT)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks[0]).toMatch(/enforced in CI\.$/)
    expect(chunks.at(-1)).toMatch(/Steering that is the job\.$/)
    expect(chunks.join(' ')).toBe(INTEGRANT_TEXT)
  })

  it('flags truncated synth output for chunked retry', () => {
    expect(shouldRetryChunkedSynth(INTEGRANT_TEXT, 26.3, 1)).toBe(true)
    expect(shouldRetryChunkedSynth(INTEGRANT_TEXT, 29.52, 1)).toBe(false)
  })
})
