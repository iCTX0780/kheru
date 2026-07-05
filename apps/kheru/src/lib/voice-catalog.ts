import { fromDisplaySpeed } from '@/lib/speed'
export type VoiceGender = 'male' | 'female'

export interface Voice {
  id: string
  engine: VoiceEngine
  voiceKey: string
  displayName: string
  gender: VoiceGender
  defaultLengthScale: number
}

export const CURATED_VOICES: Voice[] = [
  {
    id: 'kokoro:af_heart',
    engine: 'kokoro',
    voiceKey: 'af_heart',
    displayName: 'Heart',
    gender: 'female',
    defaultLengthScale: 1.0,
  },
  {
    id: 'kokoro:af_bella',
    engine: 'kokoro',
    voiceKey: 'af_bella',
    displayName: 'Bella',
    gender: 'female',
    defaultLengthScale: 1.0,
  },
  {
    id: 'kokoro:af_sarah',
    engine: 'kokoro',
    voiceKey: 'af_sarah',
    displayName: 'Sarah',
    gender: 'female',
    defaultLengthScale: 1.0,
  },
  {
    id: 'kokoro:am_michael',
    engine: 'kokoro',
    voiceKey: 'am_michael',
    displayName: 'Michael',
    gender: 'male',
    defaultLengthScale: 1.0,
  },
  {
    id: 'kokoro:am_fenrir',
    engine: 'kokoro',
    voiceKey: 'am_fenrir',
    displayName: 'Fenrir',
    gender: 'male',
    defaultLengthScale: 1.0,
  },
  {
    id: 'kokoro:am_adam',
    engine: 'kokoro',
    voiceKey: 'am_adam',
    displayName: 'Adam',
    gender: 'male',
    defaultLengthScale: 1.0,
  },
  {
    id: 'piper:en_US-lessac-high',
    engine: 'piper',
    voiceKey: 'en_US-lessac-high',
    displayName: 'Lessac',
    gender: 'female',
    defaultLengthScale: 1.2,
  },
  {
    id: 'piper:en_US-ryan-high',
    engine: 'piper',
    voiceKey: 'en_US-ryan-high',
    displayName: 'Ryan',
    gender: 'male',
    defaultLengthScale: 1.2,
  },
  {
    id: 'piper:en_US-joe-medium',
    engine: 'piper',
    voiceKey: 'en_US-joe-medium',
    displayName: 'Joe',
    gender: 'male',
    defaultLengthScale: 1.2,
  },
]

export const DEFAULT_VOICE_ID = 'kokoro:am_michael'

/** Default voice per rehearsal script speaker label (case-insensitive). */
export const SPEAKER_VOICE_DEFAULTS: Record<string, string> = {
  INTERVIEWER: 'kokoro:af_heart',
  YOU: 'kokoro:am_michael',
  HEADLINE: 'kokoro:am_adam',
}

/** Optional import speed override per speaker (Piper lengthScale; 1.25 ≈ 0.8× in the UI). */
export const SPEAKER_LENGTH_SCALE_DEFAULTS: Record<string, number> = {
  HEADLINE: fromDisplaySpeed(0.8),
}

export function voiceForSpeaker(
  speaker: string | undefined,
  fallbackVoice: string,
  availableVoices: string[]
): string {
  if (!speaker) return fallbackVoice
  const key = speaker.trim().toUpperCase().replace(/\s+/g, '_')
  const preferred = SPEAKER_VOICE_DEFAULTS[key]
  if (preferred && availableVoices.includes(preferred)) return preferred
  return fallbackVoice
}

export function lengthScaleForSpeaker(
  speaker: string | undefined,
  fallbackLengthScale: number
): number {
  if (!speaker) return fallbackLengthScale
  const key = speaker.trim().toUpperCase().replace(/\s+/g, '_')
  return SPEAKER_LENGTH_SCALE_DEFAULTS[key] ?? fallbackLengthScale
}

export const VOICE_BY_ID = Object.fromEntries(
  CURATED_VOICES.map((voice) => [voice.id, voice])
) as Record<string, Voice>

export function voicePreviewFilename(voiceId: string): string {
  return `${voiceId.replace(':', '_')}.wav`
}

export function voiceSampleUrl(voiceId: string): string {
  return `/voice-samples/${voicePreviewFilename(voiceId)}`
}

export function voiceDisplayName(voiceId: string): string {
  const voice = VOICE_BY_ID[voiceId]
  if (voice) return `${voice.displayName} (${voice.engine})`
  return voiceId
}

export function voiceInitial(voiceId: string): string {
  const voice = VOICE_BY_ID[voiceId]
  return (voice?.displayName ?? voiceId).charAt(0).toUpperCase()
}
