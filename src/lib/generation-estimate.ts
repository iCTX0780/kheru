export const BASE_MS_PER_PARAGRAPH = 8_000
export const SYNTH_MS_PER_WORD = 400
export const STITCH_BUFFER_MS = 30_000

export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export function estimateParagraphMs(text: string): number {
  return BASE_MS_PER_PARAGRAPH + countWords(text) * SYNTH_MS_PER_WORD
}

export function estimateBulkGenerationMs(texts: string[]): number {
  const paragraphMs = texts.reduce((sum, text) => sum + estimateParagraphMs(text), 0)
  return paragraphMs + STITCH_BUFFER_MS
}

export function estimateRemainingMs(params: {
  startedAt: number | null
  completed: number
  total: number
  estimatedTotalMs: number | null
  isStitching: boolean
}): number {
  const { startedAt, completed, total, estimatedTotalMs, isStitching } = params
  if (isStitching) return STITCH_BUFFER_MS

  const remaining = total - completed
  if (remaining <= 0) return 0

  if (startedAt != null && completed >= 2) {
    const elapsed = Date.now() - startedAt
    return (elapsed / completed) * remaining
  }

  if (estimatedTotalMs != null && startedAt != null && completed > 0) {
    return Math.max(0, estimatedTotalMs - (Date.now() - startedAt))
  }

  if (estimatedTotalMs != null) {
    return estimatedTotalMs
  }

  return remaining * BASE_MS_PER_PARAGRAPH
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'less than 1 min'
  if (seconds < 60) return 'less than 1 min'

  const mins = Math.round(seconds / 60)
  if (mins < 60) return `about ${mins} min`

  const hrs = Math.round(mins / 60)
  return hrs === 1 ? 'about 1 hr' : `about ${hrs} hr`
}
