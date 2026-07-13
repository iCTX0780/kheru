import { describe, expect, it } from 'vitest'
import {
  appendGenerationWithLimit,
  computeParagraphStatus,
  draftDiffersFromGeneration,
  MAX_PARAGRAPH_GENERATIONS,
  migrateParagraphToV2,
  resolveActiveGeneration,
  syncParagraphFromActiveGeneration,
} from '@/lib/paragraph-generations'
import type { Paragraph, ParagraphGeneration } from '@/stores/studio'

function baseParagraph(overrides: Partial<Paragraph> = {}): Paragraph {
  return {
    id: 'p1',
    text: 'Hello world',
    voice: 'kokoro:af_heart',
    lengthScale: 1,
    audioUrl: null,
    duration: null,
    wordTimings: null,
    status: 'idle',
    generations: [],
    activeGenerationId: null,
    ...overrides,
  }
}

function sampleGeneration(overrides: Partial<ParagraphGeneration> = {}): ParagraphGeneration {
  return {
    id: 'g1',
    createdAt: '2026-07-11T12:00:00.000Z',
    textSnapshot: 'Hello world',
    voice: 'kokoro:af_heart',
    lengthScale: 1,
    audioUrl: 'blob:abcd1234',
    duration: 2.5,
    wordTimings: null,
    audioRef: 'abcd1234',
    ...overrides,
  }
}

describe('resolveActiveGeneration', () => {
  it('returns the active generation when set', () => {
    const gen = sampleGeneration()
    const paragraph = baseParagraph({
      generations: [gen],
      activeGenerationId: 'g1',
    })
    expect(resolveActiveGeneration(paragraph)?.id).toBe('g1')
  })

  it('returns null when no active id', () => {
    const paragraph = baseParagraph({ generations: [sampleGeneration()] })
    expect(resolveActiveGeneration(paragraph)).toBeNull()
  })
})

describe('draftDiffersFromGeneration', () => {
  it('detects text changes against snapshot', () => {
    const paragraph = baseParagraph({ text: 'Updated draft' })
    const generation = sampleGeneration({ textSnapshot: 'Hello world' })
    expect(draftDiffersFromGeneration(paragraph, generation)).toBe(true)
  })

  it('returns false when draft matches snapshot', () => {
    const paragraph = baseParagraph()
    const generation = sampleGeneration()
    expect(draftDiffersFromGeneration(paragraph, generation)).toBe(false)
  })
})

describe('computeParagraphStatus', () => {
  it('marks stale when draft differs from active take', () => {
    const gen = sampleGeneration()
    const paragraph = baseParagraph({
      text: 'Changed',
      generations: [gen],
      activeGenerationId: 'g1',
      status: 'done',
    })
    expect(computeParagraphStatus(paragraph, gen)).toBe('stale')
  })

  it('marks done when draft matches active take', () => {
    const gen = sampleGeneration()
    const paragraph = baseParagraph({
      generations: [gen],
      activeGenerationId: 'g1',
      status: 'done',
    })
    expect(computeParagraphStatus(paragraph, gen)).toBe('done')
  })
})

describe('syncParagraphFromActiveGeneration', () => {
  it('denormalizes audio fields from active generation', () => {
    const gen = sampleGeneration()
    const paragraph = baseParagraph({
      generations: [gen],
      activeGenerationId: 'g1',
    })
    const synced = syncParagraphFromActiveGeneration(paragraph)
    expect(synced.audioUrl).toBe(gen.audioUrl)
    expect(synced.duration).toBe(gen.duration)
    expect(synced.status).toBe('done')
  })
})

describe('appendGenerationWithLimit', () => {
  it('keeps all takes when under the limit', () => {
    const existing = [sampleGeneration({ id: 'g1' }), sampleGeneration({ id: 'g2' })]
    const incoming = sampleGeneration({ id: 'g3', createdAt: '2026-07-11T13:00:00.000Z' })
    const result = appendGenerationWithLimit(existing, incoming)
    expect(result.generations).toHaveLength(3)
    expect(result.evicted).toHaveLength(0)
  })

  it('evicts the oldest take when adding beyond the limit', () => {
    const existing = [
      sampleGeneration({ id: 'g1', createdAt: '2026-07-11T10:00:00.000Z' }),
      sampleGeneration({ id: 'g2', createdAt: '2026-07-11T11:00:00.000Z' }),
      sampleGeneration({ id: 'g3', createdAt: '2026-07-11T12:00:00.000Z' }),
    ]
    const incoming = sampleGeneration({ id: 'g4', createdAt: '2026-07-11T13:00:00.000Z' })
    const result = appendGenerationWithLimit(existing, incoming)
    expect(result.generations).toHaveLength(MAX_PARAGRAPH_GENERATIONS)
    expect(result.generations.map((g) => g.id)).toEqual(['g2', 'g3', 'g4'])
    expect(result.evicted.map((g) => g.id)).toEqual(['g1'])
  })
})

describe('migrateParagraphToV2', () => {
  it('creates a generation from legacy single-audio paragraph', () => {
    const legacy = baseParagraph({
      audioUrl: 'blob:abcd1234',
      duration: 3,
      wordTimings: null,
      status: 'done',
    })
    const migrated = migrateParagraphToV2(legacy)
    expect(migrated.generations).toHaveLength(1)
    expect(migrated.activeGenerationId).toBe(migrated.generations[0]?.id)
    expect(migrated.generations[0]?.textSnapshot).toBe('Hello world')
    expect(migrated.generations[0]?.audioRef).toBeUndefined()
    expect(migrated.audioUrl).toBe('blob:abcd1234')
  })

  it('initializes empty generations when no audio', () => {
    const migrated = migrateParagraphToV2(baseParagraph())
    expect(migrated.generations).toEqual([])
    expect(migrated.activeGenerationId).toBeNull()
  })

  it('is idempotent for already-migrated paragraphs', () => {
    const gen = sampleGeneration()
    const paragraph = baseParagraph({
      generations: [gen],
      activeGenerationId: 'g1',
      audioUrl: gen.audioUrl,
      duration: gen.duration,
      status: 'done',
    })
    const migrated = migrateParagraphToV2(paragraph)
    expect(migrated.generations).toHaveLength(1)
    expect(migrated.activeGenerationId).toBe('g1')
  })
})
