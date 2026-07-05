import { describe, expect, it } from 'vitest'
import { fullMixRunIds } from '@/lib/export'
import type { Chapter, Paragraph } from '@/stores/studio'

function paragraph(id: string, audioUrl: string | null, status: Paragraph['status'] = 'done'): Paragraph {
  return {
    id,
    text: 'Line',
    voice: 'kokoro:am_michael',
    lengthScale: 1,
    audioUrl,
    duration: 2,
    wordTimings: null,
    status,
  }
}

describe('fullMixRunIds', () => {
  const chapter: Chapter = {
    audioUrl: '/api/audio/abcd1234',
    segments: [],
    status: 'done',
  }

  it('prefers chapter run id when chapter is ready', () => {
    const paragraphs = [paragraph('p1', '/api/audio/11111111')]
    expect(fullMixRunIds(paragraphs, chapter)).toEqual(['abcd1234'])
  })

  it('falls back to paragraph run ids in order', () => {
    const idleChapter: Chapter = { audioUrl: null, segments: [], status: 'idle' }
    const paragraphs = [
      paragraph('p1', '/api/audio/11111111'),
      paragraph('p2', '/api/audio/22222222'),
    ]
    expect(fullMixRunIds(paragraphs, idleChapter)).toEqual(['11111111', '22222222'])
  })
})
