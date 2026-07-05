import { approximateWordTimings } from '@/lib/playback-words'
import type { Paragraph, PlaybackSegment } from '@/stores/studio'

export interface SubtitleCue {
  start: number
  end: number
  text: string
}

function formatSrtTimestamp(seconds: number): string {
  const clamped = Math.max(seconds, 0)
  const hours = Math.floor(clamped / 3600)
  const minutes = Math.floor((clamped % 3600) / 60)
  const secs = Math.floor(clamped % 60)
  const millis = Math.round((clamped % 1) * 1000)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`
}

function formatVttTimestamp(seconds: number): string {
  return formatSrtTimestamp(seconds).replace(',', '.')
}

export function buildParagraphCues(
  paragraphs: Paragraph[],
  segments: PlaybackSegment[]
): SubtitleCue[] {
  const byId = new Map(paragraphs.map((paragraph) => [paragraph.id, paragraph]))

  return segments
    .map((segment) => {
      const paragraph = byId.get(segment.paragraphId)
      const text = paragraph?.text.trim() ?? ''
      if (!text) return null
      return {
        start: segment.start,
        end: segment.end,
        text,
      }
    })
    .filter((cue): cue is SubtitleCue => cue !== null)
}

export function buildWordCues(
  paragraphs: Paragraph[],
  segments: PlaybackSegment[]
): SubtitleCue[] {
  const byId = new Map(paragraphs.map((paragraph) => [paragraph.id, paragraph]))
  const cues: SubtitleCue[] = []

  for (const segment of segments) {
    const paragraph = byId.get(segment.paragraphId)
    if (!paragraph) continue
    const text = paragraph.text.trim()
    if (!text) continue

    const timings =
      paragraph.wordTimings?.length
        ? paragraph.wordTimings.map((timing) => ({
            word: timing.word,
            start: segment.start + timing.start,
            end: segment.start + timing.end,
          }))
        : approximateWordTimings(text, segment.start, segment.end)

    for (const timing of timings) {
      cues.push({
        start: timing.start,
        end: timing.end,
        text: timing.word,
      })
    }
  }

  return cues
}

export function buildSrt(cues: SubtitleCue[]): string {
  if (cues.length === 0) return ''

  return cues
    .map((cue, index) => {
      const lines = [
        String(index + 1),
        `${formatSrtTimestamp(cue.start)} --> ${formatSrtTimestamp(cue.end)}`,
        cue.text,
      ]
      return lines.join('\n')
    })
    .join('\n\n')
    .concat('\n')
}

export function buildVtt(cues: SubtitleCue[]): string {
  if (cues.length === 0) return 'WEBVTT\n\n'

  const body = cues
    .map((cue) => {
      const lines = [
        `${formatVttTimestamp(cue.start)} --> ${formatVttTimestamp(cue.end)}`,
        cue.text,
      ]
      return lines.join('\n')
    })
    .join('\n\n')

  return `WEBVTT\n\n${body}\n`
}
