import { startTransition, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BookOpen, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { paragraphStatusRailClass } from '@/lib/paragraph-status'
import { scrollToParagraph as scrollParagraphIntoView } from '@/lib/scroll-to-paragraph'
import { voiceDotClass } from '@/lib/voice-colors'
import { cn } from '@/lib/utils'
import { useStudioStore } from '@/stores/studio'

export function NavRail() {
  const paragraphs = useStudioStore((s) => s.paragraphs)
  const chapters = useStudioStore((s) => s.chapters)
  const activeChapterId = useStudioStore((s) => s.activeChapterId)
  const selectedParagraphId = useStudioStore((s) => s.selectedParagraphId)
  const playback = useStudioStore((s) => s.playback)
  const chapterTitle = useStudioStore((s) => s.chapterTitle)
  const setChapterTitle = useStudioStore((s) => s.setChapterTitle)
  const setSelectedParagraphId = useStudioStore((s) => s.setSelectedParagraphId)
  const addChapter = useStudioStore((s) => s.addChapter)
  const switchChapter = useStudioStore((s) => s.switchChapter)
  const generationLocked = useStudioStore(
    (s) => s.generationSession.active || s.chapter.status === 'generating'
  )

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(chapterTitle)

  const voiceIdsInUse = paragraphs.map((p) => p.voice)

  const scrollToParagraph = (id: string) => {
    startTransition(() => {
      setSelectedParagraphId(id)
      scrollParagraphIntoView(id)
    })
  }

  const openRename = () => {
    setRenameValue(chapterTitle)
    setRenameOpen(true)
  }

  const saveRename = () => {
    const next = renameValue.trim()
    if (!next) return
    setChapterTitle(next)
    setRenameOpen(false)
    toast.success('Chapter renamed')
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen className="size-4 shrink-0 opacity-70" />
          <span className="truncate text-sm font-semibold">Chapters</span>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={generationLocked}
                aria-label="Add chapter"
                onClick={() => addChapter()}
              >
                <Plus />
              </Button>
            }
          />
          <TooltipContent>Add chapter</TooltipContent>
        </Tooltip>
      </div>

      <ScrollArea className="max-h-36 shrink-0 px-2 py-2">
        <ul className="flex flex-col gap-0.5">
          {(chapters.length > 0 ? chapters : [{ id: activeChapterId, title: chapterTitle }]).map(
            (chapter) => {
              const isActive = chapter.id === activeChapterId
              return (
                <li key={chapter.id}>
                  <button
                    type="button"
                    onClick={() => switchChapter(chapter.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'hover:bg-sidebar-accent/60'
                    )}
                  >
                    <span
                      className={cn('size-2 shrink-0 rounded-full', isActive ? 'bg-primary' : 'bg-muted-foreground/40')}
                      aria-hidden
                    />
                    <span className="truncate">{chapter.title}</span>
                  </button>
                </li>
              )
            }
          )}
        </ul>
      </ScrollArea>

      <div className="flex items-center justify-between gap-1 border-t border-sidebar-border px-3 py-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{chapterTitle}</span>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Rename chapter" onClick={openRename}>
          <Pencil />
        </Button>
      </div>

      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
          Paragraphs
        </span>
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
              <li key={paragraph.id} className="[content-visibility:auto]">
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

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename chapter</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="chapter-title">Chapter title</FieldLabel>
              <Input
                id="chapter-title"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveRename()}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveRename}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
