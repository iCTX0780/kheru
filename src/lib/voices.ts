import { CURATED_VOICES, type Voice } from '@/lib/voice-catalog'

export interface VoiceInfo {
  id: string
  engine: 'kokoro'
  display_name: string
  gender: 'male' | 'female'
  default_length_scale: number
}

export function voiceToInfo(voice: Voice): VoiceInfo {
  return {
    id: voice.id,
    engine: voice.engine,
    display_name: voice.displayName,
    gender: voice.gender,
    default_length_scale: voice.defaultLengthScale,
  }
}

export function listVoices(): VoiceInfo[] {
  return CURATED_VOICES.map(voiceToInfo)
}
