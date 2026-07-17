export function clipDuration(audio: HTMLAudioElement, fallback = 0): number {
  if (Number.isFinite(audio.duration) && audio.duration > 0) return audio.duration
  return fallback > 0 ? fallback : 0
}

export function isClipAtEnd(audio: HTMLAudioElement, fallbackDuration = 0): boolean {
  if (audio.ended) return true
  const dur = clipDuration(audio, fallbackDuration)
  return dur > 0 && audio.currentTime >= dur - 0.1
}

/** Reset audio element position when replaying after natural end. */
export function prepareAudioElementForPlay(audio: HTMLAudioElement, localStartTime = 0): void {
  const atEnd =
    audio.ended ||
    (Number.isFinite(audio.duration) && audio.duration > 0 && audio.currentTime >= audio.duration - 0.05)

  if (atEnd) {
    audio.currentTime = localStartTime
    return
  }

  if (localStartTime > 0 && Math.abs(audio.currentTime - localStartTime) > 0.05) {
    audio.currentTime = localStartTime
  }
}

export function sequenceClipKey(
  sequenceIndex: number,
  paragraphId: string,
  audioUrl: string
): string {
  return `seq:${sequenceIndex}:${paragraphId}:${audioUrl}`
}
