import { Route } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Toaster } from 'sonner'
import { toast } from 'sonner'
import { AlertCircle, Play, Sparkles } from 'lucide-react'
import { ParagraphTimeline } from '@/components/ParagraphTimeline'
import { SegmentedTimelinePlayer } from '@/components/SegmentedTimelinePlayer'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useStudioStore } from '@/stores/studio'
import { turnFromParagraph, useGenerate, useVoices } from '@/lib/api'
import { DEFAULT_VOICE_ID } from '@/lib/voice-catalog'
import { buildSegmentsFromParagraphs, playableParagraphs } from '@/lib/playback-segments'
import { rootRoute } from './__root'

function StudioPage() {
  const { data: voiceList = [], isLoading: isLoadingVoices } = useVoices()
  const generate = useGenerate()

  const setVoices = useStudioStore((s) => s.setVoices)
  const paragraphs = useStudioStore((s) => s.paragraphs)
  const chapter = useStudioStore((s) => s.chapter)
  const setChapterGenerating = useStudioStore((s) => s.setChapterGenerating)
  const setChapterDone = useStudioStore((s) => s.setChapterDone)
  const setChapterError = useStudioStore((s) => s.setChapterError)
  const setPlayback = useStudioStore((s) => s.setPlayback)
  const resetPlayback = useStudioStore((s) => s.resetPlayback)

  useEffect(() => {
    if (voiceList.length > 0) {
      const ids = voiceList.map((v) => v.id)
      const preferred = ids.includes(DEFAULT_VOICE_ID) ? DEFAULT_VOICE_ID : ids[0]
      setVoices(ids, preferred)
    }
  }, [voiceList, setVoices])

  const handleGenerateChapter = useCallback(async () => {
    const ready = paragraphs.filter((p) => p.text.trim())
    if (ready.length === 0) {
      toast.error('Add text to at least one paragraph')
      return
    }

    setChapterGenerating()
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
      toast.success('Chapter generated')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Chapter generation failed'
      setChapterError(message)
      toast.error(message)
    }
  }, [
    generate,
    paragraphs,
    resetPlayback,
    setChapterDone,
    setChapterError,
    setChapterGenerating,
    setPlayback,
  ])

  const handlePlayParagraph = useCallback(
    (id: string) => {
      const paragraph = paragraphs.find((p) => p.id === id)
      if (!paragraph?.audioUrl || paragraph.status !== 'done') return

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
    [paragraphs, setPlayback]
  )

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
    setPlayback({
      mode: 'sequence',
      playingParagraphId: null,
      isPlaying: true,
      currentTime: 0,
      activeParagraphId: playable[0].id,
      activeWordIndex: null,
      sequenceParagraphIds: playable.map((p) => p.id),
      sequenceIndex: 0,
      sequenceTimeOffset: 0,
      timelineSegments: segments,
    })
  }, [chapter.audioUrl, chapter.segments, chapter.status, paragraphs, setPlayback])

  const hasText = paragraphs.some((p) => p.text.trim())
  const canPlayAll =
    (chapter.status === 'done' && !!chapter.audioUrl) || playableParagraphs(paragraphs).length > 0

  return (
    <>
      <header className="flex items-center justify-between gap-4 bg-surface border-b border-border px-6 py-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight">VoxLab</h1>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {canPlayAll && (
            <Button type="button" variant="secondary" size="lg" onClick={handlePlayAll}>
              <Play data-icon="inline-start" />
              Play all
            </Button>
          )}
          <Button
            type="button"
            onClick={() => void handleGenerateChapter()}
            disabled={chapter.status === 'generating' || !hasText || isLoadingVoices}
            size="lg"
            className="px-6"
          >
            {chapter.status === 'generating' ? (
              <>
                <Spinner data-icon="inline-start" />
                Generating chapter...
              </>
            ) : (
              <>
                <Sparkles data-icon="inline-start" />
                Generate chapter
              </>
            )}
          </Button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          <ParagraphTimeline voices={voiceList} onPlayParagraph={handlePlayParagraph} />
        </div>
      </main>

      {chapter.error && (
        <div className="px-6 py-3 bg-destructive/10 border-t border-destructive/20">
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{chapter.error}</AlertDescription>
          </Alert>
        </div>
      )}

      <SegmentedTimelinePlayer onPlayAll={handlePlayAll} />

      <Toaster position="bottom-right" />
    </>
  )
}

export const indexRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: StudioPage,
})
