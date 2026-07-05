export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function fetchAudioBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Audio fetch failed (${response.status})`)
  }
  return response.arrayBuffer()
}

export function runIdFromAudioUrl(audioUrl: string): string | null {
  const match = audioUrl.match(/\/api\/audio\/([0-9a-f]{8})$/)
  return match?.[1] ?? null
}
