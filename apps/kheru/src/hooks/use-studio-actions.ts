import { useCallback } from 'react'
import { toast } from 'sonner'
import {
  turnFromParagraph,
  generateConversation,
  wordTimingsForTurn,
  segmentDurationFromResult,
  stitchRunIds,
  type GenerateResponse,
} from '@/lib/api'
import { cancelPendingClientTts } from '@/lib/client-tts/engine'
import {
  assertGenerationNotCancelled,
  beginGenerationRun,
  isGenerationCancelled,
  stopGenerationRun,
} from '@/lib/generation-cancel'
import { resolveClipDuration } from '@/lib/audio-duration'
import { revokeManagedBlobUrl } from '@/lib/client-tts/blob-registry'
import { fetchServerCapabilities } from '@/lib/client-tts/capabilities'
import { isClientTtsEnabled } from '@/lib/client-tts/config'
import { clientGenerateParagraph, clientStitchParagraphs } from '@/lib/client-tts/generate'
import { estimateBulkGenerationMs, formatEta } from '@/lib/generation-estimate'
import { buildSegmentsFromParagraphs, playableParagraphs, PARAGRAPH_GAP_SECONDS } from '@/lib/playback-segments'
import { useStudioStore, type Paragraph, type PlaybackSegment } from '@/stores/studio'

async function applyParagraphResult(
  paragraph: Paragraph,
  result: GenerateResponse,
  appendParagraphGeneration: ReturnType<typeof useStudioStore.getState>['appendParagraphGeneration']
): Promise<string> {
  const audioUrl = result.clips?.[0]?.audio_url ?? result.audio_url
  const runId = result.clips?.[0]?.run_id ?? result.run_id
  const duration = await resolveClipDuration(audioUrl, segmentDurationFromResult(result, 0))
  const wordTimings = wordTimingsForTurn(result.words, 0)
  appendParagraphGeneration(
    paragraph.id,
    audioUrl,
    duration,
    wordTimings.length > 0 ? wordTimings : null,
    runId
  )
  return runId
}

