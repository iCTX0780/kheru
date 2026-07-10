import { useCallback } from 'react'
import { toast } from 'sonner'
import {
  turnFromParagraph,
  useGenerate,
  wordTimingsForTurn,
  segmentDurationFromResult,
  stitchRunIds,
  type GenerateResponse,
} from '@/lib/api'
import { resolveClipDuration } from '@/lib/audio-duration'
import { buildSegmentsFromParagraphs, playableParagraphs, PARAGRAPH_GAP_SECONDS } from '@/lib/playback-segments'
import { useStudioStore, type Paragraph } from '@/stores/studio'

async function applyParagraphResult(
  paragraph: Paragraph,
  result: GenerateResponse,
  setParagraphDone: ReturnType<typeof useStudioStore.getState>['setParagraphDone']
): Promise<string> {
  const audioUrl = result.clips?.[0]?.audio_url ?? result.audio_url
  const runId = result.clips?.[0]?.run_id ?? result.run_id
  const duration = await resolveClipDuration(audioUrl, segmentDurationFromResult(result, 0))
  const wordTimings = wordTimingsForTurn(result.words, 0)
  setParagraphDone(paragraph.id, audioUrl, duration, wordTimings.length > 0 ? wordTimings : null)
  return runId
}

function buildChapterSegments(paragraphs: Paragraph[]) {
  let offset = 0
  return paragraphs.map((p, index) => {
    const duration = p.duration ?? 0
    const segment = {
      paragraphId: p.id,
      start: offset,
      end: offset + duration,
      label: p.text.trim().slice(0, 40) + (p.text.trim().length > 40 ? '…' : ''),
    }
    offset += duration
    if (index < paragraphs.length - 1) {
      offset += PARAGRAPH_GAP_SECONDS
    }
    return segment
  })
}

