import type { ClientTtsLoadState, ClientTtsSynthResult, WorkerOutboundMessage } from '@/lib/client-tts/types'
import { GenerationCancelledError } from '@/lib/generation-cancel'

type PendingGenerate = {
  resolve: (result: ClientTtsSynthResult & { genMs: number }) => void
  reject: (error: Error) => void
}

let worker: Worker | null = null
let initPromise: Promise<{ device: string; dtype: string; loadMs: number }> | null = null
const pending = new Map<string, PendingGenerate>()

type LoadListener = (state: ClientTtsLoadState) => void
const loadListeners = new Set<LoadListener>()

let loadState: ClientTtsLoadState = {
  status: 'idle',
  progress: null,
  file: null,
  device: null,
  dtype: null,
  error: null,
}

function emitLoadState(patch: Partial<ClientTtsLoadState>): void {
  loadState = { ...loadState, ...patch }
  for (const listener of loadListeners) listener(loadState)
}

export function getClientTtsLoadState(): ClientTtsLoadState {
  return loadState
}

export function subscribeClientTtsLoad(listener: LoadListener): () => void {
  loadListeners.add(listener)
  listener(loadState)
  return () => loadListeners.delete(listener)
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.addEventListener('message', (event: MessageEvent<WorkerOutboundMessage>) => {
      const message = event.data
      if (message.type === 'load-progress') {
        emitLoadState({
          status: 'loading',
          progress: message.progress,
          file: message.file,
        })
        return
      }
      if (message.type === 'ready') {
        emitLoadState({
          status: 'ready',
          progress: 100,
          device: message.device,
          dtype: message.dtype,
          error: null,
        })
        return
      }
      if (message.type === 'generate-done') {
        const entry = pending.get(message.id)
        if (!entry) return
        pending.delete(message.id)
        entry.resolve({ blob: message.blob, duration: message.duration, genMs: message.genMs })
        return
      }
      if (message.type === 'error') {
        if (message.id) {
          const entry = pending.get(message.id)
          if (!entry) return
          pending.delete(message.id)
          entry.reject(new Error(message.message))
          return
        }
        for (const [id, entry] of pending) {
          pending.delete(id)
          entry.reject(new Error(message.message))
        }
      }
    })
    worker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'Client TTS worker failed')
      for (const [id, entry] of pending) {
        pending.delete(id)
        entry.reject(error)
      }
    })
  }
  return worker
}

/** Lazy-load Kokoro in a dedicated worker on first use. */
export async function warmClientTtsEngine(): Promise<{ device: string; dtype: string; loadMs: number }> {
  if (initPromise) return initPromise

  emitLoadState({
    status: 'loading',
    progress: 0,
    file: null,
    device: null,
    dtype: null,
    error: null,
  })

  initPromise = new Promise((resolve, reject) => {
    const w = getWorker()
    const onMessage = (event: MessageEvent<WorkerOutboundMessage>) => {
      if (event.data.type === 'ready') {
        w.removeEventListener('message', onMessage)
        emitLoadState({
          status: 'ready',
          progress: 100,
          device: event.data.device,
          dtype: event.data.dtype,
          error: null,
        })
        resolve({ device: event.data.device, dtype: event.data.dtype, loadMs: event.data.loadMs })
      }
      if (event.data.type === 'error' && !event.data.id) {
        w.removeEventListener('message', onMessage)
        initPromise = null
        emitLoadState({ status: 'error', error: event.data.message })
        reject(new Error(event.data.message))
      }
    }
    w.addEventListener('message', onMessage)
    w.postMessage({ type: 'init' })
  })

  return initPromise
}

export async function clientTtsGenerate(
  text: string,
  voiceKey: string,
  speed: number
): Promise<ClientTtsSynthResult & { genMs: number }> {
  await warmClientTtsEngine()
  const id = crypto.randomUUID()

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ type: 'generate', id, text, voiceKey, speed })
  })
}

export function cancelPendingClientTts(): void {
  const error = new GenerationCancelledError()
  for (const [id, entry] of pending) {
    pending.delete(id)
    entry.reject(error)
  }
}

export function terminateClientTtsEngine(): void {
  worker?.terminate()
  worker = null
  initPromise = null
  pending.clear()
  loadState = {
    status: 'idle',
    progress: null,
    file: null,
    device: null,
    dtype: null,
    error: null,
  }
}
