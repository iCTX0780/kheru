const DEFAULT_MAX_CHARS = 300
const MIN_SECONDS_PER_WORD = 0.265
const DURATION_RATIO_THRESHOLD = 0.92

function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function minimumExpectedDuration(text: string, lengthScale: number): number {
  return countWords(text) * MIN_SECONDS_PER_WORD * lengthScale
}

function splitSentences(text: string): string[] {
  return (
    text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [
      text,
    ]
  )
}

function splitOnWordBoundary(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/)
  const chunks: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }

    if (current) chunks.push(current)
    current = word
  }

  if (current) chunks.push(current)
  return chunks
}

/** Split long script text into Kokoro-safe chunks at sentence boundaries. */
export function splitTextForTts(text: string, maxChars = DEFAULT_MAX_CHARS): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.length <= maxChars) return [trimmed]

  const sentences = splitSentences(trimmed)
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence

    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }

    if (current) chunks.push(current)

    if (sentence.length > maxChars) {
      chunks.push(...splitOnWordBoundary(sentence, maxChars))
      current = ''
    } else {
      current = sentence
    }
  }

  if (current) chunks.push(current)
  return chunks.length > 0 ? chunks : [trimmed]
}

export function shouldRetryChunkedSynth(
  text: string,
  durationSeconds: number,
  lengthScale: number,
  maxChars = DEFAULT_MAX_CHARS
): boolean {
  const chunks = splitTextForTts(text, maxChars)
  if (chunks.length <= 1) return false
  const expected = minimumExpectedDuration(text, lengthScale)
  return durationSeconds + 0.05 < expected * DURATION_RATIO_THRESHOLD
}

export { countWords, minimumExpectedDuration }