export function useStudioActions() {
  const generate = useGenerate()

  const paragraphs = useStudioStore((s) => s.paragraphs)
  const chapter = useStudioStore((s) => s.chapter)
  const selectedParagraphId = useStudioStore((s) => s.selectedParagraphId)
  const studioPlayMode = useStudioStore((s) => s.studioPlayMode)
  const setChapterGenerating = useStudioStore((s) => s.setChapterGenerating)
  const setChapterDone = useStudioStore((s) => s.setChapterDone)
  const setChapterError = useStudioStore((s) => s.setChapterError)
  const setPlayback = useStudioStore((s) => s.setPlayback)
  const resetPlayback = useStudioStore((s) => s.resetPlayback)
  const setParagraphGenerating = useStudioStore((s) => s.setParagraphGenerating)
  const setParagraphDone = useStudioStore((s) => s.setParagraphDone)
  const setParagraphError = useStudioStore((s) => s.setParagraphError)
  const startGenerationSession = useStudioStore((s) => s.startGenerationSession)
  const advanceGenerationSession = useStudioStore((s) => s.advanceGenerationSession)
  const finishGenerationSession = useStudioStore((s) => s.finishGenerationSession)
  const failGenerationSession = useStudioStore((s) => s.failGenerationSession)

  const handleGenerateChapter = useCallback(async () => {
    const ready = paragraphs.filter((p) => p.text.trim())
    if (ready.length === 0) {
      toast.error('Add text to at least one paragraph')
      return
    }

    setChapterGenerating()
    startGenerationSession(ready.map((p) => p.id))
    resetPlayback()

    const runIds: string[] = []

    try {
      for (const paragraph of ready) {
        setParagraphGenerating(paragraph.id)

        const result = await generate.mutateAsync([
          turnFromParagraph(paragraph.id, paragraph.text.trim(), paragraph.voice, paragraph.lengthScale),
        ])

        const runId = await applyParagraphResult(paragraph, result, setParagraphDone)
        runIds.push(runId)
        advanceGenerationSession(paragraph.id)
      }

      const stitched = await stitchRunIds(runIds)
      const updatedParagraphs = useStudioStore.getState().paragraphs
      const segments = buildChapterSegments(
        ready.map((p) => updatedParagraphs.find((up) => up.id === p.id) ?? p)
      )

      setChapterDone(stitched.audio_url, segments)
      finishGenerationSession()

      setPlayback({
        mode: 'chapter',
        isPlaying: false,
        currentTime: 0,
        playingParagraphId: null,
        activeParagraphId: null,
        activeWordIndex: null,
        sequenceParagraphIds: [],
        sequenceIndex: 0,
        sequenceTimeOffset: 0,
        timelineSegments: segments,
      })
      toast.success(
        ready.length === 1 ? 'Paragraph generated' : `Generated ${ready.length} paragraphs`
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      const session = useStudioStore.getState().generationSession
      const failedDuringParagraph = session.completedIds.length < ready.length
      const failedId = failedDuringParagraph
        ? session.paragraphIds[session.currentIndex]
        : undefined

      if (failedId) {
        setParagraphError(failedId, message)
      }
      setChapterError(message)
      failGenerationSession(failedId, message)
      toast.error(message)
    }
  }, [
    generate,
    paragraphs,
    resetPlayback,
    setChapterDone,
    setChapterError,
    setChapterGenerating,
    setParagraphDone,
    setParagraphError,
    setParagraphGenerating,
    startGenerationSession,
    advanceGenerationSession,
    finishGenerationSession,
    failGenerationSession,
    setPlayback,
  ])

  const handleGenerateSelection = useCallback(async () => {
    const id = selectedParagraphId
    if (!id) {
      toast.error('Select a paragraph first')
      return
    }
    const paragraph = paragraphs.find((p) => p.id === id)
    if (!paragraph?.text.trim()) {
      toast.error('Add text before generating')
      return
    }

    startGenerationSession([paragraph.id])
    setParagraphGenerating(paragraph.id)
    try {
      const result = await generate.mutateAsync([
        turnFromParagraph(paragraph.id, paragraph.text.trim(), paragraph.voice, paragraph.lengthScale),
      ])
      await applyParagraphResult(paragraph, result, setParagraphDone)
      advanceGenerationSession(paragraph.id)
      finishGenerationSession()
      toast.success('Paragraph generated')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      setParagraphError(paragraph.id, message)
      failGenerationSession(paragraph.id, message)
      toast.error(message)
    }
  }, [
    generate,
    paragraphs,
    selectedParagraphId,
    setParagraphDone,
    setParagraphError,
    setParagraphGenerating,
    startGenerationSession,
    advanceGenerationSession,
    finishGenerationSession,
    failGenerationSession,
  ])

  const handlePlayParagraph = useCallback(
    (id: string, modeOverride?: 'selection' | 'until-end') => {
      const paragraph = paragraphs.find((p) => p.id === id)
      if (!paragraph?.audioUrl || paragraph.status !== 'done') return

      const playMode = modeOverride ?? studioPlayMode
      const playable = playableParagraphs(paragraphs)

      if (playMode === 'until-end' && playable.length > 1) {
        const index = playable.findIndex((p) => p.id === id)
        const segments = buildSegmentsFromParagraphs(playable)
        const segment = segments[index]
        setPlayback({
          mode: 'sequence',
          playingParagraphId: null,
          isPlaying: true,
          currentTime: segment?.start ?? 0,
          activeParagraphId: id,
          activeWordIndex: null,
          sequenceParagraphIds: playable.map((p) => p.id),
          sequenceIndex: Math.max(index, 0),
          sequenceTimeOffset: segment?.start ?? 0,
          timelineSegments: segments,
        })
        return
      }

      setPlayback({
        mode: 'paragraph',
        playingParagraphId: id,
        isPlaying: true,
        currentTime: 0,
        activeParagraphId: id,
        activeWordIndex: null,
        sequenceParagraphIds: [],
        sequenceIndex: 0,
        sequenceTimeOffset: 0,
        timelineSegments: [],
      })
    },
    [paragraphs, setPlayback, studioPlayMode]
  )

  const handlePlaySelection = useCallback(() => {
    if (!selectedParagraphId) {
      toast.error('Select a paragraph first')
      return
    }
    handlePlayParagraph(selectedParagraphId, studioPlayMode)
  }, [handlePlayParagraph, selectedParagraphId, studioPlayMode])

  /** Bottom player: prefer stitched chapter mix when available. */
  const handlePlayAll = useCallback(() => {
    if (chapter.status === 'done' && chapter.audioUrl) {
      setPlayback({
        mode: 'chapter',
        playingParagraphId: null,
        isPlaying: true,
        currentTime: 0,
        activeParagraphId: null,
        activeWordIndex: null,
        sequenceParagraphIds: [],
        sequenceIndex: 0,
        sequenceTimeOffset: 0,
        timelineSegments: chapter.segments,
      })
      return
    }

    const playable = playableParagraphs(paragraphs)
    if (playable.length === 0) {
      toast.error('Generate at least one paragraph, or generate chapter first')
      return
    }

    const segments = buildSegmentsFromParagraphs(playable)
    const firstId = playable[0].id
    setPlayback({
      mode: 'sequence',
      playingParagraphId: null,
      isPlaying: true,
      currentTime: 0,
      activeParagraphId: firstId,
      activeWordIndex: null,
      sequenceParagraphIds: playable.map((p) => p.id),
      sequenceIndex: 0,
      sequenceTimeOffset: 0,
      timelineSegments: segments,
    })
  }, [chapter.audioUrl, chapter.segments, chapter.status, paragraphs, setPlayback])

  const togglePlayPause = useCallback(() => {
    const { playback } = useStudioStore.getState()
    if (playback.isPlaying) {
      setPlayback({ isPlaying: false })
      return
    }
    if (playback.mode) {
      setPlayback({ isPlaying: true })
      return
    }
    handlePlayAll()
  }, [handlePlayAll, setPlayback])

  return {
    handleGenerateChapter,
    handleGenerateSelection,
    handlePlayParagraph,
    handlePlaySelection,
    handlePlayAll,
    togglePlayPause,
  }
}
