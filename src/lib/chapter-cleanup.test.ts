import { describe, expect, it, vi } from 'vitest'
import { releaseParagraphAudio } from '@/lib/chapter-cleanup'
import type { Paragraph } from '@/stores/studio'

vi.mock('@/lib/client-tts/blob-registry', () => ({
  revokeManagedBlobUrl: vi.fn(),
}))

import { revokeManagedBlobUrl } from '@/lib/client-tts/blob-registry'

describe('releaseParagraphAudio', () => {
  it('revokes blob URLs for paragraph and all generations', () => {
    const paragraph: Paragraph = {
      id: 'p1',
      text: 'Hello',
      voice: 'kokoro:af_heart',
      lengthScale: 1,
      audioUrl: 'blob:paragraph',
      duration: 2,
      wordTimings: null,
      status: 'done',
      generations: [
        {
          id: 'g1',
          createdAt: '2026-07-11T12:00:00.000Z',
          textSnapshot: 'Hello',
          voice: 'kokoro:af_heart',
          lengthScale: 1,
          audioUrl: 'blob:gen1',
          duration: 2,
          wordTimings: null,
        },
        {
          id: 'g2',
          createdAt: '2026-07-11T13:00:00.000Z',
          textSnapshot: 'Hello',
          voice: 'kokoro:af_heart',
          lengthScale: 1,
          audioUrl: 'blob:gen2',
          duration: 2,
          wordTimings: null,
        },
      ],
      activeGenerationId: 'g2',
    }

    releaseParagraphAudio(paragraph)

    expect(revokeManagedBlobUrl).toHaveBeenCalledWith('blob:paragraph')
    expect(revokeManagedBlobUrl).toHaveBeenCalledWith('blob:gen1')
    expect(revokeManagedBlobUrl).toHaveBeenCalledWith('blob:gen2')
  })
})
