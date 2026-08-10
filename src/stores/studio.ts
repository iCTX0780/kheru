import { create } from 'zustand'
import type { WordTiming } from '@/lib/playback-words'
import { revokeManagedBlobUrl } from '@/lib/client-tts/blob-registry'
import type { ImportBlock } from '@/lib/parse-script'
import {
  appendGenerationWithLimit,
  computeParagraphStatus,
  createGenerationFromParagraph,
  draftDiffersFromGeneration,
  migrateParagraphToV2,
  resolveActiveGeneration,
  syncParagraphFromActiveGeneration,
} from '@/lib/paragraph-generations'
import { deleteParagraphGenerationAudioOpfs } from '@/lib/client-tts/opfs'
import { releaseChapterAudioResources } from '@/lib/chapter-cleanup'
import type { ProjectChapter } from '@/lib/project-db'
import { createDefaultChapter, syncChapterSnapshot } from '@/lib/project-db'
import { DEFAULT_VOICE_ID, lengthScaleForSpeaker, voiceForSpeaker, VOICE_BY_ID } from '@/lib/voice-catalog'

export type ParagraphStatus = 'idle' | 'generating' | 'done' | 'stale' | 'error'
export type ChapterStatus = 'idle' | 'generating' | 'done' | 'stale' | 'error'
export type PlaybackMode = 'paragraph' | 'chapter' | 'sequence' | null
export type StudioView = 'editor' | 'presenter'
export interface ParagraphGeneration {
  id: string
  createdAt: string
  textSnapshot: string
  voice: string
  lengthScale: number
  speaker?: string
  audioUrl: string
  duration: number
  wordTimings: WordTiming[] | null
  /** Stable ref for OPFS / clip audio (e.g. runId or generation id). */
  audioRef?: string
}

export interface Paragraph {
  id: string
  text: string
  voice: string
  lengthScale: number
  /** Speaker label from imported script (e.g. INTERVIEWER, YOU). */
  speaker?: string
  audioUrl: string | null
  duration: number | null
  /** Clip-relative word timings from alignment when available. */
  wordTimings: WordTiming[] | null
  status: ParagraphStatus
  error?: string
  generations: ParagraphGeneration[]
  activeGenerationId: string | null
}

export interface PlaybackSegment {
  paragraphId: string
  start: number
  end: number
  label: string
}

export interface Chapter {
  audioUrl: string | null
  segments: PlaybackSegment[]
  status: ChapterStatus
  error?: string
}

export interface PlaybackState {
  mode: PlaybackMode
  isPlaying: boolean
  currentTime: number
  activeParagraphId: string | null
  activeWordIndex: number | null
  playingParagraphId: string | null
  /** Ordered paragraph ids for sequence (play-all) mode */
  sequenceParagraphIds: string[]
  sequenceIndex: number
  sequenceTimeOffset: number
  /** Segments shown on timeline (full mix or built from paragraph clips) */
  timelineSegments: PlaybackSegment[]
  /** Preview-only playback rate (does not affect TTS export) */
  previewPlaybackRate: number
}

export interface GenerationSession {
  active: boolean
  paragraphIds: string[]
  currentIndex: number
  completedIds: string[]
  startedAt: number | null
  estimatedTotalMs: number | null
  /** Client TTS: synthesizing vs align step for current paragraph */
  paragraphPhase: 'synthesizing' | 'aligning' | null
  cancelRequested: boolean
  failedId?: string
  error?: string
}

const initialGenerationSession: GenerationSession = {
  active: false,
  paragraphIds: [],
  currentIndex: 0,
  completedIds: [],
  startedAt: null,
  estimatedTotalMs: null,
  paragraphPhase: null,
  cancelRequested: false,
}

export interface StudioStore {
  paragraphs: Paragraph[]
  voices: string[]
  chapter: Chapter
  playback: PlaybackState
  selectedParagraphId: string | null
  generationSession: GenerationSession
  projectId: string
  projectTitle: string
  chapterTitle: string
  chapters: ProjectChapter[]
  activeChapterId: string
  view: StudioView

