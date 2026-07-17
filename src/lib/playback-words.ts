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

  for (let i = timings.length - 1; i >= 0; i--) {
    if (time >= timings[i].start) return i
  }

  return null
}

export interface TextWordAlignment {
  textIndex: number
  start: number
  end: number
}

function normalizeToken(word: string): string {
  return word.toLowerCase().replace(/^[^\w']+|[^\w']+$/g, '')
}

function isSkippableTiming(word: string): boolean {
  const token = normalizeToken(word)
  return !token || token === 'unk'
}

function tokenParts(word: string): string[] {
  return normalizeToken(word).split('-').filter(Boolean)
}

function tokensMatch(candidate: string, target: string): boolean {
  if (candidate === target) return true

  const candidateParts = tokenParts(candidate)
  const targetParts = tokenParts(target)
  if (candidateParts.includes(target) || targetParts.includes(candidate)) return true

  if (candidate.startsWith(target) || target.startsWith(candidate)) return true

  if (candidate.length >= 3 && target.length >= 3) {
    return candidate.includes(target) || target.includes(candidate)
  }

  return false
}

/** Map alignment clip timings onto display-word indices in the script text. */
export function alignTimingsToText(words: string[], timings: WordTiming[]): TextWordAlignment[] {
  if (words.length === 0 || timings.length === 0) return []

  const maxEnd = Math.max(...timings.map((t) => t.end), 0)
  const aligned: TextWordAlignment[] = []
  let textIdx = 0

  for (const timing of timings) {
    if (isSkippableTiming(timing.word)) continue

    const target = normalizeToken(timing.word)
    const positionHint =
      maxEnd > 0
        ? Math.min(words.length - 1, Math.floor((timing.start / maxEnd) * words.length))
        : textIdx

    let found = -1

    const hintStart = Math.max(textIdx, positionHint - 3)
    const hintEnd = Math.min(words.length, positionHint + 4)
    for (let i = hintStart; i < hintEnd; i++) {
      const candidate = normalizeToken(words[i])
      if (tokensMatch(candidate, target)) {
        found = i
        break
      }
    }

    if (found === -1) {
      for (let i = textIdx; i < Math.min(words.length, textIdx + 4); i++) {
        const candidate = normalizeToken(words[i])
        if (tokensMatch(candidate, target)) {
          found = i
          break
        }
      }
    }

    if (found === -1) {
      for (let i = textIdx; i < words.length; i++) {
        const candidate = normalizeToken(words[i])
        if (tokensMatch(candidate, target)) {
          found = i
          break
        }
      }
    }

    if (found === -1 && maxEnd > 0 && timing.start >= maxEnd * 0.85) {
      for (let i = words.length - 1; i >= textIdx; i--) {
        const candidate = normalizeToken(words[i])
        if (tokensMatch(candidate, target)) {
          found = i
          break
        }
      }
    }

    if (found === -1) continue

    aligned.push({ textIndex: found, start: timing.start, end: timing.end })
    textIdx = found + 1
  }

  return aligned
}

export interface PreparedWordHighlight {
  words: string[]
  aligned: TextWordAlignment[]
  hasTimings: boolean
}

/** Precompute alignment→script alignment once per paragraph; reuse during playback. */
export function prepareWordHighlight(
  text: string,
  timings: WordTiming[] | null | undefined
): PreparedWordHighlight {
  const words = splitWords(text)
  if (words.length === 0 || !timings?.length) {
    return { words, aligned: [], hasTimings: false }
  }

  const aligned = alignTimingsToText(words, timings)
  return { words, aligned, hasTimings: aligned.length > 0 }
}

/** Active word index from a prepared highlight map (cheap — safe every frame). */
export function activeTextWordIndexFromPrepared(
  prepared: PreparedWordHighlight,
  text: string,
  localTime: number,
  speechDuration: number
): number | null {
  const { words, aligned, hasTimings } = prepared
  if (words.length === 0) return null

  const progress = speechDuration > 0 ? Math.min(Math.max(localTime / speechDuration, 0), 1) : 0

  if (!hasTimings) {
    return activeWordIndexForProgress(text, progress)
  }

  const last = aligned[aligned.length - 1]

  // alignment often stops before the clip ends — keep highlighting through the full text.
  if (localTime >= last.end) {
    return activeWordIndexForProgress(text, progress)
  }

  if (localTime < aligned[0].start) {
    return 0
  }

  for (let i = 0; i < aligned.length; i++) {
    const entry = aligned[i]
    if (localTime >= entry.start && localTime < entry.end) {
      return entry.textIndex
    }

    const next = aligned[i + 1]
    if (next && localTime >= entry.end && localTime < next.start) {
      return entry.textIndex
    }
  }

  for (let i = aligned.length - 1; i >= 0; i--) {
    if (localTime >= aligned[i].start) {
      return aligned[i].textIndex
    }
  }

  return activeWordIndexForProgress(text, progress)
}

/** Active display-word index for highlighting, using alignment timings when available. */
export function activeTextWordIndex(
  text: string,
  localTime: number,
  speechDuration: number,
  timings: WordTiming[] | null | undefined
): number | null {
  return activeTextWordIndexFromPrepared(
    prepareWordHighlight(text, timings),
    text,
    localTime,
    speechDuration
  )
}
