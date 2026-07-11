import { KokoroTTS } from 'kokoro-js'
import { CLIENT_TTS_MODEL_ID, CLIENT_TTS_SAMPLE_RATE } from '@/lib/client-tts/config'
import { dtypeForDevice, detectTtsDevice } from '@/lib/client-tts/detect-device'
import type { WorkerInboundMessage, WorkerOutboundMessage } from '@/lib/client-tts/types'
import { blobToTargetRateWav, blobDurationSeconds } from '@/lib/client-tts/wav'

let engine: KokoroTTS | null = null
let initPromise: Promise<void> | null = null
let readyDevice: 'webgpu' | 'wasm' = 'wasm'
let readyDtype: 'fp32' | 'q8' = 'q8'

async function ensureEngine(): Promise<void> {
  if (engine) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    const loadStart = performance.now()
    readyDevice = await detectTtsDevice()
    readyDtype = dtypeForDevice(readyDevice)
    engine = await KokoroTTS.from_pretrained(CLIENT_TTS_MODEL_ID, {
      dtype: readyDtype,
      device: readyDevice,
      progress_callback: (info) => {
        if (info.status === 'progress') {
          postMessage({
            type: 'load-progress',
            progress: info.progress,
            file: info.file,
            loaded: info.loaded,
            total: info.total,
          } satisfies WorkerOutboundMessage)
        }
      },
    })
    const loadMs = Math.round(performance.now() - loadStart)
    postMessage({ type: 'ready', device: readyDevice, dtype: readyDtype, loadMs } satisfies WorkerOutboundMessage)
  })()

  return initPromise
}

async function synth(text: string, voiceKey: string, speed: number): Promise<{ blob: Blob; duration: number; genMs: number }> {
  await ensureEngine()
  if (!engine) throw new Error('TTS engine failed to load')

  const clampedSpeed = Math.max(0.5, Math.min(2.0, speed))
  const genStart = performance.now()
  const audio = await engine.generate(text, { voice: voiceKey as never, speed: clampedSpeed })
  const rawBlob = audio.toBlob()
  const blob = await blobToTargetRateWav(rawBlob, CLIENT_TTS_SAMPLE_RATE)
  const duration = await blobDurationSeconds(blob)
  const genMs = Math.round(performance.now() - genStart)
  return { blob, duration, genMs }
}

self.addEventListener('message', (event: MessageEvent<WorkerInboundMessage>) => {
  const message = event.data

  void (async () => {
    try {
      if (message.type === 'init') {
        await ensureEngine()
        return
      }

      if (message.type === 'generate') {
        const result = await synth(message.text, message.voiceKey, message.speed)
        postMessage({
          type: 'generate-done',
          id: message.id,
          blob: result.blob,
          duration: result.duration,
          genMs: result.genMs,
        } satisfies WorkerOutboundMessage)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Client TTS failed'
      postMessage({ type: 'error', id: message.type === 'generate' ? message.id : undefined, message: errorMessage } satisfies WorkerOutboundMessage)
    }
  })()
})
