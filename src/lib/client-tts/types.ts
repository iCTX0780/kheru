import type { WordTiming } from '@/lib/playback-words'

export interface ClientTtsTurn {
  text: string
  voice: string
  lengthScale: number
}

export interface ClientTtsSynthResult {
  blob: Blob
  duration: number
}

export interface ClientGenerateSegment {
  index: number
  start: number
  end: number
}

export interface ClientGenerateClip {
  index: number
  blob: Blob
  duration: number
  audioUrl: string
}

export interface ClientGenerateResult {
  blob: Blob
  duration: number
  audioUrl: string
  segments: ClientGenerateSegment[]
  clips: ClientGenerateClip[]
  wordTimings: WordTiming[] | null
}

export type WorkerDevice = 'webgpu' | 'wasm'

export type WorkerInboundMessage =
  | { type: 'init' }
  | { type: 'generate'; id: string; text: string; voiceKey: string; speed: number }

export type WorkerOutboundMessage =
  | { type: 'ready'; device: WorkerDevice; dtype: string; loadMs: number }
  | { type: 'load-progress'; progress: number; file: string; loaded?: number; total?: number }
  | { type: 'generate-done'; id: string; blob: Blob; duration: number; genMs: number }
  | { type: 'error'; id?: string; message: string }

export interface ClientTtsLoadState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  progress: number | null
  file: string | null
  device: string | null
  dtype: string | null
  error: string | null
}

export interface SpikeBenchmarkResult {
  device: WorkerDevice
  dtype: string
  loadMs: number
  shortGenMs: number
  longGenMs: number
}
