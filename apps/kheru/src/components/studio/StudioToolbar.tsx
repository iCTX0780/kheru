import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ExportMenu } from '@/components/ExportMenu'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useStudioStore, type StudioPlayMode } from '@/stores/studio'
import {
  FileUp,
  HelpCircle,
  PanelLeft,
  PanelRight,
  Pause,
  Play,
  Sparkles,
} from 'lucide-react'

interface StudioToolbarProps {
  hydrated: boolean
  isLoadingVoices: boolean
  chapterGenerating: boolean
  hasText: boolean
  canPlay: boolean
  isPlaying: boolean
  onTogglePlay: () => void
  onGenerateSelection: () => void
  onGenerateChapter: () => void
  leftCollapsed: boolean
  rightCollapsed: boolean
  onToggleLeft: () => void
  onToggleRight: () => void
  onOpenShortcuts: () => void
  onImportOpen: () => void
}

export function StudioToolbar({
  hydrated,
  isLoadingVoices,
  chapterGenerating,
  hasText,
  canPlay,
  isPlaying,
  onTogglePlay,
  onGenerateSelection,
  onGenerateChapter,
  leftCollapsed,
  rightCollapsed,
  onToggleLeft,
  onToggleRight,
  onOpenShortcuts,
  onImportOpen,
}: StudioToolbarProps) {
  const projectTitle = useStudioStore((s) => s.projectTitle)
  const setProjectTitle = useStudioStore((s) => s.setProjectTitle)
  const studioPlayMode = useStudioStore((s) => s.studioPlayMode)
  const setStudioPlayMode = useStudioStore((s) => s.setStudioPlayMode)
  const selectedParagraphId = useStudioStore((s) => s.selectedParagraphId)

  const disabled = !hydrated || isLoadingVoices

  return (
    <>
      <header className="flex shrink-0 flex-col gap-2 border-b border-border bg-surface px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onToggleLeft}
            aria-label={leftCollapsed ? 'Show chapters panel' : 'Hide chapters panel'}
            aria-pressed={!leftCollapsed}
          >
            <PanelLeft />
          </Button>
          <div className="min-w-0 flex-1">
            <Input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              className="h-auto border-0 bg-transparent px-0 font-heading text-lg font-semibold tracking-tight shadow-none focus-visible:ring-0"
              placeholder="Untitled project"
              aria-label="Project title"
            />
            <p className="text-[0.65rem] text-muted-foreground">Rehearsal studio</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <ToggleGroup
            value={[studioPlayMode]}
            onValueChange={(value) => {
              const next = (Array.isArray(value) ? value[0] : value) as StudioPlayMode | undefined
              if (next) setStudioPlayMode(next)
            }}
            variant="outline"
            size="sm"
            disabled={disabled}
          >
            <ToggleGroupItem value="selection" aria-label="Play selection only">
              Selection
            </ToggleGroupItem>
            <ToggleGroupItem value="until-end" aria-label="Play until end of chapter">
              Until end
            </ToggleGroupItem>
          </ToggleGroup>

          <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || !canPlay}
            onClick={onTogglePlay}
          >
            {isPlaying ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>

          <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !selectedParagraphId}
            onClick={() => void onGenerateSelection()}
          >
            <Sparkles data-icon="inline-start" />
            Generate one
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={disabled || chapterGenerating || !hasText}
            onClick={() => void onGenerateChapter()}
          >
            {chapterGenerating ? (
              <>
                <Spinner data-icon="inline-start" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles data-icon="inline-start" />
                Generate all
              </>
            )}
          </Button>

          <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type="button" variant="ghost" size="sm" disabled={disabled} />}
            >
              <FileUp data-icon="inline-start" />
              Import
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={onImportOpen}>Import script</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <ExportMenu />

          <ThemeToggle />

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onOpenShortcuts}
            aria-label="Keyboard shortcuts"
          >
            <HelpCircle />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onToggleRight}
            aria-label={rightCollapsed ? 'Show inspector panel' : 'Hide inspector panel'}
            aria-pressed={!rightCollapsed}
          >
            <PanelRight />
          </Button>
        </div>
      </header>
    </>
  )
}
