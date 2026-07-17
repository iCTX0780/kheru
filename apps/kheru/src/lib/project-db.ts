import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Chapter, Paragraph } from '@/stores/studio'

export const PROJECT_DB_NAME = 'kheru-db'
export const PROJECT_DB_VERSION = 1
export const SCHEMA_VERSION = 2

export interface ProjectChapter {
  id: string
  title: string
  paragraphs: Paragraph[]
  chapter: Chapter
}

export interface ProjectRecord {
  id: string
  title: string
  chapters: ProjectChapter[]
  activeChapterId: string
  updatedAt: string
}

interface MetaRecord {
  key: string
  value: string
}

interface KheruDbSchema extends DBSchema {
  projects: {
    key: string
    value: ProjectRecord
  }
  meta: {
    key: string
    value: MetaRecord
  }
}

let dbPromise: Promise<IDBPDatabase<KheruDbSchema>> | null = null

const idbMetrics = {
  puts: 0,
  gets: 0,
  totalPutMs: 0,
  totalGetMs: 0,
}

function trackIdbMetric(kind: 'put' | 'get', startedAt: number) {
  if (!import.meta.env.DEV) return
  const elapsed = performance.now() - startedAt
  if (kind === 'put') {
    idbMetrics.puts++
    idbMetrics.totalPutMs += elapsed
  } else {
    idbMetrics.gets++
    idbMetrics.totalGetMs += elapsed
  }
  ;(globalThis as typeof globalThis & { __kheruIdbMetrics?: typeof idbMetrics }).__kheruIdbMetrics =
    idbMetrics
}

function getDb(): Promise<IDBPDatabase<KheruDbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<KheruDbSchema>(PROJECT_DB_NAME, PROJECT_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
}

