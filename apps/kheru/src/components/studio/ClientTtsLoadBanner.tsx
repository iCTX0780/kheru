import { Loader2 } from 'lucide-react'
import { useClientTtsLoad } from '@/hooks/use-client-tts-load'
import { isClientTtsEnabled } from '@/lib/client-tts/config'
import { cn } from '@/lib/utils'

export function ClientTtsLoadBanner() {
  const load = useClientTtsLoad()

  if (!isClientTtsEnabled() || load.status !== 'loading') return null

  const percent = load.progress != null ? Math.round(load.progress) : null
  const fileLabel = load.file?.split('/').pop() ?? 'Kokoro model'

  return (
    <div
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b border-border bg-surface/95 backdrop-blur-sm',
        'pt-[env(safe-area-inset-top)]'
      )}
      role="status"
      aria-live="polite"
      aria-label="Downloading voice model"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Downloading voice model…</p>
          <p className="truncate text-xs text-muted-foreground">
            {fileLabel}
            {percent != null ? ` · ${percent}%` : ''}
          </p>
        </div>
        {percent != null && (
          <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
