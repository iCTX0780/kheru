import { useEffect, useState, type ChangeEvent } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { parseImportScript } from '@/lib/parse-script'
import { useStudioStore } from '@/stores/studio'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { NavRail } from '@/components/studio/NavRail'
import { ScriptCanvas } from '@/components/studio/ScriptCanvas'
import { ContextualInspector } from '@/components/studio/ContextualInspector'
import { StudioToolbar } from '@/components/studio/StudioToolbar'
import { SegmentedTimelinePlayer } from '@/components/SegmentedTimelinePlayer'
import { GenerationProgressPanel } from '@/components/studio/GenerationProgressPanel'
import { cn } from '@/lib/utils'
import type { VoiceInfo } from '@/lib/api'

interface StudioShellProps {
  hydrated: boolean
  voices: VoiceInfo[]
  isLoadingVoices: boolean
  chapterGenerating: boolean
  chapterError?: string
  hasText: boolean
  canPlay: boolean
  isPlaying: boolean
  onTogglePlay: () => void
  onGenerateSelection: () => void
  onGenerateChapter: () => void
  onPlayParagraph: (id: string) => void
  onPlayAll: () => void
  onPlaySelection: () => void
  onOpenShortcuts: () => void
}

export function StudioShell({
  hydrated,
  voices,
  isLoadingVoices,
  chapterGenerating,
  chapterError,
  hasText,
  canPlay,
  isPlaying,
  onTogglePlay,
  onGenerateSelection,
  onGenerateChapter,
  onPlayParagraph: _onPlayParagraph,
  onPlayAll,
  onPlaySelection,
  onOpenShortcuts,
}: StudioShellProps) {
  const isMobile = useIsMobile()
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')

  const importParagraphs = useStudioStore((s) => s.importParagraphs)

  const handleImport = () => {
    const blocks = parseImportScript(importText)
    if (blocks.length === 0) return
    importParagraphs(blocks)
    setImportText('')
    setImportOpen(false)
  }

  useEffect(() => {
    if (isMobile) {
      setLeftOpen(false)
      setRightOpen(false)
    } else {
      setLeftOpen(true)
      setRightOpen(true)
    }
  }, [isMobile])

  const inspector = (
    <ContextualInspector
      voices={voices}
      isLoadingVoices={isLoadingVoices}
      onGenerateSelection={onGenerateSelection}
      onPlaySelection={onPlaySelection}
    />
  )

  return (
    <TooltipProvider>
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <StudioToolbar
          hydrated={hydrated}
          isLoadingVoices={isLoadingVoices}
          chapterGenerating={chapterGenerating}
          hasText={hasText}
          canPlay={canPlay}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          onGenerateSelection={onGenerateSelection}
          onGenerateChapter={onGenerateChapter}
          leftCollapsed={!leftOpen}
          rightCollapsed={!rightOpen}
          onToggleLeft={() => setLeftOpen((v) => !v)}
          onToggleRight={() => setRightOpen((v) => !v)}
          onOpenShortcuts={onOpenShortcuts}
          onImportOpen={() => setImportOpen(true)}
        />

        {chapterError && (
          <div className="shrink-0 border-b border-destructive/20 bg-destructive/10 px-4 py-2">
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{chapterError}</AlertDescription>
            </Alert>
          </div>
        )}

        {isMobile ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-28">
            {leftOpen && (
              <div className="max-h-44 shrink-0 border-b border-border">
                <NavRail />
              </div>
            )}
            <ScriptCanvas
              voices={voices}
              hydrated={hydrated}
              onImportOpen={() => setImportOpen(true)}
            />
            <Sheet open={rightOpen} onOpenChange={setRightOpen}>
              <SheetContent side="right" className="w-full max-w-sm p-0">
                {inspector}
              </SheetContent>
            </Sheet>
          </div>
        ) : (
          <div
            className={cn(
              'grid min-h-0 flex-1 overflow-hidden pb-28',
              leftOpen && rightOpen && 'grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(280px,320px)]',
              leftOpen && !rightOpen && 'grid-cols-[minmax(220px,260px)_minmax(0,1fr)]',
              !leftOpen && rightOpen && 'grid-cols-[minmax(0,1fr)_minmax(280px,320px)]',
              !leftOpen && !rightOpen && 'grid-cols-1'
            )}
          >
            {leftOpen && <NavRail />}
            <ScriptCanvas
              voices={voices}
              hydrated={hydrated}
              onImportOpen={() => setImportOpen(true)}
            />
            {rightOpen && inspector}
          </div>
        )}

        <GenerationProgressPanel />
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
          <SegmentedTimelinePlayer onPlayAll={onPlayAll} />
        </div>

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="!flex max-h-[min(90dvh,40rem)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
            <DialogHeader className="shrink-0 gap-2 border-b border-border px-4 py-4">
              <DialogTitle>Import script</DialogTitle>
              <DialogDescription>
                Paste a script with speaker labels (HEADING:, INTERVIEWER:, YOU:, etc.). Wrapped
                lines merge into the previous turn. HEADING/HEADLINE → Fenrir, INTERVIEWER → Heart,
                YOU → Michael by default.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-hidden px-4 py-3">
              <Textarea
                value={importText}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setImportText(e.target.value)}
                placeholder={'INTERVIEWER: Thanks for joining...\nYOU: Sure. I\'m a technical lead...'}
                className="min-h-32 max-h-[min(55dvh,28rem)] w-full resize-none overflow-y-auto overscroll-contain font-mono text-sm"
              />
            </div>
            <DialogFooter className="shrink-0">
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleImport} disabled={!importText.trim()}>
                Import
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
