export interface StorageEstimate {
  usage: number
  quota: number
}

/**
 * App-level soft cap on how much device storage Kheru will use before it warns
 * and then blocks new generation. Independent of (and usually far below) the
 * browser's per-origin quota, so the app never quietly fills the disk. Single
 * source of truth — change here to retune.
 */
export const STORAGE_BUDGET_BYTES = 2 * 1024 ** 3 // 2 GB

/** Fraction of the budget at which we warn but still allow generation. */
export const STORAGE_WARN_RATIO = 0.8

export type BudgetLevel = 'ok' | 'warn' | 'over'

export interface BudgetStatus {
  usage: number
  /** Effective ceiling: the app budget, capped by the real browser quota. */
  budget: number
  ratio: number
  level: BudgetLevel
}

/** Classify current usage against the app budget (capped by browser quota). */
export function evaluateBudget(
  estimate: StorageEstimate | null,
  appBudget = STORAGE_BUDGET_BYTES
): BudgetStatus | null {
  if (!estimate) return null
  const budget = Math.min(appBudget, estimate.quota) || appBudget
  const ratio = budget > 0 ? estimate.usage / budget : 0
  const level: BudgetLevel = ratio >= 1 ? 'over' : ratio >= STORAGE_WARN_RATIO ? 'warn' : 'ok'
  return { usage: estimate.usage, budget, ratio, level }
}

function storageManagerAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'storage' in navigator
}

/** Read the browser's storage usage/quota estimate. Returns null when the
 * StorageManager API is unavailable or the estimate is unusable. */
export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  if (!storageManagerAvailable() || typeof navigator.storage.estimate !== 'function') {
    return null
  }
  try {
    const { usage, quota } = await navigator.storage.estimate()
    if (typeof usage !== 'number' || typeof quota !== 'number' || quota <= 0) {
      return null
    }
    return { usage, quota }
  } catch {
    return null
  }
}

/** Ask the browser to make storage persistent (reduces eviction of kept data).
 * Returns whether storage is persisted; false when unsupported. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!storageManagerAvailable() || typeof navigator.storage.persist !== 'function') {
    return false
  }
  try {
    if (typeof navigator.storage.persisted === 'function' && (await navigator.storage.persisted())) {
      return true
    }
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/** Whether the origin's storage is currently persisted (eviction-resistant). */
export async function isStoragePersisted(): Promise<boolean> {
  if (!storageManagerAvailable() || typeof navigator.storage.persisted !== 'function') {
    return false
  }
  try {
    return await navigator.storage.persisted()
  } catch {
    return false
  }
}

/** usage / quota clamped to [0, 1]; 0 when the estimate is absent. */
export function usageRatio(estimate: StorageEstimate | null): number {
  if (!estimate || estimate.quota <= 0) return 0
  return Math.min(1, Math.max(0, estimate.usage / estimate.quota))
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

/** Human-readable byte size, e.g. 448790528 → "428 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / 1024 ** exponent
  const digits = value >= 100 || exponent === 0 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${UNITS[exponent]}`
}