async function applyClientParagraphResult(
  paragraph: Paragraph,
  appendParagraphGeneration: ReturnType<typeof useStudioStore.getState>['appendParagraphGeneration'],
  options: {
    projectId: string
    align: boolean
    onAlignStart?: () => void
    signal: AbortSignal
    isCancelled: () => boolean
  }
): Promise<{ blob: Blob; audioUrl: string; generationId: string }> {
  revokeManagedBlobUrl(paragraph.audioUrl)

  const generationId = crypto.randomUUID()
  const result = await clientGenerateParagraph(
    {
      text: paragraph.text.trim(),
      voice: paragraph.voice,
      lengthScale: paragraph.lengthScale,
    },
    {
      projectId: options.projectId,
      paragraphId: paragraph.id,
      generationId,
      align: options.align,
      onAlignStart: options.onAlignStart,
      signal: options.signal,
      isCancelled: options.isCancelled,
    }
  )

  appendParagraphGeneration(
    paragraph.id,
    result.audioUrl,
    result.duration,
    result.wordTimings,
    generationId
  )
  return { blob: result.blob, audioUrl: result.audioUrl, generationId }
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

function paragraphsWithText(paragraphs: Paragraph[]): Paragraph[] {
  return paragraphs.filter((p) => p.text.trim())
}

function allTextParagraphsHaveActiveTake(paragraphs: Paragraph[]): boolean {
  const withText = paragraphsWithText(paragraphs)
  if (withText.length === 0) return false
  return withText.every((p) => p.status === 'done' && p.audioUrl)
}

function extractRunId(audioUrl: string): string | null {
  const match = audioUrl.match(/\/api\/audio\/([0-9a-f]{8})$/)
  return match?.[1] ?? null
}

async function stitchChapterFromActiveTakes(options: {
  clientTts: boolean
  projectId: string
  chapterId: string
  paragraphs: Paragraph[]
  clientClips?: Blob[]
}): Promise<{ audioUrl: string; segments: PlaybackSegment[] } | null> {
  const withText = paragraphsWithText(options.paragraphs)
  if (!allTextParagraphsHaveActiveTake(options.paragraphs)) return null

  const segments = buildChapterSegments(withText)

  if (options.clientTts) {
    const blobs: Blob[] = []
    for (const paragraph of withText) {
      if (!paragraph.audioUrl) return null
      const response = await fetch(paragraph.audioUrl)
      blobs.push(await response.blob())
    }
    const stitched = await clientStitchParagraphs(blobs, {
      projectId: options.projectId,
      chapterId: options.chapterId,
    })
    return { audioUrl: stitched.audioUrl, segments }
  }

  const runIds: string[] = []
  for (const paragraph of withText) {
    if (!paragraph.audioUrl) return null
    const runId = extractRunId(paragraph.audioUrl)
    if (!runId) return null
    runIds.push(runId)
  }
  const stitched = await stitchRunIds(runIds)
  return { audioUrl: stitched.audio_url, segments }
}

async function handleCancelledGeneration(
  tryRestitchChapter: () => Promise<boolean>
): Promise<void> {
  const completedCount = useStudioStore.getState().generationSession.completedIds.length
  stopGenerationRun()
  cancelPendingClientTts()
  useStudioStore.getState().finalizeCancelledGeneration()
  if (completedCount > 0) {
    await tryRestitchChapter()
  }
  toast.message('Generation stopped')
}

export function useStudioActions() {
  const clientTts = isClientTtsEnabled()

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
  const appendParagraphGeneration = useStudioStore((s) => s.appendParagraphGeneration)
  const selectParagraphGeneration = useStudioStore((s) => s.selectParagraphGeneration)
  const deleteParagraphGeneration = useStudioStore((s) => s.deleteParagraphGeneration)
  const setParagraphError = useStudioStore((s) => s.setParagraphError)
  const startGenerationSession = useStudioStore((s) => s.startGenerationSession)
  const setGenerationParagraphPhase = useStudioStore((s) => s.setGenerationParagraphPhase)
  const advanceGenerationSession = useStudioStore((s) => s.advanceGenerationSession)
  const finishGenerationSession = useStudioStore((s) => s.finishGenerationSession)
  const failGenerationSession = useStudioStore((s) => s.failGenerationSession)
  const requestCancelGeneration = useStudioStore((s) => s.requestCancelGeneration)

  const isCancelled = () => useStudioStore.getState().generationSession.cancelRequested

  const tryRestitchChapter = useCallback(async () => {
    const state = useStudioStore.getState()
    if (!allTextParagraphsHaveActiveTake(state.paragraphs)) return false

    try {
      const stitched = await stitchChapterFromActiveTakes({
        clientTts,
        projectId: state.projectId,
        chapterId: state.activeChapterId,
        paragraphs: state.paragraphs,
      })
      if (!stitched) return false

      revokeManagedBlobUrl(state.chapter.audioUrl)
      setChapterDone(stitched.audioUrl, stitched.segments)
      return true
    } catch {
      return false
    }
  }, [clientTts, setChapterDone])

  const handleGenerateChapter = useCallback(async () => {
    const state = useStudioStore.getState()
    if (state.generationSession.active || state.chapter.status === 'generating') {
      toast.error('Finish chapter generation before starting another run')
      return
    }

    const ready = paragraphs.filter((p) => p.text.trim())
    if (ready.length === 0) {
      toast.error('Add text to at least one paragraph')
      return
    }

    const capabilities = clientTts ? await fetchServerCapabilities() : null
    const hybridAlign = Boolean(clientTts && capabilities?.gentle)

    setChapterGenerating()
    const estimatedTotalMs = estimateBulkGenerationMs(ready.map((p) => p.text.trim()))
    startGenerationSession(
      ready.map((p) => p.id),
      estimatedTotalMs
    )
    if (ready.length >= 10) {
      toast.message(
        `Generating ${ready.length} paragraphs — estimated ${formatEta(estimatedTotalMs / 1000)}. You can keep this tab open.`
      )
    }
    resetPlayback()

    const signal = beginGenerationRun()

    try {
      if (clientTts) {
        revokeManagedBlobUrl(state.chapter.audioUrl)
      }

      for (const paragraph of ready) {
        assertGenerationNotCancelled(useStudioStore.getState().generationSession.cancelRequested)

        setParagraphGenerating(paragraph.id)
        setGenerationParagraphPhase('synthesizing')

        if (clientTts) {
          await applyClientParagraphResult(paragraph, appendParagraphGeneration, {
            projectId: state.projectId,
            align: hybridAlign,
            onAlignStart: () => setGenerationParagraphPhase('aligning'),
            signal,
            isCancelled,
          })
        } else {
          const result = await generateConversation(
            [turnFromParagraph(paragraph.id, paragraph.text.trim(), paragraph.voice, paragraph.lengthScale)],
            { signal }
          )
          await applyParagraphResult(paragraph, result, appendParagraphGeneration)
        }

        advanceGenerationSession(paragraph.id)
      }

      assertGenerationNotCancelled(useStudioStore.getState().generationSession.cancelRequested)

      const updatedParagraphs = useStudioStore.getState().paragraphs
      const segments = buildChapterSegments(
        ready.map((p) => updatedParagraphs.find((up) => up.id === p.id) ?? p)
      )

      if (clientTts) {
        const blobs: Blob[] = []
        for (const paragraph of ready) {
          const updated = updatedParagraphs.find((p) => p.id === paragraph.id)
          if (!updated?.audioUrl) continue
          const response = await fetch(updated.audioUrl)
          blobs.push(await response.blob())
        }
        const stitched = await clientStitchParagraphs(blobs, {
          projectId: state.projectId,
          chapterId: state.activeChapterId,
        })
        setChapterDone(stitched.audioUrl, segments)
      } else {
        const runIds: string[] = []
        for (const paragraph of ready) {
          const updated = updatedParagraphs.find((p) => p.id === paragraph.id)
          const audioUrl = updated?.audioUrl
          if (!audioUrl) continue
          const runId = extractRunId(audioUrl)
          if (runId) runIds.push(runId)
        }
        const stitched = await stitchRunIds(runIds, { signal })
        setChapterDone(stitched.audio_url, segments)
      }

      finishGenerationSession()
      stopGenerationRun()

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
      if (isGenerationCancelled(err)) {
        await handleCancelledGeneration(tryRestitchChapter)
        return
      }

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
      stopGenerationRun()
      toast.error(message)
    }
  }, [
    clientTts,
    paragraphs,
    resetPlayback,
    setChapterDone,
    setChapterError,
    setChapterGenerating,
    appendParagraphGeneration,
    setParagraphError,
    setParagraphGenerating,
    setGenerationParagraphPhase,
    startGenerationSession,
    advanceGenerationSession,
    finishGenerationSession,
    failGenerationSession,
    setPlayback,
    tryRestitchChapter,
  ])

  const handleGenerateSelection = useCallback(async () => {
    const state = useStudioStore.getState()
    if (state.generationSession.active || state.chapter.status === 'generating') {
      toast.error('Finish chapter generation before generating a single paragraph')
      return
    }

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

    const capabilities = clientTts ? await fetchServerCapabilities() : null
    const hybridAlign = Boolean(clientTts && capabilities?.gentle)

    startGenerationSession([paragraph.id])
    setParagraphGenerating(paragraph.id)
    setGenerationParagraphPhase('synthesizing')
    const signal = beginGenerationRun()
    try {
      if (clientTts) {
        await applyClientParagraphResult(paragraph, appendParagraphGeneration, {
          projectId: state.projectId,
          align: hybridAlign,
          onAlignStart: () => setGenerationParagraphPhase('aligning'),
          signal,
          isCancelled,
        })
      } else {
        const result = await generateConversation(
          [turnFromParagraph(paragraph.id, paragraph.text.trim(), paragraph.voice, paragraph.lengthScale)],
          { signal }
        )
        await applyParagraphResult(paragraph, result, appendParagraphGeneration)
      }
      advanceGenerationSession(paragraph.id)
      finishGenerationSession()
      stopGenerationRun()

      const restitched = await tryRestitchChapter()
      if (!restitched && state.chapter.status === 'done') {
        useStudioStore.getState().invalidateChapterAudio()
      }

      toast.success('Paragraph generated')
    } catch (err) {
      if (isGenerationCancelled(err)) {
        await handleCancelledGeneration(tryRestitchChapter)
        return
      }

      const message = err instanceof Error ? err.message : 'Generation failed'
      setParagraphError(paragraph.id, message)
      failGenerationSession(paragraph.id, message)
      stopGenerationRun()
      toast.error(message)
    }
  }, [
    clientTts,
    paragraphs,
    selectedParagraphId,
    appendParagraphGeneration,
    setParagraphError,
    setParagraphGenerating,
    setGenerationParagraphPhase,
    startGenerationSession,
    advanceGenerationSession,
    finishGenerationSession,
    failGenerationSession,
    tryRestitchChapter,
  ])

  const handleStopGeneration = useCallback(() => {
    if (!useStudioStore.getState().generationSession.active) return
    requestCancelGeneration()
    stopGenerationRun()
    cancelPendingClientTts()
  }, [requestCancelGeneration])

  const handleSelectGeneration = useCallback(
    async (paragraphId: string, generationId: string) => {
      const state = useStudioStore.getState()
      if (state.generationSession.active || state.chapter.status === 'generating') {
        toast.error('Finish chapter generation before switching takes')
        return
      }

      selectParagraphGeneration(paragraphId, generationId)
      const restitched = await tryRestitchChapter()
      if (!restitched && state.chapter.status === 'done') {
        useStudioStore.getState().invalidateChapterAudio()
      }
    },
    [selectParagraphGeneration, tryRestitchChapter]
  )

  const handleDeleteGeneration = useCallback(
    async (paragraphId: string, generationId: string) => {
      const state = useStudioStore.getState()
      if (state.generationSession.active || state.chapter.status === 'generating') {
        toast.error('Finish chapter generation before deleting takes')
        return
      }

      deleteParagraphGeneration(paragraphId, generationId)
      const restitched = await tryRestitchChapter()
      if (!restitched && state.chapter.status === 'done') {
        useStudioStore.getState().invalidateChapterAudio()
      }
      toast.success('Take deleted')
    },
    [deleteParagraphGeneration, tryRestitchChapter]
  )

  const handlePlayParagraph = useCallback(
    (id: string, modeOverride?: 'selection' | 'until-end') => {
      const state = useStudioStore.getState()
      if (state.generationSession.active || state.chapter.status === 'generating') {
        toast.error('Finish chapter generation before playing')
        return
      }

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

  const handlePlayGenerationTake = useCallback((paragraphId: string, generationId: string) => {
    const paragraph = useStudioStore.getState().paragraphs.find((p) => p.id === paragraphId)
    const generation = paragraph?.generations?.find((g) => g.id === generationId)
    if (!generation?.audioUrl) return
    const audio = new Audio(generation.audioUrl)
    void audio.play()
  }, [])

  const handlePlaySelection = useCallback(() => {
    if (!selectedParagraphId) {
      toast.error('Select a paragraph first')
      return
    }
    handlePlayParagraph(selectedParagraphId, studioPlayMode)
  }, [handlePlayParagraph, selectedParagraphId, studioPlayMode])

  /** Bottom player: prefer stitched chapter mix when available. */
  const handlePlayAll = useCallback(() => {
    const state = useStudioStore.getState()
    if (state.generationSession.active || state.chapter.status === 'generating') {
      toast.error('Finish chapter generation before playing')
      return
    }

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
    handleStopGeneration,
    handleSelectGeneration,
    handleDeleteGeneration,
    handlePlayGenerationTake,
    handlePlayParagraph,
    handlePlaySelection,
    handlePlayAll,
    togglePlayPause,
  }
}
