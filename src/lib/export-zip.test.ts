import { describe, expect, it } from 'vitest'
import { buildZip } from '@/lib/export-zip'

describe('buildZip', () => {
  it('creates a valid zip with one stored entry', () => {
    const data = new TextEncoder().encode('hello')
    const zip = buildZip([{ name: 'test.txt', data }])

    expect(zip[0]).toBe(0x50)
    expect(zip[1]).toBe(0x4b)
    expect(zip[2]).toBe(0x03)
    expect(zip[3]).toBe(0x04)

    const tail = zip.subarray(zip.length - 22)
    expect(tail[0]).toBe(0x50)
    expect(tail[1]).toBe(0x4b)
    expect(tail[2]).toBe(0x05)
    expect(tail[3]).toBe(0x06)
  })
})
