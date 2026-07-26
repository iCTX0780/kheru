import { revokeManagedBlobUrl } from '@/lib/client-tts/blob-registry'
import { canExportParagraphs, exportParagraphsZip } from '@/lib/export'
import { activeChapter, getProjectFromIDB } from '@/lib/project-db'
import { restoreClientAudioFromOpfs } from '@/lib/validate-audio'

export class NothingToExportError extends Error {
  constructor() {
    super('This project has no generated audio to export')
    this.name = 'NothingToExportError'
  }
}

/**
 * Export a project's generated paragraph audio as a ZIP, straight from the
 * dashboard. Rehydrates blob URLs from OPFS first (the persisted record only
 * holds stale/revoked URLs), then revokes them once the ZIP is built.
 */
export async function exportProjectAudioZip(projectId: string): Promise<void> {
  const project = await getProjectFromIDB(projectId)
  if (!project) throw new NothingToExportError()

  const chapter = activeChapter(project)
  if (!chapter) throw new NothingToExportError()

  const restored = await restoreClientAudioFromOpfs(
    projectId,
    chapter.id,
    chapter.paragraphs,
    chapter.chapter
  )

  try {
    if (!canExportParagraphs(restored.paragraphs)) {
      throw new NothingToExportError()
    }
    await exportParagraphsZip(restored.paragraphs, project.title, chapter.title)
  } finally {
    for (const paragraph of restored.paragraphs) {
      for (const generation of paragraph.generations ?? []) {
        revokeManagedBlobUrl(generation.audioUrl)
      }
    }
    revokeManagedBlobUrl(restored.chapter.audioUrl)
  }
}
