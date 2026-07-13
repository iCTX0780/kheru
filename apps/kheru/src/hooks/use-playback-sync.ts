import { useEffect, useRef, type RefObject } from 'react'
import { findSegmentRegionForTime } from '@/lib/playback-segments'
import {
  activeTextWordIndexFromPrepared,
  prepareWordHighlight,
  type PreparedWordHighlight,
  type WordTiming,
} from '@/lib/playback-words'
import type { PlaybackMode } from '@/stores/studio'
import { useStudioStore } from '@/stores/studio'

interface UsePlaybackSyncOptions {
  audioRef: RefObject<HTMLAudioElement | null>
  isPlaying: boolean
  mode: PlaybackMode
}

/** Cap store updates during playback — UI only needs ~10 fps for time/scrub sync */
const SYNC_INTERVAL_MS = 100

interface HighlightCache {
  paragraphId: string | null
  text: string
  timings: WordTiming[] | null | undefined
  prepared: PreparedWordHighlight
}

function getCachedHighlight(
  cache: HighlightCache,
  paragraphId: string,
  text: string,
  wordTimings: WordTiming[] | null | undefined
): PreparedWordHighlight {
  if (
    cache.paragraphId === paragraphId &&
    cache.text === text &&
    cache.timings === wordTimings
  ) {
    return cache.prepared
  }

  cache.paragraphId = paragraphId
  cache.text = text
  cache.timings = wordTimings
  cache.prepared = prepareWordHighlight(text, wordTimings)
  return cache.prepared
}

export function usePlaybackSync({ audioRef, isPlaying, mode }: UsePlaybackSyncOptions) {
  const setPlayback = useStudioStore((s) => s.setPlayback)
  const highlightCacheRef = useRef<HighlightCache>({
    paragraphId: null,
    text: '',
    timings: undefined,
    prepared: { words: [], aligned: [], hasTimings: false },
  })

  useEffect(() => {
    if (!isPlaying || !audioRef.current || !mode) return

    const lastStateRef = {
      currentTime: -1,
      activeParagraphId: null as string | null,
      activeWordIndex: null as number | null,
    }

    const tick = () => {
      const audio = audioRef.current
      if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return

      const { paragraphs, playback, chapter } = useStudioStore.getState()
      const segments =
        playback.timelineSegments.length > 0 ? playback.timelineSegments : chapter.segments

      const currentTime =
        mode === 'sequence' ? playback.sequenceTimeOffset + audio.currentTime : audio.currentTime

      let activeParagraphId: string | null = null
      let activeWordIndex: number | null = null

      if (mode === 'paragraph' && playback.playingParagraphId) {
        activeParagraphId = playback.playingParagraphId
        const paragraph = paragraphs.find((p) => p.id === playback.playingParagraphId)
        if (paragraph?.text.trim()) {
          const prepared = getCachedHighlight(
            highlightCacheRef.current,
            paragraph.id,
            paragraph.text,
            paragraph.wordTimings
          )
          activeWordIndex = activeTextWordIndexFromPrepared(
            prepared,
            paragraph.text,
            audio.currentTime,
            audio.duration
          )
        }
      } else if (mode === 'chapter' || mode === 'sequence') {
        const totalDuration =
          mode === 'chapter'
            ? audio.duration
            : (segments.at(-1)?.end ?? audio.duration)

        const region = findSegmentRegionForTime(segments, currentTime, totalDuration)
        if (region) {
          const { segment } = region
          activeParagraphId = segment.paragraphId
          const paragraph = paragraphs.find((p) => p.id === segment.paragraphId)
          if (paragraph?.text.trim()) {
            const speechDuration = segment.end - segment.start
            const localTime =
              mode === 'sequence' ? audio.currentTime : currentTime - segment.start
            const timingDuration =
              Number.isFinite(audio.duration) && audio.duration > 0
                ? mode === 'sequence'
                  ? audio.duration
                  : speechDuration
                : speechDuration

            const prepared = getCachedHighlight(
              highlightCacheRef.current,
              paragraph.id,
              paragraph.text,
              paragraph.wordTimings
            )
            activeWordIndex = activeTextWordIndexFromPrepared(
              prepared,
              paragraph.text,
              localTime,
              timingDuration
            )
          }
        }
      }

      const highlightChanged =
        activeParagraphId !== lastStateRef.activeParagraphId ||
        activeWordIndex !== lastStateRef.activeWordIndex
      const timeMoved = Math.abs(currentTime - lastStateRef.currentTime) > 0.05

      if (highlightChanged || timeMoved) {
        lastStateRef.currentTime = currentTime
        lastStateRef.activeParagraphId = activeParagraphId
        lastStateRef.activeWordIndex = activeWordIndex
        setPlayback({ currentTime, activeParagraphId, activeWordIndex })
      }
    }

    tick()
    const interval = window.setInterval(tick, SYNC_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [audioRef, isPlaying, mode, setPlayback])
}
