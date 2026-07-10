import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, unlinkSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { concatWavs } from './concat'
import { audioPath, DEFAULT_GAP_SECONDS, TARGET_SAMPLE_RATE, TEMP_DIR } from './paths'

const RUN_ID_RE = /^[0-9a-f]{8}$/

export type ExportFormat = 'wav' | 'mp3'

export function validateRunId(runId: string): void {
  if (!RUN_ID_RE.test(runId)) {
    throw new Error('Invalid run id')
  }
}

export function exportConcat(
  runIds: string[],
  format: ExportFormat
): { buffer: Buffer; contentType: string; filename: string } {
  if (runIds.length === 0) {
    throw new Error('No audio clips to export')
  }

  for (const runId of runIds) {
    validateRunId(runId)
    if (!existsSync(audioPath(runId))) {
      throw new Error(`Audio not found: ${runId}`)
    }
  }

  const exportId = randomBytes(4).toString('hex')
  const wavOut = `${TEMP_DIR}/export-${exportId}.wav`

  try {
    if (runIds.length === 1 && format === 'wav') {
      return {
        buffer: readFileSync(audioPath(runIds[0])),
        contentType: 'audio/wav',
        filename: 'full-mix.wav',
      }
    }

    const clips = runIds.map((runId) => audioPath(runId))
    const gaps = Array.from({ length: runIds.length - 1 }, () => DEFAULT_GAP_SECONDS)
    concatWavs(clips, wavOut, gaps, TARGET_SAMPLE_RATE)

    if (format === 'wav') {
      return {
        buffer: readFileSync(wavOut),
        contentType: 'audio/wav',
        filename: 'full-mix.wav',
      }
    }

    const mp3Out = `${TEMP_DIR}/export-${exportId}.mp3`
    try {
      execFileSync(
        'ffmpeg',
        ['-y', '-i', wavOut, '-codec:a', 'libmp3lame', '-qscale:a', '2', mp3Out],
        { stdio: 'pipe' }
      )
    } catch {
      throw new Error('MP3 export requires ffmpeg')
    }

    const buffer = readFileSync(mp3Out)
    unlinkSync(mp3Out)
    return {
      buffer,
      contentType: 'audio/mpeg',
      filename: 'full-mix.mp3',
    }
  } finally {
    try {
      unlinkSync(wavOut)
    } catch {
      /* ignore */
    }
  }
}

export function stitchRunIds(
  runIds: string[]
): { run_id: string; audio_url: string } {
  if (runIds.length === 0) {
    throw new Error('No audio clips to stitch')
  }

  for (const runId of runIds) {
    validateRunId(runId)
    if (!existsSync(audioPath(runId))) {
      throw new Error(`Audio not found: ${runId}`)
    }
  }

  const runId = randomBytes(4).toString('hex')
  const outPath = audioPath(runId)

  if (runIds.length === 1) {
    copyFileSync(audioPath(runIds[0]), outPath)
    return { run_id: runId, audio_url: `/api/audio/${runId}` }
  }

  const clips = runIds.map((id) => audioPath(id))
  const gaps = Array.from({ length: runIds.length - 1 }, () => DEFAULT_GAP_SECONDS)
  concatWavs(clips, outPath, gaps, TARGET_SAMPLE_RATE)

  return { run_id: runId, audio_url: `/api/audio/${runId}` }
}
