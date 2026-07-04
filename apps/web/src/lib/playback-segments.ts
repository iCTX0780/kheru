import type { Paragraph, PlaybackSegment } from '@/stores/studio'

export function buildSegmentsFromParagraphs(paragraphs: Paragraph[]): PlaybackSegment[] {
  let offset = 0
  return paragraphs.map((p) => {
    const duration = p.duration ?? 0
    const segment: PlaybackSegment = {
      paragraphId: p.id,
      start: offset,
      end: offset + duration,
      label: p.text.trim().slice(0, 40) + (p.text.trim().length > 40 ? '…' : ''),
    }
    offset += duration
    return segment
  })
}

export function playableParagraphs(paragraphs: Paragraph[]): Paragraph[] {
  return paragraphs.filter((p) => p.status === 'done' && p.audioUrl && p.duration)
}
