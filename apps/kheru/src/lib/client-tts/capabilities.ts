export interface ServerCapabilities {
  gentle: boolean
  client_tts_build: boolean
}

let cached: ServerCapabilities | null = null
let fetchPromise: Promise<ServerCapabilities> | null = null

const defaultCapabilities: ServerCapabilities = {
  gentle: false,
  client_tts_build: false,
}

export async function fetchServerCapabilities(): Promise<ServerCapabilities> {
  if (cached) return cached
  if (fetchPromise) return fetchPromise

  fetchPromise = (async () => {
    try {
      const response = await fetch('/api/capabilities')
      if (!response.ok) return defaultCapabilities
      const data = (await response.json()) as ServerCapabilities
      cached = {
        gentle: Boolean(data.gentle),
        client_tts_build: Boolean(data.client_tts_build),
      }
      return cached
    } catch {
      return defaultCapabilities
    } finally {
      fetchPromise = null
    }
  })()

  return fetchPromise
}

export function getCachedServerCapabilities(): ServerCapabilities | null {
  return cached
}

export function resetServerCapabilitiesCache(): void {
  cached = null
  fetchPromise = null
}
