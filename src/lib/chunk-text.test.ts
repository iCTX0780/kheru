import { describe, expect, it } from 'vitest'
import { splitSentences, splitTextForTts } from './chunk-text'
import { prepareTextForTts } from './tts-prepare-text'

describe('splitSentences', () => {
  it('does not split version tokens like v1.x', () => {
    const text = 'We migrated from angular v1.x to v2 and it was painful.'
    expect(splitSentences(text)).toEqual([text])
  })

  it('still splits real sentence boundaries', () => {
    expect(splitSentences('First sentence. Second sentence.')).toEqual([
      'First sentence.',
      'Second sentence.',
    ])
  })

  it('protects decimals and semver', () => {
    const text = 'Use node.js 2.0.1 on port 3.14. Then ship.'
    expect(splitSentences(text)).toEqual(['Use node.js 2.0.1 on port 3.14.', 'Then ship.'])
  })
})

describe('splitTextForTts', () => {
  it('keeps short version strings in one chunk', () => {
    const text = 'We migrated from angular v1.x to v2.'
    expect(splitTextForTts(text)).toEqual([text])
  })

  it('does not split on unicode ellipsis or quoted periods', () => {
    const text =
      'Standalone collapses that… a component just lists its own imports array, and that\'s it. It\'s simpler to reason about, it tree-shakes better because the compiler can see real per-component dependencies, and it makes lazy-loading a route trivially just "load this component." On migration — I don\'t do it big-bang.'
    const spoken = prepareTextForTts(text).spoken
    expect(splitSentences(spoken).join(' ')).toBe(spoken)
    expect(splitTextForTts(spoken).join(' ')).toBe(spoken)
  })
})
