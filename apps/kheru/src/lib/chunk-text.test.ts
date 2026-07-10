import { describe, expect, it } from 'vitest'
import { splitSentences, splitTextForTts } from './chunk-text'

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
})
