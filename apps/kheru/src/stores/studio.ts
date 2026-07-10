import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { WordTiming } from '@/lib/playback-words'
import type { ImportBlock } from '@/lib/parse-script'
import { DEFAULT_VOICE_ID, lengthScaleForSpeaker, voiceForSpeaker, VOICE_BY_ID } from '@/lib/voice-catalog'

export type ParagraphStatus = 'idle' | 'generating' | 'done' | 'stale' | 'error'
export type ChapterStatus = 'idle' | 'generating' | 'done' | 'stale' | 'error'
export type PlaybackMode = 'paragraph' | 'chapter' | 'sequence' | null
export type StudioPlayMode = 'selection' | 'until-end'

export interface Paragraph {
  id: string
  text: string
  voice: string
  lengthScale: number
  /** Speaker label from imported script (e.g. INTERVIEWER, YOU). */
  speaker?: string
  audioUrl: string | null
  duration: number | null
  /** Clip-relative word timings from Gentle alignment (when available). */
  wordTimings: WordTiming[] | null
  status: ParagraphStatus
  error?: string
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
  /** Segments shown on timeline (chapter or built from paragraph clips) */
  timelineSegments: PlaybackSegment[]
  /** Preview-only playback rate (does not affect TTS export) */
  previewPlaybackRate: number
}

export interface GenerationSession {
  active: boolean
  paragraphIds: string[]
  currentIndex: number
  completedIds: string[]
  failedId?: string
  error?: string
}

const initialGenerationSession: GenerationSession = {
  active: false,
  paragraphIds: [],
  currentIndex: 0,
  completedIds: [],
}

export interface StudioStore {
  paragraphs: Paragraph[]
  voices: string[]
  chapter: Chapter
  playback: PlaybackState
  selectedParagraphId: string | null
  studioPlayMode: StudioPlayMode
  generationSession: GenerationSession
  projectTitle: string
  chapterTitle: string

  setVoices: (voices: string[], defaultVoice?: string) => void
  setSelectedParagraphId: (id: string | null) => void
  setStudioPlayMode: (mode: StudioPlayMode) => void
  setProjectTitle: (title: string) => void
  setChapterTitle: (title: string) => void
  addParagraph: (afterId?: string) => void
  importParagraphs: (blocks: ImportBlock[]) => void
  updateParagraph: (id: string, updates: Partial<Pick<Paragraph, 'text' | 'voice' | 'lengthScale'>>) => void
  removeParagraph: (id: string) => void
  moveParagraph: (id: string, direction: 'up' | 'down') => void

  setParagraphGenerating: (id: string) => void
  setParagraphsGenerating: (ids: string[]) => void
  setParagraphDone: (id: string, audioUrl: string, duration: number, wordTimings?: WordTiming[] | null) => void
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

  startGenerationSession: (paragraphIds: string[]) => void
  advanceGenerationSession: (completedId: string) => void
  finishGenerationSession: () => void
  failGenerationSession: (failedId: string | undefined, error: string) => void
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
  }
}

function markChapterStale(chapter: Chapter): Chapter {
  if (chapter.status === 'idle') return chapter
  return { ...chapter, status: 'stale' }
}

