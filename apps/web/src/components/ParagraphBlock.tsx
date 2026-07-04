import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { VoicePicker } from '@/components/VoicePicker'
import { HighlightedText } from '@/components/HighlightedText'
import { ChevronDown, ChevronUp, Play, Sparkles, Trash2 } from 'lucide-react'
import { getAudioDuration } from '@/lib/audio-duration'
import { turnFromParagraph, useGenerate } from '@/lib/api'
import type { Paragraph } from '@/stores/studio'
import { useStudioStore } from '@/stores/studio'
import { fromDisplaySpeed, SPEED_MAX, SPEED_MIN, toDisplaySpeed } from '@/lib/speed'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ParagraphBlockProps {
  paragraph: Paragraph
  index: number
  voices: string[]
  isActive: boolean
  isPlaying: boolean
  activeWordIndex: number | null
  onPlay: (id: string) => void
}

export function ParagraphBlock({
  paragraph,
  index,
  voices,
  isActive,
  isPlaying,
  activeWordIndex,
  onPlay,
}: ParagraphBlockProps) {
  const generate = useGenerate()
  const updateParagraph = useStudioStore((s) => s.updateParagraph)
  const removeParagraph = useStudioStore((s) => s.removeParagraph)
  const moveParagraph = useStudioStore((s) => s.moveParagraph)
  const setParagraphGenerating = useStudioStore((s) => s.setParagraphGenerating)
  const setParagraphDone = useStudioStore((s) => s.setParagraphDone)
  const setParagraphError = useStudioStore((s) => s.setParagraphError)
  const paragraphs = useStudioStore((s) => s.paragraphs)

  const canPlay = paragraph.status === 'done' && paragraph.audioUrl
  const isGenerating = paragraph.status === 'generating'

  const handleGenerate = useCallback(async () => {
    if (!paragraph.text.trim()) {
      toast.error('Add text before generating')
      return
    }

    setParagraphGenerating(paragraph.id)
    try {
      const result = await generate.mutateAsync([
        turnFromParagraph(paragraph.id, paragraph.text.trim(), paragraph.voice, paragraph.lengthScale),
      ])
      const duration = await getAudioDuration(result.audio_url)
      setParagraphDone(paragraph.id, result.audio_url, duration)
      toast.success('Paragraph generated')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      setParagraphError(paragraph.id, message)
      toast.error(message)
    }
  }, [generate, paragraph, setParagraphDone, setParagraphError, setParagraphGenerating])

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface p-4 transition-colors',
        isActive && 'border-primary/50 bg-primary/5'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1 pt-1">
          <span className="text-xs font-medium text-muted-foreground w-6 text-center">{index + 1}</span>
          <div className="flex flex-col gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              disabled={index === 0}
              onClick={() => moveParagraph(paragraph.id, 'up')}
              aria-label="Move up"
            >
              <ChevronUp className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              disabled={index === paragraphs.length - 1}
              onClick={() => moveParagraph(paragraph.id, 'down')}
              aria-label="Move down"
            >
              <ChevronDown className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {isActive && isPlaying && paragraph.text.trim() ? (
            <div
              className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed"
              aria-live="polite"
            >
              <HighlightedText text={paragraph.text} activeWordIndex={activeWordIndex} />
            </div>
          ) : (
            <Textarea
              value={paragraph.text}
              onChange={(e) => updateParagraph(paragraph.id, { text: e.target.value })}
              placeholder="Write dialogue for this paragraph..."
              className="min-h-20 resize-y text-sm bg-background"
            />
          )}

          {isActive && isPlaying && (
            <p className="text-[10px] text-muted-foreground">Word highlights are approximate.</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="flex flex-col gap-3">
              <Field>
                <FieldLabel className="text-xs text-muted-foreground">Voice</FieldLabel>
                <VoicePicker
                  voices={voices}
                  value={paragraph.voice}
                  onValueChange={(voice) =>
                    updateParagraph(paragraph.id, { voice, lengthScale: 1.0 })
                  }
                  disabled={isGenerating}
                />
              </Field>

              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel className="text-xs text-muted-foreground">Speed</FieldLabel>
                  <span className="text-xs font-semibold">{toDisplaySpeed(paragraph.lengthScale).toFixed(1)}x</span>
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
              </Field>
            </div>

            <div className="flex gap-2 sm:flex-col">
              <Button
                type="button"
                size="sm"
                onClick={() => void handleGenerate()}
                disabled={isGenerating || !paragraph.text.trim()}
              >
                {isGenerating ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Generating
                  </>
                ) : (
                  <>
                    <Sparkles data-icon="inline-start" />
                    Generate
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onPlay(paragraph.id)}
                disabled={!canPlay}
              >
                <Play data-icon="inline-start" />
                Play
              </Button>
            </div>
          </div>

          {paragraph.status === 'stale' && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Content changed — re-generate to update audio.
            </p>
          )}

          {paragraph.error && (
            <Alert variant="destructive">
              <AlertDescription>{paragraph.error}</AlertDescription>
            </Alert>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => removeParagraph(paragraph.id)}
          disabled={paragraphs.length <= 1}
          aria-label="Delete paragraph"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}