  setVoices: (voices: string[], defaultVoice?: string) => void
  setSelectedParagraphId: (id: string | null) => void
  setView: (view: StudioView) => void
  setProjectId: (id: string) => void
  setProjectTitle: (title: string) => void
  setChapterTitle: (title: string) => void
  addChapter: () => void
  switchChapter: (chapterId: string) => void
  deleteChapter: (chapterId: string) => boolean
  loadProject: (project: {
    id: string
    title: string
    chapters: ProjectChapter[]
    activeChapterId: string
  }) => void
  addParagraph: (afterId?: string) => void
  importParagraphs: (blocks: ImportBlock[], speakerVoiceMap?: Record<string, string>) => void
  updateParagraph: (id: string, updates: Partial<Pick<Paragraph, 'text' | 'voice' | 'lengthScale'>>) => void
  removeParagraph: (id: string) => void
  moveParagraph: (id: string, direction: 'up' | 'down') => void

  setParagraphGenerating: (id: string) => void
  setParagraphsGenerating: (ids: string[]) => void
  setParagraphDone: (id: string, audioUrl: string, duration: number, wordTimings?: WordTiming[] | null) => void
  appendParagraphGeneration: (
    id: string,
    audioUrl: string,
    duration: number,
    wordTimings?: WordTiming[] | null,
    audioRef?: string
  ) => void
  selectParagraphGeneration: (paragraphId: string, generationId: string) => void
  deleteParagraphGeneration: (paragraphId: string, generationId: string) => void
  applyParagraphWordTimings: (items: { id: string; wordTimings: WordTiming[] }[]) => void
  setParagraphError: (id: string, message: string) => void

  setChapterGenerating: () => void
  setChapterDone: (audioUrl: string, segments: PlaybackSegment[]) => void
  setChapterError: (message: string) => void

  invalidateParagraphAudio: (id: string) => void
  invalidateChapterAudio: () => void

  setPlayback: (updates: Partial<PlaybackState>) => void
  resetPlayback: () => void
  setPreviewPlaybackRate: (rate: number) => void

  startGenerationSession: (paragraphIds: string[], estimatedTotalMs?: number) => void
  setGenerationParagraphPhase: (phase: 'synthesizing' | 'aligning' | null) => void
  advanceGenerationSession: (completedId: string) => void
  finishGenerationSession: () => void
  failGenerationSession: (failedId: string | undefined, error: string) => void
  requestCancelGeneration: () => void
  finalizeCancelledGeneration: () => void
}

function createParagraph(voice: string): Paragraph {
  const lengthScale = VOICE_BY_ID[voice]?.defaultLengthScale ?? 1.0
  return {
    id: crypto.randomUUID(),
    text: '',
    voice,
    lengthScale,
    audioUrl: null,
    duration: null,
    wordTimings: null,
    status: 'idle',
    generations: [],
    activeGenerationId: null,
  }
}

function syncChapters(
  chapters: ProjectChapter[],
  activeChapterId: string,
  title: string,
  paragraphs: Paragraph[],
  chapter: Chapter
): ProjectChapter[] {
  return syncChapterSnapshot(chapters, activeChapterId, title, paragraphs, chapter)
}

function markChapterStale(chapter: Chapter): Chapter {
  if (chapter.status === 'idle') return chapter
  return { ...chapter, status: 'stale' }
}

function paragraphAfterEdit(paragraph: Paragraph, updates: Partial<Pick<Paragraph, 'text' | 'voice' | 'lengthScale'>>): Paragraph {
  const next = { ...paragraph, ...updates }
  const active = resolveActiveGeneration(paragraph)
  if (!active) return next

  const contentChanged =
    (updates.text !== undefined && updates.text !== paragraph.text) ||
    (updates.voice !== undefined && updates.voice !== paragraph.voice) ||
    (updates.lengthScale !== undefined && updates.lengthScale !== paragraph.lengthScale)

  if (!contentChanged) return next

  const status = draftDiffersFromGeneration(next, active) ? 'stale' : 'done'
  return {
    ...next,
    status,
    audioUrl: active.audioUrl,
    duration: active.duration,
    wordTimings: active.wordTimings,
  }
}

