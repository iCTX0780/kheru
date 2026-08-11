/**
 * Thin wrapper around the Rust `diagnostics::*` commands.
 * Returns `null` in the browser/Docker build.
 */

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function invoke<T>(cmd: string): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd)
}

export async function getLogDirectory(): Promise<string | null> {
  if (!isTauriRuntime()) return null
  return invoke<string>('log_directory')
}

export async function revealLogDirectory(): Promise<string | null> {
  if (!isTauriRuntime()) return null
  return invoke<string>('reveal_log_directory')
}
