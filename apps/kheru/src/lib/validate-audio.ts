import type { Chapter, Paragraph } from '@/stores/studio'
import { syncParagraphFromActiveGeneration } from '@/lib/paragraph-generations'
import {
  loadChapterAudioOpfs,
  loadLegacyParagraphAudioOpfs,
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

async function restoreGenerationFromOpfs(
  projectId: string,
  paragraphId: string,
  generationId: string,
  audioRef?: string
): Promise<Blob | null> {
  const byGenerationId = await loadParagraphAudioOpfs(projectId, paragraphId, generationId)
  if (byGenerationId) return byGenerationId

  if (audioRef && audioRef !== generationId) {
    const byRef = await loadParagraphAudioOpfs(projectId, paragraphId, audioRef)
    if (byRef) return byRef
  }

  return loadLegacyParagraphAudioOpfs(projectId, paragraphId)
}

/** Try restoring paragraph/chapter audio from OPFS after refresh. */
export async function restoreClientAudioFromOpfs(
  projectId: string,
  activeChapterId: string,
  paragraphs: Paragraph[],
  chapter: Chapter
): Promise<{ paragraphs: Paragraph[]; chapter: Chapter }> {
  if (!opfsAudioSupported()) {
    return { paragraphs, chapter }
  }

  const nextParagraphs = [...paragraphs]
  let nextChapter = chapter

  for (let i = 0; i < nextParagraphs.length; i++) {
    const paragraph = nextParagraphs[i]
    const generations = paragraph.generations ?? []
    let changed = false
    const nextGenerations = [...generations]

    for (let g = 0; g < nextGenerations.length; g++) {
      const generation = nextGenerations[g]
      if (generation.audioUrl && (await audioExists(generation.audioUrl))) continue

      const blob = await restoreGenerationFromOpfs(
        projectId,
        paragraph.id,
        generation.id,
        generation.audioRef
      )
      if (!blob) continue

      const audioUrl = createManagedBlobUrl(blob)
      nextGenerations[g] = { ...generation, audioUrl }
      changed = true
    }

    if (!changed) continue

    nextParagraphs[i] = syncParagraphFromActiveGeneration({
      ...paragraph,
      generations: nextGenerations,
    })
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

/** Check persisted audio URLs still resolve. */
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
