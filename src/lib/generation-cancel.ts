export class GenerationCancelledError extends Error {
  constructor() {
    super('Generation cancelled')
    this.name = 'GenerationCancelledError'
  }
}

export function isGenerationCancelled(error: unknown): boolean {
  return (
    error instanceof GenerationCancelledError ||
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.message === 'Generation cancelled')
  )
}

let activeAbortController: AbortController | null = null

export function beginGenerationRun(): AbortSignal {
  activeAbortController?.abort()
  activeAbortController = new AbortController()
  return activeAbortController.signal
}

export function stopGenerationRun(): void {
  activeAbortController?.abort()
  activeAbortController = null
}

export function getGenerationAbortSignal(): AbortSignal | undefined {
  return activeAbortController?.signal
}

export function assertGenerationNotCancelled(cancelRequested: boolean): void {
  if (cancelRequested) {
    throw new GenerationCancelledError()
  }
}
