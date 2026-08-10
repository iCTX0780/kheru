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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { useIsMobile } from '@/hooks/use-mobile'
import { collectImportSpeakers, parseImportScript, type ImportBlock } from '@/lib/parse-script'
import { buildSpeakerVoiceDefaults, DEFAULT_VOICE_ID } from '@/lib/voice-catalog'
import { useStudioStore } from '@/stores/studio'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { NavRail } from '@/components/studio/NavRail'
import { ScriptCanvas } from '@/components/studio/ScriptCanvas'
import { ContextualInspector } from '@/components/studio/ContextualInspector'
import { PresenterStage } from '@/components/studio/PresenterStage'
import { StudioToolbar } from '@/components/studio/StudioToolbar'
import { SegmentedTimelinePlayer } from '@/components/SegmentedTimelinePlayer'
import { GenerationProgressPanel } from '@/components/studio/GenerationProgressPanel'
import { ClientTtsLoadBanner } from '@/components/studio/ClientTtsLoadBanner'
import { VoicePicker } from '@/components/VoicePicker'
import { cn } from '@/lib/utils'
import type { VoiceInfo } from '@/lib/voices'

type ImportStep = 'paste' | 'speakers'

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
  onSelectGeneration: (paragraphId: string, generationId: string) => void
  onPlayGenerationTake: (paragraphId: string, generationId: string) => void
  onDeleteGeneration: (paragraphId: string, generationId: string) => void
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
  onSelectGeneration,
  onPlayGenerationTake,
  onDeleteGeneration,
  onOpenShortcuts,
}: StudioShellProps) {
  const isMobile = useIsMobile()
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importStep, setImportStep] = useState<ImportStep>('paste')
  const [parsedBlocks, setParsedBlocks] = useState<ImportBlock[]>([])
  const [speakerVoices, setSpeakerVoices] = useState<Record<string, string>>({})

  const importParagraphs = useStudioStore((s) => s.importParagraphs)
  const storeVoices = useStudioStore((s) => s.voices)
  const view = useStudioStore((s) => s.view)
  const setView = useStudioStore((s) => s.setView)

  const availableVoiceIds = voices.length > 0 ? voices.map((v) => v.id) : storeVoices
  const fallbackVoice = availableVoiceIds[0] ?? DEFAULT_VOICE_ID
  const importSpeakers = collectImportSpeakers(parsedBlocks)
  const totalImportParagraphs = parsedBlocks.filter((block) => block.text.trim()).length

  const resetImport = () => {
    setImportText('')
    setImportStep('paste')
    setParsedBlocks([])
    setSpeakerVoices({})
  }

  const finishImport = (blocks: ImportBlock[], voiceMap?: Record<string, string>) => {
    importParagraphs(blocks, voiceMap)
    resetImport()
    setImportOpen(false)
  }

  const handleImportContinue = () => {
    const blocks = parseImportScript(importText)
    if (blocks.length === 0) return

    const speakers = collectImportSpeakers(blocks)
    if (speakers.length === 0) {
      finishImport(blocks)
      return
    }

    setParsedBlocks(blocks)
    setSpeakerVoices(
      buildSpeakerVoiceDefaults(
        speakers.map((speaker) => speaker.label),
        fallbackVoice,
        availableVoiceIds
      )
    )
    setImportStep('speakers')
  }

  const handleImportConfirm = () => {
    if (parsedBlocks.length === 0) return
    finishImport(parsedBlocks, speakerVoices)
  }

  const handleImportOpenChange = (open: boolean) => {
    setImportOpen(open)
    if (!open) resetImport()
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

  // Presenter is desktop-only — the stage layout needs horizontal room.
  useEffect(() => {
    if (isMobile && view === 'presenter') setView('editor')
  }, [isMobile, view, setView])

  // ⌘⇧P / Ctrl+Shift+P — toggle Editor ↔ Presenter (desktop only).
  useEffect(() => {
    if (isMobile) return
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.shiftKey && (event.key === 'p' || event.key === 'P')) {
        event.preventDefault()
        setView(view === 'presenter' ? 'editor' : 'presenter')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isMobile, view, setView])

  const inspector = (
    <ContextualInspector
      voices={voices}
      isLoadingVoices={isLoadingVoices}
      onGenerateSelection={onGenerateSelection}
      onPlaySelection={onPlaySelection}
      onSelectGeneration={onSelectGeneration}
      onPlayGenerationTake={onPlayGenerationTake}
      onDeleteGeneration={onDeleteGeneration}
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

        {!isMobile && view === 'presenter' ? (
          <PresenterStage />
        ) : isMobile ? (
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
        <ClientTtsLoadBanner />
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
          <SegmentedTimelinePlayer onPlayAll={onPlayAll} />
        </div>

        <Dialog open={importOpen} onOpenChange={handleImportOpenChange}>
          <DialogContent className="!flex max-h-[min(90dvh,40rem)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
            <DialogHeader className="shrink-0 gap-2 border-b border-border px-4 py-4">
              <DialogTitle>
                {importStep === 'paste' ? 'Import script' : 'Assign voices'}
              </DialogTitle>
              <DialogDescription>
                {importStep === 'paste' ? (
                  <>
                    Paste a script with speaker labels (e.g. INTERVIEWER:, YOU:, Shadi:). Wrapped
                    lines merge into the previous turn.
                  </>
                ) : (
                  <>
                    {importSpeakers.length} speaker{importSpeakers.length === 1 ? '' : 's'} in{' '}
                    {totalImportParagraphs} paragraph{totalImportParagraphs === 1 ? '' : 's'}.
                    Choose a voice for each speaker before importing.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {importStep === 'paste' ? (
              <div className="min-h-0 flex-1 overflow-hidden px-4 py-3">
                <Textarea
                  value={importText}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setImportText(e.target.value)}
                  placeholder={'INTERVIEWER: Thanks for joining...\nYOU: Sure. I\'m a technical lead...'}
                  className="min-h-32 max-h-[min(55dvh,28rem)] w-full resize-none overflow-y-auto overscroll-contain font-mono text-sm"
                />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                <FieldGroup className="gap-4">
                  {importSpeakers.map((speaker) => (
                    <Field key={speaker.label}>
                      <FieldLabel className="text-xs text-muted-foreground">
                        {speaker.label}
                        <span className="ml-1.5 font-normal">
                          · {speaker.lineCount} paragraph{speaker.lineCount === 1 ? '' : 's'}
                        </span>
                      </FieldLabel>
                      <VoicePicker
                        voices={voices}
                        value={speakerVoices[speaker.label] ?? fallbackVoice}
                        onValueChange={(voice) =>
                          setSpeakerVoices((current) => ({ ...current, [speaker.label]: voice }))
                        }
                        disabled={isLoadingVoices || voices.length === 0}
                      />
                    </Field>
                  ))}
                </FieldGroup>
              </div>
            )}

            <DialogFooter className="shrink-0">
              {importStep === 'speakers' && (
                <Button type="button" variant="outline" onClick={() => setImportStep('paste')}>
                  Back
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => handleImportOpenChange(false)}>
                Cancel
              </Button>
              {importStep === 'paste' ? (
                <Button type="button" onClick={handleImportContinue} disabled={!importText.trim()}>
                  Continue
                </Button>
              ) : (
                <Button type="button" onClick={handleImportConfirm}>
                  Import
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