const initialPlayback: PlaybackState = {
  mode: null,
  isPlaying: false,
  currentTime: 0,
  activeParagraphId: null,
  activeWordIndex: null,
  playingParagraphId: null,
  sequenceParagraphIds: [],
  sequenceIndex: 0,
  sequenceTimeOffset: 0,
  timelineSegments: [],
  previewPlaybackRate: 1,
}

function withSyncedChapters<T extends {
  paragraphs: Paragraph[]
  chapter: Chapter
  chapterTitle: string
  chapters: ProjectChapter[]
  activeChapterId: string
}>(
  state: T,
  updates: Partial<Pick<T, 'paragraphs' | 'chapter' | 'chapterTitle'>> & Record<string, unknown>
): T & { chapters: ProjectChapter[] } {
  const paragraphs = (updates.paragraphs as Paragraph[] | undefined) ?? state.paragraphs
  const chapter = (updates.chapter as Chapter | undefined) ?? state.chapter
  const chapterTitle = (updates.chapterTitle as string | undefined) ?? state.chapterTitle
  return {
    ...state,
    ...updates,
    paragraphs,
    chapter,
    chapterTitle,
    chapters: syncChapters(state.chapters, state.activeChapterId, chapterTitle, paragraphs, chapter),
  } as T & { chapters: ProjectChapter[] }
}

function normalizeParagraph(paragraph: Paragraph): Paragraph {
  const migrated = migrateParagraphToV2(paragraph)
  const normalized: Paragraph = {
    ...migrated,
    text: typeof migrated.text === 'string' ? migrated.text : '',
    wordTimings: migrated.wordTimings ?? null,
    generations: migrated.generations ?? [],
    activeGenerationId: migrated.activeGenerationId ?? null,
  }

  // Orphaned in-flight generation cannot resume after reload.
  if (normalized.status === 'generating') {
    if (normalized.audioUrl && normalized.duration) {
      return syncParagraphFromActiveGeneration({ ...normalized, status: 'done', error: undefined })
    }
    return { ...normalized, status: 'idle', error: undefined }
  }

  return syncParagraphFromActiveGeneration(normalized)
}

