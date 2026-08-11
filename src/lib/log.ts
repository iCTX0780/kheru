/**
 * Local log bridge for the Tauri desktop app.
 *
 * On the desktop build, log calls flow through `@tauri-apps/plugin-log`
 * into a rotating file under the app's platform log directory
 * (`~/Library/Logs/com.kheru.studio/` on macOS). On the web/Docker build,
 * they fall back to `console.*` — logs there stay in the browser
 * devtools; there is no server-side collection.
 *
 * Everything is local. Nothing leaves the machine.
 */

type Level = 'trace' | 'debug' | 'info' | 'warn' | 'error'

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function send(level: Level, message: string): Promise<void> {
  if (!isTauriRuntime()) {
    const fn =
      level === 'error'
        ? console.error
        : level === 'warn'
          ? console.warn
          : level === 'debug' || level === 'trace'
            ? console.debug
            : console.info
    fn(`[kheru:${level}]`, message)
    return
  }
  try {
    const mod = await import('@tauri-apps/plugin-log')
    await mod[level](message)
  } catch {
    // Swallow log-transport failures — logging must never crash the app.
  }
}

export const log = {
  trace: (message: string) => void send('trace', message),
  debug: (message: string) => void send('debug', message),
  info: (message: string) => void send('info', message),
  warn: (message: string) => void send('warn', message),
  error: (message: string) => void send('error', message),
}

/**
 * Install browser-level error listeners so uncaught exceptions and unhandled
 * promise rejections land in the log stream too, not just the devtools console.
 * Idempotent — safe to call from a React effect.
 */
let installed = false
export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (event) => {
    const src = event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : 'unknown'
    log.error(`uncaught: ${event.message} @ ${src}`)
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason =
      event.reason instanceof Error
        ? `${event.reason.message}\n${event.reason.stack ?? ''}`
        : String(event.reason)
    log.error(`unhandled rejection: ${reason}`)
  })
}
