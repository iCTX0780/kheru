import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { Link } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { ArrowLeft, Cpu, Gauge, HardDrive, Palette, ShieldCheck, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useStorageEstimate } from '@/hooks/use-storage-usage'
import {
  evaluateBudget,
  formatBytes,
  isStoragePersisted,
  requestPersistentStorage,
} from '@/lib/storage-usage'
import {
  getStorageBudget,
  setPersistPref,
  setStorageBudget,
  STORAGE_BUDGET_PRESETS,
} from '@/lib/storage-settings'
import {
  getTtsCapabilities,
  setTtsBackend,
  type TtsBackendPreference,
  type TtsCapabilities,
} from '@/lib/tts-backend'
import { cn } from '@/lib/utils'

export function SettingsPage() {
  const { estimate, refresh: refreshEstimate } = useStorageEstimate()
  const [budget, setBudget] = useState<number | null>(null)
  const [persisted, setPersisted] = useState(false)
  const [persistBusy, setPersistBusy] = useState(false)
  const [ttsCaps, setTtsCaps] = useState<TtsCapabilities | null>(null)
  const [ttsBusy, setTtsBusy] = useState(false)

  useEffect(() => {
    void getStorageBudget().then(setBudget)
    void isStoragePersisted().then(setPersisted)
    void getTtsCapabilities().then(setTtsCaps)
    // Re-poll capabilities when the tab regains focus — `active` becomes
    // meaningful only after the first generation, which may happen in the
    // studio tab after settings was opened.
    const onFocus = () => void getTtsCapabilities().then(setTtsCaps)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const handleTtsBackendChange = useCallback(async (value: string) => {
    const next = value as TtsBackendPreference
    setTtsBusy(true)
    try {
      const caps = await setTtsBackend(next)
      if (caps) {
        setTtsCaps(caps)
        if (next === 'gpu' && !caps.gpu_available) {
          toast.warning(
            'No GPU accelerator available on this device — Kheru will keep generating on CPU.'
          )
        } else if (caps.effective === 'cpu') {
          toast.message('Now generating on CPU.')
        } else {
          toast.success(`Now generating on ${caps.gpu_label ?? 'GPU'}.`)
        }
      }
    } catch (err) {
      toast.error(`Failed to switch TTS backend: ${(err as Error).message}`)
    } finally {
      setTtsBusy(false)
    }
  }, [])

  const handleBudgetChange = useCallback(
    async (value: string) => {
      const bytes = Number(value)
      setBudget(bytes)
      await setStorageBudget(bytes)
      await refreshEstimate()
      toast.success(`Storage budget set to ${formatBytes(bytes)}`)
    },
    [refreshEstimate]
  )

  const handlePersistChange = useCallback(
    async (next: boolean) => {
      if (!next) {
        // The browser has no API to revoke persistence; record the preference
        // and explain how it's actually cleared.
        await setPersistPref(false)
        if (persisted) {
          toast.message('Your browser keeps storage persistent until you clear site data.')
        } else {
          setPersisted(false)
        }
        return
      }
      setPersistBusy(true)
      const granted = await requestPersistentStorage()
      await setPersistPref(granted)
      setPersisted(granted)
      setPersistBusy(false)
      toast[granted ? 'success' : 'warning'](
        granted
          ? 'Persistent storage enabled — Kheru audio won’t be auto-evicted.'
          : 'Your browser declined persistent storage.'
      )
    },
    [persisted]
  )

  const status = evaluateBudget(estimate, budget ?? undefined)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="relative border-b border-border bg-background">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] [background-size:24px_24px]" />
        <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-10">
          <Button
            nativeButton={false}
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit text-muted-foreground"
            render={<Link to="/" />}
          >
            <ArrowLeft data-icon="inline-start" />
            Projects
          </Button>
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">Settings</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Control how much of your device storage Kheru uses. Your scripts are always kept —
              these settings only affect generated audio.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
        <AppearanceSection />

        {ttsCaps ? (
          <TtsBackendSection caps={ttsCaps} busy={ttsBusy} onChange={handleTtsBackendChange} />
        ) : null}

        <SettingsSection
          icon={HardDrive}
          title="Storage usage"
          description="How much of your budget Kheru is currently using on this device."
        >
          {budget === null ? (
            <Skeleton className="h-14 w-full rounded-lg" />
          ) : status ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground">
                  {formatBytes(status.usage)}{' '}
                  <span className="text-muted-foreground">of {formatBytes(status.budget)}</span>
                </span>
                <Badge variant={status.level !== 'ok' ? 'destructive' : 'secondary'}>
                  {Math.min(100, Math.round(status.ratio * 100))}%
                </Badge>
              </div>
              <Progress
                value={Math.min(100, Math.round(status.ratio * 100))}
                indicatorClassName={cn(status.level !== 'ok' && 'bg-destructive')}
              />
              {status.level === 'over' ? (
                <p className="text-xs text-destructive">
                  Over budget — clear audio from finished projects to keep generating.
                </p>
              ) : status.level === 'warn' ? (
                <p className="text-xs text-destructive">Nearly full — consider clearing old audio.</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Storage reporting isn’t available in this browser.
            </p>
          )}
        </SettingsSection>

        <SettingsSection
          icon={Gauge}
          title="Storage budget"
          description="Kheru warns as you approach this limit and blocks new generation once you pass it — so it never quietly fills your disk."
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Maximum device storage</span>
            {budget === null ? (
              <Skeleton className="h-9 w-40 rounded-md" />
            ) : (
              <Select
                value={String(budget)}
                onValueChange={(v) => v && void handleBudgetChange(v)}
              >
                <SelectTrigger className="w-40" aria-label="Storage budget">
                  <SelectValue>{(value) => formatBytes(Number(value))}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STORAGE_BUDGET_PRESETS.map((bytes) => (
                    <SelectItem key={bytes} value={String(bytes)}>
                      {formatBytes(bytes)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </SettingsSection>

        <SettingsSection
          icon={ShieldCheck}
          title="Keep audio safe from eviction"
          description="Ask the browser not to auto-delete Kheru’s audio when disk runs low. Off by default, so Kheru never holds onto space you might need elsewhere."
        >
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              {persisted ? 'Enabled' : 'Disabled'}
            </span>
            <Switch
              checked={persisted}
              disabled={persistBusy}
              onCheckedChange={(next) => void handlePersistChange(next)}
              aria-label="Keep audio safe from eviction"
            />
          </div>
        </SettingsSection>
      </div>
    </div>
  )
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <SettingsSection
      icon={Palette}
      title="Appearance"
      description="Kheru's theme applies to every screen — dashboard, studio, and settings."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">Theme</span>
        {mounted ? (
          <Select value={theme ?? 'system'} onValueChange={(v) => v && setTheme(v)}>
            <SelectTrigger className="w-40" aria-label="Theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">Match system</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Skeleton className="h-9 w-40 rounded-md" />
        )}
      </div>
    </SettingsSection>
  )
}

function TtsBackendSection({
  caps,
  busy,
  onChange,
}: {
  caps: TtsCapabilities
  busy: boolean
  onChange: (next: string) => void | Promise<void>
}) {
  const gpuHint =
    caps.gpu_label ??
    (caps.platform === 'macos'
      ? 'CoreML'
      : caps.platform === 'windows'
        ? 'DirectML (not yet wired up — tracked in #14)'
        : caps.platform === 'linux'
          ? 'CUDA (not yet wired up — tracked in #14)'
          : 'GPU acceleration not available on this platform')

  const activeLabel = caps.active
    ? caps.active === 'coreml'
      ? caps.gpu_label ?? 'CoreML'
      : 'CPU'
    : null
  const willLabel =
    caps.effective === 'coreml' ? caps.gpu_label ?? 'CoreML' : 'CPU'

  const description = activeLabel
    ? `Currently generating on ${activeLabel}.`
    : `Will use ${willLabel} on the next generation.`

  return (
    <SettingsSection
      icon={(caps.active ?? caps.effective) === 'cpu' ? Cpu : Zap}
      title="TTS compute backend"
      description={description}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Backend</span>
          <Select
            value={caps.preference}
            onValueChange={(v) => v && void onChange(v)}
            disabled={busy}
          >
            <SelectTrigger className="w-40" aria-label="TTS backend">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="gpu" disabled={!caps.gpu_available}>
                GPU
              </SelectItem>
              <SelectItem value="cpu">CPU</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={caps.gpu_available ? 'secondary' : 'outline'}>
            {caps.gpu_available ? 'GPU available' : 'GPU unavailable'}
          </Badge>
          <span>{gpuHint}</span>
        </div>

        {!caps.gpu_available && caps.preference === 'gpu' ? (
          <p className="text-xs text-destructive">
            No accelerator was detected — generation is falling back to CPU. Switch to Auto or CPU
            to hide this warning.
          </p>
        ) : null}
      </div>
    </SettingsSection>
  )
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-surface/60 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-base font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-4 pl-12">{children}</div>
    </section>
  )
}
