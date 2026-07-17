import type { Paragraph, PlaybackSegment } from '@/stores/studio'

/** Segment region extends through inter-paragraph gaps until the next segment starts. */
export function findSegmentRegionForTime(
  segments: PlaybackSegment[],
  time: number,
  totalDuration: number
): { segment: PlaybackSegment; regionEnd: number } | null {
  if (segments.length === 0) return null

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const regionEnd = segments[i + 1]?.start ?? totalDuration
    if (time >= segment.start && time < regionEnd) {
      return { segment, regionEnd }
    }
  }

  const last = segments[segments.length - 1]
  if (time >= last.start && time <= totalDuration) {
    return { segment: last, regionEnd: totalDuration }
  }

  return null
}

/** Gap between paragraph clips in the local full-mix stitch. */
export const PARAGRAPH_GAP_SECONDS = 0.4

export function buildSegmentsFromParagraphs(paragraphs: Paragraph[]): PlaybackSegment[] {
  let offset = 0
  return paragraphs.map((p, index) => {
    const duration = p.duration ?? 0
    const segment: PlaybackSegment = {
      paragraphId: p.id,
      start: offset,
      end: offset + duration,
      label: p.text.trim().slice(0, 40) + (p.text.trim().length > 40 ? '…' : ''),
    }
    offset += duration
    if (index < paragraphs.length - 1) {
      offset += PARAGRAPH_GAP_SECONDS
    }
    return segment
  })
}

export function playableParagraphs(paragraphs: Paragraph[]): Paragraph[] {
  return paragraphs.filter((p) => p.status === 'done' && p.audioUrl)
}
