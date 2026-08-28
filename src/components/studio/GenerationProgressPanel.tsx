import { memo, useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Circle, Loader2, Square, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { voiceDisplayName } from '@/lib/voice-catalog'
import { estimateRemainingMs, formatEta } from '@/lib/generation-estimate'
import { useClientTtsLoad } from '@/hooks/use-client-tts-load'
import { voiceDotClass } from '@/lib/voice-colors'
import { cn } from '@/lib/utils'
import { useStudioStore } from '@/stores/studio'
import { useStudioActions } from '@/hooks/use-studio-actions'

type SegmentState = 'queued' | 'generating' | 'done' | 'error'

function segmentStateFor(
  paragraphId: string,
  index: number,
  session: ReturnType<typeof useStudioStore.getState>['generationSession'],
  paragraphStatus: string
): SegmentState {
  if (session.failedId === paragraphId) return 'error'
  if (session.completedIds.includes(paragraphId)) return 'done'
  if (session.active && index === session.currentIndex && paragraphStatus === 'generating') {
    return 'generating'
  }
  if (session.active && index === session.currentIndex) return 'generating'
  return 'queued'
}

const GenerationSegmentRow = memo(function GenerationSegmentRow({
  index,
  label,
  voiceId,
  voiceIdsInUse,
  state,
}: {
  index: number
  label: string
  voiceId: string
  voiceIdsInUse: string[]
  state: SegmentState
}) {
  return (
    <li
      className={cn(
        'flex items-start gap-2.5 rounded-md px-2 py-1.5 text-xs transition-colors',
        state === 'generating' && 'bg-status-generating/10',
        state === 'done' && 'opacity-80',
        state === 'error' && 'bg-status-error/10'
      )}
    >
      <span className="mt-0.5 w-4 shrink-0 text-center font-mono text-[0.65rem] text-muted-foreground">
        {index + 1}
      </span>
      <span
        className={cn('mt-1 size-2 shrink-0 rounded-full', voiceDotClass(voiceId, voiceIdsInUse))}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{label}</span>
        <span className="text-[0.65rem] text-muted-foreground">{voiceDisplayName(voiceId)}</span>
      </span>
      <span className="mt-0.5 shrink-0" aria-hidden>
        {state === 'done' && <Check className="size-3.5 text-status-converted" />}
        {state === 'generating' && (
          <Loader2 className="size-3.5 animate-spin text-status-generating" />
        )}
        {state === 'error' && <X className="size-3.5 text-status-error" />}
        {state === 'queued' && <Circle className="size-3 text-muted-foreground/40" />}
      </span>
    </li>
  )
})

function ProgressRing({ percent }: { percent: number }) {
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <div className="relative size-11 shrink-0">
      <svg className="size-full -rotate-90" viewBox="0 0 44 44" aria-hidden>
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-border"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-primary transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-heading text-[0.7rem] font-semibold tabular-nums">
        {Math.round(percent)}%
      </span>
    </div>
  )
}

