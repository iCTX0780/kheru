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
import { isClientTtsEnabled } from '@/lib/client-tts/config'
import { getCachedServerCapabilities } from '@/lib/client-tts/capabilities'
import { fromDisplaySpeed, SPEED_MAX, SPEED_MIN, toDisplaySpeed } from '@/lib/speed'
import { useStudioStore } from '@/stores/studio'
import { ChevronDown, Play, Sparkles } from 'lucide-react'
import type { VoiceInfo } from '@/lib/api'

interface ContextualInspectorProps {
  voices: VoiceInfo[]
  isLoadingVoices: boolean
  onGenerateSelection: () => void
  onPlaySelection: () => void
}

export function ContextualInspector({
  voices,
  isLoadingVoices,
  onGenerateSelection,
  onPlaySelection,
}: ContextualInspectorProps) {
  const paragraphs = useStudioStore((s) => s.paragraphs)
  const selectedParagraphId = useStudioStore((s) => s.selectedParagraphId)
  const updateParagraph = useStudioStore((s) => s.updateParagraph)
  const generationParagraphPhase = useStudioStore((s) => s.generationSession.paragraphPhase)

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
  const generateLabel = paragraph.status === 'done' ? 'Regenerate' : 'Generate'
  const clientTts = isClientTtsEnabled()
  const gentleAvailable = getCachedServerCapabilities()?.gentle ?? false
  const hasGentleTimings = Boolean(paragraph.wordTimings?.length)

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
                  {generationParagraphPhase === 'aligning' ? 'Aligning' : 'Generating'}
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
              Content changed — regenerate to update audio.
            </p>
          )}

          {paragraph.status === 'done' && hasGentleTimings && (
            <p className="text-xs text-muted-foreground">Word highlights (Gentle).</p>
          )}

          {paragraph.status === 'done' && !hasGentleTimings && clientTts && (
            <p className="text-xs text-muted-foreground">
              {gentleAvailable
                ? 'Estimated word highlights — alignment did not return timings for this clip.'
                : 'Estimated word highlights (offline). Enable Gentle on the server for aligned karaoke.'}
            </p>
          )}

          {paragraph.status === 'done' && !hasGentleTimings && !clientTts && (
            <p className="text-xs text-muted-foreground">
              Estimated word highlights. Run with Gentle for aligned karaoke.
            </p>
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
