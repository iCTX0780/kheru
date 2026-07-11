import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Play, Pause } from 'lucide-react'
import { toast } from 'sonner'
import { usePlaybackSync } from '@/hooks/use-playback-sync'
import { useStudioStore } from '@/stores/studio'
import { playableParagraphs, findSegmentRegionForTime, buildSegmentsFromParagraphs } from '@/lib/playback-segments'
import { scrollToParagraph } from '@/lib/scroll-to-paragraph'
import { voiceSegmentClass } from '@/lib/voice-colors'
import { revokePlayableAudioUrl, shouldStreamPlayback, toPlayableAudioUrl } from '@/lib/playable-audio-url'
import { isClipAtEnd, prepareAudioElementForPlay, sequenceClipKey } from '@/lib/playback-clip'
import { audioExists } from '@/lib/validate-audio'
import { cn } from '@/lib/utils'

const WaveformCanvas = lazy(() =>
  import('@/components/studio/WaveformCanvas').then((m) => ({ default: m.WaveformCanvas }))
)

const PREVIEW_SPEEDS = [0.8, 1, 1.25, 1.5, 2] as const

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
  const loadedClipKeyRef = useRef<string | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const loadGenerationRef = useRef(0)
  const sequenceIndexRef = useRef(0)
  const clipLoadingRef = useRef(false)
  const sequenceAdvanceLockRef = useRef(false)
  const [duration, setDuration] = useState(0)

  const chapter = useStudioStore((s) => s.chapter)
  const paragraphs = useStudioStore((s) => s.paragraphs)
  const playback = useStudioStore((s) => s.playback)
  const setPlayback = useStudioStore((s) => s.setPlayback)
  const resetPlayback = useStudioStore((s) => s.resetPlayback)
  const setPreviewPlaybackRate = useStudioStore((s) => s.setPreviewPlaybackRate)
  const studioPlayMode = useStudioStore((s) => s.studioPlayMode)
  const selectedParagraphId = useStudioStore((s) => s.selectedParagraphId)
  const setSelectedParagraphId = useStudioStore((s) => s.setSelectedParagraphId)
  const invalidateParagraphAudio = useStudioStore((s) => s.invalidateParagraphAudio)
  const invalidateChapterAudio = useStudioStore((s) => s.invalidateChapterAudio)

  const handleStop = useCallback(() => {
    revokePlayableAudioUrl(objectUrlRef.current)
    objectUrlRef.current = null
    loadedClipKeyRef.current = null
    resetPlayback()
  }, [resetPlayback])

  const playable = useMemo(() => playableParagraphs(paragraphs), [paragraphs])
  const builtSegments = useMemo(() => buildSegmentsFromParagraphs(playable), [playable])
  const voiceIdsInUse = useMemo(() => paragraphs.map((p) => p.voice), [paragraphs])

  const timelineSegments = useMemo(() => {
    if (playback.timelineSegments.length > 0) return playback.timelineSegments
    if (chapter.segments.length > 0) return chapter.segments
    return builtSegments
  }, [builtSegments, chapter.segments, playback.timelineSegments])

  const audioUrl = resolveAudioUrl(
    playback.mode,
    playback.playingParagraphId,
    playback.sequenceParagraphIds,
    playback.sequenceIndex,
    paragraphs,
    chapter.audioUrl
  )

  const clipKey =
    playback.mode === 'sequence'
      ? sequenceClipKey(
          playback.sequenceIndex,
          playback.sequenceParagraphIds[playback.sequenceIndex] ?? '',
          audioUrl ?? ''
        )
      : playback.mode === 'paragraph'
        ? `p:${playback.playingParagraphId ?? ''}:${audioUrl ?? ''}`
        : playback.mode === 'chapter'
          ? `ch:${chapter.audioUrl ?? ''}`
          : null

  sequenceIndexRef.current = playback.sequenceIndex

  const playingParagraph =
    playback.mode === 'paragraph' && playback.playingParagraphId
      ? paragraphs.find((p) => p.id === playback.playingParagraphId)
      : null

  const totalDuration = useMemo(() => {
    if (playback.mode === 'sequence' || playback.mode === 'chapter') {
      return timelineSegments.at(-1)?.end ?? duration ?? 0
    }
    if (playable.length > 1) {
      return timelineSegments.at(-1)?.end ?? duration ?? 0
    }
    if (playback.mode === 'paragraph') {
      return duration || playingParagraph?.duration || 0
    }
    return duration || timelineSegments.at(-1)?.end || 0
  }, [duration, playback.mode, playable.length, playingParagraph?.duration, timelineSegments])

  const canScrub = Boolean(audioUrl) && totalDuration > 0
  const showSegments = timelineSegments.length > 1

  const waveformAudioUrl = useMemo(() => {
    if (playback.mode === 'chapter' && chapter.audioUrl) return chapter.audioUrl
    return audioUrl
  }, [audioUrl, chapter.audioUrl, playback.mode])

  const waveformPreferPeaks =
    playback.mode === 'chapter' || totalDuration > 120

  usePlaybackSync({ audioRef, isPlaying: playback.isPlaying, mode: playback.mode })

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = playback.previewPlaybackRate
  }, [playback.previewPlaybackRate, clipKey])

  const advanceSequence = useCallback(() => {
    if (sequenceAdvanceLockRef.current) return
    sequenceAdvanceLockRef.current = true

    const state = useStudioStore.getState()
    const { playback: pb } = state
    if (pb.mode !== 'sequence') {
      sequenceAdvanceLockRef.current = false
      return
    }

    const nextIndex = pb.sequenceIndex + 1
    if (nextIndex >= pb.sequenceParagraphIds.length) {
      loadedClipKeyRef.current = null
      setPlayback({
        isPlaying: false,
        currentTime: 0,
        activeParagraphId: null,
        activeWordIndex: null,
        sequenceIndex: 0,
        sequenceTimeOffset: 0,
      })
      window.requestAnimationFrame(() => {
        sequenceAdvanceLockRef.current = false
      })
      return
    }

    const segments =
      pb.timelineSegments.length > 0
        ? pb.timelineSegments
        : buildSegmentsFromParagraphs(playableParagraphs(state.paragraphs))
    const nextSegment = segments[nextIndex]
    const nextId = pb.sequenceParagraphIds[nextIndex]

    loadedClipKeyRef.current = null

    setPlayback({
      isPlaying: true,
      sequenceIndex: nextIndex,
      sequenceTimeOffset: nextSegment?.start ?? 0,
      currentTime: nextSegment?.start ?? 0,
      activeParagraphId: nextId ?? null,
      activeWordIndex: null,
    })

    window.requestAnimationFrame(() => {
      sequenceAdvanceLockRef.current = false
    })
  }, [setPlayback])

  const advanceSequenceRef = useRef(advanceSequence)
  advanceSequenceRef.current = advanceSequence

  useEffect(() => {
    return () => {
      revokePlayableAudioUrl(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  // Load clip when clipKey changes; auto-play when isPlaying.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioUrl || !clipKey) {
      loadedClipKeyRef.current = null
      setDuration(0)
      return
    }
    if (loadedClipKeyRef.current === clipKey) return

    const generation = ++loadGenerationRef.current
    const loadUrl = audioUrl
    clipLoadingRef.current = true
    setDuration(0)

    let cancelled = false
    let retried = false
    const fetchAbort = new AbortController()

    const onLoaded = () => {
      if (cancelled || loadGenerationRef.current !== generation) return
      clipLoadingRef.current = false
      loadedClipKeyRef.current = clipKey
      const { isPlaying, mode, currentTime, sequenceTimeOffset } = useStudioStore.getState().playback
      if (mode === 'paragraph' || mode === 'chapter') {
        setDuration(audio.duration)
      }
      if (isPlaying) {
        if (mode === 'sequence') {
          audio.currentTime = Math.max(0, currentTime - sequenceTimeOffset)
        } else {
          audio.currentTime = Math.min(currentTime, audio.duration || currentTime)
        }
        void audio.play().catch(() => setPlayback({ isPlaying: false }))
      }
    }

    const onPlaybackFailure = async () => {
      if (loadGenerationRef.current !== generation) return
      clipLoadingRef.current = false
      loadedClipKeyRef.current = null

      if (!retried && !cancelled) {
        retried = true
        toast.message('Playback interrupted — retrying…')
        window.setTimeout(() => {
          if (!cancelled && loadGenerationRef.current === generation) {
            void loadClip()
          }
        }, 400)
        return
      }

      const exists = await audioExists(loadUrl)
      if (!exists) {
        const { playback: pb } = useStudioStore.getState()
        if (pb.mode === 'chapter') {
          invalidateChapterAudio()
        } else if (pb.mode === 'paragraph' && pb.playingParagraphId) {
          invalidateParagraphAudio(pb.playingParagraphId)
        } else if (pb.mode === 'sequence') {
          const id = pb.sequenceParagraphIds[pb.sequenceIndex]
          if (id) invalidateParagraphAudio(id)
        }
        toast.error('Audio file not found — re-generate to restore playback')
      } else {
        toast.error('Playback failed — try again')
      }

      setPlayback({ isPlaying: false })
    }

    const onError = () => {
      void onPlaybackFailure()
    }

    const streamPlayback = shouldStreamPlayback(
      playback.mode,
      playingParagraph?.duration ?? (playback.mode === 'chapter' ? totalDuration : null)
    )

    const loadClip = async () => {
      try {
        audio.removeEventListener('loadedmetadata', onLoaded)
        audio.removeEventListener('error', onError)

        if (streamPlayback) {
          if (objectUrlRef.current) {
            revokePlayableAudioUrl(objectUrlRef.current)
            objectUrlRef.current = null
          }
          audio.addEventListener('loadedmetadata', onLoaded, { once: true })
          audio.addEventListener('error', onError, { once: true })
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
          audio.currentTime = 0
          audio.src = loadUrl
          audio.load()
          return
        }

        const objectUrl = await toPlayableAudioUrl(loadUrl, { signal: fetchAbort.signal })
        if (cancelled || loadGenerationRef.current !== generation) {
          revokePlayableAudioUrl(objectUrl)
          return
        }

        revokePlayableAudioUrl(objectUrlRef.current)
        objectUrlRef.current = objectUrl

        audio.addEventListener('loadedmetadata', onLoaded, { once: true })
        audio.addEventListener('error', onError, { once: true })
        audio.pause()
        audio.currentTime = 0
        audio.src = objectUrl
        audio.load()
      } catch (err) {
        if (
          cancelled ||
          loadGenerationRef.current !== generation ||
          (err instanceof DOMException && err.name === 'AbortError')
        ) {
          return
        }
        await onPlaybackFailure()
      }
    }

    void loadClip()

    return () => {
      cancelled = true
      fetchAbort.abort()
      clipLoadingRef.current = false
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('error', onError)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
  }, [clipKey, audioUrl, invalidateChapterAudio, invalidateParagraphAudio, playback.mode, playingParagraph?.duration, setPlayback, totalDuration])

  // Play/pause already-loaded clip when isPlaying toggles.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !clipKey || loadedClipKeyRef.current !== clipKey) return

    if (!playback.isPlaying) {
      audio.pause()
      return
    }

    if (clipLoadingRef.current || audio.readyState < HTMLMediaElement.HAVE_METADATA) return

    const { playback: pb } = useStudioStore.getState()
    const localStart =
      pb.mode === 'sequence'
        ? Math.max(0, pb.currentTime - pb.sequenceTimeOffset)
        : pb.mode === 'chapter'
          ? pb.currentTime
          : 0
    prepareAudioElementForPlay(audio, localStart)

    if (audio.paused) {
      void audio.play().catch(() => setPlayback({ isPlaying: false }))
    }
  }, [clipKey, playback.isPlaying, setPlayback])

  // Sequence clip boundary — use actual audio duration, not stored paragraph duration.
  useEffect(() => {
    if (!playback.isPlaying || playback.mode !== 'sequence') return

    const audio = audioRef.current
    if (!audio) return

    const watchingIndex = playback.sequenceIndex
    let raf = 0

    const tick = () => {
      const state = useStudioStore.getState()
      const pb = state.playback
      const el = audioRef.current

      if (!el || !pb.isPlaying || pb.mode !== 'sequence') return
      if (pb.sequenceIndex !== watchingIndex) return
      if (loadedClipKeyRef.current !== clipKey) return
      if (clipLoadingRef.current || el.readyState < HTMLMediaElement.HAVE_METADATA) {
        raf = requestAnimationFrame(tick)
        return
      }

      const paragraph = state.paragraphs.find(
        (p) => p.id === pb.sequenceParagraphIds[watchingIndex]
      )
      const fallback =
        (paragraph?.duration && paragraph.duration > 0 ? paragraph.duration : el.duration) ?? 0

      if (isClipAtEnd(el, fallback)) {
        advanceSequenceRef.current()
        return
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [clipKey, playback.isPlaying, playback.mode, playback.sequenceIndex])

  useEffect(() => {
    setDuration(0)
  }, [playback.mode])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onEnded = () => {
      const { playback: pb } = useStudioStore.getState()
      if (!pb.isPlaying) return

      if (pb.mode === 'sequence') {
        if (pb.sequenceIndex !== sequenceIndexRef.current) return
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

  const canPlayAll =
    (chapter.status === 'done' && !!chapter.audioUrl) || playableParagraphs(paragraphs).length > 0

  const togglePlay = useCallback(() => {
    if (playback.isPlaying) {
      setPlayback({ isPlaying: false })
      return
    }

    const playableList = playableParagraphs(paragraphs)

    if (!playback.mode && playableList.length > 0 && onPlayAll) {
      onPlayAll()
      return
    }

    if (!audioUrl) {
      if (canPlayAll && onPlayAll) onPlayAll()
      return
    }

    const updates: Parameters<typeof setPlayback>[0] = { isPlaying: true }

    if (playback.mode === 'sequence') {
      const finished =
        playback.sequenceIndex >= playback.sequenceParagraphIds.length - 1 &&
        playback.currentTime >= (timelineSegments.at(-1)?.end ?? 0) - 0.15

      const restartingFromStart =
        playback.sequenceIndex === 0 &&
        playback.sequenceTimeOffset === 0 &&
        playback.currentTime === 0 &&
        loadedClipKeyRef.current !== null

      if (finished || restartingFromStart) {
        const first = playback.sequenceParagraphIds[0]
        updates.sequenceIndex = 0
        updates.sequenceTimeOffset = 0
        updates.currentTime = 0
        updates.activeParagraphId = first ?? null
        loadedClipKeyRef.current = null
      } else {
        updates.activeParagraphId =
          playback.sequenceParagraphIds[playback.sequenceIndex] ?? playback.activeParagraphId
      }
      updates.activeWordIndex = null
    } else if (playback.mode === 'paragraph' && playback.playingParagraphId) {
      updates.activeParagraphId = playback.playingParagraphId
      updates.activeWordIndex = null
    }

    setPlayback(updates)
  }, [audioUrl, canPlayAll, onPlayAll, paragraphs, playback, setPlayback, timelineSegments])

  const seek = useCallback(
    (time: number) => {
      const clampedTime = Math.max(0, time)
      const state = useStudioStore.getState()
      const { playback: pb, paragraphs: paras, chapter } = state
      const segments =
        pb.timelineSegments.length > 0 ? pb.timelineSegments : chapter.segments

      if (pb.mode === 'sequence') {
        const totalDur = segments.at(-1)?.end ?? totalDuration
        const region = findSegmentRegionForTime(segments, clampedTime, totalDur)
        if (!region) return

        const index = pb.sequenceParagraphIds.indexOf(region.segment.paragraphId)
        if (index === -1) return

        const targetUrl = paras.find((p) => p.id === region.segment.paragraphId)?.audioUrl ?? ''
        const sameClip =
          index === pb.sequenceIndex &&
          loadedClipKeyRef.current === sequenceClipKey(index, region.segment.paragraphId, targetUrl)

        if (!sameClip) {
          loadedClipKeyRef.current = null
        }

        setPlayback({
          sequenceIndex: index,
          sequenceTimeOffset: region.segment.start,
          currentTime: clampedTime,
          activeParagraphId: region.segment.paragraphId,
          activeWordIndex: null,
        })

        const audio = audioRef.current
        if (audio && sameClip) {
          audio.currentTime = clampedTime - region.segment.start
        }
        return
      }

      const audio = audioRef.current
      if (!audio) return

      if (pb.mode === 'chapter') {
        const totalDur = duration || segments.at(-1)?.end || audio.duration
        const region = findSegmentRegionForTime(segments, clampedTime, totalDur)
        audio.currentTime = clampedTime
        setPlayback({
          currentTime: clampedTime,
          activeParagraphId: region?.segment.paragraphId ?? pb.activeParagraphId,
          activeWordIndex: null,
        })
        return
      }

      if (pb.mode === 'paragraph' && pb.playingParagraphId) {
        const paragraph = paras.find((p) => p.id === pb.playingParagraphId)
        const maxTime = audio.duration || paragraph?.duration || clampedTime
        const nextTime = Math.min(clampedTime, maxTime)
        audio.currentTime = nextTime
        setPlayback({
          currentTime: nextTime,
          activeParagraphId: pb.playingParagraphId,
          activeWordIndex: null,
        })
      }
    },
    [duration, setPlayback, totalDuration]
  )

  const handleScrub = useCallback(
    (value: number | readonly number[]) => {
      const time = Array.isArray(value) ? value[0] : value
      seek(time)
    },
    [seek]
  )

  const handleSegmentClick = useCallback(
    (start: number, paragraphId: string) => {
      setSelectedParagraphId(paragraphId)
      scrollToParagraph(paragraphId)

      const state = useStudioStore.getState()
      const { playback: pb, chapter: ch, paragraphs: paras } = state
      const playableList = playableParagraphs(paras)

      if (!pb.mode && playableList.length > 0) {
        if (ch.status === 'done' && ch.audioUrl) {
          const segments =
            ch.segments.length > 0 ? ch.segments : buildSegmentsFromParagraphs(playableList)
          setPlayback({
            mode: 'chapter',
            playingParagraphId: null,
            isPlaying: true,
            currentTime: start,
            activeParagraphId: paragraphId,
            activeWordIndex: null,
            sequenceParagraphIds: [],
            sequenceIndex: 0,
            sequenceTimeOffset: 0,
            timelineSegments: segments,
          })
          return
        }

        const index = Math.max(
          playableList.findIndex((p) => p.id === paragraphId),
          0
        )
        const segments = buildSegmentsFromParagraphs(playableList)
        loadedClipKeyRef.current = null
        setPlayback({
          mode: 'sequence',
          playingParagraphId: null,
          isPlaying: true,
          currentTime: start,
          activeParagraphId: paragraphId,
          activeWordIndex: null,
          sequenceParagraphIds: playableList.map((p) => p.id),
          sequenceIndex: index,
          sequenceTimeOffset: segments[index]?.start ?? 0,
          timelineSegments: segments,
        })
        return
      }

      seek(start)
      setPlayback({ isPlaying: true })
    },
    [seek, setPlayback, setSelectedParagraphId]
  )

  const hasGeneratedAudio =
    (chapter.status === 'done' && !!chapter.audioUrl) ||
    chapter.status === 'stale' ||
    paragraphs.some((p) => p.status === 'done' || p.status === 'stale')

  const showPlayer = playback.mode !== null || hasGeneratedAudio || paragraphs.some((p) => p.text.trim())

  if (!showPlayer) return null

  const modeLabel =
    playback.mode === 'chapter'
      ? 'Chapter'
      : playback.mode === 'sequence'
        ? studioPlayMode === 'until-end'
          ? 'Until end'
          : 'Sequence'
        : playback.mode === 'paragraph'
          ? 'Selection'
          : studioPlayMode === 'until-end'
            ? 'Until end'
            : 'Selection'

  return (
    <div className="border-t border-border bg-surface px-4 py-3 shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.35)] sm:px-6">
      <audio ref={audioRef} className="hidden" />

      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="shrink-0"
          onClick={togglePlay}
          disabled={!audioUrl && !canPlayAll}
          aria-label={playback.isPlaying ? 'Pause' : 'Play'}
        >
          {playback.isPlaying ? <Pause /> : <Play />}
        </Button>

        {playback.mode && (
          <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs" onClick={handleStop}>
            Stop
          </Button>
        )}

        <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline w-10 shrink-0">
          {formatTime(playback.currentTime)}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Suspense fallback={<Skeleton className="h-10 w-full rounded-md" />}>
            <WaveformCanvas
              audioUrl={waveformAudioUrl}
              currentTime={playback.currentTime}
              duration={totalDuration}
              onSeek={seek}
              disabled={!canScrub}
              preferPeaks={waveformPreferPeaks}
              estimatedDuration={totalDuration}
            />
          </Suspense>

          {showSegments ? (
            <div className="flex h-8 overflow-hidden rounded-md border border-border">
              {timelineSegments.map((segment) => {
                const width =
                  totalDuration > 0 ? ((segment.end - segment.start) / totalDuration) * 100 : 0
                const isTimeActive =
                  playback.currentTime >= segment.start && playback.currentTime < segment.end
                const isSelected =
                  !playback.isPlaying && selectedParagraphId === segment.paragraphId
                const isActive = isTimeActive || isSelected
                const paragraph = paragraphs.find((p) => p.id === segment.paragraphId)
                const voiceId = paragraph?.voice ?? voiceIdsInUse[0] ?? ''
                return (
                  <button
                    key={segment.paragraphId}
                    type="button"
                    className={cn(
                      'h-full min-w-0 truncate border-r border-border px-1 text-[0.65rem] last:border-r-0 transition-colors motion-reduce:transition-none text-muted-foreground',
                      voiceSegmentClass(voiceId, voiceIdsInUse, isActive)
                    )}
                    style={{ width: `${Math.max(width, 4)}%` }}
                    title={segment.label}
                    aria-label={`Seek to ${segment.label}`}
                    onClick={() => handleSegmentClick(segment.start, segment.paragraphId)}
                  >
                    {segment.label}
                  </button>
                )
              })}
            </div>
          ) : (
            <Slider
              className="py-0.5"
              value={[Math.min(playback.currentTime, totalDuration || 0)]}
              onValueChange={handleScrub}
              min={0}
              max={Math.max(totalDuration, 0.01)}
              step={0.05}
              disabled={!canScrub}
              aria-label="Playback position"
            />
          )}
        </div>

        <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline w-10 shrink-0 text-right">
          {formatTime(totalDuration)}
        </span>

        <Select
          value={String(playback.previewPlaybackRate)}
          onValueChange={(value) => setPreviewPlaybackRate(Number(value))}
        >
          <SelectTrigger size="sm" className="w-[4.5rem] shrink-0" aria-label="Preview playback speed">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectGroup>
              {PREVIEW_SPEEDS.map((speed) => (
                <SelectItem key={speed} value={String(speed)}>
                  {speed}x
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <span className="hidden text-[0.65rem] uppercase tracking-wide text-muted-foreground shrink-0 lg:inline">
          {modeLabel}
        </span>
      </div>

      {chapter.status === 'stale' &&
        !chapter.audioUrl &&
        (playback.mode === 'chapter' || playback.mode === 'sequence') && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Audio may be out of date — re-generate chapter for the latest full mix.
        </p>
      )}
    </div>
  )
}
