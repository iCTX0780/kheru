import { unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { KokoroTTS } from 'kokoro-js'
import { DATA_DIR, TARGET_SAMPLE_RATE } from './paths'
import { readWav, resampleAudio, writePcm16Wav } from './wav'

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'

const HF_CACHE = process.env.TRANSFORMERS_CACHE ?? resolve(DATA_DIR, 'transformers-cache')
process.env.TRANSFORMERS_CACHE = HF_CACHE
process.env.HF_HOME = process.env.HF_HOME ?? HF_CACHE

let engine: KokoroTTS | null = null
let enginePromise: Promise<KokoroTTS> | null = null

async function getEngine(): Promise<KokoroTTS> {
  if (engine) return engine
  if (!enginePromise) {
    enginePromise = KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: 'q8',
      device: 'cpu',
    }).then((tts) => {
      engine = tts
      return tts
    })
  }
  return enginePromise
}

export async function synthKokoro(
  text: string,
  voiceKey: string,
  outPath: string,
  speed: number
): Promise<void> {
  const tts = await getEngine()
  const clampedSpeed = Math.max(0.5, Math.min(2.0, speed))
  const audio = await tts.generate(text, { voice: voiceKey, speed: clampedSpeed } as NonNullable<
    Parameters<typeof tts.generate>[1]
  >)

  const tempFloat = `${outPath}.float.wav`
  try {
    await audio.save(tempFloat)
    const { sampleRate, samples } = readWav(tempFloat)
    const resampled = resampleAudio(samples, sampleRate, TARGET_SAMPLE_RATE)
    writePcm16Wav(outPath, resampled, TARGET_SAMPLE_RATE)
  } finally {
    try {
      unlinkSync(tempFloat)
    } catch {
      /* ignore */
    }
  }
}

export async function warmKokoro(): Promise<void> {
  await getEngine()
}
