export function clipDuration(audio: HTMLAudioElement, fallback = 0): number {
  if (Number.isFinite(audio.duration) && audio.duration > 0) return audio.duration
  return fallback > 0 ? fallback : 0
}

export function isClipAtEnd(audio: HTMLAudioElement, fallbackDuration = 0): boolean {
  if (audio.ended) return true
  const dur = clipDuration(audio, fallbackDuration)
  return dur > 0 && audio.currentTime >= dur - 0.1
}

export function sequenceClipKey(
  sequenceIndex: number,
  paragraphId: string,
  audioUrl: string
): string {
  return `seq:${sequenceIndex}:${paragraphId}:${audioUrl}`
}
