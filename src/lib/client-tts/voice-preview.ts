import { createManagedBlobUrl } from '@/lib/client-tts/blob-registry'
import { warmClientTtsEngine, clientTtsGenerate } from '@/lib/client-tts/engine'
import { VOICE_BY_ID } from '@/lib/voice-catalog'

const PREVIEW_LINE = 'Hello, this is a voice preview.'
const previewUrlCache = new Map<string, string>()

/** Lazy client-synthesized voice preview; cached per voice for the session. */
export async function getVoicePreviewUrl(voiceId: string): Promise<string> {
  const cached = previewUrlCache.get(voiceId)
  if (cached) return cached

  const voice = VOICE_BY_ID[voiceId]
  if (!voice) throw new Error(`Unknown voice: ${voiceId}`)

  await warmClientTtsEngine()
  const result = await clientTtsGenerate(PREVIEW_LINE, voice.voiceKey, 1)
  const url = createManagedBlobUrl(result.blob)
  previewUrlCache.set(voiceId, url)
  return url
}
