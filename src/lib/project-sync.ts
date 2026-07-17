import { useStudioStore, type StudioStore } from '@/stores/studio'
import {
  type ProjectRecord,
  saveProjectToIDB,
  setMetaValue,
  syncChapterSnapshot,
} from '@/lib/project-db'

export function studioStateToProject(state: StudioStore): ProjectRecord {
  const chapters = syncChapterSnapshot(
    state.chapters,
    state.activeChapterId,
    state.chapterTitle,
    state.paragraphs,
    state.chapter
  )
  return {
    id: state.projectId,
    title: state.projectTitle,
    chapters,
    activeChapterId: state.activeChapterId,
    updatedAt: new Date().toISOString(),
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let idleCallbackId: number | null = null

export function scheduleProjectSave(): void {
  if (typeof window === 'undefined') return

  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    const run = () => {
      void flushProjectSave()
    }
    if ('requestIdleCallback' in window) {
      idleCallbackId = window.requestIdleCallback(run, { timeout: 2000 })
    } else {
      run()
    }
  }, 500)
}

export async function flushProjectSave(): Promise<void> {
  const state = useStudioStore.getState()
  if (!state.projectId) return

  const project = studioStateToProject(state)
  await saveProjectToIDB(project)
  await setMetaValue('lastActiveProjectId', project.id)
}

export function cancelScheduledProjectSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (idleCallbackId != null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
    window.cancelIdleCallback(idleCallbackId)
    idleCallbackId = null
  }
}
