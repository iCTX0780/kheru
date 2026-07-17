const activeBlobUrls = new Set<string>()

export function createManagedBlobUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob)
  activeBlobUrls.add(url)
  return url
}

export function revokeManagedBlobUrl(url: string | null | undefined): void {
  if (!url?.startsWith('blob:')) return
  URL.revokeObjectURL(url)
  activeBlobUrls.delete(url)
}

export function revokeAllManagedBlobUrls(): void {
  for (const url of activeBlobUrls) {
    URL.revokeObjectURL(url)
  }
  activeBlobUrls.clear()
}

export function isManagedBlobUrl(url: string): boolean {
  return url.startsWith('blob:') && activeBlobUrls.has(url)
}
