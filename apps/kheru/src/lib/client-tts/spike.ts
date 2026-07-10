import { clientTtsGenerate, warmClientTtsEngine } from '@/lib/client-tts/engine'
import type { SpikeBenchmarkResult } from '@/lib/client-tts/types'
import { VOICE_BY_ID } from '@/lib/voice-catalog'

const SHORT_TEXT =
  'Thanks for making the time. I wanted to walk through some important ideas with you.'
const LONG_TEXT =
  'Kokoro is an open-weight TTS model with 82 million parameters. Despite its lightweight architecture, it delivers comparable quality to larger models while being significantly faster and more cost-efficient. With Apache-licensed weights, Kokoro can be deployed anywhere from production environments to personal projects. It can even run one hundred percent locally in your browser, powered by Transformers.js and WebGPU when available.'

const DEFAULT_VOICE_KEY = VOICE_BY_ID['kokoro:am_michael']?.voiceKey ?? 'am_michael'

/** Run WebGPU/WASM benchmark timings for go/no-go decisions. */
export async function runClientTtsSpike(
  voiceKey = DEFAULT_VOICE_KEY
): Promise<SpikeBenchmarkResult> {
  const init = await warmClientTtsEngine()
  const short = await clientTtsGenerate(SHORT_TEXT, voiceKey, 1)
  const long = await clientTtsGenerate(LONG_TEXT, voiceKey, 1)

  return {
    device: init.device as SpikeBenchmarkResult['device'],
    dtype: init.dtype,
    loadMs: init.loadMs,
    shortGenMs: short.genMs,
    longGenMs: long.genMs,
  }
}
