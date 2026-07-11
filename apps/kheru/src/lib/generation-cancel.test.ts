import { describe, expect, it } from 'vitest'
import {
  GenerationCancelledError,
  assertGenerationNotCancelled,
  isGenerationCancelled,
} from '@/lib/generation-cancel'

describe('generation-cancel', () => {
  it('detects GenerationCancelledError', () => {
    expect(isGenerationCancelled(new GenerationCancelledError())).toBe(true)
  })

  it('detects AbortError', () => {
    expect(isGenerationCancelled(new DOMException('aborted', 'AbortError'))).toBe(true)
  })

  it('throws when cancel is requested', () => {
    expect(() => assertGenerationNotCancelled(true)).toThrow(GenerationCancelledError)
    expect(() => assertGenerationNotCancelled(false)).not.toThrow()
  })
})
