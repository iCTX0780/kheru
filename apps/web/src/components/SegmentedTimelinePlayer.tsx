import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Play, Pause } from 'lucide-react'
import { usePlaybackSync } from '@/hooks/use-playback-sync'
import { useStudioStore } from '@/stores/studio'
import { playableParagraphs } from '@/lib/playback-segments'
import { cn } from '@/lib/utils'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function resolveAudioUrl(
  mode: ReturnType<typeof useStudioStore.getState>['playback']['mode'],
  playingParagraphId: string | null,
  sequenceParagraphIds: string[],
  sequenceIndex: number,
  paragraphs: ReturnType<typeof useStudioStore.getState>['paragraphs'],
  chapterAudioUrl: string | null
): string | null {
  if (mode === 'paragraph' && playingParagraphId) {
    return paragraphs.find((p) => p.id === playingParagraphId)?.audioUrl ?? null
  }
  if (mode === 'chapter') return chapterAudioUrl
  if (mode === 'sequence' && sequenceParagraphIds.length > 0) {
    const id = sequenceParagraphIds[sequenceIndex]
    return paragraphs.find((p) => p.id === id)?.audioUrl ?? null
  }
  return null
}

export function SegmentedTimelinePlayer({ onPlayAll }: { onPlayAll?: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const pendingPlayRef = useRef(false)
  const loadedSrcRef = useRef<string | null>(null)
  const [duration, setDuration] = useState(0)

  const chapter = useStudioStore((s) => s.chapter)
  const paragraphs = useStudioStore((s) => s.paragraphs)
  const playback = useStudioStore((s) => s.playback)
  const setPlayback = useStudioStore((s) => s.setPlayback)
  const resetPlayback = useStudioStore((s) => s.resetPlayback)

  const handleStop = useCallback(() => {
    loadedSrcRef.current = null
    resetPlayback()
  }, [resetPlayback])

  const timelineSegments =
    playback.timelineSegments.length > 0 ? playback.timelineSegments : chapter.segments

  const audioUrl = resolveAudioUrl(
    playback.mode,
    playback.playingParagraphId,
    playback.sequenceParagraphIds,
    playback.sequenceIndex,
    paragraphs,
    chapter.audioUrl
  )

  const totalDuration =
    duration ||
    (playback.mode === 'chapter' || playback.mode === 'sequence'
      ? timelineSegments.at(-1)?.end ?? 0
      : 0)

  const showSegments =
    (playback.mode === 'chapter' || playback.mode === 'sequence') && timelineSegments.length > 0

  usePlaybackSync({ audioRef, isPlaying: playback.isPlaying, mode: playback.mode })

  const advanceSequence = useCallback(() => {
    const state = useStudioStore.getState()
    const { playback: pb, paragraphs: paras } = state
    const nextIndex = pb.sequenceIndex + 1

    if (nextIndex >= pb.sequenceParagraphIds.length) {
      setPlayback({
        isPlaying: false,
        currentTime: 0,
        activeParagraphId: null,
        activeWordIndex: null,
        sequenceIndex: 0,
        sequenceTimeOffset: 0,
      })
      return
    }

    const prevId = pb.sequenceParagraphIds[pb.sequenceIndex]
    const prev = paras.find((p) => p.id === prevId)
    const offset = pb.sequenceTimeOffset + (prev?.duration ?? 0)

    pendingPlayRef.current = true
    setPlayback({
      sequenceIndex: nextIndex,
      sequenceTimeOffset: offset,
      currentTime: offset,
    })
  }, [setPlayback])

  const advanceSequenceRef = useRef(advanceSequence)
  advanceSequenceRef.current = advanceSequence

  // Load source only when the resolved URL changes — not on unrelated paragraph edits.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioUrl) {
      loadedSrcRef.current = null
      return
    }
    if (loadedSrcRef.current === audioUrl) return

    const shouldPlay = useStudioStore.getState().playback.isPlaying
    loadedSrcRef.current = audioUrl
    pendingPlayRef.current = shouldPlay

    const onLoaded = () => {
      const mode = useStudioStore.getState().playback.mode
      if (mode === 'paragraph' || mode === 'chapter') {
        setDuration(audio.duration)
      }
      if (pendingPlayRef.current) {
        void audio.play().catch(() => {
          pendingPlayRef.current = false
          setPlayback({ isPlaying: false })
        })
      }
    }

    audio.addEventListener('loadedmetadata', onLoaded, { once: true })
    audio.src = audioUrl
    audio.load()

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
    }
  }, [audioUrl, setPlayback])

  // Stable ended handler — does not rebind when paragraphs change.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onEnded = () => {
      const mode = useStudioStore.getState().playback.mode
      if (mode === 'sequence') {
        advanceSequenceRef.current()
        return
      }
      setPlayback({
        isPlaying: false,
        currentTime: 0,
        activeParagraphId: null,
        activeWordIndex: null,
      })
    }

    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [setPlayback])

  // Play / pause without reloading the source.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !loadedSrcRef.current) return

    if (playback.isPlaying) {
      if (audio.paused && audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        void audio.play().catch(() => setPlayback({ isPlaying: false }))
      } else if (audio.paused) {
        pendingPlayRef.current = true
      }
    } else {
      audio.pause()
    }
  }, [playback.isPlaying, setPlayback])

  const canPlayAll =
    (chapter.status === 'done' && !!chapter.audioUrl) || playableParagraphs(paragraphs).length > 0

  const togglePlay = useCallback(() => {
    if (playback.isPlaying) {
      setPlayback({ isPlaying: false })
      return
    }
    if (!audioUrl) {
      if (canPlayAll && onPlayAll) onPlayAll()
      return
    }
    setPlayback({ isPlaying: true })
  }, [audioUrl, canPlayAll, onPlayAll, playback.isPlaying, setPlayback])

  const seek = useCallback(
    (time: number) => {
      const state = useStudioStore.getState()
      const { playback: pb, paragraphs: paras } = state
      const segments =
        pb.timelineSegments.length > 0 ? pb.timelineSegments : state.chapter.segments

      if (pb.mode === 'sequence') {
        const segment = segments.find((s) => time >= s.start && time < s.end)
        if (!segment) return
        const index = pb.sequenceParagraphIds.indexOf(segment.paragraphId)
        if (index === -1) return

        pendingPlayRef.current = pb.isPlaying
        setPlayback({
          sequenceIndex: index,
          sequenceTimeOffset: segment.start,
          currentTime: time,
        })

        const targetUrl = paras.find((p) => p.id === segment.paragraphId)?.audioUrl
        const audio = audioRef.current
        if (audio && loadedSrcRef.current === targetUrl) {
          audio.currentTime = time - segment.start
        }
        return
      }

      const audio = audioRef.current
      if (!audio) return
      audio.currentTime = time
      setPlayback({ currentTime: time })
    },
    [setPlayback]
  )

  const handleSegmentClick = (start: number) => {
    seek(start)
    setPlayback({ isPlaying: true })
  }

  const showPlayer =
    playback.mode !== null ||
    chapter.status === 'done' ||
    chapter.status === 'stale' ||
    paragraphs.some((p) => p.status === 'done')

  if (!showPlayer) return null

  const modeLabel =
    playback.mode === 'chapter'
      ? 'Chapter'
      : playback.mode === 'sequence'
        ? 'All paragraphs'
        : playback.mode === 'paragraph'
          ? 'Paragraph'
          : null

  return (
    <div className="border-t border-border bg-surface px-6 py-4">
      <audio ref={audioRef} className="hidden" />

      <div className="flex items-center gap-4">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="shrink-0"
          onClick={togglePlay}
          disabled={!audioUrl && !canPlayAll}
          aria-label={playback.isPlaying ? 'Pause' : 'Play'}
        >
          {playback.isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>

        <span className="text-xs tabular-nums text-muted-foreground w-10 shrink-0">
          {formatTime(playback.currentTime)}
        </span>

        <div className="flex-1 min-w-0">
          {showSegments ? (
            <div className="flex h-8 rounded-md overflow-hidden border border-border">
              {timelineSegments.map((segment) => {
                const width =
                  totalDuration > 0 ? ((segment.end - segment.start) / totalDuration) * 100 : 0
                const isActive =
                  playback.currentTime >= segment.start && playback.currentTime < segment.end
                return (
                  <button
                    key={segment.paragraphId}
                    type="button"
                    className={cn(
                      'h-full min-w-0 px-1 text-[10px] truncate border-r border-border last:border-r-0 transition-colors',
                      isActive ? 'bg-primary/30 text-foreground' : 'bg-surface-2 text-muted-foreground hover:bg-muted'
                    )}
                    style={{ width: `${Math.max(width, 4)}%` }}
                    title={segment.label}
                    onClick={() => handleSegmentClick(segment.start)}
                  >
                    {segment.label}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: totalDuration > 0 ? `${(playback.currentTime / totalDuration) * 100}%` : '0%',
                }}
              />
            </div>
          )}
        </div>

        <span className="text-xs tabular-nums text-muted-foreground w-10 shrink-0 text-right">
          {formatTime(totalDuration)}
        </span>

        {modeLabel && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0 hidden sm:inline">
            {modeLabel}
          </span>
        )}

        {playback.mode && (
          <Button type="button" variant="ghost" size="sm" className="text-xs h-7 shrink-0" onClick={handleStop}>
            Stop
          </Button>
        )}
      </div>

      {chapter.status === 'stale' && (playback.mode === 'chapter' || playback.mode === 'sequence') && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
          Audio may be out of date — re-generate chapter for the latest full mix.
        </p>
      )}
    </div>
  )
}
