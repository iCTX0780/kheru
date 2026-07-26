import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Paragraph, ParagraphGeneration } from '@/stores/studio'
import type { ProjectRecord } from '@/lib/project-db'

vi.mock('@/lib/client-tts/opfs', () => ({
  deleteProjectAudioOpfs: vi.fn(async () => {}),
  deleteParagraphGenerationAudioOpfs: vi.fn(async () => {}),
}))

vi.mock('@/lib/project-db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/project-db')>()
  return {
    ...actual,
    getProjectFromIDB: vi.fn(),
    saveProjectToIDB: vi.fn(async () => {}),
  }
})

import { deleteParagraphGenerationAudioOpfs, deleteProjectAudioOpfs } from '@/lib/client-tts/opfs'
import { getProjectFromIDB, saveProjectToIDB } from '@/lib/project-db'
import { clearProjectAudio, keepLatestGenerationOnly } from '@/lib/project-cleanup'

function generation(id: string, createdAt: string): ParagraphGeneration {
  return {
    id,
    createdAt,
    textSnapshot: 'Hello',
    voice: 'kokoro:af_heart',
    lengthScale: 1,
    audioUrl: `blob:${id}`,
    duration: 2,
    wordTimings: null,
  }
}

function paragraph(overrides: Partial<Paragraph> = {}): Paragraph {
  return {
    id: 'p1',
    text: 'Hello',
    voice: 'kokoro:af_heart',
    lengthScale: 1,
    audioUrl: 'blob:p1',
    duration: 2,
    wordTimings: null,
    status: 'done',
    generations: [],
    activeGenerationId: null,
    ...overrides,
  }
}

function project(paragraphs: Paragraph[]): ProjectRecord {
  return {
    id: 'proj-1',
    title: 'My show',
    chapters: [
      {
        id: 'chap-1',
        title: 'Script',
        paragraphs,
        chapter: { audioUrl: 'blob:mix', segments: [{} as never], status: 'done' },
      },
    ],
    activeChapterId: 'chap-1',
    updatedAt: '2026-07-01T00:00:00.000Z',
  }
}

const mockedGet = vi.mocked(getProjectFromIDB)
const mockedSave = vi.mocked(saveProjectToIDB)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('clearProjectAudio', () => {
  it('purges OPFS and resets every paragraph + full mix', async () => {
    const p = paragraph({
      status: 'done',
      audioUrl: 'blob:gen2',
      duration: 2,
      generations: [generation('g1', '2026-07-01T10:00:00.000Z'), generation('g2', '2026-07-01T11:00:00.000Z')],
      activeGenerationId: 'g2',
    })
    mockedGet.mockResolvedValue(project([p]))

    await clearProjectAudio('proj-1')

    expect(deleteProjectAudioOpfs).toHaveBeenCalledWith('proj-1')
    const saved = mockedSave.mock.calls[0][0]
    const reset = saved.chapters[0].paragraphs[0]
    expect(reset.status).toBe('idle')
    expect(reset.generations).toEqual([])
    expect(reset.activeGenerationId).toBeNull()
    expect(reset.audioUrl).toBeNull()
    expect(saved.chapters[0].chapter).toEqual({ audioUrl: null, segments: [], status: 'idle' })
    expect(reset.text).toBe('Hello')
  })

  it('no-ops the IDB write when the project is missing (still purges OPFS)', async () => {
    mockedGet.mockResolvedValue(undefined)
    await clearProjectAudio('gone')
    expect(deleteProjectAudioOpfs).toHaveBeenCalledWith('gone')
    expect(mockedSave).not.toHaveBeenCalled()
  })
})

describe('keepLatestGenerationOnly', () => {
  it('keeps the active take and deletes the rest from OPFS', async () => {
    const p = paragraph({
      generations: [
        generation('g1', '2026-07-01T10:00:00.000Z'),
        generation('g2', '2026-07-01T11:00:00.000Z'),
        generation('g3', '2026-07-01T12:00:00.000Z'),
      ],
      activeGenerationId: 'g2',
    })
    mockedGet.mockResolvedValue(project([p]))

    await keepLatestGenerationOnly('proj-1')

    expect(deleteParagraphGenerationAudioOpfs).toHaveBeenCalledWith('proj-1', 'p1', 'g1')
    expect(deleteParagraphGenerationAudioOpfs).toHaveBeenCalledWith('proj-1', 'p1', 'g3')
    expect(deleteParagraphGenerationAudioOpfs).not.toHaveBeenCalledWith('proj-1', 'p1', 'g2')

    const kept = mockedSave.mock.calls[0][0].chapters[0].paragraphs[0]
    expect(kept.generations.map((g) => g.id)).toEqual(['g2'])
    expect(kept.activeGenerationId).toBe('g2')
  })

  it('falls back to the newest take when there is no active id', async () => {
    const p = paragraph({
      audioUrl: null,
      generations: [
        generation('old', '2026-07-01T10:00:00.000Z'),
        generation('new', '2026-07-01T12:00:00.000Z'),
      ],
      activeGenerationId: null,
    })
    mockedGet.mockResolvedValue(project([p]))

    await keepLatestGenerationOnly('proj-1')

    expect(deleteParagraphGenerationAudioOpfs).toHaveBeenCalledWith('proj-1', 'p1', 'old')
    const kept = mockedSave.mock.calls[0][0].chapters[0].paragraphs[0]
    expect(kept.generations.map((g) => g.id)).toEqual(['new'])
    expect(kept.activeGenerationId).toBe('new')
  })

  it('leaves paragraphs with 0 or 1 take untouched', async () => {
    const p = paragraph({ generations: [generation('g1', '2026-07-01T10:00:00.000Z')], activeGenerationId: 'g1' })
    mockedGet.mockResolvedValue(project([p]))

    await keepLatestGenerationOnly('proj-1')

    expect(deleteParagraphGenerationAudioOpfs).not.toHaveBeenCalled()
  })
})
