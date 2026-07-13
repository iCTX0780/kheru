import { describe, expect, it } from 'vitest'
import { buildParagraphCues, buildSrt, buildVtt, buildWordCues } from '@/lib/export-subtitles'
import type { Paragraph, PlaybackSegment } from '@/stores/studio'

function paragraph(id: string, text: string): Paragraph {
  return {
    id,
    text,
    voice: 'am_michael',
    lengthScale: 1,
    audioUrl: `blob:${id}`,
    duration: 2,
    wordTimings: null,
    status: 'done',
    generations: [],
    activeGenerationId: null,
  }
}

describe('export subtitles', () => {
  const paragraphs = [paragraph('aaaa0001', 'Hello world.'), paragraph('bbbb0002', 'Second line.')]
  const segments: PlaybackSegment[] = [
    { paragraphId: 'aaaa0001', start: 0, end: 2.5, label: 'Hello world.' },
    { paragraphId: 'bbbb0002', start: 2.5, end: 5, label: 'Second line.' },
  ]

  it('builds paragraph cues from segments', () => {
    expect(buildParagraphCues(paragraphs, segments)).toEqual([
      { start: 0, end: 2.5, text: 'Hello world.' },
      { start: 2.5, end: 5, text: 'Second line.' },
    ])
  })

  it('formats SRT with cue numbers and timestamps', () => {
    const srt = buildSrt(buildParagraphCues(paragraphs, segments))
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:02,500\nHello world.')
    expect(srt).toContain('2\n00:00:02,500 --> 00:00:05,000\nSecond line.')
  })

  it('formats VTT with WEBVTT header', () => {
    const vtt = buildVtt(buildParagraphCues(paragraphs, segments))
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true)
    expect(vtt).toContain('00:00:00.000 --> 00:00:02.500')
  })

  it('builds approximate word cues when timings are missing', () => {
    const cues = buildWordCues(paragraphs, segments)
    expect(cues.length).toBeGreaterThan(2)
    expect(cues[0].text).toBe('Hello')
    expect(cues[0].start).toBeGreaterThanOrEqual(0)
    expect(cues.at(-1)?.end).toBeLessThanOrEqual(5)
  })
})
