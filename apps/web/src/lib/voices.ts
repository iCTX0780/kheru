export function voiceDisplayName(voiceId: string): string {
  const parts = voiceId.split('-')
  return parts.length > 1 ? parts.slice(1).join('-') : voiceId
}

export function voiceSampleUrl(voiceId: string): string {
  return `/voice-samples/${voiceId}.wav`
}

export function voiceInitial(voiceId: string): string {
  const name = voiceDisplayName(voiceId)
  return name.charAt(0).toUpperCase()
}
