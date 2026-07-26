import { getMetaValue, setMetaValue } from '@/lib/project-db'
import { STORAGE_BUDGET_BYTES } from '@/lib/storage-usage'

const BUDGET_KEY = 'storageBudgetBytes'
const PERSIST_KEY = 'persistStoragePref'

const GB = 1024 ** 3

/** Selectable storage-budget presets (bytes). */
export const STORAGE_BUDGET_PRESETS = [1 * GB, 2 * GB, 5 * GB, 10 * GB] as const

/** Configured soft cap on how much device storage Kheru may use before it warns
 * and blocks generation. Falls back to the built-in default. */
export async function getStorageBudget(): Promise<number> {
  const raw = await getMetaValue(BUDGET_KEY)
  const value = raw ? Number(raw) : NaN
  return Number.isFinite(value) && value > 0 ? value : STORAGE_BUDGET_BYTES
}

export async function setStorageBudget(bytes: number): Promise<void> {
  await setMetaValue(BUDGET_KEY, String(Math.round(bytes)))
}

/** Whether the user opted in to persistent (eviction-resistant) storage. */
export async function getPersistPref(): Promise<boolean> {
  return (await getMetaValue(PERSIST_KEY)) === 'true'
}

export async function setPersistPref(enabled: boolean): Promise<void> {
  await setMetaValue(PERSIST_KEY, enabled ? 'true' : 'false')
}
