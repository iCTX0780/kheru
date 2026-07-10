import { existsSync, readFileSync, statSync } from 'node:fs'

export interface ByteRange {
  start: number
  end: number
}

export function parseByteRange(header: string, fileSize: number): ByteRange | null {
  const match = /^bytes=(\d+)-(\d*)$/i.exec(header.trim())
  if (!match) return null

  const start = Number.parseInt(match[1], 10)
  const end = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1

  if (!Number.isFinite(start) || start < 0 || start >= fileSize) return null
  if (!Number.isFinite(end) || end < start || end >= fileSize) return null

  return { start, end }
}

export function isBenignStreamError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as NodeJS.ErrnoException).code
  return code === 'ECONNRESET' || code === 'ERR_STREAM_PREMATURE_CLOSE' || code === 'EPIPE'
}

const wavFileCache = new Map<string, { mtimeMs: number; buffer: Buffer }>()

/** Cached read — browsers issue many range requests during <audio> playback. */
function readWavFile(filePath: string): Buffer {
  const { mtimeMs } = statSync(filePath)
  const cached = wavFileCache.get(filePath)
  if (cached && cached.mtimeMs === mtimeMs) return cached.buffer

  const buffer = readFileSync(filePath)
  wavFileCache.set(filePath, { mtimeMs, buffer })
  return buffer
}

export function wavHeadResponse(filePath: string): Response | { error: Response } {
  if (!existsSync(filePath)) {
    return {
      error: new Response(JSON.stringify({ detail: 'Audio not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    }
  }

  const { size } = statSync(filePath)
  return new Response(null, {
    status: 200,
    headers: {
      'Content-Type': 'audio/wav',
      'Content-Length': String(size),
      'Accept-Ranges': 'bytes',
    },
  })
}

export function wavResponse(
  filePath: string,
  request: Request
): Response | { error: Response } {
  if (!existsSync(filePath)) {
    return {
      error: new Response(JSON.stringify({ detail: 'Audio not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    }
  }

  const buffer = readWavFile(filePath)
  const size = buffer.length
  const rangeHeader = request.headers.get('range')
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'audio/wav',
    'Accept-Ranges': 'bytes',
  }

  if (rangeHeader) {
    const range = parseByteRange(rangeHeader, size)
    if (range) {
      const length = range.end - range.start + 1
      const slice = buffer.subarray(range.start, range.end + 1)
      return new Response(slice, {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Length': String(length),
          'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
        },
      })
    }
  }

  if (request.signal?.aborted) {
    return new Response(null, { status: 499 })
  }

  return new Response(buffer, {
    headers: {
      ...baseHeaders,
      'Content-Length': String(size),
    },
  })
}

export function readWavPcmSamples(filePath: string, targetSamples = 1000): number[] {
  if (!existsSync(filePath)) return []

  const buffer = readFileSync(filePath)
  if (buffer.length <= 44) return []

  const pcm = buffer.subarray(44)
  const sampleCount = Math.floor(pcm.length / 2)
  if (sampleCount === 0) return []

  const step = Math.max(1, Math.floor(sampleCount / targetSamples))
  const samples: number[] = []

  for (let i = 0; i < sampleCount; i += step) {
    let sum = 0
    let count = 0
    for (let j = i; j < Math.min(i + step, sampleCount); j++) {
      const sample = pcm.readInt16LE(j * 2)
      sum += Math.abs(sample) / 32768
      count++
    }
    samples.push(count > 0 ? sum / count : 0)
  }

  return samples
}
