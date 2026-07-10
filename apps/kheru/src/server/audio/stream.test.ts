import { describe, expect, it } from 'vitest'
import { isBenignStreamError, parseByteRange } from '@/server/audio/stream'

describe('stream', () => {
  it('parseByteRange parses open-ended ranges', () => {
    expect(parseByteRange('bytes=0-', 1000)).toEqual({ start: 0, end: 999 })
    expect(parseByteRange('bytes=100-199', 1000)).toEqual({ start: 100, end: 199 })
  })

  it('isBenignStreamError recognizes client disconnect codes', () => {
    expect(isBenignStreamError({ code: 'ECONNRESET' })).toBe(true)
    expect(isBenignStreamError({ code: 'EPIPE' })).toBe(true)
    expect(isBenignStreamError({ code: 'ENOENT' })).toBe(false)
  })
})
