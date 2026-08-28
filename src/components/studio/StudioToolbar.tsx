import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Separator } from '@/components/ui/separator'
import { ExportMenu } from '@/components/ExportMenu'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { useStudioStore } from '@/stores/studio'
import {
  FileUp,
  HelpCircle,
  Monitor,
  PanelLeft,
  PanelRight,
  Pause,
  Play,
  Presentation,
  Sparkles,
} from 'lucide-react'

/**
 * True when running inside a Tauri window on macOS. Used to reserve
 * inset for the traffic-light buttons and enable the drag region.
 * Synchronous — avoids a Tauri IPC roundtrip just for CSS padding.
 */
function isMacTauri(): boolean {
  if (typeof window === 'undefined') return false
  if (!('__TAURI_INTERNALS__' in window)) return false
  const ua = navigator.userAgent || ''
  const platform = navigator.platform || ''
  return /Mac/i.test(platform) || /Mac OS X/i.test(ua)
}

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
  const generationLocked = useStudioStore(
    (s) => s.generationSession.active || s.chapter.status === 'generating'
  )
  const selectedParagraphId = useStudioStore((s) => s.selectedParagraphId)
  const view = useStudioStore((s) => s.view)
  const setView = useStudioStore((s) => s.setView)
  const isMobile = useIsMobile()
  const macTauri = isMacTauri()

  const disabled = !hydrated || isLoadingVoices

  return (
    <>
      <header
        className={cn(
          'flex shrink-0 flex-col gap-2 border-b border-border bg-surface py-2 sm:flex-row sm:items-center sm:justify-between',
          macTauri ? 'pl-20 pr-3 sm:pr-4' : 'px-3 sm:px-4'
        )}
        data-tauri-drag-region={macTauri ? '' : undefined}
      >
        {/* Interactive left group — explicitly opts out of the header's
            drag region so buttons/links/inputs receive clicks in Tauri. */}
        <div
          className="flex min-w-0 flex-1 items-center gap-2"
          data-tauri-drag-region="false"
        >
          {view === 'editor' && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onToggleLeft}
              aria-label={leftCollapsed ? 'Show script panel' : 'Hide script panel'}
              aria-pressed={!leftCollapsed}
            >
              <PanelLeft />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink render={<Link to="/" />}>Projects</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Studio</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              className="mt-1 h-auto border-0 bg-transparent px-0 font-heading text-lg font-semibold tracking-tight shadow-none focus-visible:ring-0"
              placeholder="Untitled project"
              aria-label="Project title"
            />
          </div>
        </div>

        <div
          className="flex flex-wrap items-center gap-1.5"
          data-tauri-drag-region="false"
        >
          <Button
            type="button"
            variant={hasText ? 'secondary' : 'default'}
            size="sm"
            disabled={disabled}
            onClick={onImportOpen}
            title="Paste an AI-generated script to rehearse"
          >
            <FileUp data-icon="inline-start" />
            Import script
          </Button>

          <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || generationLocked || !canPlay}
            onClick={onTogglePlay}
          >
            {isPlaying ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || generationLocked || !selectedParagraphId}
            onClick={() => void onGenerateSelection()}
          >
            <Sparkles data-icon="inline-start" />
            Generate one
          </Button>

          <Button
            type="button"
            variant={hasText ? 'default' : 'outline'}
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

          <ExportMenu />

          {!isMobile && (
            <>
              <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
              <div
                role="group"
                aria-label="Studio view"
                className="flex overflow-hidden rounded-md border border-border"
              >
                <Button
                  type="button"
                  variant={view === 'editor' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 rounded-none border-0 px-2"
                  onClick={() => setView('editor')}
                  aria-pressed={view === 'editor'}
                  aria-label="Editor view"
                  title="Editor view (⌘⇧P)"
                >
                  <Monitor data-icon="inline-start" />
                  <span className="hidden md:inline">Editor</span>
                </Button>
                <Button
                  type="button"
                  variant={view === 'presenter' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 rounded-none border-0 px-2"
                  onClick={() => setView('presenter')}
                  aria-pressed={view === 'presenter'}
                  aria-label="Presenter view"
                  title="Presenter view (⌘⇧P)"
                >
                  <Presentation data-icon="inline-start" />
                  <span className="hidden md:inline">Presenter</span>
                </Button>
              </div>
            </>
          )}

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

          {view === 'editor' && (
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
          )}
        </div>
      </header>
    </>
  )
}
