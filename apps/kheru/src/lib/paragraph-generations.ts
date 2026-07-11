import type { Paragraph, ParagraphGeneration, ParagraphStatus } from '@/stores/studio'

export const MAX_PARAGRAPH_GENERATIONS = 3

export function resolveActiveGeneration(paragraph: Paragraph): ParagraphGeneration | null {
  if (!paragraph.activeGenerationId || !paragraph.generations?.length) return null
  return paragraph.generations.find((g) => g.id === paragraph.activeGenerationId) ?? null
}

export function draftDiffersFromGeneration(
  paragraph: Pick<Paragraph, 'text' | 'voice' | 'lengthScale'>,
  generation: Pick<ParagraphGeneration, 'textSnapshot' | 'voice' | 'lengthScale'>
): boolean {
  return (
    paragraph.text !== generation.textSnapshot ||
    paragraph.voice !== generation.voice ||
    paragraph.lengthScale !== generation.lengthScale
  )
}

export function computeParagraphStatus(
  paragraph: Paragraph,
  active: ParagraphGeneration | null
): ParagraphStatus {
  if (paragraph.status === 'generating') return 'generating'
  if (paragraph.status === 'error') return 'error'
  if (!active) {
    return paragraph.generations?.length ? 'idle' : 'idle'
  }
  return draftDiffersFromGeneration(paragraph, active) ? 'stale' : 'done'
}

export function syncParagraphFromActiveGeneration(paragraph: Paragraph): Paragraph {
  const generations = paragraph.generations ?? []
  const activeGenerationId = paragraph.activeGenerationId ?? null
  const active = resolveActiveGeneration({ ...paragraph, generations, activeGenerationId })

  if (!active) {
    return {
      ...paragraph,
      generations,
      activeGenerationId,
      audioUrl: null,
      duration: null,
      wordTimings: null,
      status:
        paragraph.status === 'generating'
          ? 'generating'
          : paragraph.status === 'error'
            ? 'error'
            : 'idle',
    }
  }

  const status = computeParagraphStatus(paragraph, active)
  return {
    ...paragraph,
    generations,
    activeGenerationId,
    audioUrl: active.audioUrl,
    duration: active.duration,
    wordTimings: active.wordTimings,
    status,
  }
}

export function createGenerationFromParagraph(
  paragraph: Paragraph,
  audioUrl: string,
  duration: number,
  wordTimings: ParagraphGeneration['wordTimings'],
  audioRef?: string
): ParagraphGeneration {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    textSnapshot: paragraph.text,
    voice: paragraph.voice,
    lengthScale: paragraph.lengthScale,
    speaker: paragraph.speaker,
    audioUrl,
    duration,
    wordTimings,
    audioRef,
  }
}

/** Migrate v1 paragraph (single audio slot) to v2 generations array. */
export function migrateParagraphToV2(paragraph: Paragraph): Paragraph {
  if (paragraph.generations && paragraph.generations.length > 0) {
    return syncParagraphFromActiveGeneration({
      ...paragraph,
      generations: paragraph.generations,
      activeGenerationId: paragraph.activeGenerationId ?? paragraph.generations[0]?.id ?? null,
    })
  }

  if (paragraph.audioUrl && paragraph.duration != null) {
    const generation = createGenerationFromParagraph(
      paragraph,
      paragraph.audioUrl,
      paragraph.duration,
      paragraph.wordTimings,
      extractAudioRef(paragraph.audioUrl)
    )
    return syncParagraphFromActiveGeneration({
      ...paragraph,
      generations: [generation],
      activeGenerationId: generation.id,
    })
  }

  return {
    ...paragraph,
    generations: [],
    activeGenerationId: null,
    audioUrl: null,
    duration: null,
    wordTimings: null,
    status: paragraph.status === 'generating' ? 'generating' : 'idle',
  }
}

function extractAudioRef(audioUrl: string): string | undefined {
  const match = audioUrl.match(/\/api\/audio\/([0-9a-f]{8})$/)
  return match?.[1]
}

/** Append a take and evict oldest entries when over the per-paragraph limit. */
export function appendGenerationWithLimit(
  generations: ParagraphGeneration[],
  incoming: ParagraphGeneration
): { generations: ParagraphGeneration[]; evicted: ParagraphGeneration[] } {
  const combined = [...generations, incoming]
  if (combined.length <= MAX_PARAGRAPH_GENERATIONS) {
    return { generations: combined, evicted: [] }
  }

  const evictCount = combined.length - MAX_PARAGRAPH_GENERATIONS
  const sortedOldestFirst = [...generations].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const evicted = sortedOldestFirst.slice(0, evictCount)
  const evictedIds = new Set(evicted.map((g) => g.id))
  const kept = combined.filter((g) => !evictedIds.has(g.id))
  return { generations: kept, evicted }
}

export function migrateProjectParagraphsV2<T extends { paragraphs: Paragraph[] }>(chapter: T): T {
  return {
    ...chapter,
    paragraphs: chapter.paragraphs.map(migrateParagraphToV2),
  }
}
