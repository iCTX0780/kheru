import { buildSegmentsFromParagraphs, playableParagraphs } from '@/lib/playback-segments'
import { downloadBlob, fetchAudioBuffer, runIdFromAudioUrl } from '@/lib/export-download'
import { buildZip } from '@/lib/export-zip'
import { buildParagraphCues, buildSrt, buildVtt, buildWordCues } from '@/lib/export-subtitles'
import type { Chapter, Paragraph } from '@/stores/studio'

export type SubtitleFormat = 'srt' | 'vtt'
export type SubtitleGranularity = 'paragraph' | 'word'
export type AudioExportFormat = 'wav' | 'mp3'

function subtitleSegments(paragraphs: Paragraph[], chapter: Chapter) {
  if (chapter.status === 'done' && chapter.segments.length > 0) {
    return chapter.segments
  }

  return buildSegmentsFromParagraphs(playableParagraphs(paragraphs))
}

function subtitleParagraphs(paragraphs: Paragraph[], chapter: Chapter) {
  return chapter.status === 'done' && chapter.segments.length > 0
    ? paragraphs
    : playableParagraphs(paragraphs)
}

/** Run ids for a single concatenated export, preferring an existing chapter mix. */
export function fullMixRunIds(paragraphs: Paragraph[], chapter: Chapter): string[] {
  if (chapter.status === 'done' && chapter.audioUrl) {
    const runId = runIdFromAudioUrl(chapter.audioUrl)
    if (runId) return [runId]
  }

  return playableParagraphs(paragraphs)
    .map((paragraph) => (paragraph.audioUrl ? runIdFromAudioUrl(paragraph.audioUrl) : null))
    .filter((runId): runId is string => runId !== null)
}

export function canExportFullMix(paragraphs: Paragraph[], chapter: Chapter): boolean {
  return fullMixRunIds(paragraphs, chapter).length > 0
}

export function canExportParagraphs(paragraphs: Paragraph[]): boolean {
  return playableParagraphs(paragraphs).length > 0
}

export function canExportSubtitles(paragraphs: Paragraph[], chapter: Chapter): boolean {
  return canExportFullMix(paragraphs, chapter)
}

async function parseExportError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: string }
    if (typeof data.detail === 'string') return data.detail
  } catch {
    /* ignore */
  }
  return response.statusText || 'Export failed'
}

export async function exportFullMix(
  paragraphs: Paragraph[],
  chapter: Chapter,
  format: AudioExportFormat
): Promise<void> {
  const runIds = fullMixRunIds(paragraphs, chapter)
  if (runIds.length === 0) {
    throw new Error('Generate at least one paragraph, or generate chapter first')
  }

  if (runIds.length === 1 && format === 'wav') {
    const buffer = await fetchAudioBuffer(`/api/audio/${runIds[0]}`)
    downloadBlob(new Blob([buffer], { type: 'audio/wav' }), 'full-mix.wav')
    return
  }

  const response = await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ run_ids: runIds, format }),
  })

  if (!response.ok) {
    throw new Error(await parseExportError(response))
  }

  const buffer = await response.arrayBuffer()
  const mimeType = format === 'mp3' ? 'audio/mpeg' : 'audio/wav'
  downloadBlob(new Blob([buffer], { type: mimeType }), `full-mix.${format}`)
}

export async function exportParagraphsZip(paragraphs: Paragraph[]): Promise<void> {
  const exportable = playableParagraphs(paragraphs)
  if (exportable.length === 0) {
    throw new Error('Generate at least one paragraph before exporting')
  }

  const files: { name: string; data: Uint8Array }[] = []

  for (let index = 0; index < exportable.length; index++) {
    const paragraph = exportable[index]
    if (!paragraph.audioUrl) continue

    const buffer = await fetchAudioBuffer(paragraph.audioUrl)
    files.push({
      name: `paragraph-${String(index + 1).padStart(3, '0')}.wav`,
      data: new Uint8Array(buffer),
    })
  }

  const zipped = buildZip(files)
  downloadBlob(new Blob([zipped], { type: 'application/zip' }), 'paragraphs.zip')
}

export function exportSubtitles(
  paragraphs: Paragraph[],
  chapter: Chapter,
  format: SubtitleFormat,
  granularity: SubtitleGranularity = 'paragraph'
): void {
  if (!canExportSubtitles(paragraphs, chapter)) {
    throw new Error('Generate audio before exporting subtitles')
  }

  const segments = subtitleSegments(paragraphs, chapter)
  const sourceParagraphs = subtitleParagraphs(paragraphs, chapter)
  const cues =
    granularity === 'word'
      ? buildWordCues(sourceParagraphs, segments)
      : buildParagraphCues(sourceParagraphs, segments)

  const content = format === 'srt' ? buildSrt(cues) : buildVtt(cues)
  const mimeType = format === 'srt' ? 'application/x-subrip' : 'text/vtt'
  const filename = granularity === 'word' ? `subtitles-words.${format}` : `subtitles.${format}`

  downloadBlob(new Blob([content], { type: mimeType }), filename)
}
