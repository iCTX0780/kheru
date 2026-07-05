/** Speaker label at line start, e.g. INTERVIEWER:, YOU:, Shadi: */
const SPEAKER_LINE = /^([A-Za-z][A-Za-z0-9_ ]{0,48}):\s*(.*)$/

/** Markdown rehearsal scripts: **INTERVIEWER:** dialogue */
const BOLD_SPEAKER_LINE = /^\*\*([A-Za-z][A-Za-z0-9_ ]{0,48}):\*\*\s*(.*)$/

export interface ImportBlock {
  text: string
  speaker?: string
}

function normalizeImportScript(script: string): string {
  let text = script.replace(/\r\n/g, '\n')

  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---\n', 4)
    if (end !== -1) text = text.slice(end + 5)
  }

  const notesIdx = text.search(/^##\s+Delivery notes/im)
  if (notesIdx !== -1) text = text.slice(0, notesIdx)

  const lines: string[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^#{1,6}\s+/.test(trimmed)) {
      const title = trimmed.replace(/^#{1,6}\s+/, '').trim()
      if (title) lines.push(`HEADLINE: ${title}`)
      continue
    }
    if (trimmed.startsWith('>')) continue
    if (trimmed === '---') continue

    const boldSpeaker = trimmed.match(BOLD_SPEAKER_LINE)
    if (boldSpeaker) {
      lines.push(`${boldSpeaker[1]}: ${boldSpeaker[2]}`)
      continue
    }

    lines.push(trimmed)
  }

  return lines.join('\n')
}

function scriptUsesSpeakerLabels(script: string): boolean {
  const normalized = normalizeImportScript(script)
  return normalized.split('\n').some((line) => SPEAKER_LINE.test(line.trim()))
}

export function parseImportScript(script: string): ImportBlock[] {
  const normalized = normalizeImportScript(script)
  const speakerMode = scriptUsesSpeakerLabels(normalized)

  if (!speakerMode) {
    return parsePlainLines(normalized).map((text) => ({ text }))
  }

  const paragraphs: ImportBlock[] = []

  for (const line of normalized.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const speakerMatch = trimmed.match(SPEAKER_LINE)
    if (speakerMatch) {
      paragraphs.push({ speaker: speakerMatch[1].trim(), text: speakerMatch[2].trim() })
      continue
    }

    if (paragraphs.length === 0) {
      paragraphs.push({ text: trimmed })
      continue
    }

    const last = paragraphs.length - 1
    const prev = paragraphs[last]
    paragraphs[last] = {
      ...prev,
      text: prev.text ? `${prev.text} ${trimmed}` : trimmed,
    }
  }

  return paragraphs.map((p) => ({ ...p, text: p.text.trim() })).filter((p) => p.text)
}

/** One non-empty line per paragraph (no speaker labels in the script). */
function parsePlainLines(script: string): string[] {
  const paragraphs: string[] = []

  for (const line of script.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) {
      paragraphs.push(trimmed)
      continue
    }

    const text = trimmed.substring(colonIndex + 1).trim()
    if (text) paragraphs.push(text)
  }

  return paragraphs
}
