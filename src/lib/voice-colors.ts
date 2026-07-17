const SPEAKER_COUNT = 5

/** Stable palette index for a voice id among voices used in the session. */
export function voiceColorIndex(voiceId: string, voiceIdsInUse: string[]): number {
  const unique = [...new Set(voiceIdsInUse.filter(Boolean))]
  const index = unique.indexOf(voiceId)
  return index >= 0 ? index % SPEAKER_COUNT : 0
}

const ACTIVE_HIGHLIGHT: Record<number, string> = {
  0: 'bg-speaker-0/35 text-foreground ring-1 ring-speaker-0/50',
  1: 'bg-speaker-1/35 text-foreground ring-1 ring-speaker-1/50',
  2: 'bg-speaker-2/35 text-foreground ring-1 ring-speaker-2/50',
  3: 'bg-speaker-3/35 text-foreground ring-1 ring-speaker-3/50',
  4: 'bg-speaker-4/35 text-foreground ring-1 ring-speaker-4/50',
}

const IDLE_TINT: Record<number, string> = {
  0: 'bg-speaker-0/10',
  1: 'bg-speaker-1/10',
  2: 'bg-speaker-2/10',
  3: 'bg-speaker-3/10',
  4: 'bg-speaker-4/10',
}

const SEGMENT_BG: Record<number, string> = {
  0: 'bg-speaker-0/20 hover:bg-speaker-0/30',
  1: 'bg-speaker-1/20 hover:bg-speaker-1/30',
  2: 'bg-speaker-2/20 hover:bg-speaker-2/30',
  3: 'bg-speaker-3/20 hover:bg-speaker-3/30',
  4: 'bg-speaker-4/20 hover:bg-speaker-4/30',
}

const SEGMENT_ACTIVE: Record<number, string> = {
  0: 'bg-speaker-0/40 text-foreground',
  1: 'bg-speaker-1/40 text-foreground',
  2: 'bg-speaker-2/40 text-foreground',
  3: 'bg-speaker-3/40 text-foreground',
  4: 'bg-speaker-4/40 text-foreground',
}

export function voiceHighlightClass(
  voiceId: string,
  voiceIdsInUse: string[],
  isActive: boolean
): string {
  const index = voiceColorIndex(voiceId, voiceIdsInUse)
  return isActive ? ACTIVE_HIGHLIGHT[index] : IDLE_TINT[index]
}

export function voiceSegmentClass(
  voiceId: string,
  voiceIdsInUse: string[],
  isActive: boolean
): string {
  const index = voiceColorIndex(voiceId, voiceIdsInUse)
  return isActive ? SEGMENT_ACTIVE[index] : SEGMENT_BG[index]
}

const DOT_BG: Record<number, string> = {
  0: 'bg-speaker-0',
  1: 'bg-speaker-1',
  2: 'bg-speaker-2',
  3: 'bg-speaker-3',
  4: 'bg-speaker-4',
}

export function voiceDotClass(voiceId: string, voiceIdsInUse: string[]): string {
  const index = voiceColorIndex(voiceId, voiceIdsInUse)
  return DOT_BG[index]
}

const ROW_TINT: Record<number, string> = {
  0: 'bg-speaker-0/8',
  1: 'bg-speaker-1/8',
  2: 'bg-speaker-2/8',
  3: 'bg-speaker-3/8',
  4: 'bg-speaker-4/8',
}

const RING: Record<number, string> = {
  0: 'ring-speaker-0/50',
  1: 'ring-speaker-1/50',
  2: 'ring-speaker-2/50',
  3: 'ring-speaker-3/50',
  4: 'ring-speaker-4/50',
}

const ACCENT_TICK: Record<number, string> = {
  0: 'bg-speaker-0',
  1: 'bg-speaker-1',
  2: 'bg-speaker-2',
  3: 'bg-speaker-3',
  4: 'bg-speaker-4',
}

export function voiceRowTintClass(voiceId: string, voiceIdsInUse: string[]): string {
  const index = voiceColorIndex(voiceId, voiceIdsInUse)
  return ROW_TINT[index]
}

export function voiceRingClass(voiceId: string, voiceIdsInUse: string[]): string {
  const index = voiceColorIndex(voiceId, voiceIdsInUse)
  return RING[index]
}

export function voiceAccentTickClass(voiceId: string, voiceIdsInUse: string[]): string {
  const index = voiceColorIndex(voiceId, voiceIdsInUse)
  return ACCENT_TICK[index]
}

const CUE_BORDER: Record<number, string> = {
  0: 'border-l-speaker-0',
  1: 'border-l-speaker-1',
  2: 'border-l-speaker-2',
  3: 'border-l-speaker-3',
  4: 'border-l-speaker-4',
}

export function voiceCueBorderClass(voiceId: string, voiceIdsInUse: string[]): string {
  const index = voiceColorIndex(voiceId, voiceIdsInUse)
  return CUE_BORDER[index]
}
