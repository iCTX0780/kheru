/**
 * Thin wrapper around the Tauri commands exposed by `src-tauri/src/tts/mod.rs`.
 * Returns `null` when the app is running in the browser/Docker build, so
 * callers can render conditionally without a runtime crash.
 */

export type TtsBackendPreference = 'auto' | 'gpu' | 'cpu'
export type ActiveExecutionProvider = 'cpu' | 'coreml'

export interface TtsCapabilities {
  gpu_available: boolean
  gpu_label: string | null
  preference: TtsBackendPreference
  /** What we will attach next, given the current preference. */
  effective: ActiveExecutionProvider
  /** What the currently loaded session actually runs on. `null` until first gen. */
  active: ActiveExecutionProvider | null
  platform: 'macos' | 'windows' | 'linux' | 'other'
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

export async function getTtsCapabilities(): Promise<TtsCapabilities | null> {
  if (!isTauriRuntime()) return null
  return invoke<TtsCapabilities>('tts_capabilities')
}

export async function setTtsBackend(
  next: TtsBackendPreference
): Promise<TtsCapabilities | null> {
  if (!isTauriRuntime()) return null
  return invoke<TtsCapabilities>('tts_set_backend', { backendPref: next })
}
