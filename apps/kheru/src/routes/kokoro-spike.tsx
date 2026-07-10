import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { runClientTtsSpike } from '@/lib/client-tts/spike'
import type { SpikeBenchmarkResult } from '@/lib/client-tts/types'

export const Route = createFileRoute('/kokoro-spike')({
  component: KokoroSpikePage,
})

function KokoroSpikePage() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SpikeBenchmarkResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runSpike = useCallback(async () => {
    setRunning(true)
    setError(null)
    try {
      const benchmark = await runClientTtsSpike()
      setResult(benchmark)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Spike failed')
    } finally {
      setRunning(false)
    }
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold">Kokoro client TTS spike</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Isolated browser benchmark for model load and generation latency. First run downloads the
          Kokoro model (~tens of MB).
        </p>
      </header>

      <Button type="button" onClick={() => void runSpike()} disabled={running}>
        {running ? 'Running benchmark…' : 'Run WebGPU / WASM benchmark'}
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <section className="rounded-lg border p-4 text-sm">
          <h2 className="mb-3 font-medium">Results</h2>
          <dl className="grid grid-cols-2 gap-2">
            <dt className="text-muted-foreground">Device</dt>
            <dd>{result.device}</dd>
            <dt className="text-muted-foreground">dtype</dt>
            <dd>{result.dtype}</dd>
            <dt className="text-muted-foreground">Model load (cold/warm)</dt>
            <dd>{result.loadMs} ms</dd>
            <dt className="text-muted-foreground">~15-word paragraph</dt>
            <dd>{result.shortGenMs} ms</dd>
            <dt className="text-muted-foreground">~100-word paragraph</dt>
            <dd>{result.longGenMs} ms</dd>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Pass criteria: warm generation under 8s for a typical paragraph on your target device.
            Compare WASM by forcing software path in dev tools if needed.
          </p>
        </section>
      )}
    </main>
  )
}
