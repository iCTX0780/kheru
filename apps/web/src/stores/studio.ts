import { create } from 'zustand'

export type ParagraphStatus = 'idle' | 'generating' | 'done' | 'stale' | 'error'
export type ChapterStatus = 'idle' | 'generating' | 'done' | 'stale' | 'error'
export type PlaybackMode = 'paragraph' | 'chapter' | 'sequence' | null

export interface Paragraph {
  id: string
  text: string
  voice: string
  lengthScale: number
  audioUrl: string | null
  duration: number | null
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
}

export interface StudioStore {
  paragraphs: Paragraph[]
  voices: string[]
  chapter: Chapter
  playback: PlaybackState

  setVoices: (voices: string[], defaultVoice?: string) => void
  addParagraph: (afterId?: string) => void
  importParagraphs: (texts: string[]) => void
  updateParagraph: (id: string, updates: Partial<Pick<Paragraph, 'text' | 'voice' | 'lengthScale'>>) => void
  removeParagraph: (id: string) => void
  moveParagraph: (id: string, direction: 'up' | 'down') => void

  setParagraphGenerating: (id: string) => void
  setParagraphDone: (id: string, audioUrl: string, duration: number) => void
  setParagraphError: (id: string, message: string) => void

  setChapterGenerating: () => void
  setChapterDone: (audioUrl: string, segments: PlaybackSegment[]) => void
  setChapterError: (message: string) => void

  setPlayback: (updates: Partial<PlaybackState>) => void
  resetPlayback: () => void
}

function createParagraph(voice: string): Paragraph {
  return {
    id: crypto.randomUUID(),
    text: '',
    voice,
    lengthScale: 1.0,
    audioUrl: null,
    duration: null,
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
}

export const useStudioStore = create<StudioStore>((set) => ({
  paragraphs: [],
  voices: [],
  chapter: { audioUrl: null, segments: [], status: 'idle' },
  playback: initialPlayback,

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
      }
    }),

  addParagraph: (afterId) =>
    set((state) => {
      const voice = state.voices[0] || ''
      const paragraph = createParagraph(voice)
      if (!afterId) {
        return { paragraphs: [...state.paragraphs, paragraph], chapter: markChapterStale(state.chapter) }
      }
      const index = state.paragraphs.findIndex((p) => p.id === afterId)
      const paragraphs = [...state.paragraphs]
      paragraphs.splice(index + 1, 0, paragraph)
      return { paragraphs, chapter: markChapterStale(state.chapter) }
    }),

  importParagraphs: (texts) =>
    set((state) => {
      const voice = state.voices[0] || ''
      const imported = texts.filter((t) => t.trim()).map((text) => ({
        ...createParagraph(voice),
        text: text.trim(),
      }))
      return {
        paragraphs: imported.length > 0 ? imported : state.paragraphs,
        chapter: { audioUrl: null, segments: [], status: 'idle' },
        playback: initialPlayback,
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
      return {
        paragraphs: paragraphs.length > 0 ? paragraphs : state.voices[0] ? [createParagraph(state.voices[0])] : [],
        chapter: markChapterStale(state.chapter),
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

  setParagraphDone: (id, audioUrl, duration) =>
    set((state) => ({
      paragraphs: state.paragraphs.map((p) =>
        p.id === id ? { ...p, status: 'done', audioUrl, duration, error: undefined } : p
      ),
    })),

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

  setPlayback: (updates) =>
    set((state) => ({
      playback: { ...state.playback, ...updates },
    })),

  resetPlayback: () => set({ playback: initialPlayback }),
}))