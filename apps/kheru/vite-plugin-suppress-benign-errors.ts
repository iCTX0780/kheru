import type { Plugin, ViteDevServer } from 'vite'

const BENIGN_SOCKET_ERRORS = new Set(['ECONNRESET', 'EPIPE', 'ERR_STREAM_PREMATURE_CLOSE'])

function isBenignSocketMessage(message: string): boolean {
  return (
    message.includes('ECONNRESET') ||
    message.includes('EPIPE') ||
    message.includes('ERR_STREAM_PREMATURE_CLOSE')
  )
}

function patchDevServer(server: ViteDevServer): void {
  const hot = server.environments?.client?.hot
  if (hot) {
    const originalSend = hot.send.bind(hot)
    hot.send = (payload) => {
      if (
        payload.type === 'error' &&
        payload.err?.message &&
        isBenignSocketMessage(payload.err.message)
      ) {
        return
      }
      return originalSend(payload)
    }
  }

  const originalError = server.config.logger.error.bind(server.config.logger)
  server.config.logger.error = (msg, options) => {
    if (typeof msg === 'string' && isBenignSocketMessage(msg)) return
    if (options?.error && isBenignSocketError(options.error)) return
    return originalError(msg, options)
  }

  server.httpServer?.on('clientError', (err, socket) => {
    if (isBenignSocketError(err)) socket.destroy()
  })
}

function isBenignSocketError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as NodeJS.ErrnoException).code
  return typeof code === 'string' && BENIGN_SOCKET_ERRORS.has(code)
}

/** Dev-only: stop aborted audio/socket disconnects from triggering the Vite error overlay. */
export function suppressBenignDevErrors(): Plugin {
  return {
    name: 'kheru-suppress-benign-dev-errors',
    apply: 'serve',
    configureServer(server) {
      patchDevServer(server)
    },
  }
}
