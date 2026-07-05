import type { Chapter, Paragraph } from '@/stores/studio'

export interface AudioValidationResult {
  invalidParagraphIds: string[]
  chapterMissing: boolean
}

async function audioExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

/** Check persisted audio URLs still resolve on the server. */
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
