import { fromDisplaySpeed } from '@/lib/speed'

export type VoiceEngine = 'kokoro'
export type VoiceGender = 'male' | 'female'
export type VoiceLocale = 'en-us' | 'en-gb'

export interface Voice {
  id: string
  engine: VoiceEngine
  voiceKey: string
  displayName: string
  gender: VoiceGender
  locale: VoiceLocale
  defaultLengthScale: number
}

function kokoroVoice(
  voiceKey: string,
  displayName: string,
  gender: VoiceGender,
  locale: VoiceLocale
): Voice {
  return {
    id: `kokoro:${voiceKey}`,
    engine: 'kokoro',
    voiceKey,
    displayName,
    gender,
    locale,
    defaultLengthScale: 1.0,
  }
}

/** All English voices supported by kokoro-js (`tts.list_voices()`). */
export const CURATED_VOICES: Voice[] = [
  // American English — female
  kokoroVoice('af_heart', 'Heart', 'female', 'en-us'),
  kokoroVoice('af_bella', 'Bella', 'female', 'en-us'),
  kokoroVoice('af_nicole', 'Nicole', 'female', 'en-us'),
  kokoroVoice('af_sarah', 'Sarah', 'female', 'en-us'),
  kokoroVoice('af_kore', 'Kore', 'female', 'en-us'),
  kokoroVoice('af_aoede', 'Aoede', 'female', 'en-us'),
  kokoroVoice('af_alloy', 'Alloy', 'female', 'en-us'),
  kokoroVoice('af_nova', 'Nova', 'female', 'en-us'),
  kokoroVoice('af_sky', 'Sky', 'female', 'en-us'),
  kokoroVoice('af_jessica', 'Jessica', 'female', 'en-us'),
  kokoroVoice('af_river', 'River', 'female', 'en-us'),
  // American English — male
  kokoroVoice('am_michael', 'Michael', 'male', 'en-us'),
  kokoroVoice('am_fenrir', 'Fenrir', 'male', 'en-us'),
  kokoroVoice('am_puck', 'Puck', 'male', 'en-us'),
  kokoroVoice('am_adam', 'Adam', 'male', 'en-us'),
  kokoroVoice('am_echo', 'Echo', 'male', 'en-us'),
  kokoroVoice('am_eric', 'Eric', 'male', 'en-us'),
  kokoroVoice('am_liam', 'Liam', 'male', 'en-us'),
  kokoroVoice('am_onyx', 'Onyx', 'male', 'en-us'),
  kokoroVoice('am_santa', 'Santa', 'male', 'en-us'),
  // British English — female
  kokoroVoice('bf_emma', 'Emma', 'female', 'en-gb'),
  kokoroVoice('bf_isabella', 'Isabella', 'female', 'en-gb'),
  kokoroVoice('bf_alice', 'Alice', 'female', 'en-gb'),
  kokoroVoice('bf_lily', 'Lily', 'female', 'en-gb'),
  // British English — male
  kokoroVoice('bm_george', 'George', 'male', 'en-gb'),
  kokoroVoice('bm_fable', 'Fable', 'male', 'en-gb'),
  kokoroVoice('bm_daniel', 'Daniel', 'male', 'en-gb'),
  kokoroVoice('bm_lewis', 'Lewis', 'male', 'en-gb'),
]

export const DEFAULT_VOICE_ID = 'kokoro:am_michael'

/** Default voice per rehearsal script speaker label (case-insensitive). */
export const SPEAKER_VOICE_DEFAULTS: Record<string, string> = {
  HEADING: 'kokoro:am_fenrir',
  HEADLINE: 'kokoro:am_fenrir',
  INTERVIEWER: 'kokoro:af_heart',
  YOU: 'kokoro:am_michael',
}

/** Optional import speed override per speaker (lengthScale; 1.25 ≈ 0.8× in the UI). */
export const SPEAKER_LENGTH_SCALE_DEFAULTS: Record<string, number> = {
  HEADING: fromDisplaySpeed(0.8),
  HEADLINE: fromDisplaySpeed(0.8),
}

export function voiceForSpeaker(
  speaker: string | undefined,
  fallbackVoice: string,
  availableVoices: string[],
  customMap?: Record<string, string>
): string {
  if (!speaker) return fallbackVoice
  if (customMap?.[speaker]) return customMap[speaker]
  const key = speaker.trim().toUpperCase().replace(/\s+/g, '_')
  const preferred = SPEAKER_VOICE_DEFAULTS[key]
  if (preferred && availableVoices.includes(preferred)) return preferred
  return fallbackVoice
}

/** Suggest a distinct voice per speaker for the import mapping step. */
export function buildSpeakerVoiceDefaults(
  speakers: string[],
  fallbackVoice: string,
  availableVoices: string[]
): Record<string, string> {
  const map: Record<string, string> = {}
  const used = new Set<string>()

  for (const speaker of speakers) {
    const preferred = voiceForSpeaker(speaker, fallbackVoice, availableVoices)
    if (!used.has(preferred)) {
      map[speaker] = preferred
      used.add(preferred)
      continue
    }

    const unused = availableVoices.find((voice) => !used.has(voice))
    const voice = unused ?? preferred
    map[speaker] = voice
    used.add(voice)
  }

  return map
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

export const LOCALE_LABELS: Record<VoiceLocale, string> = {
  'en-us': 'American English',
  'en-gb': 'British English',
}

export function voicePreviewFilename(voiceId: string): string {
  return `${voiceId.replace(':', '_')}.wav`
}

export function voiceDisplayName(voiceId: string): string {
  const voice = VOICE_BY_ID[voiceId]
  return voice?.displayName ?? voiceId
}

export function voiceInitial(voiceId: string): string {
  const voice = VOICE_BY_ID[voiceId]
  return (voice?.displayName ?? voiceId).charAt(0).toUpperCase()
}
