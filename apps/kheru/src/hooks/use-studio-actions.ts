import { useCallback } from 'react'
import { toast } from 'sonner'
import { turnFromParagraph, useGenerate, wordTimingsForTurn, segmentDurationFromResult } from '@/lib/api'
import { resolveClipDuration } from '@/lib/audio-duration'
import { buildSegmentsFromParagraphs, playableParagraphs } from '@/lib/playback-segments'
import { useStudioStore } from '@/stores/studio'

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

  const setParagraphsGenerating = useStudioStore((s) => s.setParagraphsGenerating)

  const handleGenerateChapter = useCallback(async () => {
    const ready = paragraphs.filter((p) => p.text.trim())
    if (ready.length === 0) {
      toast.error('Add text to at least one paragraph')
      return
    }

    setChapterGenerating()
    setParagraphsGenerating(ready.map((p) => p.id))
    resetPlayback()

    try {
      const conversation = ready.map((p) =>
        turnFromParagraph(p.id, p.text.trim(), p.voice, p.lengthScale)
      )
      const result = await generate.mutateAsync(conversation)
      const segments = result.segments.map((seg) => {
        const paragraph = ready[seg.index]
        return {
          paragraphId: paragraph.id,
          start: seg.start,
          end: seg.end,
          label: paragraph.text.trim().slice(0, 40) + (paragraph.text.length > 40 ? '…' : ''),
        }
      })
      setChapterDone(result.audio_url, segments)

      for (let index = 0; index < ready.length; index++) {
        const paragraph = ready[index]
        const clip = result.clips?.find((c) => c.index === index)
        const audioUrl = clip?.audio_url ?? result.audio_url
        const duration = await resolveClipDuration(
          audioUrl,
          segmentDurationFromResult(result, index)
        )
        const wordTimings = wordTimingsForTurn(result.words, index)
        setParagraphDone(
          paragraph.id,
          audioUrl,
          duration,
          wordTimings.length > 0 ? wordTimings : null
        )
      }

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
      setChapterError(message)
      for (const paragraph of ready) {
        setParagraphError(paragraph.id, message)
      }
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
    setParagraphsGenerating,
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

    setParagraphGenerating(paragraph.id)
    try {
      const result = await generate.mutateAsync([
        turnFromParagraph(paragraph.id, paragraph.text.trim(), paragraph.voice, paragraph.lengthScale),
      ])
      const audioUrl = result.clips?.[0]?.audio_url ?? result.audio_url
      const duration = await resolveClipDuration(
        audioUrl,
        segmentDurationFromResult(result, 0)
      )
      const wordTimings = wordTimingsForTurn(result.words, 0)
      setParagraphDone(
        paragraph.id,
        audioUrl,
        duration,
        wordTimings.length > 0 ? wordTimings : null
      )
      toast.success('Paragraph generated')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      setParagraphError(paragraph.id, message)
      toast.error(message)
    }
  }, [generate, paragraphs, selectedParagraphId, setParagraphDone, setParagraphError, setParagraphGenerating])

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