function paragraphAfterEdit(paragraph: Paragraph, updates: Partial<Pick<Paragraph, 'text' | 'voice' | 'lengthScale'>>): Paragraph {
  const next = { ...paragraph, ...updates }
  if (paragraph.status === 'done' || paragraph.status === 'stale') {
    const contentChanged =
      (updates.text !== undefined && updates.text !== paragraph.text) ||
      (updates.voice !== undefined && updates.voice !== paragraph.voice) ||
      (updates.lengthScale !== undefined && updates.lengthScale !== paragraph.lengthScale)
    if (contentChanged) {
      next.status = 'stale'
      next.audioUrl = paragraph.audioUrl
      next.duration = paragraph.duration
      next.wordTimings = paragraph.wordTimings
    }
  }
  return next
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

interface PersistedStudio {
  paragraphs: Paragraph[]
  chapter: Chapter
  projectTitle?: string
  chapterTitle?: string
}

function normalizeParagraph(paragraph: Paragraph): Paragraph {
  const normalized: Paragraph = {
    ...paragraph,
    text: typeof paragraph.text === 'string' ? paragraph.text : '',
    wordTimings: paragraph.wordTimings ?? null,
  }

  // Orphaned in-flight generation cannot resume after reload.
  if (normalized.status === 'generating') {
    if (normalized.audioUrl && normalized.duration) {
      return { ...normalized, status: 'done', error: undefined }
    }
    return { ...normalized, status: 'idle', error: undefined }
  }

  return normalized
}

export const useStudioStore = create<StudioStore>()(
  persist(
    (set) => ({
  paragraphs: [],
  voices: [],
  chapter: { audioUrl: null, segments: [], status: 'idle' },
  playback: initialPlayback,
  selectedParagraphId: null,
  studioPlayMode: 'until-end',
  generationSession: initialGenerationSession,
  projectTitle: 'Untitled project',
  chapterTitle: 'Chapter 1',

  setSelectedParagraphId: (id) => set({ selectedParagraphId: id }),

  setStudioPlayMode: (mode) => set({ studioPlayMode: mode }),

  setProjectTitle: (title) => set({ projectTitle: title }),

  setChapterTitle: (title) => set({ chapterTitle: title }),

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
        return {
          paragraphs: [...state.paragraphs, paragraph],
          chapter: markChapterStale(state.chapter),
          selectedParagraphId: paragraph.id,
        }
      }
      const index = state.paragraphs.findIndex((p) => p.id === afterId)
      const paragraphs = [...state.paragraphs]
      paragraphs.splice(index + 1, 0, paragraph)
      return {
        paragraphs,
        chapter: markChapterStale(state.chapter),
        selectedParagraphId: paragraph.id,
      }
    }),

  importParagraphs: (blocks) =>
    set((state) => {
      const fallback = state.voices[0] || DEFAULT_VOICE_ID
      const imported = blocks
        .filter((block) => block.text.trim())
        .map((block) => {
          const voice = voiceForSpeaker(block.speaker, fallback, state.voices)
          const voiceDefault = VOICE_BY_ID[voice]?.defaultLengthScale ?? 1.0
          return {
            ...createParagraph(voice),
            text: block.text.trim(),
            speaker: block.speaker,
            lengthScale: lengthScaleForSpeaker(block.speaker, voiceDefault),
          }
        })
      return {
        paragraphs: imported.length > 0 ? imported : state.paragraphs,
        chapter: { audioUrl: null, segments: [], status: 'idle' },
        playback: initialPlayback,
        selectedParagraphId: imported[0]?.id ?? state.selectedParagraphId,
      }
    }),

  updateParagraph: (id, updates) =>
    set((state) => ({
      paragraphs: state.paragraphs.map((p) => (p.id === id ? paragraphAfterEdit(p, updates) : p)),
      chapter: markChapterStale(state.chapter),
    })),

  removeParagraph: (id) =>
    set((state) => {
      const paragraphs = state.paragraphs.filter((p) => p.id !== id)
      const nextParagraphs =
        paragraphs.length > 0 ? paragraphs : state.voices[0] ? [createParagraph(state.voices[0])] : []
      const removedIndex = state.paragraphs.findIndex((p) => p.id === id)
      let selectedParagraphId = state.selectedParagraphId
      if (selectedParagraphId === id) {
        selectedParagraphId =
          nextParagraphs[Math.min(removedIndex, nextParagraphs.length - 1)]?.id ?? null
      }
      return {
        paragraphs: nextParagraphs,
        chapter: markChapterStale(state.chapter),
        selectedParagraphId,
      }
    }),

  moveParagraph: (id, direction) =>
    set((state) => {
      const index = state.paragraphs.findIndex((p) => p.id === id)
      if (index === -1) return state
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= state.paragraphs.length) return state
      const paragraphs = [...state.paragraphs]
      ;[paragraphs[index], paragraphs[target]] = [paragraphs[target], paragraphs[index]]
      return { paragraphs, chapter: markChapterStale(state.chapter) }
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
    set((state) => ({
      paragraphs: state.paragraphs.map((p) =>
        p.id === id
          ? { ...p, status: 'done', audioUrl, duration, wordTimings, error: undefined }
          : p
      ),
    })),

  applyParagraphWordTimings: (items) =>
    set((state) => {
      const byId = new Map(items.map((item) => [item.id, item.wordTimings]))
      return {
        paragraphs: state.paragraphs.map((p) => {
          const wordTimings = byId.get(p.id)
          return wordTimings ? { ...p, wordTimings } : p
        }),
      }
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
    set(() => ({
      chapter: { audioUrl, segments, status: 'done', error: undefined },
    })),

  setChapterError: (message) =>
    set((state) => ({
      chapter: { ...state.chapter, status: 'error', error: message },
    })),

  invalidateParagraphAudio: (id) =>
    set((state) => ({
      paragraphs: state.paragraphs.map((p) =>
        p.id === id
          ? { ...p, status: 'stale', audioUrl: null, duration: null, wordTimings: null }
          : p
      ),
    })),

  invalidateChapterAudio: () =>
    set((state) => ({
      chapter: {
        ...state.chapter,
        status: state.chapter.status === 'idle' ? 'idle' : 'stale',
        audioUrl: null,
        segments: [],
      },
    })),

  setPlayback: (updates) =>
    set((state) => ({
      playback: { ...state.playback, ...updates },
    })),

  resetPlayback: () => set({ playback: initialPlayback }),

  startGenerationSession: (paragraphIds) =>
    set({
      generationSession: {
        active: true,
        paragraphIds,
        currentIndex: 0,
        completedIds: [],
      },
    }),

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
    }),
    {
      name: 'kheru-studio',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
      ),
      partialize: (state): PersistedStudio => ({
        paragraphs: state.paragraphs,
        chapter: state.chapter,
        projectTitle: state.projectTitle,
        chapterTitle: state.chapterTitle,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<PersistedStudio>
        let chapter = saved.chapter ?? current.chapter
        if (chapter.status === 'generating') {
          chapter = {
            ...chapter,
            status: chapter.audioUrl ? 'done' : 'idle',
            error: undefined,
          }
        }
        return {
          ...current,
          paragraphs: (saved.paragraphs ?? current.paragraphs).map(normalizeParagraph),
          chapter,
          projectTitle: saved.projectTitle ?? current.projectTitle,
          chapterTitle: saved.chapterTitle ?? current.chapterTitle,
          selectedParagraphId:
            current.selectedParagraphId ??
            (saved.paragraphs ?? current.paragraphs)[0]?.id ??
            null,
        }
      },
      skipHydration: true,
    }
  )
)