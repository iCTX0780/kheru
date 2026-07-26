import { deleteParagraphGenerationAudioOpfs, deleteProjectAudioOpfs } from '@/lib/client-tts/opfs'
import { getProjectFromIDB, saveProjectToIDB, type ProjectChapter } from '@/lib/project-db'
import { resolveActiveGeneration, syncParagraphFromActiveGeneration } from '@/lib/paragraph-generations'
import type { Paragraph, ParagraphGeneration } from '@/stores/studio'

/**
 * Free all audio for a project while preserving the script. Recursively purges
 * the OPFS `kheru-audio/{projectId}` tree, then rewrites the IndexedDB record so
 * every paragraph resets to idle (no generations) and every full-mix is cleared.
 */
export async function clearProjectAudio(projectId: string): Promise<void> {
  await deleteProjectAudioOpfs(projectId)

  const project = await getProjectFromIDB(projectId)
  if (!project) return

  const chapters: ProjectChapter[] = project.chapters.map((chapter) => ({
    ...chapter,
    paragraphs: chapter.paragraphs.map((p) =>
      syncParagraphFromActiveGeneration({
        ...p,
        generations: [],
        activeGenerationId: null,
      })
    ),
    chapter: { audioUrl: null, segments: [], status: 'idle' },
  }))

  await saveProjectToIDB({ ...project, chapters })
}

function keptGeneration(paragraph: Paragraph): ParagraphGeneration | null {
  const active = resolveActiveGeneration(paragraph)
  if (active) return active
  const generations = paragraph.generations ?? []
  if (generations.length === 0) return null
  return [...generations].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

/**
 * For every paragraph, drop all takes except the active (or newest) one,
 * deleting the discarded generation WAVs from OPFS. Full-mix audio is left
 * intact — it was stitched from the takes we keep.
 */
export async function keepLatestGenerationOnly(projectId: string): Promise<void> {
  const project = await getProjectFromIDB(projectId)
  if (!project) return

  const deletions: Promise<void>[] = []

  const chapters: ProjectChapter[] = project.chapters.map((chapter) => ({
    ...chapter,
    paragraphs: chapter.paragraphs.map((p) => {
      const generations = p.generations ?? []
      if (generations.length <= 1) return p

      const kept = keptGeneration(p)
      for (const gen of generations) {
        if (gen.id !== kept?.id) {
          deletions.push(deleteParagraphGenerationAudioOpfs(projectId, p.id, gen.id))
        }
      }

      return syncParagraphFromActiveGeneration({
        ...p,
        generations: kept ? [kept] : [],
        activeGenerationId: kept?.id ?? null,
      })
    }),
  }))

  await Promise.all(deletions)
  await saveProjectToIDB({ ...project, chapters })
}
