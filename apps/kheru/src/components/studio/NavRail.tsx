import { startTransition } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BookOpen, Plus } from 'lucide-react'
import { paragraphStatusRailClass } from '@/lib/paragraph-status'
import { scrollToParagraph as scrollParagraphIntoView } from '@/lib/scroll-to-paragraph'
import { voiceDotClass } from '@/lib/voice-colors'
import { cn } from '@/lib/utils'
import { useStudioStore } from '@/stores/studio'

export function NavRail() {
  const paragraphs = useStudioStore((s) => s.paragraphs)
  const selectedParagraphId = useStudioStore((s) => s.selectedParagraphId)
  const playback = useStudioStore((s) => s.playback)
  const chapterTitle = useStudioStore((s) => s.chapterTitle)
  const setSelectedParagraphId = useStudioStore((s) => s.setSelectedParagraphId)

  const voiceIdsInUse = paragraphs.map((p) => p.voice)

  const scrollToParagraph = (id: string) => {
    startTransition(() => {
      setSelectedParagraphId(id)
      scrollParagraphIntoView(id)
    })
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="size-4 shrink-0 opacity-70" />
          <span className="truncate text-sm font-semibold">Chapters</span>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button type="button" variant="ghost" size="icon-sm" disabled aria-label="Add chapter" />
            }
          />
          <TooltipContent>Multi-chapter support coming soon</TooltipContent>
        </Tooltip>
      </div>

      <div className="px-2 py-2">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md bg-sidebar-accent px-2 py-2 text-left text-sm font-medium text-sidebar-accent-foreground"
        >
          <span className="size-2 shrink-0 rounded-full bg-primary" />
          {chapterTitle}
        </button>
      </div>

      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
          Paragraphs
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button type="button" variant="ghost" size="icon-xs" disabled aria-label="Add chapter">
                <Plus />
              </Button>
            }
          />
          <TooltipContent>Coming soon</TooltipContent>
        </Tooltip>
      </div>

      <ScrollArea className="flex-1 px-2">
        <ul className="flex flex-col gap-0.5 pb-4">
          {paragraphs.map((paragraph, index) => {
            const isSelected = selectedParagraphId === paragraph.id
            const isActive = playback.activeParagraphId === paragraph.id
            const preview = paragraph.text.trim().slice(0, 48) || `Paragraph ${index + 1}`
            const subtitle = paragraph.speaker
              ? `¶ ${index + 1} · ${paragraph.speaker.toUpperCase()}`
              : `¶ ${index + 1}`

            return (
              <li key={paragraph.id}>
                <button
                  type="button"
                  onClick={() => scrollToParagraph(paragraph.id)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                    'hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:outline-none',
                    isSelected && 'bg-sidebar-accent text-sidebar-accent-foreground',
                    isActive && !isSelected && 'ring-1 ring-primary/30'
                  )}
                >
                  <span
                    className={cn(
                      'mt-1.5 w-1 shrink-0 self-stretch rounded-full min-h-4',
                      paragraphStatusRailClass(paragraph.status)
                    )}
                    aria-hidden
                  />
                  <span
                    className={cn('mt-1 size-2 shrink-0 rounded-full', voiceDotClass(paragraph.voice, voiceIdsInUse))}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{preview}</span>
                    <span className="truncate text-[0.65rem] font-mono text-muted-foreground">{subtitle}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </aside>
  )
}