export const useStudioStore = create<StudioStore>()((set) => ({
  paragraphs: [],
  voices: [],
  chapter: { audioUrl: null, segments: [], status: 'idle' },
  playback: initialPlayback,
  selectedParagraphId: null,
  generationSession: initialGenerationSession,
  projectId: '',
  projectTitle: 'Untitled project',
  chapterTitle: 'Script',
  chapters: [],
  activeChapterId: '',
  view: 'editor',

  setSelectedParagraphId: (id) => set({ selectedParagraphId: id }),

  setView: (view) => set({ view }),

  setProjectId: (id) => set({ projectId: id }),

  setProjectTitle: (title) => set({ projectTitle: title }),

  setChapterTitle: (title) =>
    set((state) => withSyncedChapters(state, { chapterTitle: title })),

  loadProject: (project) => {
    const chapter =
      project.chapters.find((c) => c.id === project.activeChapterId) ?? project.chapters[0]
    if (!chapter) return
    set({
      projectId: project.id,
      projectTitle: project.title,
      chapters: project.chapters.map((c) => ({
        ...c,
        paragraphs: c.paragraphs.map(normalizeParagraph),
      })),
      activeChapterId: chapter.id,
      chapterTitle: chapter.title,
      paragraphs: chapter.paragraphs.map(normalizeParagraph),
      chapter:
        chapter.chapter.status === 'generating'
          ? { ...chapter.chapter, status: chapter.chapter.audioUrl ? 'done' : 'idle', error: undefined }
          : chapter.chapter,
      playback: initialPlayback,
      generationSession: initialGenerationSession,
      selectedParagraphId: chapter.paragraphs[0]?.id ?? null,
    })
  },

  addChapter: () =>
    set((state) => {
      const synced = syncChapters(
        state.chapters,
        state.activeChapterId,
        state.chapterTitle,
        state.paragraphs,
        state.chapter
      )
      const voice = state.voices[0] || ''
      const newChapter = createDefaultChapter(`Chapter ${synced.length + 1}`, voice)
      return {
        chapters: [...synced, newChapter],
        activeChapterId: newChapter.id,
        chapterTitle: newChapter.title,
        paragraphs: newChapter.paragraphs,
        chapter: newChapter.chapter,
        playback: initialPlayback,
        selectedParagraphId: newChapter.paragraphs[0]?.id ?? null,
      }
    }),

  switchChapter: (chapterId) =>
    set((state) => {
      if (chapterId === state.activeChapterId) return state
      const synced = syncChapters(
        state.chapters,
        state.activeChapterId,
        state.chapterTitle,
        state.paragraphs,
        state.chapter
      )
      const next = synced.find((c) => c.id === chapterId)
      if (!next) return state
      return {
        chapters: synced,
        activeChapterId: next.id,
        chapterTitle: next.title,
        paragraphs: next.paragraphs,
        chapter: next.chapter,
        playback: initialPlayback,
        selectedParagraphId: next.paragraphs[0]?.id ?? null,
      }
    }),

  deleteChapter: (chapterId) => {
    let deleted = false
    set((state) => {
      const synced = syncChapters(
        state.chapters,
        state.activeChapterId,
        state.chapterTitle,
        state.paragraphs,
        state.chapter
      )
      if (synced.length <= 1) return state

      const target = synced.find((c) => c.id === chapterId)
      if (!target) return state

      releaseChapterAudioResources(state.projectId, target)
      const remaining = synced.filter((c) => c.id !== chapterId)
      deleted = true

      if (chapterId !== state.activeChapterId) {
        return { ...state, chapters: remaining }
      }

      const deletedIndex = synced.findIndex((c) => c.id === chapterId)
      const next = remaining[Math.min(deletedIndex, remaining.length - 1)]
      return {
        chapters: remaining,
        activeChapterId: next.id,
        chapterTitle: next.title,
        paragraphs: next.paragraphs,
        chapter: next.chapter,
        playback: initialPlayback,
        generationSession: initialGenerationSession,
        selectedParagraphId: next.paragraphs[0]?.id ?? null,
      }
    })
    return deleted
  },

  setPreviewPlaybackRate: (rate) =>
    set((state) => ({
      playback: { ...state.playback, previewPlaybackRate: rate },
    })),

  setVoices: (voices, defaultVoice) =>
    set((state) => {
      const fallback = defaultVoice || voices[0] || ''
      const paragraphs =
        state.paragraphs.length > 0
          ? state.paragraphs
          : fallback
            ? [createParagraph(fallback)]
            : []
      return {
        voices,
        paragraphs: paragraphs.map((p) => ({
          ...p,
          voice: voices.includes(p.voice) ? p.voice : fallback,
        })),
        selectedParagraphId:
          state.selectedParagraphId && paragraphs.some((p) => p.id === state.selectedParagraphId)
            ? state.selectedParagraphId
            : paragraphs[0]?.id ?? null,
      }
    }),

  addParagraph: (afterId) =>
    set((state) => {
      const voice = state.voices[0] || ''
      const paragraph = createParagraph(voice)
      if (!afterId) {
        return withSyncedChapters(state, {
          paragraphs: [...state.paragraphs, paragraph],
          chapter: markChapterStale(state.chapter),
          selectedParagraphId: paragraph.id,
        })
      }
      const index = state.paragraphs.findIndex((p) => p.id === afterId)
      const paragraphs = [...state.paragraphs]
      paragraphs.splice(index + 1, 0, paragraph)
      return withSyncedChapters(state, {
        paragraphs,
        chapter: markChapterStale(state.chapter),
        selectedParagraphId: paragraph.id,
      })
    }),

  importParagraphs: (blocks, speakerVoiceMap) =>
    set((state) => {
      const fallback = state.voices[0] || DEFAULT_VOICE_ID
      const imported = blocks
        .filter((block) => block.text.trim())
        .map((block) => {
          const voice = voiceForSpeaker(block.speaker, fallback, state.voices, speakerVoiceMap)
          const voiceDefault = VOICE_BY_ID[voice]?.defaultLengthScale ?? 1.0
          return {
            ...createParagraph(voice),
            text: block.text.trim(),
            speaker: block.speaker,
            lengthScale: lengthScaleForSpeaker(block.speaker, voiceDefault),
          }
        })
      return withSyncedChapters(state, {
        paragraphs: imported.length > 0 ? imported : state.paragraphs,
        chapter: { audioUrl: null, segments: [], status: 'idle' },
        playback: initialPlayback,
        selectedParagraphId: imported[0]?.id ?? state.selectedParagraphId,
      })
    }),

  updateParagraph: (id, updates) =>
    set((state) =>
      withSyncedChapters(state, {
        paragraphs: state.paragraphs.map((p) => (p.id === id ? paragraphAfterEdit(p, updates) : p)),
        chapter: markChapterStale(state.chapter),
      })
    ),

  removeParagraph: (id) =>
    set((state) => {
      const removed = state.paragraphs.find((p) => p.id === id)
      revokeManagedBlobUrl(removed?.audioUrl)
      for (const gen of removed?.generations ?? []) {
        revokeManagedBlobUrl(gen.audioUrl)
      }
      const paragraphs = state.paragraphs.filter((p) => p.id !== id)
      const nextParagraphs =
        paragraphs.length > 0 ? paragraphs : state.voices[0] ? [createParagraph(state.voices[0])] : []
      const removedIndex = state.paragraphs.findIndex((p) => p.id === id)
      let selectedParagraphId = state.selectedParagraphId
      if (selectedParagraphId === id) {
        selectedParagraphId =
          nextParagraphs[Math.min(removedIndex, nextParagraphs.length - 1)]?.id ?? null
      }
      return withSyncedChapters(state, {
        paragraphs: nextParagraphs,
        chapter: markChapterStale(state.chapter),
        selectedParagraphId,
      })
    }),

  moveParagraph: (id, direction) =>
    set((state) => {
      const index = state.paragraphs.findIndex((p) => p.id === id)
      if (index === -1) return state
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= state.paragraphs.length) return state
      const paragraphs = [...state.paragraphs]
      ;[paragraphs[index], paragraphs[target]] = [paragraphs[target], paragraphs[index]]
      return withSyncedChapters(state, { paragraphs, chapter: markChapterStale(state.chapter) })
    }),

  setParagraphGenerating: (id) =>
    set((state) => ({
      paragraphs: state.paragraphs.map((p) =>
        p.id === id ? { ...p, status: 'generating', error: undefined } : p
      ),
    })),

  setParagraphsGenerating: (ids) =>
    set((state) => {
      const idSet = new Set(ids)
      return {
        paragraphs: state.paragraphs.map((p) =>
          idSet.has(p.id) ? { ...p, status: 'generating', error: undefined } : p
        ),
      }
    }),

  setParagraphDone: (id, audioUrl, duration, wordTimings = null) =>
    set((state) => {
      const paragraph = state.paragraphs.find((p) => p.id === id)
      if (!paragraph) return state
      const generation = createGenerationFromParagraph(paragraph, audioUrl, duration, wordTimings)
      const { generations, evicted } = appendGenerationWithLimit(paragraph.generations ?? [], generation)
      for (const removed of evicted) {
        revokeManagedBlobUrl(removed.audioUrl)
        void deleteParagraphGenerationAudioOpfs(state.projectId, id, removed.id)
      }
      const updated = syncParagraphFromActiveGeneration({
        ...paragraph,
        generations,
        activeGenerationId: generation.id,
        status: 'done',
        error: undefined,
      })
      return withSyncedChapters(state, {
        paragraphs: state.paragraphs.map((p) => (p.id === id ? updated : p)),
        chapter: markChapterStale(state.chapter),
      })
    }),

  appendParagraphGeneration: (id, audioUrl, duration, wordTimings = null, audioRef) =>
    set((state) => {
      const paragraph = state.paragraphs.find((p) => p.id === id)
      if (!paragraph) return state
      const generation = createGenerationFromParagraph(
        paragraph,
        audioUrl,
        duration,
        wordTimings,
        audioRef
      )
      const { generations, evicted } = appendGenerationWithLimit(paragraph.generations ?? [], generation)
      for (const removed of evicted) {
        revokeManagedBlobUrl(removed.audioUrl)
        void deleteParagraphGenerationAudioOpfs(state.projectId, id, removed.id)
      }
      const updated = syncParagraphFromActiveGeneration({
        ...paragraph,
        generations,
        activeGenerationId: generation.id,
        status: 'done',
        error: undefined,
      })
      return withSyncedChapters(state, {
        paragraphs: state.paragraphs.map((p) => (p.id === id ? updated : p)),
        chapter: markChapterStale(state.chapter),
      })
    }),

  selectParagraphGeneration: (paragraphId, generationId) =>
    set((state) => {
      const paragraph = state.paragraphs.find((p) => p.id === paragraphId)
      if (!paragraph) return state
      const generation = paragraph.generations?.find((g) => g.id === generationId)
      if (!generation) return state

      const updated = syncParagraphFromActiveGeneration({
        ...paragraph,
        activeGenerationId: generationId,
        status: computeParagraphStatus(paragraph, generation),
      })
      return withSyncedChapters(state, {
        paragraphs: state.paragraphs.map((p) => (p.id === paragraphId ? updated : p)),
        chapter: markChapterStale(state.chapter),
      })
    }),

  deleteParagraphGeneration: (paragraphId, generationId) =>
    set((state) => {
      const paragraph = state.paragraphs.find((p) => p.id === paragraphId)
      if (!paragraph) return state
      const generation = paragraph.generations?.find((g) => g.id === generationId)
      if (!generation) return state

      revokeManagedBlobUrl(generation.audioUrl)
      void deleteParagraphGenerationAudioOpfs(state.projectId, paragraphId, generationId)

      const generations = (paragraph.generations ?? []).filter((g) => g.id !== generationId)
      let activeGenerationId = paragraph.activeGenerationId
      if (activeGenerationId === generationId) {
        activeGenerationId = generations.at(-1)?.id ?? null
      }

      const updated = syncParagraphFromActiveGeneration({
        ...paragraph,
        generations,
        activeGenerationId,
        error: undefined,
      })
      return withSyncedChapters(state, {
        paragraphs: state.paragraphs.map((p) => (p.id === paragraphId ? updated : p)),
        chapter: markChapterStale(state.chapter),
      })
    }),

  applyParagraphWordTimings: (items) =>
    set((state) => {
      const byId = new Map(items.map((item) => [item.id, item.wordTimings]))
      return withSyncedChapters(state, {
        paragraphs: state.paragraphs.map((p) => {
          const wordTimings = byId.get(p.id)
          if (!wordTimings) return p
          const activeId = p.activeGenerationId
          const generations = (p.generations ?? []).map((g) =>
            g.id === activeId ? { ...g, wordTimings } : g
          )
          return syncParagraphFromActiveGeneration({ ...p, generations, wordTimings })
        }),
      })
    }),

  setParagraphError: (id, message) =>
    set((state) => ({
      paragraphs: state.paragraphs.map((p) =>
        p.id === id ? { ...p, status: 'error', error: message } : p
      ),
    })),

  setChapterGenerating: () =>
    set((state) => ({
      chapter: { ...state.chapter, status: 'generating', error: undefined },
    })),

  setChapterDone: (audioUrl, segments) =>
    set((state) =>
      withSyncedChapters(state, {
        chapter: { audioUrl, segments, status: 'done', error: undefined },
      })
    ),

  setChapterError: (message) =>
    set((state) =>
      withSyncedChapters(state, {
        chapter: { ...state.chapter, status: 'error', error: message },
      })
    ),

  invalidateParagraphAudio: (id) =>
    set((state) => {
      const paragraph = state.paragraphs.find((p) => p.id === id)
      revokeManagedBlobUrl(paragraph?.audioUrl)
      return withSyncedChapters(state, {
        paragraphs: state.paragraphs.map((p) =>
          p.id === id
            ? syncParagraphFromActiveGeneration({
                ...p,
                status: p.generations?.length ? 'stale' : 'idle',
                audioUrl: null,
                duration: null,
                wordTimings: null,
              })
            : p
        ),
      })
    }),

  invalidateChapterAudio: () =>
    set((state) => {
      revokeManagedBlobUrl(state.chapter.audioUrl)
      return withSyncedChapters(state, {
        chapter: {
          ...state.chapter,
          status: state.chapter.status === 'idle' ? 'idle' : 'stale',
          audioUrl: null,
          segments: [],
        },
      })
    }),

  setPlayback: (updates) =>
    set((state) => ({
      playback: { ...state.playback, ...updates },
    })),

  resetPlayback: () => set({ playback: initialPlayback }),

  startGenerationSession: (paragraphIds, estimatedTotalMs) =>
    set({
      generationSession: {
        active: true,
        paragraphIds,
        currentIndex: 0,
        completedIds: [],
        startedAt: Date.now(),
        estimatedTotalMs: estimatedTotalMs ?? null,
        paragraphPhase: 'synthesizing',
        cancelRequested: false,
      },
    }),

  setGenerationParagraphPhase: (phase) =>
    set((state) => ({
      generationSession: {
        ...state.generationSession,
        paragraphPhase: phase,
      },
    })),

  advanceGenerationSession: (completedId) =>
    set((state) => {
      const session = state.generationSession
      if (!session.active) return state
      const completedIds = [...session.completedIds, completedId]
      const currentIndex = Math.min(session.currentIndex + 1, session.paragraphIds.length)
      return {
        generationSession: {
          ...session,
          completedIds,
          currentIndex,
          paragraphPhase: 'synthesizing',
        },
      }
    }),

  finishGenerationSession: () =>
    set({ generationSession: initialGenerationSession }),

  failGenerationSession: (failedId, error) =>
    set((state) => ({
      generationSession: {
        ...state.generationSession,
        active: false,
        failedId,
        error,
      },
    })),

  requestCancelGeneration: () =>
    set((state) => ({
      generationSession: {
        ...state.generationSession,
        cancelRequested: true,
      },
    })),

  finalizeCancelledGeneration: () =>
    set((state) => {
      const session = state.generationSession
      const paragraphs = state.paragraphs.map((paragraph) => {
        if (paragraph.status !== 'generating') return paragraph
        return syncParagraphFromActiveGeneration({
          ...paragraph,
          error: undefined,
        })
      })

      let chapter = state.chapter
      if (chapter.status === 'generating') {
        if (session.completedIds.length > 0) {
          chapter = { ...chapter, status: 'stale', error: undefined }
        } else {
          chapter = {
            ...chapter,
            status: chapter.audioUrl ? 'stale' : 'idle',
            error: undefined,
          }
        }
      }

      return withSyncedChapters(state, {
        paragraphs,
        chapter,
        generationSession: initialGenerationSession,
      })
    }),
}))