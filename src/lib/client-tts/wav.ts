import { CLIENT_TTS_SAMPLE_RATE } from '@/lib/client-tts/config'

export interface PcmWav {
  sampleRate: number
  channels: number
  samples: Float32Array
}

/** Read mono PCM16 or IEEE float WAV into normalized float samples. */
export function readWavBuffer(buffer: ArrayBuffer): PcmWav {
  const buf = new DataView(buffer)
  const riff = String.fromCharCode(buf.getUint8(0), buf.getUint8(1), buf.getUint8(2), buf.getUint8(3))
  if (riff !== 'RIFF') throw new Error('Not a WAV file')

  let offset = 12
  let sampleRate = 0
  let channels = 1
  let bitsPerSample = 16
  let audioFormat = 1
  let dataOffset = 0
  let dataSize = 0

  while (offset < buf.byteLength - 8) {
    const chunkId = String.fromCharCode(
      buf.getUint8(offset),
      buf.getUint8(offset + 1),
      buf.getUint8(offset + 2),
      buf.getUint8(offset + 3)
    )
    const chunkSize = buf.getUint32(offset + 4, true)
    const chunkData = offset + 8

    if (chunkId === 'fmt ') {
      audioFormat = buf.getUint16(chunkData, true)
      channels = buf.getUint16(chunkData + 2, true)
      sampleRate = buf.getUint32(chunkData + 4, true)
      bitsPerSample = buf.getUint16(chunkData + 14, true)
    } else if (chunkId === 'data') {
      dataOffset = chunkData
      dataSize = chunkSize
      break
    }

    offset = chunkData + chunkSize + (chunkSize % 2)
  }

  if (!dataOffset || !sampleRate) throw new Error('Invalid WAV')

  const frameCount = dataSize / (channels * (bitsPerSample / 8))
  const samples = new Float32Array(frameCount)

  if (audioFormat === 1 && bitsPerSample === 16) {
    for (let i = 0; i < frameCount; i++) {
      let sum = 0
      for (let ch = 0; ch < channels; ch++) {
        const sampleIndex = i * channels + ch
        sum += buf.getInt16(dataOffset + sampleIndex * 2, true) / 32768
      }
      samples[i] = sum / channels
    }
  } else if (audioFormat === 3 && bitsPerSample === 32) {
    for (let i = 0; i < frameCount; i++) {
      let sum = 0
      for (let ch = 0; ch < channels; ch++) {
        const sampleIndex = i * channels + ch
        sum += buf.getFloat32(dataOffset + sampleIndex * 4, true)
      }
      samples[i] = sum / channels
    }
  } else {
    throw new Error(`Unsupported WAV format ${audioFormat}/${bitsPerSample}`)
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

export function writePcm16WavBuffer(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numSamples = samples.length
  const dataSize = numSamples * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i))
    }
  }

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(36, 'data')
  view.setUint32(40, dataSize, true)

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true)
  }

  return buffer
}

export function wavDurationSeconds(buffer: ArrayBuffer): number {
  const { sampleRate, samples } = readWavBuffer(buffer)
  return samples.length / sampleRate
}

export async function blobToTargetRateWav(blob: Blob, targetRate = CLIENT_TTS_SAMPLE_RATE): Promise<Blob> {
  const buffer = await blob.arrayBuffer()
  const { sampleRate, samples } = readWavBuffer(buffer)
  const resampled = resampleAudio(samples, sampleRate, targetRate)
  const wav = writePcm16WavBuffer(resampled, targetRate)
  return new Blob([wav], { type: 'audio/wav' })
}

export async function blobDurationSeconds(blob: Blob): Promise<number> {
  const buffer = await blob.arrayBuffer()
  return wavDurationSeconds(buffer)
}
