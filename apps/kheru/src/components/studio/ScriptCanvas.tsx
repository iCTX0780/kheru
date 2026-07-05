import { startTransition, useCallback, useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ScriptTimeline } from '@/components/studio/ScriptTimeline'
import { useStudioStore } from '@/stores/studio'
import type { VoiceInfo } from '@/lib/api'

interface ScriptCanvasProps {
  voices: VoiceInfo[]
  hydrated: boolean
  onImportOpen?: () => void
}

export function ScriptCanvas({ voices, hydrated, onImportOpen }: ScriptCanvasProps) {
  const paragraphs = useStudioStore((s) => s.paragraphs)
  const playback = useStudioStore((s) => s.playback)
  const selectedParagraphId = useStudioStore((s) => s.selectedParagraphId)
  const setSelectedParagraphId = useStudioStore((s) => s.setSelectedParagraphId)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hydrated || selectedParagraphId || paragraphs.length === 0) return
    setSelectedParagraphId(paragraphs[0].id)
  }, [hydrated, paragraphs, selectedParagraphId, setSelectedParagraphId])

  const selectAdjacent = useCallback(
    (direction: 'up' | 'down') => {
      if (paragraphs.length === 0) return
      const currentIndex = paragraphs.findIndex((p) => p.id === selectedParagraphId)
      const baseIndex = currentIndex >= 0 ? currentIndex : 0
      const nextIndex =
        direction === 'up' ? Math.max(0, baseIndex - 1) : Math.min(paragraphs.length - 1, baseIndex + 1)
      const next = paragraphs[nextIndex]
      if (!next) return
      startTransition(() => {
        setSelectedParagraphId(next.id)
        document.getElementById(`paragraph-${next.id}`)?.scrollIntoView({ block: 'nearest' })
      })
    },
    [paragraphs, selectedParagraphId, setSelectedParagraphId]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        selectAdjacent('up')
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        selectAdjacent('down')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectAdjacent])

  return (
    <div
      id="paragraph-timeline"
      ref={containerRef}
      className="flex h-full min-h-0 flex-1 flex-col bg-surface"
    >
      <ScrollArea className="flex-1">
        <ScriptTimeline
          paragraphs={paragraphs}
          voices={voices}
          hydrated={hydrated}
          playback={playback}
          selectedParagraphId={selectedParagraphId}
          onSelectParagraph={setSelectedParagraphId}
          onImportOpen={onImportOpen}
        />
      </ScrollArea>
    </div>
  )
}
