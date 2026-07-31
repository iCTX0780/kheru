import { canExportFullMix, fetchFullMixBuffer } from '@/lib/export'
import { downloadBlob } from '@/lib/export-download'
import { exportBaseName } from '@/lib/export-filename'
import { buildZip } from '@/lib/export-zip'
import { buildSegmentsFromParagraphs, playableParagraphs } from '@/lib/playback-segments'
import type { Chapter, Paragraph } from '@/stores/studio'

export const PLAYPACK_FORMAT = 'kheru-playpack'
export const PLAYPACK_VERSION = 1
export const PLAYPACK_MIME_TYPE = 'application/vnd.ictx.kheru.playpack+zip'
export const PLAYPACK_EXTENSION = 'kheru'

export interface PlaypackWord {
  word: string
  start: number
  end: number
}

export interface PlaypackParagraph {
  id?: string
  text: string
  speaker?: string
  start: number
  end: number
  words?: PlaypackWord[]
}

export interface PlaypackManifest {
  format: typeof PLAYPACK_FORMAT
  version: typeof PLAYPACK_VERSION
  title: string
  projectTitle?: string
  exportedAt: string
  audio: { file: string; mimeType: string }
  paragraphs: PlaypackParagraph[]
}

export function canExportPlaypack(paragraphs: Paragraph[], chapter: Chapter): boolean {
  return canExportFullMix(paragraphs, chapter)
}

interface BuildManifestInput {
  paragraphs: Paragraph[]
  chapter: Chapter
  projectTitle: string
  chapterTitle: string
  now?: Date
}

/** Pure — safe to unit-test without touching the audio pipeline. */
export function buildPlaypackManifest({
  paragraphs,
  chapter,
  projectTitle,
  chapterTitle,
  now,
}: BuildManifestInput): PlaypackManifest {
  const exportable = playableParagraphs(paragraphs)

  // Prefer chapter-provided segment offsets when a chapter mix was rendered externally;
  // fall back to the same client-side stitch offsets used by `fetchFullMixBuffer`.
  const rebuilt = buildSegmentsFromParagraphs(exportable)
  const useChapterSegments =
    chapter.status === 'done' && chapter.segments.length === exportable.length
  const offsets = useChapterSegments ? chapter.segments : rebuilt

  const manifestParagraphs: PlaypackParagraph[] = exportable.map((p, i) => {
    const seg = offsets[i]
    const shifted = p.wordTimings?.map((w) => ({
      word: w.word,
      start: w.start + seg.start,
      end: w.end + seg.start,
    }))
    return {
      id: p.id,
      text: p.text,
      speaker: p.speaker,
      start: seg.start,
      end: seg.end,
      words: shifted,
    }
  })

  return {
    format: PLAYPACK_FORMAT,
    version: PLAYPACK_VERSION,
    title: chapterTitle,
    projectTitle,
    exportedAt: (now ?? new Date()).toISOString(),
    audio: { file: 'audio.wav', mimeType: 'audio/wav' },
    paragraphs: manifestParagraphs,
  }
}

export async function exportPlaypack(
  paragraphs: Paragraph[],
  chapter: Chapter,
  projectTitle: string,
  chapterTitle: string
): Promise<void> {
  const exportable = playableParagraphs(paragraphs)
  if (exportable.length === 0) {
    throw new Error('Generate at least one paragraph before exporting')
  }

  const audioBuffer = await fetchFullMixBuffer(paragraphs, chapter)
  const manifest = buildPlaypackManifest({
    paragraphs,
    chapter,
    projectTitle,
    chapterTitle,
  })

  const zipped = buildZip([
    {
      name: 'manifest.json',
      data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
    },
    {
      name: 'audio.wav',
      data: new Uint8Array(audioBuffer),
    },
  ])

  const base = exportBaseName(projectTitle, chapterTitle)
  downloadBlob(
    new Blob([new Uint8Array(zipped)], { type: PLAYPACK_MIME_TYPE }),
    `${base}.${PLAYPACK_EXTENSION}`
  )
}
