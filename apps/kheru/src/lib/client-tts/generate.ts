import {
  countWords,
  shouldRetryChunkedSynth,
  splitTextForTts,
} from '@/lib/chunk-text'
import { prepareTextForTts } from '@/lib/tts-prepare-text'
import { alignParagraphAudio } from '@/lib/client-tts/align'
import { createManagedBlobUrl } from '@/lib/client-tts/blob-registry'
import { concatWavBlobs, concatWavBlobsDuration } from '@/lib/client-tts/concat-blobs'
import { clientTtsGenerate } from '@/lib/client-tts/engine'
import type { ClientGenerateResult, ClientTtsTurn } from '@/lib/client-tts/types'
import { saveChapterAudioOpfs, saveParagraphAudioOpfs } from '@/lib/client-tts/opfs'
import type { WordTiming } from '@/lib/playback-words'
import { PARAGRAPH_GAP_SECONDS } from '@/lib/playback-segments'
import { kokoroSpeedFromLengthScale } from '@/lib/speed'
import { VOICE_BY_ID } from '@/lib/voice-catalog'

function resolveVoiceKey(voiceId: string): string {
  const voice = VOICE_BY_ID[voiceId]
  if (!voice) throw new Error(`Unknown voice: ${voiceId}`)
  return voice.voiceKey
}

async function synthChunkedLine(
  chunks: string[],
  voiceKey: string,
  speed: number
): Promise<{ blob: Blob; duration: number }> {
  const chunkBlobs: Blob[] = []
  for (const chunk of chunks) {
    const result = await clientTtsGenerate(chunk, voiceKey, speed)
    chunkBlobs.push(result.blob)
  }
  const zeroGaps = Array.from({ length: chunkBlobs.length - 1 }, () => 0)
  const blob = await concatWavBlobs(chunkBlobs, zeroGaps)
  const duration = await concatWavBlobsDuration(chunkBlobs, zeroGaps)
  return { blob, duration }
}

async function synthLine(
  text: string,
  voiceId: string,
  lengthScale: number
): Promise<{ blob: Blob; duration: number }> {
  const voiceKey = resolveVoiceKey(voiceId)
  const speed = kokoroSpeedFromLengthScale(lengthScale)
  const chunks = splitTextForTts(text)

  if (chunks.length > 1) {
    return synthChunkedLine(chunks, voiceKey, speed)
  }

  const first = await clientTtsGenerate(text, voiceKey, speed)
  if (shouldRetryChunkedSynth(text, first.duration, lengthScale)) {
    console.warn(
      `Client TTS output shorter than expected for ${countWords(text)} words — retrying in chunks`
    )
    return synthChunkedLine(chunks, voiceKey, speed)
  }

  return { blob: first.blob, duration: first.duration }
}

export interface ClientGenerateOptions {
  projectId?: string
  paragraphId?: string
  /** When true, POST synthesized audio to /api/align when Gentle is up. */
  align?: boolean
  onAlignStart?: () => void
}

/** Generate one paragraph clip in the browser; optional Gentle align via server proxy. */
export async function clientGenerateParagraph(
  turn: ClientTtsTurn,
  options?: ClientGenerateOptions
): Promise<ClientGenerateResult> {
  const { spoken } = prepareTextForTts(turn.text)
  const { blob, duration } = await synthLine(spoken, turn.voice, turn.lengthScale)
  const audioUrl = createManagedBlobUrl(blob)

  if (options?.projectId && options.paragraphId) {
    void saveParagraphAudioOpfs(options.projectId, options.paragraphId, blob)
  }

  let wordTimings: WordTiming[] | null = null
  if (options?.align) {
    options.onAlignStart?.()
    wordTimings = await alignParagraphAudio(blob, spoken)
  }

  return {
    blob,
    duration,
    audioUrl,
    segments: [{ index: 0, start: 0, end: duration }],
    clips: [{ index: 0, blob, duration, audioUrl }],
    wordTimings,
  }
}

/** Stitch paragraph blobs client-side with inter-paragraph gaps. */
export async function clientStitchParagraphs(
  clips: Blob[],
  options?: { projectId?: string; chapterId?: string }
): Promise<{ blob: Blob; duration: number; audioUrl: string }> {
  const gaps = Array.from({ length: Math.max(clips.length - 1, 0) }, () => PARAGRAPH_GAP_SECONDS)
  const blob = await concatWavBlobs(clips, gaps)
  const duration = await concatWavBlobsDuration(clips, gaps)
  const audioUrl = createManagedBlobUrl(blob)

  if (options?.projectId && options.chapterId) {
    void saveChapterAudioOpfs(options.projectId, options.chapterId, blob)
  }

  return { blob, duration, audioUrl }
}
