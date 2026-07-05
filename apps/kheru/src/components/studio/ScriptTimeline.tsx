import { startTransition, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { ParagraphBlock } from '@/components/ParagraphBlock'
import { ScriptComposer } from '@/components/studio/ScriptComposer'
import type { VoiceInfo } from '@/lib/api'
import type { Paragraph, PlaybackState } from '@/stores/studio'

interface ScriptTimelineProps {
  paragraphs: Paragraph[]
  voices: VoiceInfo[]
  hydrated: boolean
  playback: PlaybackState
  selectedParagraphId: string | null
  onSelectParagraph: (id: string) => void
  onImportOpen?: () => void
}

function TimelineSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className="h-20 flex-1 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export function ScriptTimeline({
  paragraphs,
  voices,
  hydrated,
  playback,
  selectedParagraphId,
  onSelectParagraph,
  onImportOpen,
}: ScriptTimelineProps) {
  useEffect(() => {
    const activeId = playback.activeParagraphId
    if (!activeId || !playback.isPlaying) return
    document.getElementById(`paragraph-${activeId}`)?.scrollIntoView({ block: 'nearest' })
  }, [playback.activeParagraphId, playback.isPlaying])

  return (
    <div className="relative mx-auto w-full max-w-3xl px-6 py-8">
      <div
        className="pointer-events-none absolute bottom-8 left-[calc(1.5rem+15px)] top-8 w-px bg-script-thread"
        aria-hidden
      />

      <div className="relative flex flex-col gap-8">
        {!hydrated ? (
          <TimelineSkeleton />
        ) : (
          <>
            {paragraphs.map((paragraph, index) => {
              const isActivePlayback =
                playback.activeParagraphId === paragraph.id ||
                (playback.mode === 'sequence' &&
                  playback.sequenceParagraphIds[playback.sequenceIndex] === paragraph.id)

              return (
                <ParagraphBlock
                  key={paragraph.id}
                  paragraph={paragraph}
                  index={index}
                  isSelected={selectedParagraphId === paragraph.id}
                  isActive={isActivePlayback}
                  isPlaying={
                    playback.isPlaying &&
                    (playback.playingParagraphId === paragraph.id ||
                      (playback.mode === 'sequence' &&
                        playback.sequenceParagraphIds[playback.sequenceIndex] === paragraph.id))
                  }
                  activeWordIndex={isActivePlayback ? playback.activeWordIndex : null}
                  onSelect={() => startTransition(() => onSelectParagraph(paragraph.id))}
                  onImportOpen={onImportOpen}
                />
              )
            })}
            <ScriptComposer onImportOpen={onImportOpen} />
          </>
        )}
      </div>
    </div>
  )
}
