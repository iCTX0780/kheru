export const CLIENT_TTS_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'

/**
 * Kokoro-82M outputs audio at 24 kHz natively. We match that end-to-end
 * (browser worker and Rust backend both emit 24 kHz WAV) to avoid a
 * lossy resample step. Historical builds used 22050 — clips cached in
 * OPFS from those builds are transparently upsampled at concat time
 * (see concat-blobs.ts).
 */
export const CLIENT_TTS_SAMPLE_RATE = 24_000

// Injected by `vite.config.tauri.ts`. Undefined in the web/Docker build.
declare const __KHERU_TARGET__: string | undefined

export function isTauriTarget(): boolean {
  return typeof __KHERU_TARGET__ !== 'undefined' && __KHERU_TARGET__ === 'tauri'
}
