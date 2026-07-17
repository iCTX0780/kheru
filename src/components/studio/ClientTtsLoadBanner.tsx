import { useClientTtsLoad } from '@/hooks/use-client-tts-load'

export function ClientTtsLoadBanner() {
  const load = useClientTtsLoad()

  if (load.status !== 'loading') return null

  const label =
    load.progress != null
      ? `Loading Kokoro model (${Math.round(load.progress)}%)`
      : 'Loading Kokoro model'

  return (
    <div className="border-b border-border bg-muted/40 px-4 py-2 text-center text-xs text-muted-foreground">
      {label}
      {load.file ? ` — ${load.file.split('/').pop()}` : null}
    </div>
  )
}
