import { useMemo } from 'react'
import { VoiceAvatar } from '@/components/studio/VoiceAvatar'
import { HighlightedText } from '@/components/HighlightedText'
import {
  voiceColorIndex,
  voiceDotClass,
  voiceRingClass,
} from '@/lib/voice-colors'
import { voiceInitial } from '@/lib/voice-catalog'
import { cn } from '@/lib/utils'
import { useStudioStore } from '@/stores/studio'

/**
 * Presenter view — a "watch/listen" rendering of the current script.
 * Rendered by StudioShell when `store.view === 'presenter'`. The bottom
 * SegmentedTimelinePlayer stays mounted at the shell level and drives
 * `playback.*`; this view only reads from it and reflects the state.
 */
export function PresenterStage() {
  const paragraphs = useStudioStore((s) => s.paragraphs)
  const activeParagraphId = useStudioStore((s) => s.playback.activeParagraphId)
  const selectedParagraphId = useStudioStore((s) => s.selectedParagraphId)
  const activeWordIndex = useStudioStore((s) => s.playback.activeWordIndex)
  const isPlaying = useStudioStore((s) => s.playback.isPlaying)

  const voiceIdsInUse = useMemo(() => paragraphs.map((p) => p.voice), [paragraphs])

  // One tile per unique voice, keyed by first-seen paragraph (for speaker label).
  const speakerTiles = useMemo(() => {
    const seen = new Map<string, { voiceId: string; label: string }>()
    for (const p of paragraphs) {
      if (seen.has(p.voice)) continue
      seen.set(p.voice, {
        voiceId: p.voice,
        label: (p.speaker && p.speaker.trim()) || voiceInitial(p.voice),
      })
    }
    return [...seen.values()]
  }, [paragraphs])

  // Ground the "showing" paragraph in what's playing; fall back to the
  // currently selected paragraph so the stage is never blank when idle.
  const showingParagraph =
    paragraphs.find((p) => p.id === activeParagraphId) ??
    paragraphs.find((p) => p.id === selectedParagraphId) ??
    paragraphs[0]

  const activeVoiceId = showingParagraph?.voice ?? speakerTiles[0]?.voiceId ?? ''
  const activeIndex =
    activeVoiceId && voiceIdsInUse.length > 0
      ? voiceColorIndex(activeVoiceId, voiceIdsInUse)
      : 0

  const totalParagraphs = paragraphs.length
  const currentPosition = showingParagraph
    ? paragraphs.findIndex((p) => p.id === showingParagraph.id) + 1
    : 0

  if (totalParagraphs === 0) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden pb-28 text-center">
        <div className="max-w-md px-6">
          <p className="font-heading text-2xl font-semibold tracking-tight">
            The stage is empty
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Switch back to Editor and import a script or add paragraphs.
            Presenter shows each speaker and rolls the transcript as the
            script plays.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden pb-28">
      {/* Ambient background tinted by the active speaker */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 transition-colors duration-700 ease-out',
          activeIndex === 0 && 'bg-speaker-0/8',
          activeIndex === 1 && 'bg-speaker-1/8',
          activeIndex === 2 && 'bg-speaker-2/8',
          activeIndex === 3 && 'bg-speaker-3/8',
          activeIndex === 4 && 'bg-speaker-4/8'
        )}
      />

      {/* Speaker tile grid */}
      <div className="relative shrink-0 px-6 pt-6 pb-3">
        <div
          className="mx-auto grid max-w-5xl gap-3"
          style={{
            gridTemplateColumns:
              speakerTiles.length === 1
                ? 'minmax(200px, 280px)'
                : `repeat(${Math.min(speakerTiles.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {speakerTiles.map((tile) => {
            const isActive = tile.voiceId === activeVoiceId
            return (
              <div
                key={tile.voiceId}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 backdrop-blur-sm transition-all duration-500 ease-out',
                  isActive
                    ? 'scale-[1.02] opacity-100 ring-2 ' + voiceRingClass(tile.voiceId, voiceIdsInUse)
                    : 'opacity-55'
                )}
              >
                <div
                  className={cn(
                    'relative',
                    isActive && isPlaying && 'motion-safe:animate-ambient-pulse'
                  )}
                >
                  <VoiceAvatar
                    voiceId={tile.voiceId}
                    voiceIdsInUse={voiceIdsInUse}
                    status={isActive && isPlaying ? 'generating' : 'done'}
                    className="size-12"
                  />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-heading text-xs font-semibold tracking-tight">
                    {tile.label}
                  </span>
                  <span className="flex items-center gap-1 text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                    <span
                      aria-hidden
                      className={cn(
                        'inline-block size-1 rounded-full',
                        voiceDotClass(tile.voiceId, voiceIdsInUse)
                      )}
                    />
                    <span className="max-w-[10rem] truncate">{tile.voiceId}</span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Rolling transcript — overflow-hidden guards against text bleeding
          up into the tile grid on short windows; internal overflow-y-auto
          lets very long paragraphs scroll instead of clipping. */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-8 py-4">
        <div className="max-h-full w-full max-w-[65ch] overflow-y-auto text-center">
          {showingParagraph?.speaker && (
            <div className="mb-3 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <span
                aria-hidden
                className={cn(
                  'inline-block size-1.5 rounded-full',
                  voiceDotClass(showingParagraph.voice, voiceIdsInUse)
                )}
              />
              {showingParagraph.speaker}
            </div>
          )}
          {showingParagraph ? (
            <HighlightedText
              text={showingParagraph.text}
              activeWordIndex={activeWordIndex}
              voiceId={showingParagraph.voice}
              voiceIdsInUse={voiceIdsInUse}
              className="text-xl leading-[1.5] tracking-tight md:text-2xl"
            />
          ) : (
            <p className="text-lg text-muted-foreground">Nothing to show.</p>
          )}
          <div className="mt-5 font-mono text-[0.65rem] tabular-nums uppercase tracking-wider text-muted-foreground">
            ¶ {currentPosition} / {totalParagraphs}
          </div>
        </div>
      </div>
    </div>
  )
}
