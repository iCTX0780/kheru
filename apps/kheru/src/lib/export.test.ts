import { describe, expect, it } from 'vitest'
import { canExportFullMix, canExportParagraphs } from '@/lib/export'
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
    generations: [],
    activeGenerationId: null,
  }
}

describe('canExportFullMix', () => {
  const chapter: Chapter = {
    audioUrl: 'blob:chapter',
    segments: [],
    status: 'done',
  }

  it('allows export when chapter mix exists', () => {
    const paragraphs = [paragraph('p1', 'blob:p1')]
    expect(canExportFullMix(paragraphs, chapter)).toBe(true)
  })

  it('allows export from paragraph blobs when chapter is idle', () => {
    const idleChapter: Chapter = { audioUrl: null, segments: [], status: 'idle' }
    const paragraphs = [paragraph('p1', 'blob:p1'), paragraph('p2', null, 'idle')]
    expect(canExportFullMix(paragraphs, idleChapter)).toBe(true)
  })
})

describe('canExportParagraphs', () => {
  it('requires at least one generated paragraph', () => {
    expect(canExportParagraphs([paragraph('p1', 'blob:p1')])).toBe(true)
    expect(canExportParagraphs([paragraph('p1', null, 'idle')])).toBe(false)
  })
})