export async function listProjectsFromIDB(): Promise<ProjectRecord[]> {
  const startedAt = performance.now()
  const db = await getDb()
  const projects = await db.getAll('projects')
  trackIdbMetric('get', startedAt)
  return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getProjectFromIDB(id: string): Promise<ProjectRecord | undefined> {
  const startedAt = performance.now()
  const db = await getDb()
  const project = await db.get('projects', id)
  trackIdbMetric('get', startedAt)
  return project
}

export async function saveProjectToIDB(project: ProjectRecord): Promise<void> {
  const startedAt = performance.now()
  const db = await getDb()
  await db.put('projects', { ...project, updatedAt: new Date().toISOString() })
  trackIdbMetric('put', startedAt)
}

export async function deleteProjectFromIDB(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('projects', id)
}

export async function getMetaValue(key: string): Promise<string | null> {
  const db = await getDb()
  const row = await db.get('meta', key)
  return row?.value ?? null
}

export async function setMetaValue(key: string, value: string): Promise<void> {
  const db = await getDb()
  await db.put('meta', { key, value })
}

export const DEFAULT_SCRIPT_CHAPTER_TITLE = 'Script'

export function createDefaultChapter(
  title = DEFAULT_SCRIPT_CHAPTER_TITLE,
  voice = ''
): ProjectChapter {
  return {
    id: crypto.randomUUID(),
    title,
    paragraphs: voice
      ? [
          {
            id: crypto.randomUUID(),
            text: '',
            voice,
            lengthScale: 1,
            audioUrl: null,
            duration: null,
            wordTimings: null,
            status: 'idle',
            generations: [],
            activeGenerationId: null,
          },
        ]
      : [],
    chapter: { audioUrl: null, segments: [], status: 'idle' },
  }
}

export function createDefaultProject(voice = '', title = 'Untitled project'): ProjectRecord {
  const chapter = createDefaultChapter(DEFAULT_SCRIPT_CHAPTER_TITLE, voice)
  return {
    id: crypto.randomUUID(),
    title,
    chapters: [chapter],
    activeChapterId: chapter.id,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Flatten multi-chapter projects into a single Script workspace.
 * Preserves paragraph order across chapters; keeps the first chapter's mix metadata.
 */
export function flattenProjectToSingleChapter(project: ProjectRecord): {
  project: ProjectRecord
  changed: boolean
} {
  if (project.chapters.length <= 1) {
    const only = project.chapters[0]
    if (!only) return { project, changed: false }
    if (only.title === DEFAULT_SCRIPT_CHAPTER_TITLE && project.activeChapterId === only.id) {
      return { project, changed: false }
    }
    // Normalize sole chapter title / active id without merging
    const normalized: ProjectRecord = {
      ...project,
      activeChapterId: only.id,
      chapters: [{ ...only, title: DEFAULT_SCRIPT_CHAPTER_TITLE }],
    }
    const changed =
      only.title !== DEFAULT_SCRIPT_CHAPTER_TITLE || project.activeChapterId !== only.id
    return { project: normalized, changed }
  }

  const [first] = project.chapters
  const paragraphs = project.chapters.flatMap((c) => c.paragraphs)
  const merged: ProjectChapter = {
    ...first,
    title: DEFAULT_SCRIPT_CHAPTER_TITLE,
    paragraphs,
    // Drop stale full-mix — paragraph list changed across former chapters
    chapter: { audioUrl: null, segments: [], status: 'idle' },
  }

  return {
    project: {
      ...project,
      chapters: [merged],
      activeChapterId: merged.id,
    },
    changed: true,
  }
}

export function syncChapterSnapshot(
  chapters: ProjectChapter[],
  activeChapterId: string,
  title: string,
  paragraphs: Paragraph[],
  chapter: Chapter
): ProjectChapter[] {
  const exists = chapters.some((c) => c.id === activeChapterId)
  const snapshot: ProjectChapter = {
    id: activeChapterId,
    title,
    paragraphs,
    chapter,
  }
  if (!exists) return [...chapters, snapshot]
  return chapters.map((c) =>
    c.id === activeChapterId ? { ...c, title, paragraphs, chapter } : c
  )
}

export function activeChapter(project: ProjectRecord): ProjectChapter | undefined {
  return project.chapters.find((c) => c.id === project.activeChapterId) ?? project.chapters[0]
}

interface LegacyPersistedStudio {
  paragraphs?: Paragraph[]
  chapter?: Chapter
  projectTitle?: string
  chapterTitle?: string
}

export async function migrateLocalStorageToIDB(defaultVoice = ''): Promise<ProjectRecord | null> {
  if (typeof window === 'undefined') return null

  const migrated = await getMetaValue('schemaVersion')
  if (migrated === String(SCHEMA_VERSION)) return null

  const raw = localStorage.getItem('kheru-studio')
  if (!raw) {
    await setMetaValue('schemaVersion', String(SCHEMA_VERSION))
    return null
  }

  try {
    const parsed = JSON.parse(raw) as { state?: LegacyPersistedStudio }
    const state = parsed.state ?? (parsed as LegacyPersistedStudio)
    const project = createDefaultProject(defaultVoice, state.projectTitle ?? 'Untitled project')
    const chapter = activeChapter(project)!
    chapter.title = state.chapterTitle ?? DEFAULT_SCRIPT_CHAPTER_TITLE
    chapter.paragraphs = (state.paragraphs ?? chapter.paragraphs).map((p) => ({
      ...p,
      wordTimings: p.wordTimings ?? null,
    }))
    chapter.chapter = state.chapter ?? chapter.chapter

    await saveProjectToIDB(project)
    await setMetaValue('lastActiveProjectId', project.id)
    await setMetaValue('schemaVersion', String(SCHEMA_VERSION))
    localStorage.removeItem('kheru-studio')
    return project
  } catch {
    await setMetaValue('schemaVersion', String(SCHEMA_VERSION))
    return null
  }
}

export function projectSummary(project: ProjectRecord) {
  const paragraphs = project.chapters.flatMap((c) => c.paragraphs)
  const doneCount = paragraphs.filter((p) => p.status === 'done').length
  const voices = [...new Set(paragraphs.map((p) => p.voice).filter(Boolean))].slice(0, 5)
  return {
    id: project.id,
    title: project.title,
    updatedAt: project.updatedAt,
    paragraphCount: paragraphs.length,
    doneCount,
    voices,
  }
}

export type ProjectSummary = ReturnType<typeof projectSummary>
