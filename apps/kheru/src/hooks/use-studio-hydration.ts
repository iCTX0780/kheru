import { useEffect, useState } from 'react'
import { shallow } from 'zustand/shallow'
import { useStudioStore, type StudioStore } from '@/stores/studio'
import {
  createDefaultProject,
  getMetaValue,
  getProjectFromIDB,
  migrateLocalStorageToIDB,
  saveProjectToIDB,
  setMetaValue,
} from '@/lib/project-db'
import { validateStudioAudio } from '@/lib/validate-audio'
import { DEFAULT_VOICE_ID } from '@/lib/voice-catalog'
import { scheduleProjectSave } from '@/lib/project-sync'
import { toast } from 'sonner'

function pickPersistableState(state: StudioStore) {
  return {
    projectId: state.projectId,
    projectTitle: state.projectTitle,
    chapterTitle: state.chapterTitle,
    chapters: state.chapters,
    activeChapterId: state.activeChapterId,
    paragraphs: state.paragraphs,
    chapter: state.chapter,
  }
}

/** Load project from IndexedDB and validate audio URLs. */
export function useStudioHydration(projectId?: string): boolean {
  const [hydrated, setHydrated] = useState(false)
  const loadProject = useStudioStore((s) => s.loadProject)
  const setProjectId = useStudioStore((s) => s.setProjectId)

  useEffect(() => {
    let cancelled = false

    const finish = async () => {
      try {
        await migrateLocalStorageToIDB(DEFAULT_VOICE_ID)

        const targetId = projectId ?? (await getMetaValue('lastActiveProjectId'))
        let project = targetId ? await getProjectFromIDB(targetId) : null

        if (!project) {
          project = createDefaultProject(DEFAULT_VOICE_ID)
          await saveProjectToIDB(project)
          await setMetaValue('lastActiveProjectId', project.id)
        }

        if (cancelled) return

        loadProject(project)
        setProjectId(project.id)

        const { paragraphs, chapter } = useStudioStore.getState()
        const validation = await validateStudioAudio(paragraphs, chapter)
        if (validation.invalidParagraphIds.length > 0 || validation.chapterMissing) {
          const store = useStudioStore.getState()
          for (const id of validation.invalidParagraphIds) {
            store.invalidateParagraphAudio(id)
          }
          if (validation.chapterMissing) {
            store.invalidateChapterAudio()
          }
          toast.message('Some audio files are missing on the server — re-generate to restore.')
        }
      } catch (err) {
        console.warn('Studio hydration failed:', err)
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }

    void finish()
    return () => {
      cancelled = true
    }
  }, [loadProject, projectId, setProjectId])

  return hydrated
}

/** Auto-save project to IndexedDB when persistable studio state changes. */
export function useProjectAutoSave(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return

    let prev = pickPersistableState(useStudioStore.getState())
    const unsub = useStudioStore.subscribe((state) => {
      const next = pickPersistableState(state)
      if (shallow(next, prev)) return
      prev = next
      scheduleProjectSave()
    })

    return unsub
  }, [enabled])
}
