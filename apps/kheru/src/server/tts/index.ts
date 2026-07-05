import { randomBytes } from 'node:crypto'
import { copyFileSync, unlinkSync } from 'node:fs'
import { kokoroSpeedFromLengthScale } from '@/lib/speed'
import { validateVoice } from '@/server/voices/catalog'
import { synthKokoro } from './kokoro'
import { synthPiper } from './piper'
import { concatWavs } from './concat'
import { countWords, splitTextForTts, shouldRetryChunkedSynth } from './chunk-text'
import {
  DEFAULT_GAP_SECONDS,
  TARGET_SAMPLE_RATE,
  audioPath,
  tempClipPath,
} from './paths'
import { clipDurationSeconds } from './wav'
import { alignWithGentle, gentleUrl } from '@/server/alignment/gentle'

export interface Turn {
  speaker: string
  voice: string
  text: string
  length_scale?: number
  gap_after?: number
}

export interface SegmentTimestamp {
  index: number
  start: number
  end: number
}

export interface AlignedWord {
  index: number
  word: string
  start: number
  end: number
}

async function synthChunk(
  text: string,
  voice: ReturnType<typeof validateVoice>,
  outPath: string,
  lengthScale: number
): Promise<void> {
  if (voice.engine === 'piper') {
    await synthPiper(text, voice.voiceKey, outPath, lengthScale)
    return
  }
  const kokoroSpeed = kokoroSpeedFromLengthScale(lengthScale)
  await synthKokoro(text, voice.voiceKey, outPath, kokoroSpeed)
}

async function synthChunkedLine(
  chunks: string[],
  voice: ReturnType<typeof validateVoice>,
  outPath: string,
  lengthScale: number
): Promise<void> {
  const chunkPaths: string[] = []

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunkPath = `${outPath}.chunk-${i}.wav`
      chunkPaths.push(chunkPath)
      await synthChunk(chunks[i], voice, chunkPath, lengthScale)
    }

    const zeroGaps = Array.from({ length: chunkPaths.length - 1 }, () => 0)
    concatWavs(chunkPaths, outPath, zeroGaps, TARGET_SAMPLE_RATE)
  } finally {
    for (const chunkPath of chunkPaths) {
      try {
        unlinkSync(chunkPath)
      } catch {
        /* ignore */
      }
    }
  }
}

async function synthLine(
  text: string,
  voiceId: string,
  outPath: string,
  lengthScale: number
): Promise<void> {
  const voice = validateVoice(voiceId)
  const chunks = splitTextForTts(text)

  if (voice.engine === 'kokoro' && chunks.length > 1) {
    await synthChunkedLine(chunks, voice, outPath, lengthScale)
    return
  }

  await synthChunk(text, voice, outPath, lengthScale)

  if (
    chunks.length > 1 &&
    shouldRetryChunkedSynth(text, clipDurationSeconds(outPath), lengthScale)
  ) {
    console.warn(
      `TTS output shorter than expected for ${countWords(text)} words — retrying in ${chunks.length} chunks`
    )
    await synthChunkedLine(chunks, voice, outPath, lengthScale)
  }
}

export interface ClipRef {
  index: number
  run_id: string
  audio_url: string
}

export async function generateConversation(
  turns: Turn[]
): Promise<{ runId: string; segments: SegmentTimestamp[]; words: AlignedWord[]; clips: ClipRef[] }> {
  const runId = randomBytes(4).toString('hex')
  const clips: string[] = []
  const clipRefs: ClipRef[] = []
  const gaps: number[] = []
  const segments: SegmentTimestamp[] = []
  const words: AlignedWord[] = []
  const alignmentUrl = gentleUrl()
  let offset = 0

  try {
    for (let idx = 0; idx < turns.length; idx++) {
      const turn = turns[idx]
      const clipPath = tempClipPath(runId, idx)
      const lengthScale = turn.length_scale ?? 1.0
      await synthLine(turn.text, turn.voice, clipPath, lengthScale)
      clips.push(clipPath)

      const duration = clipDurationSeconds(clipPath)
      segments.push({ index: idx, start: offset, end: offset + duration })

      if (alignmentUrl) {
        try {
          const clipWords = await alignWithGentle(clipPath, turn.text, alignmentUrl)
          for (const timing of clipWords) {
            words.push({
              index: idx,
              word: timing.word,
              start: timing.start,
              end: timing.end,
            })
          }
        } catch (err) {
          console.warn(`Gentle alignment failed for turn ${idx}:`, err)
        }
      }

      const gap = turn.gap_after ?? DEFAULT_GAP_SECONDS
      gaps.push(gap)
      offset += duration
      if (idx < turns.length - 1) offset += gap
    }

    concatWavs(clips, audioPath(runId), gaps, TARGET_SAMPLE_RATE)

    for (let idx = 0; idx < clips.length; idx++) {
      const clipRunId = randomBytes(4).toString('hex')
      copyFileSync(clips[idx], audioPath(clipRunId))
      clipRefs.push({
        index: idx,
        run_id: clipRunId,
        audio_url: `/api/audio/${clipRunId}`,
      })
    }
  } finally {
    for (const clip of clips) {
      try {
        unlinkSync(clip)
      } catch {
        /* ignore */
      }
    }
  }

  return { runId, segments, words, clips: clipRefs }
}
