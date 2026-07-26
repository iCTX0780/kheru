import { useCallback, useEffect, useState } from 'react'
import { measureProjectOpfs, opfsAudioSupported } from '@/lib/client-tts/opfs'
import { getStorageEstimate, type StorageEstimate } from '@/lib/storage-usage'

type IdleHandle = number

interface IdleWindow {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

function scheduleIdle(cb: () => void): IdleHandle {
  const idle = window as unknown as IdleWindow
  if (typeof idle.requestIdleCallback === 'function') {
    return idle.requestIdleCallback(cb, { timeout: 2000 })
  }
  return window.setTimeout(cb, 200) as unknown as IdleHandle
}

function cancelIdle(handle: IdleHandle) {
  const idle = window as unknown as IdleWindow
  if (typeof idle.cancelIdleCallback === 'function') {
    idle.cancelIdleCallback(handle)
  } else {
    window.clearTimeout(handle)
  }
}

/** Global browser storage estimate (usage/quota). Re-read via `refresh`. */
export function useStorageEstimate() {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null)

  const refresh = useCallback(async () => {
    setEstimate(await getStorageEstimate())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { estimate, refresh }
}

/** Per-project OPFS audio sizes, measured in parallel on an idle callback so
 * first paint is never blocked. Recomputed each mount (no persisted cache). */
export function useProjectAudioSizes(projectIds: string[]) {
  const supported = opfsAudioSupported()
  const [sizes, setSizes] = useState<Record<string, number>>({})
  const [measuring, setMeasuring] = useState(supported && projectIds.length > 0)

  const key = projectIds.join(',')

  const measure = useCallback(async () => {
    const ids = key ? key.split(',') : []
    const results = await Promise.all(ids.map((id) => measureProjectOpfs(id)))
    const next: Record<string, number> = {}
    ids.forEach((id, i) => {
      next[id] = results[i]
    })
    setSizes(next)
    setMeasuring(false)
  }, [key])

  useEffect(() => {
    if (!supported || !key) {
      setMeasuring(false)
      return
    }
    setMeasuring(true)
    const handle = scheduleIdle(() => {
      void measure()
    })
    return () => cancelIdle(handle)
  }, [supported, key, measure])

  return { sizes, measuring, supported, remeasure: measure }
}
