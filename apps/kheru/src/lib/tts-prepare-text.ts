/** How a glossary entry should be spoken by Kokoro. */
export type TtsSpeakMode = 'expand' | 'spell' | 'word'

export interface TtsGlossaryEntry {
  pattern: RegExp
  spoken: string
  mode: TtsSpeakMode
}

/** Built-in software glossary — longer / compound patterns first. */
export const TTS_GLOSSARY: TtsGlossaryEntry[] = [
  { pattern: /\bCI\/CD\b/g, spoken: 'C I C D', mode: 'spell' },
  { pattern: /\ba11y\b/gi, spoken: 'accessibility', mode: 'expand' },
  { pattern: /\bi18n\b/gi, spoken: 'internationalization', mode: 'expand' },
  { pattern: /\bl10n\b/gi, spoken: 'localization', mode: 'expand' },
  { pattern: /\bk8s\b/gi, spoken: 'kubernetes', mode: 'expand' },
  { pattern: /\bDOM\b/g, spoken: 'dome', mode: 'word' },
  { pattern: /\bDI\b/g, spoken: 'D I', mode: 'spell' },
  { pattern: /\bHTTPS\b/g, spoken: 'H T T P S', mode: 'spell' },
  { pattern: /\bHTTP\b/g, spoken: 'H T T P', mode: 'spell' },
  { pattern: /\bJSON\b/g, spoken: 'J S O N', mode: 'spell' },
  { pattern: /\bAWS\b/g, spoken: 'A W S', mode: 'spell' },
  { pattern: /\bAPI\b/g, spoken: 'A P I', mode: 'spell' },
  { pattern: /\bURL\b/g, spoken: 'U R L', mode: 'spell' },
  { pattern: /\bSQL\b/g, spoken: 'S Q L', mode: 'spell' },
  { pattern: /\bCLI\b/g, spoken: 'C L I', mode: 'spell' },
  { pattern: /\bSSR\b/g, spoken: 'S S R', mode: 'spell' },
  { pattern: /\bCSR\b/g, spoken: 'C S R', mode: 'spell' },
  { pattern: /\bTTS\b/g, spoken: 'T T S', mode: 'spell' },
  { pattern: /\bUI\b/g, spoken: 'U I', mode: 'spell' },
  { pattern: /\bUX\b/g, spoken: 'U X', mode: 'spell' },
  { pattern: /\bPR\b/g, spoken: 'P R', mode: 'spell' },
  { pattern: /\bCI\b/g, spoken: 'C I', mode: 'spell' },
  { pattern: /\bCD\b/g, spoken: 'C D', mode: 'spell' },
]

const AS_OVERRIDE_PATTERN = /\b(\S+)\s*\[as:\s*([^\]]+)\]/gi

export interface PreparedTtsText {
  /** Script text with `[as: …]` hints removed for display. */
  display: string
  /** Text passed to Kokoro and Gentle alignment. */
  spoken: string
}

function applyGlossary(spoken: string, glossary: TtsGlossaryEntry[]): string {
  let result = spoken
  for (const entry of glossary) {
    result = result.replace(entry.pattern, entry.spoken)
  }
  return result
}

function applyAuthorOverrides(text: string): { display: string; spoken: string } {
  const overrides: Array<{ start: number; end: number; token: string; spoken: string }> = []

  for (const match of text.matchAll(AS_OVERRIDE_PATTERN)) {
    if (match.index == null) continue
    overrides.push({
      start: match.index,
      end: match.index + match[0].length,
      token: match[1],
      spoken: match[2].trim(),
    })
  }

  if (overrides.length === 0) {
    return { display: text, spoken: text }
  }

  let display = ''
  let spoken = ''
  let cursor = 0

  for (const override of overrides) {
    display += text.slice(cursor, override.start) + override.token
    spoken += text.slice(cursor, override.start) + override.spoken
    cursor = override.end
  }

  display += text.slice(cursor)
  spoken += text.slice(cursor)

  return { display, spoken }
}

/** Normalize script text for Kokoro while keeping a display-friendly form. */
export function prepareTextForTts(
  text: string,
  glossary: TtsGlossaryEntry[] = TTS_GLOSSARY
): PreparedTtsText {
  const trimmed = text.trim()
  if (!trimmed) return { display: '', spoken: '' }

  const { display, spoken: withOverrides } = applyAuthorOverrides(trimmed)
  const spoken = applyGlossary(withOverrides, glossary)

  return {
    display: display.trim(),
    spoken: spoken.trim(),
  }
}
