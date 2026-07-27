import { describe, expect, it } from 'vitest'
import { buildPlaypackManifest, PLAYPACK_FORMAT, PLAYPACK_VERSION } from '@/lib/export-playpack'
import { PARAGRAPH_GAP_SECONDS } from '@/lib/playback-segments'
import type { Chapter, Paragraph } from '@/stores/studio'

function paragraph(overrides: Partial<Paragraph>): Paragraph {
  return {
    id: 'p1',
    text: 'Hello.',
    voice: 'kokoro:am_michael',
    lengthScale: 1,
    audioUrl: 'blob:p1',
    duration: 2,
    wordTimings: null,
    status: 'done',
    generations: [],
    activeGenerationId: null,
    ...overrides,
  }
}

const idleChapter: Chapter = { audioUrl: null, segments: [], status: 'idle' }
const now = new Date('2026-07-27T10:00:00.000Z')

describe('buildPlaypackManifest', () => {
  it('emits the locked v1 header', () => {
    const manifest = buildPlaypackManifest({
      paragraphs: [paragraph({})],
      chapter: idleChapter,
      projectTitle: 'Weak-spot drill',
      chapterTitle: 'Chapter One',
      now,
    })
    expect(manifest.format).toBe(PLAYPACK_FORMAT)
    expect(manifest.version).toBe(PLAYPACK_VERSION)
    expect(manifest.title).toBe('Chapter One')
    expect(manifest.projectTitle).toBe('Weak-spot drill')
    expect(manifest.exportedAt).toBe('2026-07-27T10:00:00.000Z')
    expect(manifest.audio).toEqual({ file: 'audio.wav', mimeType: 'audio/wav' })
  })

  it('offsets each paragraph by the client-side stitch gap', () => {
    const paragraphs = [
      paragraph({ id: 'a', duration: 2, text: 'First.' }),
      paragraph({ id: 'b', duration: 3, text: 'Second.' }),
    ]
    const manifest = buildPlaypackManifest({
      paragraphs,
      chapter: idleChapter,
      projectTitle: 'P',
      chapterTitle: 'C',
      now,
    })
    expect(manifest.paragraphs).toHaveLength(2)
    expect(manifest.paragraphs[0]).toMatchObject({ id: 'a', start: 0, end: 2 })
    expect(manifest.paragraphs[1]).toMatchObject({
      id: 'b',
      start: 2 + PARAGRAPH_GAP_SECONDS,
      end: 2 + PARAGRAPH_GAP_SECONDS + 3,
    })
  })

  it('skips paragraphs without generated audio', () => {
    const paragraphs = [
      paragraph({ id: 'a', duration: 2 }),
      paragraph({ id: 'skip', status: 'idle', audioUrl: null }),
      paragraph({ id: 'b', duration: 2 }),
    ]
    const manifest = buildPlaypackManifest({
      paragraphs,
      chapter: idleChapter,
      projectTitle: 'P',
      chapterTitle: 'C',
      now,
    })
    expect(manifest.paragraphs.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('shifts word timings to chapter-absolute time', () => {
    const paragraphs = [
      paragraph({ id: 'a', duration: 1 }),
      paragraph({
        id: 'b',
        duration: 2,
        wordTimings: [
          { word: 'Hello', start: 0, end: 0.5 },
          { word: 'world.', start: 0.5, end: 1 },
        ],
      }),
    ]
    const manifest = buildPlaypackManifest({
      paragraphs,
      chapter: idleChapter,
      projectTitle: 'P',
      chapterTitle: 'C',
      now,
    })
    const offset = 1 + PARAGRAPH_GAP_SECONDS
    expect(manifest.paragraphs[1].words).toEqual([
      { word: 'Hello', start: offset + 0, end: offset + 0.5 },
      { word: 'world.', start: offset + 0.5, end: offset + 1 },
    ])
  })

  it('prefers chapter segments when a chapter mix was rendered', () => {
    const paragraphs = [
      paragraph({ id: 'a', duration: 2 }),
      paragraph({ id: 'b', duration: 2 }),
    ]
    const chapter: Chapter = {
      audioUrl: 'blob:chapter',
      status: 'done',
      segments: [
        { paragraphId: 'a', start: 0, end: 1.8, label: 'a' },
        { paragraphId: 'b', start: 2.0, end: 4.0, label: 'b' },
      ],
    }
    const manifest = buildPlaypackManifest({
      paragraphs,
      chapter,
      projectTitle: 'P',
      chapterTitle: 'C',
      now,
    })
    expect(manifest.paragraphs[0]).toMatchObject({ start: 0, end: 1.8 })
    expect(manifest.paragraphs[1]).toMatchObject({ start: 2.0, end: 4.0 })
  })

  it('preserves speaker label when present', () => {
    const manifest = buildPlaypackManifest({
      paragraphs: [paragraph({ speaker: 'HOST', duration: 1 })],
      chapter: idleChapter,
      projectTitle: 'P',
      chapterTitle: 'C',
      now,
    })
    expect(manifest.paragraphs[0].speaker).toBe('HOST')
  })
})
