import { describe, expect, it } from 'vitest'
import { evaluateBudget, formatBytes, STORAGE_BUDGET_BYTES, usageRatio } from '@/lib/storage-usage'

describe('formatBytes', () => {
  it('formats zero and negatives as 0 B', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-100)).toBe('0 B')
  })

  it('formats bytes, KB, MB, GB with sensible precision', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1.00 KB')
    expect(formatBytes(1536)).toBe('1.50 KB')
    expect(formatBytes(448790528)).toBe('428 MB')
    expect(formatBytes(5 * 1024 ** 3)).toBe('5.00 GB')
  })

  it('drops decimals for values >= 100', () => {
    expect(formatBytes(150 * 1024)).toBe('150 KB')
  })
})

describe('usageRatio', () => {
  it('returns 0 for null or zero-quota estimates', () => {
    expect(usageRatio(null)).toBe(0)
    expect(usageRatio({ usage: 10, quota: 0 })).toBe(0)
  })

  it('computes usage/quota clamped to [0, 1]', () => {
    expect(usageRatio({ usage: 25, quota: 100 })).toBe(0.25)
    expect(usageRatio({ usage: 200, quota: 100 })).toBe(1)
  })
})

describe('evaluateBudget', () => {
  const GB = 1024 ** 3

  it('returns null when the estimate is absent', () => {
    expect(evaluateBudget(null)).toBeNull()
  })

  it('measures against the app budget, not the (larger) browser quota', () => {
    const status = evaluateBudget({ usage: 1 * GB, quota: 100 * GB })
    expect(status?.budget).toBe(STORAGE_BUDGET_BYTES) // 2 GB, capped below the 100 GB quota
    expect(status?.level).toBe('ok')
    expect(status?.ratio).toBeCloseTo(0.5)
  })

  it('caps the budget at the browser quota when the quota is smaller', () => {
    const status = evaluateBudget({ usage: 0.5 * GB, quota: 1 * GB })
    expect(status?.budget).toBe(1 * GB)
  })

  it('flags warn at >=80% and over at >=100% of budget', () => {
    expect(evaluateBudget({ usage: 1.7 * GB, quota: 100 * GB })?.level).toBe('warn')
    expect(evaluateBudget({ usage: 2 * GB, quota: 100 * GB })?.level).toBe('over')
    expect(evaluateBudget({ usage: 3 * GB, quota: 100 * GB })?.level).toBe('over')
  })
})
