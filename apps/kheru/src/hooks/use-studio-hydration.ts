import { useEffect, useState } from 'react'
import { useStudioStore } from '@/stores/studio'

function isClientHydrated(): boolean {
  return typeof window !== 'undefined' && useStudioStore.persist.hasHydrated()
}

/** Restore studio state from localStorage before rendering the editor. */
export function useStudioHydration(): boolean {
  const [hydrated, setHydrated] = useState(isClientHydrated)

  useEffect(() => {
    let cancelled = false
    const finish = () => {
      if (!cancelled) setHydrated(true)
    }

    if (isClientHydrated()) {
      finish()
      return
    }

    const unsub = useStudioStore.persist.onFinishHydration(finish)

    try {
      const result = useStudioStore.persist.rehydrate()
      if (result && typeof (result as Promise<void>).then === 'function') {
        void (result as Promise<void>).then(finish).catch((err) => {
          console.warn('Studio rehydrate failed:', err)
          finish()
        })
      } else {
        finish()
      }
    } catch (err) {
      console.warn('Studio rehydrate failed:', err)
      finish()
    }

    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  return hydrated
}
