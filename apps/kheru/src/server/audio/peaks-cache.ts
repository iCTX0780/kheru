const MAX_ENTRIES = 64

interface PeakEntry {
  samples: number[]
  duration: number
  maxAmplitude: number
}

const cache = new Map<string, PeakEntry>()

export function getCachedPeaks(runId: string): PeakEntry | undefined {
  const entry = cache.get(runId)
  if (!entry) return undefined
  cache.delete(runId)
  cache.set(runId, entry)
  return entry
}

export function setCachedPeaks(runId: string, entry: PeakEntry): void {
  if (cache.has(runId)) cache.delete(runId)
  cache.set(runId, entry)
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
}

export function computePeakMeta(samples: number[], sampleRate = 22_050, sampleCount?: number): {
  duration: number
  maxAmplitude: number
} {
  const maxAmplitude = Math.max(...samples, 0.0001)
  const duration =
    sampleCount && sampleCount > 0
      ? sampleCount / sampleRate
      : samples.length > 0
        ? samples.length * 0.1
        : 0
  return { duration, maxAmplitude }
}
