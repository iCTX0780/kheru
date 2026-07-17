import type { WorkerDevice } from '@/lib/client-tts/types'

/** Prefer WebGPU when available; fall back to WASM. */
export async function detectTtsDevice(): Promise<WorkerDevice> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) {
    return 'wasm'
  }

  try {
    const adapter = await navigator.gpu.requestAdapter()
    if (adapter) return 'webgpu'
  } catch {
    /* fall through */
  }

  return 'wasm'
}

export function dtypeForDevice(device: WorkerDevice): 'fp32' | 'q8' {
  return device === 'webgpu' ? 'fp32' : 'q8'
}
