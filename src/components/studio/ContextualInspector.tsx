import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { VoicePicker } from '@/components/VoicePicker'
import { paragraphStatusLabel } from '@/lib/paragraph-status'
import { draftDiffersFromGeneration, MAX_PARAGRAPH_GENERATIONS, resolveActiveGeneration } from '@/lib/paragraph-generations'
import { fromDisplaySpeed, SPEED_MAX, SPEED_MIN, toDisplaySpeed } from '@/lib/speed'
import { useStudioStore } from '@/stores/studio'
import { ChevronDown, Play, Sparkles, Trash2 } from 'lucide-react'
import type { VoiceInfo } from '@/lib/voices'
import { cn } from '@/lib/utils'

interface ContextualInspectorProps {
  voices: VoiceInfo[]
  isLoadingVoices: boolean
  onGenerateSelection: () => void
  onPlaySelection: () => void
  onSelectGeneration: (paragraphId: string, generationId: string) => void
  onPlayGenerationTake: (paragraphId: string, generationId: string) => void
  onDeleteGeneration: (paragraphId: string, generationId: string) => void
}

function formatTakeTime(createdAt: string): string {
  const date = new Date(createdAt)
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString()
}

function truncateText(text: string, max = 60): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

export function ContextualInspector({
  voices,
  isLoadingVoices,
  onGenerateSelection,
  onPlaySelection,
  onSelectGeneration,
  onPlayGenerationTake,
  onDeleteGeneration,
}: ContextualInspectorProps) {
  const paragraphs = useStudioStore((s) => s.paragraphs)
  const selectedParagraphId = useStudioStore((s) => s.selectedParagraphId)
  const updateParagraph = useStudioStore((s) => s.updateParagraph)
  const generationLocked = useStudioStore(
    (s) => s.generationSession.active || s.chapter.status === 'generating'
  )

  const paragraph = paragraphs.find((p) => p.id === selectedParagraphId)

  if (!paragraph) {
    return (
      <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="border-b border-sidebar-border px-4 py-3">
          <h2 className="text-sm font-semibold">Inspector</h2>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Select a paragraph to edit voice and speed settings.
        </div>
      </aside>
    )
  }

  const isGenerating = paragraph.status === 'generating'
  const canPlay = paragraph.status === 'done' && paragraph.audioUrl
  const generateLabel = paragraph.generations?.length ? 'Regenerate' : 'Generate'
  const activeGeneration = resolveActiveGeneration(paragraph)
  const draftChangedSinceActive =
    activeGeneration && draftDiffersFromGeneration(paragraph, activeGeneration)
  const takes = [...(paragraph.generations ?? [])].reverse()

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-3">
        <h2 className="text-sm font-semibold">Inspector</h2>
        <p className="text-xs text-muted-foreground">Paragraph settings</p>
      </div>

      <ScrollArea className="flex-1">
        <FieldGroup className="gap-5 p-4">
          <Field>
            <FieldLabel className="text-xs text-muted-foreground">Status</FieldLabel>
            <Badge variant="secondary">{paragraphStatusLabel(paragraph.status)}</Badge>
          </Field>

          <Field>
            <FieldLabel className="text-xs text-muted-foreground">Voice</FieldLabel>
            {isLoadingVoices ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <VoicePicker
                voices={voices}
                value={paragraph.voice}
                onValueChange={(voice) =>
                  updateParagraph(paragraph.id, { voice, lengthScale: 1.0 })
                }
                disabled={isGenerating}
              />
            )}
          </Field>

          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel className="text-xs text-muted-foreground">Speed</FieldLabel>
              <span className="text-xs font-semibold tabular-nums">
                {toDisplaySpeed(paragraph.lengthScale).toFixed(1)}x
              </span>
            </div>
            <Slider
              value={[toDisplaySpeed(paragraph.lengthScale)]}
              onValueChange={(value) =>
                updateParagraph(paragraph.id, {
                  lengthScale: fromDisplaySpeed(Array.isArray(value) ? value[0] : value),
                })
              }
              min={SPEED_MIN}
              max={SPEED_MAX}
              step={0.1}
              disabled={isGenerating}
            />
            <p className="text-[0.65rem] text-muted-foreground">Affects TTS generation speed.</p>
          </Field>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => void onGenerateSelection()}
              disabled={isGenerating || !paragraph.text.trim() || isLoadingVoices}
            >
              {isGenerating ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Generating
                </>
              ) : (
                <>
                  <Sparkles data-icon="inline-start" />
                  {generateLabel}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onPlaySelection}
              disabled={!canPlay}
            >
              <Play data-icon="inline-start" />
              Play selection
            </Button>
          </div>

          {paragraph.status === 'stale' && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Draft changed since active take — regenerate to create a new take from current text.
            </p>
          )}

          {draftChangedSinceActive && paragraph.status === 'done' && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Draft differs from the active take snapshot.
            </p>
          )}

          {takes.length > 0 && (
            <Collapsible defaultOpen={takes.length > 1}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                Takes ({takes.length}/{MAX_PARAGRAPH_GENERATIONS})
                <ChevronDown className="size-3.5" />
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-2 pt-2">
                <p className="text-[0.65rem] text-muted-foreground">
                  Up to {MAX_PARAGRAPH_GENERATIONS} takes per paragraph. Regenerating removes the oldest
                  when full.
                </p>
                {takes.map((take, index) => {
                  const isActive = take.id === paragraph.activeGenerationId
                  const takeNumber = takes.length - index
                  return (
                    <div
                      key={take.id}
                      className={cn(
                        'flex flex-col gap-2 rounded-md border p-2',
                        isActive ? 'border-primary/50 bg-primary/5' : 'border-border'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">Take {takeNumber}</span>
                            {isActive && (
                              <Badge variant="secondary" className="text-[0.6rem]">
                                Active
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                            {formatTakeTime(take.createdAt)} · {take.duration.toFixed(1)}s
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {truncateText(take.textSnapshot)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Preview take ${takeNumber}`}
                            onClick={() => onPlayGenerationTake(paragraph.id, take.id)}
                          >
                            <Play />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Delete take ${takeNumber}`}
                            disabled={generationLocked}
                            onClick={() => void onDeleteGeneration(paragraph.id, take.id)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                      {!isActive && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={generationLocked}
                          onClick={() => void onSelectGeneration(paragraph.id, take.id)}
                        >
                          Use this take
                        </Button>
                      )}
                    </div>
                  )
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {paragraph.status === 'done' && (
            <p className="text-xs text-muted-foreground">Estimated word highlights during playback.</p>
          )}

          {paragraph.error && (
            <Alert variant="destructive">
              <AlertDescription>{paragraph.error}</AlertDescription>
            </Alert>
          )}

          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              Advanced
              <ChevronDown className="size-3.5" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 text-xs text-muted-foreground">
              Stability, similarity, and style controls are planned for a future release.
            </CollapsibleContent>
          </Collapsible>
        </FieldGroup>
      </ScrollArea>
    </aside>
  )
}