export function GenerationProgressPanel() {
  const generationSession = useStudioStore((s) => s.generationSession)
  const chapter = useStudioStore((s) => s.chapter)
  const paragraphs = useStudioStore((s) => s.paragraphs)
  const finishGenerationSession = useStudioStore((s) => s.finishGenerationSession)
  const { handleStopGeneration } = useStudioActions()
  const clientTtsLoad = useClientTtsLoad()

  const [expanded, setExpanded] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [tick, setTick] = useState(0)

  const total = generationSession.paragraphIds.length
  const completed = generationSession.completedIds.length
  const hasError = Boolean(generationSession.failedId && generationSession.error)
  const isStitching =
    generationSession.active &&
    total > 0 &&
    completed === total &&
    chapter.status === 'generating'

  const remainingMs = estimateRemainingMs({
    startedAt: generationSession.startedAt,
    completed,
    total,
    estimatedTotalMs: generationSession.estimatedTotalMs,
    isStitching,
  })
  const etaLabel = formatEta(remainingMs / 1000)
  const isLargeBatch = total >= 5
  const showChillCopy = total >= 10 && generationSession.active && !hasError
  void tick

  useEffect(() => {
    if (!generationSession.active) return
    const timer = window.setInterval(() => setTick((value) => value + 1), 10_000)
    return () => window.clearInterval(timer)
  }, [generationSession.active])

  const percent = total === 0 ? 0 : isStitching ? 100 : (completed / total) * 100

  const paragraphById = useMemo(
    () => new Map(paragraphs.map((p) => [p.id, p])),
    [paragraphs]
  )

  const voiceIdsInUse = useMemo(
    () =>
      generationSession.paragraphIds
        .map((id) => paragraphById.get(id)?.voice)
        .filter((v): v is string => Boolean(v)),
    [generationSession.paragraphIds, paragraphById]
  )

  const currentId = generationSession.paragraphIds[generationSession.currentIndex]
  const currentParagraph = currentId ? paragraphById.get(currentId) : undefined
  const isModelLoading =
    clientTtsLoad.status === 'loading' &&
    generationSession.active &&
    completed === 0
  const currentPreview = isModelLoading
    ? clientTtsLoad.progress != null
      ? `Downloading Kokoro model (${Math.round(clientTtsLoad.progress)}%)…`
      : 'Downloading Kokoro model…'
    : currentParagraph?.text.trim().slice(0, 64) ||
      (isStitching ? 'Stitching full mix…' : 'Preparing…')

  const visible =
    generationSession.active ||
    showComplete ||
    Boolean(generationSession.failedId && generationSession.error)

  useEffect(() => {
    if (generationSession.active) {
      setShowComplete(false)
      setExpanded(true)
    }
  }, [generationSession.active])

  useEffect(() => {
    if (!generationSession.active && completed === total && total > 0 && !generationSession.failedId) {
      setShowComplete(true)
      setExpanded(false)
      const timer = window.setTimeout(() => setShowComplete(false), 2000)
      return () => window.clearTimeout(timer)
    }
  }, [generationSession.active, generationSession.failedId, completed, total])

  if (!visible) return null

  const progressSubtitle = (() => {
    if (hasError) return generationSession.error
    if (isStitching) return 'Almost done — stitching full mix'
    if (showChillCopy) {
      return `Prepping your run — voicing ${total} paragraph${total === 1 ? '' : 's'}.`
    }
    if (completed < 2 && generationSession.active) {
      if (isModelLoading) {
        return clientTtsLoad.file
          ? `First run downloads model weights — ${clientTtsLoad.file.split('/').pop()}`
          : 'First run downloads model weights (~tens of MB).'
      }
      return 'Warming up — time estimate in a moment.'
    }
    if (generationSession.active && total >= 5) {
      return `${completed} / ${total} · ${etaLabel} remaining`
    }
    return `${completed} / ${total} segments · ${currentPreview}${currentPreview.length >= 64 ? '…' : ''}`
  })()

  return (
    <div
      className={cn(
        'fixed inset-x-0 z-30 border-t border-border bg-surface/95 backdrop-blur-sm',
        'bottom-[calc(4.5rem+env(safe-area-inset-bottom))]'
      )}
      role="status"
      aria-live="polite"
      aria-label="Voice generation progress"
    >
      <div className="mx-auto max-w-3xl px-4 py-3">
        <div className="flex items-center gap-3">
          <ProgressRing percent={percent} />

          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm font-semibold">
              {hasError
                ? 'Generation stopped'
                : isStitching
                  ? 'Stitching'
                  : showComplete
                    ? 'Generation complete'
                    : isLargeBatch && generationSession.active
                      ? 'Generating voices — this takes a while'
                      : 'Generating voices'}
            </p>
            <p className="truncate text-xs text-muted-foreground">{progressSubtitle}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {generationSession.active && !hasError && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={handleStopGeneration}
                aria-label="Stop generation"
              >
                <Square className="size-3 fill-current" />
                Stop
              </Button>
            )}
            {(generationSession.active || hasError) && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                aria-label={expanded ? 'Collapse segment list' : 'Expand segment list'}
              >
                {expanded ? <ChevronDown /> : <ChevronUp />}
              </Button>
            )}
            {hasError && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => finishGenerationSession()}
                aria-label="Dismiss"
              >
                <X />
              </Button>
            )}
          </div>
        </div>

        {expanded && total > 0 && (
          <ul className="mt-3 max-h-48 space-y-0.5 overflow-y-auto overscroll-contain border-t border-border pt-3">
            {generationSession.paragraphIds.map((id, index) => {
              const paragraph = paragraphById.get(id)
              if (!paragraph) return null
              const label = paragraph.text.trim().slice(0, 56) || `Paragraph ${index + 1}`
              const state = segmentStateFor(id, index, generationSession, paragraph.status)
              return (
                <GenerationSegmentRow
                  key={id}
                  index={index}
                  label={label}
                  voiceId={paragraph.voice}
                  voiceIdsInUse={voiceIdsInUse}
                  state={state}
                />
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
