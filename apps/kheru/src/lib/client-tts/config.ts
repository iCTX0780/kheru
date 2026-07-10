/** When true, Kokoro runs in a browser Web Worker instead of POST /api/generate. */
export function isClientTtsEnabled(): boolean {
  const value = import.meta.env.VITE_CLIENT_TTS
  return value === '1' || value === 'true'
}

export const CLIENT_TTS_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'

/** Match server `TARGET_SAMPLE_RATE` in `server/tts/paths.ts`. */
export const CLIENT_TTS_SAMPLE_RATE = 22_050
