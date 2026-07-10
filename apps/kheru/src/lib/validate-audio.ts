import type { Chapter, Paragraph } from '@/stores/studio'
import { isClientTtsEnabled } from '@/lib/client-tts/config'
import {
  loadChapterAudioOpfs,
  loadParagraphAudioOpfs,
  opfsAudioSupported,
} from '@/lib/client-tts/opfs'
import { createManagedBlobUrl } from '@/lib/client-tts/blob-registry'

export interface AudioValidationResult {
  invalidParagraphIds: string[]
  chapterMissing: boolean
}

function isBlobAudioUrl(url: string): boolean {
  return url.startsWith('blob:')
}

export async function audioExists(url: string): Promise<boolean> {
  if (isBlobAudioUrl(url)) {
    try {
      const response = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } })
      return response.ok
    } catch {
      return false
    }
  }

  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

/** Try restoring paragraph/chapter audio from OPFS after refresh. */
export async function restoreClientAudioFromOpfs(
  projectId: string,
  activeChapterId: string,
  paragraphs: Paragraph[],
  chapter: Chapter
): Promise<{ paragraphs: Paragraph[]; chapter: Chapter }> {
  if (!isClientTtsEnabled() || !opfsAudioSupported()) {
    return { paragraphs, chapter }
  }

  const nextParagraphs = [...paragraphs]
  let nextChapter = chapter

  for (let i = 0; i < nextParagraphs.length; i++) {
    const paragraph = nextParagraphs[i]
    if (paragraph.status === 'idle' || paragraph.status === 'generating') continue
    if (paragraph.audioUrl && (await audioExists(paragraph.audioUrl))) continue

    const blob = await loadParagraphAudioOpfs(projectId, paragraph.id)
    if (!blob) continue

    const audioUrl = createManagedBlobUrl(blob)
    const duration = paragraph.duration ?? (await blobDurationFromBlob(blob))
    nextParagraphs[i] = {
      ...paragraph,
      status: 'done',
      audioUrl,
      duration,
      wordTimings: null,
      error: undefined,
    }
  }

  if (chapter.audioUrl && chapter.status === 'done' && !(await audioExists(chapter.audioUrl))) {
    const chapterBlob = await loadChapterAudioOpfs(projectId, activeChapterId)
    if (chapterBlob) {
      const audioUrl = createManagedBlobUrl(chapterBlob)
      nextChapter = {
        ...chapter,
        audioUrl,
        status: 'done',
        error: undefined,
      }
    }
  }

  return { paragraphs: nextParagraphs, chapter: nextChapter }
}

async function blobDurationFromBlob(blob: Blob): Promise<number> {
  const ctx = new AudioContext()
  try {
    const buffer = await blob.arrayBuffer()
    const audioBuffer = await ctx.decodeAudioData(buffer.slice(0))
    return audioBuffer.duration
  } finally {
    await ctx.close()
  }
}

/** Check persisted audio URLs still resolve (server HEAD or blob/OPFS). */
export async function validateStudioAudio(
  paragraphs: Paragraph[],
  chapter: Chapter
): Promise<AudioValidationResult> {
  const invalidParagraphIds: string[] = []

  await Promise.all(
    paragraphs.map(async (paragraph) => {
      if (!paragraph.audioUrl || paragraph.status === 'idle') return
      const ok = await audioExists(paragraph.audioUrl)
      if (!ok) invalidParagraphIds.push(paragraph.id)
    })
  )

  let chapterMissing = false
  if (chapter.audioUrl && chapter.status === 'done') {
    chapterMissing = !(await audioExists(chapter.audioUrl))
  }

  return { invalidParagraphIds, chapterMissing }
}
