import { useEffect, type RefObject } from 'react'
import { activeWordIndexForProgress } from '@/lib/playback-words'
import type { PlaybackMode } from '@/stores/studio'
import { useStudioStore } from '@/stores/studio'

interface UsePlaybackSyncOptions {
  audioRef: RefObject<HTMLAudioElement | null>
  isPlaying: boolean
  mode: PlaybackMode
}

export function usePlaybackSync({ audioRef, isPlaying, mode }: UsePlaybackSyncOptions) {
  const setPlayback = useStudioStore((s) => s.setPlayback)

  useEffect(() => {
    if (!isPlaying || !audioRef.current || !mode) return

    let raf = 0
    const tick = () => {
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
          const progress = audio.currentTime / audio.duration
          activeWordIndex = activeWordIndexForProgress(paragraph.text, progress)
        }
      } else if (mode === 'chapter' || mode === 'sequence') {
        const segment = segments.find((s) => currentTime >= s.start && currentTime < s.end)
        if (segment) {
          activeParagraphId = segment.paragraphId
          const paragraph = paragraphs.find((p) => p.id === segment.paragraphId)
          if (paragraph?.text.trim()) {
            const segmentDuration = segment.end - segment.start
            const localTime =
              mode === 'sequence'
                ? audio.currentTime
                : currentTime - segment.start
            const progress = segmentDuration > 0 ? localTime / segmentDuration : 0
            activeWordIndex = activeWordIndexForProgress(paragraph.text, progress)
          }
        }
      }

      setPlayback({ currentTime, activeParagraphId, activeWordIndex })
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [audioRef, isPlaying, mode, setPlayback])
}
