import { useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { ParagraphBlock } from '@/components/ParagraphBlock'
import { ScriptComposer } from '@/components/studio/ScriptComposer'
import { scrollToParagraph } from '@/lib/scroll-to-paragraph'
import type { VoiceInfo } from '@/lib/voices'
import type { Paragraph } from '@/stores/studio'

interface ScriptTimelineProps {
  paragraphs: Paragraph[]
  voices: VoiceInfo[]
  hydrated: boolean
  isPlaying: boolean
  activeParagraphId: string | null
  activeWordIndex: number | null
  voiceIdsInUse: string[]
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
  voices: _voices,
  hydrated,
  isPlaying,
  activeParagraphId,
  activeWordIndex,
  voiceIdsInUse,
  selectedParagraphId,
  onSelectParagraph,
  onImportOpen,
}: ScriptTimelineProps) {
  useEffect(() => {
    if (!activeParagraphId || !isPlaying) return
    scrollToParagraph(activeParagraphId)
  }, [activeParagraphId, isPlaying])

  return (
    <div className="relative mx-auto w-full max-w-3xl px-6 py-8">
      <div
        className="pointer-events-none absolute bottom-8 left-[calc(1.5rem+1rem)] top-8 w-px bg-script-thread"
        aria-hidden
      />

      <div className="relative flex flex-col gap-8">
        {!hydrated ? (
          <TimelineSkeleton />
        ) : (
          <>
            {paragraphs.map((paragraph, index) => {
              const isActivePlayback = activeParagraphId === paragraph.id
              const isPlayingParagraph = isPlaying && activeParagraphId === paragraph.id

              return (
                <ParagraphBlock
                  key={paragraph.id}
                  paragraph={paragraph}
                  index={index}
                  paragraphCount={paragraphs.length}
                  isSelected={selectedParagraphId === paragraph.id}
                  isActive={isActivePlayback}
                  isPlaying={isPlayingParagraph}
                  activeWordIndex={isActivePlayback ? activeWordIndex : null}
                  voiceIdsInUse={voiceIdsInUse}
                  onSelectParagraph={onSelectParagraph}
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
