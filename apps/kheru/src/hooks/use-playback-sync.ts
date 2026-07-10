import { useEffect, type RefObject } from 'react'
import { findSegmentRegionForTime } from '@/lib/playback-segments'
import { activeTextWordIndex } from '@/lib/playback-words'
import type { PlaybackMode } from '@/stores/studio'
import { useStudioStore } from '@/stores/studio'

interface UsePlaybackSyncOptions {
  audioRef: RefObject<HTMLAudioElement | null>
  isPlaying: boolean
  mode: PlaybackMode
}

const SYNC_MIN_INTERVAL_MS = 1000 / 30

function resolveActiveWordIndex(
  text: string,
  localTime: number,
  speechDuration: number,
  wordTimings: { word: string; start: number; end: number }[] | null | undefined
): number | null {
  return activeTextWordIndex(text, localTime, speechDuration, wordTimings)
}

export function usePlaybackSync({ audioRef, isPlaying, mode }: UsePlaybackSyncOptions) {
  const setPlayback = useStudioStore((s) => s.setPlayback)

  useEffect(() => {
    if (!isPlaying || !audioRef.current || !mode) return

    let raf = 0
    let lastEmit = 0
    const lastStateRef = {
      currentTime: -1,
      activeParagraphId: null as string | null,
      activeWordIndex: null as number | null,
    }

    const tick = (now: number) => {
      const audio = audioRef.current
      if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) {
        raf = requestAnimationFrame(tick)
        return
      }

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
          activeWordIndex = resolveActiveWordIndex(
            paragraph.text,
            audio.currentTime,
            audio.duration,
            paragraph.wordTimings
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

            activeWordIndex = resolveActiveWordIndex(
              paragraph.text,
              localTime,
              timingDuration,
              paragraph.wordTimings
            )
          }
        }
      }

      const shouldEmit =
        now - lastEmit >= SYNC_MIN_INTERVAL_MS ||
        activeParagraphId !== lastStateRef.activeParagraphId ||
        activeWordIndex !== lastStateRef.activeWordIndex

      if (
        shouldEmit &&
        (Math.abs(currentTime - lastStateRef.currentTime) > 0.02 ||
          activeParagraphId !== lastStateRef.activeParagraphId ||
          activeWordIndex !== lastStateRef.activeWordIndex)
      ) {
        lastEmit = now
        lastStateRef.currentTime = currentTime
        lastStateRef.activeParagraphId = activeParagraphId
        lastStateRef.activeWordIndex = activeWordIndex
        setPlayback({ currentTime, activeParagraphId, activeWordIndex })
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [audioRef, isPlaying, mode, setPlayback])
}
