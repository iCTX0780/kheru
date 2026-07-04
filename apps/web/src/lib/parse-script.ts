export function parseImportScript(script: string): string[] {
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
