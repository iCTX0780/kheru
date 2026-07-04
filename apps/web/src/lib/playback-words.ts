export interface WordTiming {
  word: string
  start: number
  end: number
}

export function splitWords(text: string): string[] {
  return text.trim() ? text.trim().split(/\s+/) : []
}

function wordWeights(words: string[]): number[] {
  return words.map((word) => {
    let weight = Math.max(word.length, 1)
    if (/[,.!?;:…]$/.test(word)) weight *= 1.6
    else if (/[-—]$/.test(word)) weight *= 1.2
    return weight
  })
}

/** Map playback progress (0–1) within a clip/segment to the active word index. */
export function activeWordIndexForProgress(text: string, progress: number): number | null {
  const words = splitWords(text)
  if (words.length === 0) return null

  const clamped = Math.min(Math.max(progress, 0), 1)
  const weights = wordWeights(words)
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return 0

  const target = clamped * total
  let cumulative = 0
  for (let i = 0; i < words.length; i++) {
    cumulative += weights[i]
    if (target <= cumulative || i === words.length - 1) {
      return i
    }
  }
  return words.length - 1
}

/** Approximate word timings by character-weighted duration within a segment. */
export function approximateWordTimings(
  text: string,
  segmentStart: number,
  segmentEnd: number
): WordTiming[] {
  const words = splitWords(text)
  if (words.length === 0) return []

  const duration = Math.max(segmentEnd - segmentStart, 0)
  const weights = wordWeights(words)
  const total = weights.reduce((a, b) => a + b, 0)

  let offset = segmentStart
  return words.map((word, i) => {
    const wordDuration = (weights[i] / total) * duration
    const timing = { word, start: offset, end: offset + wordDuration }
    offset += wordDuration
    return timing
  })
}

export function activeWordIndex(timings: WordTiming[], time: number): number | null {
  if (timings.length === 0) return null
  const index = timings.findIndex((t) => time >= t.start && time < t.end)
  if (index !== -1) return index
  if (time >= timings[timings.length - 1].start) return timings.length - 1
  return null
}
