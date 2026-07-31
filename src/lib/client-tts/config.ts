export const CLIENT_TTS_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'

export const CLIENT_TTS_SAMPLE_RATE = 22_050

// Injected by `vite.config.tauri.ts`. Undefined in the web/Docker build.
declare const __KHERU_TARGET__: string | undefined

export function isTauriTarget(): boolean {
  return typeof __KHERU_TARGET__ !== 'undefined' && __KHERU_TARGET__ === 'tauri'
}
