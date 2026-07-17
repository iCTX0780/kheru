import { describe, expect, it } from 'vitest'
import { audioExists } from '@/lib/validate-audio'

describe('audioExists', () => {
  it('treats invalid blob URLs as missing', async () => {
    const deadBlobUrl = 'blob:http://localhost/dead-url'
    await expect(audioExists(deadBlobUrl)).resolves.toBe(false)
  })
})
