import { buildSegmentsFromParagraphs, playableParagraphs, PARAGRAPH_GAP_SECONDS } from '@/lib/playback-segments'
import { downloadBlob, fetchAudioBuffer } from '@/lib/export-download'
import { exportBaseName } from '@/lib/export-filename'
import { buildZip } from '@/lib/export-zip'
import { buildParagraphCues, buildSrt, buildVtt, buildWordCues } from '@/lib/export-subtitles'
import { concatWavBlobs } from '@/lib/client-tts/concat-blobs'
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

export function canExportFullMix(paragraphs: Paragraph[], chapter: Chapter): boolean {
  if (chapter.status === 'done' && chapter.audioUrl) return true
  return playableParagraphs(paragraphs).some((p) => p.audioUrl)
}

export function canExportParagraphs(paragraphs: Paragraph[]): boolean {
  return playableParagraphs(paragraphs).length > 0
}

export function canExportSubtitles(paragraphs: Paragraph[], chapter: Chapter): boolean {
  return canExportFullMix(paragraphs, chapter)
}

async function fetchFullMixBuffer(paragraphs: Paragraph[], chapter: Chapter): Promise<ArrayBuffer> {
  if (chapter.status === 'done' && chapter.audioUrl) {
    return fetchAudioBuffer(chapter.audioUrl)
  }

  const exportable = playableParagraphs(paragraphs)
  const blobs: Blob[] = []
  for (const paragraph of exportable) {
    if (!paragraph.audioUrl) continue
    const buffer = await fetchAudioBuffer(paragraph.audioUrl)
    blobs.push(new Blob([buffer], { type: 'audio/wav' }))
  }

  if (blobs.length === 0) {
    throw new Error('Generate at least one paragraph, or generate chapter first')
  }

  const gaps = Array.from({ length: Math.max(blobs.length - 1, 0) }, () => PARAGRAPH_GAP_SECONDS)
  const stitched = blobs.length === 1 ? blobs[0] : await concatWavBlobs(blobs, gaps)
  return stitched.arrayBuffer()
}

async function exportFullMixClient(
  paragraphs: Paragraph[],
  chapter: Chapter,
  projectTitle: string,
  chapterTitle: string
): Promise<void> {
  const base = exportBaseName(projectTitle, chapterTitle)
  const buffer = await fetchFullMixBuffer(paragraphs, chapter)
  downloadBlob(new Blob([buffer], { type: 'audio/wav' }), `${base}.wav`)
}

export async function exportFullMix(
  paragraphs: Paragraph[],
  chapter: Chapter,
  format: AudioExportFormat,
  projectTitle: string,
  chapterTitle: string
): Promise<void> {
  if (format === 'mp3') {
    throw new Error('MP3 export is not available in the browser — use WAV')
  }
  await exportFullMixClient(paragraphs, chapter, projectTitle, chapterTitle)
}

export async function exportParagraphsZip(
  paragraphs: Paragraph[],
  projectTitle: string,
  chapterTitle: string
): Promise<void> {
  const exportable = playableParagraphs(paragraphs)
  if (exportable.length === 0) {
    throw new Error('Generate at least one paragraph before exporting')
  }

  const base = exportBaseName(projectTitle, chapterTitle)
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
  downloadBlob(new Blob([new Uint8Array(zipped)], { type: 'application/zip' }), `${base}-paragraphs.zip`)
}

export function exportSubtitles(
  paragraphs: Paragraph[],
  chapter: Chapter,
  format: SubtitleFormat,
  granularity: SubtitleGranularity,
  projectTitle: string,
  chapterTitle: string
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
  const base = exportBaseName(projectTitle, chapterTitle)
  const suffix = granularity === 'word' ? `-subtitles-words` : `-subtitles`
  const filename = `${base}${suffix}.${format}`

  downloadBlob(new Blob([content], { type: mimeType }), filename)
}
