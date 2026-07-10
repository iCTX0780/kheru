const DEFAULT_MAX_CHARS = 300
const MIN_SECONDS_PER_WORD = 0.265
const DURATION_RATIO_THRESHOLD = 0.92

/** Placeholders use private-use chars so they never appear in real script text. */
const PLACEHOLDER_PREFIX = '\uE000'
const PLACEHOLDER_SUFFIX = '\uE001'

interface ProtectedSpan {
  placeholder: string
  value: string
}

/** Patterns whose `.` must not end a sentence for TTS chunking. Longest / most specific first. */
const PROTECTED_SPAN_PATTERNS: RegExp[] = [
  /\b(?:e\.g\.|i\.e\.|etc\.|vs\.|Jr\.|Sr\.|Dr\.|Mr\.|Mrs\.|Ms\.)\b/gi,
  /\b[a-z][a-z0-9]*\.(?:js|ts|tsx|jsx|mjs|cjs)\b/gi,
  /\bv\d+(?:\.\d+)+[a-zA-Z0-9]*\b/g,
  /\bv\d+\.[a-zA-Z0-9]+\b/g,
  /\b\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.]+)?\b/g,
  /\b\d+\.\d+[a-zA-Z]?\b/g,
]

function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function minimumExpectedDuration(text: string, lengthScale: number): number {
  return countWords(text) * MIN_SECONDS_PER_WORD * lengthScale
}

function protectSpans(text: string): { text: string; spans: ProtectedSpan[] } {
  const spans: ProtectedSpan[] = []
  let index = 0
  let result = text

  const protect = (input: string, pattern: RegExp): string =>
    input.replace(pattern, (match) => {
      const placeholder = `${PLACEHOLDER_PREFIX}${index++}${PLACEHOLDER_SUFFIX}`
      spans.push({ placeholder, value: match })
      return placeholder
    })

  for (const pattern of PROTECTED_SPAN_PATTERNS) {
    result = protect(result, pattern)
  }

  return { text: result, spans }
}

function restoreSpans(text: string, spans: ProtectedSpan[]): string {
  let result = text
  for (const { placeholder, value } of spans) {
    result = result.replaceAll(placeholder, value)
  }
  return result
}

function splitSentences(text: string): string[] {
  const { text: protectedText, spans } = protectSpans(text)
  const sentences =
    protectedText.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [
      protectedText,
    ]

  return sentences.map((sentence) => restoreSpans(sentence, spans)).filter(Boolean)
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

export { countWords, minimumExpectedDuration, protectSpans, restoreSpans, splitSentences }
