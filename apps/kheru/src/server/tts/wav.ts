import { readFileSync, writeFileSync } from 'node:fs'

export interface PcmWav {
  sampleRate: number
  channels: number
  samples: Float32Array
}

/** Read mono PCM16 or IEEE float WAV into normalized float samples. */
export function readWav(path: string): PcmWav {
  const buf = readFileSync(path)
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error(`Not a WAV file: ${path}`)

  let offset = 12
  let sampleRate = 0
  let channels = 1
  let bitsPerSample = 16
  let audioFormat = 1
  let dataOffset = 0
  let dataSize = 0

  while (offset < buf.length - 8) {
    const chunkId = buf.toString('ascii', offset, offset + 4)
    const chunkSize = buf.readUInt32LE(offset + 4)
    const chunkData = offset + 8

    if (chunkId === 'fmt ') {
      audioFormat = buf.readUInt16LE(chunkData)
      channels = buf.readUInt16LE(chunkData + 2)
      sampleRate = buf.readUInt32LE(chunkData + 4)
      bitsPerSample = buf.readUInt16LE(chunkData + 14)
    } else if (chunkId === 'data') {
      dataOffset = chunkData
      dataSize = chunkSize
      break
    }

    offset = chunkData + chunkSize + (chunkSize % 2)
  }

  if (!dataOffset || !sampleRate) throw new Error(`Invalid WAV: ${path}`)

  const frameCount = dataSize / (channels * (bitsPerSample / 8))
  const samples = new Float32Array(frameCount)

  if (audioFormat === 1 && bitsPerSample === 16) {
    for (let i = 0; i < frameCount; i++) {
      let sum = 0
      for (let ch = 0; ch < channels; ch++) {
        const sampleIndex = i * channels + ch
        sum += buf.readInt16LE(dataOffset + sampleIndex * 2) / 32768
      }
      samples[i] = sum / channels
    }
  } else if (audioFormat === 3 && bitsPerSample === 32) {
    for (let i = 0; i < frameCount; i++) {
      let sum = 0
      for (let ch = 0; ch < channels; ch++) {
        const sampleIndex = i * channels + ch
        sum += buf.readFloatLE(dataOffset + sampleIndex * 4)
      }
      samples[i] = sum / channels
    }
  } else {
    throw new Error(`Unsupported WAV format ${audioFormat}/${bitsPerSample} in ${path}`)
  }

  return { sampleRate, channels: 1, samples }
}

export function resampleAudio(data: Float32Array, origSr: number, targetSr: number): Float32Array {
  if (origSr === targetSr) return data
  const duration = data.length / origSr
  const targetLen = Math.max(1, Math.floor(duration * targetSr))
  const out = new Float32Array(targetLen)
  for (let i = 0; i < targetLen; i++) {
    const t = (i / targetLen) * duration
    const srcIndex = t * origSr
    const i0 = Math.floor(srcIndex)
    const i1 = Math.min(i0 + 1, data.length - 1)
    const frac = srcIndex - i0
    out[i] = data[i0] * (1 - frac) + data[i1] * frac
  }
  return out
}

export function writePcm16Wav(path: string, samples: Float32Array, sampleRate: number): void {
  const numSamples = samples.length
  const dataSize = numSamples * 2
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2)
  }

  writeFileSync(path, buffer)
}

export function clipDurationSeconds(path: string): number {
  const { sampleRate, samples } = readWav(path)
  return samples.length / sampleRate
}
