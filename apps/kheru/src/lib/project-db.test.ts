import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SCRIPT_CHAPTER_TITLE,
  createDefaultChapter,
  createDefaultProject,
  flattenProjectToSingleChapter,
  projectSummary,
  type ProjectRecord,
} from './project-db'
import type { Paragraph } from '@/stores/studio'

function paragraph(text: string, voice = 'kokoro:af_heart'): Paragraph {
  return {
    id: crypto.randomUUID(),
    text,
    voice,
    lengthScale: 1,
    audioUrl: null,
    duration: null,
    wordTimings: null,
    status: 'idle',
    generations: [],
    activeGenerationId: null,
  }
}

describe('flattenProjectToSingleChapter', () => {
  it('merges multi-chapter paragraphs into one Script chapter', () => {
    const a = createDefaultChapter('Chapter 1')
    a.paragraphs = [paragraph('First'), paragraph('Second')]
    const b = createDefaultChapter('Chapter 2')
    b.paragraphs = [paragraph('Third')]
    const project: ProjectRecord = {
      id: 'proj-1',
      title: 'My show',
      chapters: [a, b],
      activeChapterId: b.id,
      updatedAt: new Date().toISOString(),
    }

    const { project: flat, changed } = flattenProjectToSingleChapter(project)

    expect(changed).toBe(true)
    expect(flat.chapters).toHaveLength(1)
    expect(flat.chapters[0].title).toBe(DEFAULT_SCRIPT_CHAPTER_TITLE)
    expect(flat.chapters[0].paragraphs.map((p) => p.text)).toEqual([
      'First',
      'Second',
      'Third',
    ])
    expect(flat.activeChapterId).toBe(a.id)
    expect(flat.chapters[0].chapter.status).toBe('idle')
  })

  it('renames a sole non-Script chapter without losing paragraphs', () => {
    const project = createDefaultProject('kokoro:af_heart', 'Untitled')
    project.chapters[0].title = 'Chapter 1'
    project.chapters[0].paragraphs = [paragraph('Only')]

    const { project: flat, changed } = flattenProjectToSingleChapter(project)

    expect(changed).toBe(true)
    expect(flat.chapters).toHaveLength(1)
    expect(flat.chapters[0].title).toBe(DEFAULT_SCRIPT_CHAPTER_TITLE)
    expect(flat.chapters[0].paragraphs).toHaveLength(1)
  })

  it('is a no-op for an already-flat Script project', () => {
    const project = createDefaultProject('kokoro:af_heart')
    expect(project.chapters[0].title).toBe(DEFAULT_SCRIPT_CHAPTER_TITLE)

    const { project: flat, changed } = flattenProjectToSingleChapter(project)

    expect(changed).toBe(false)
    expect(flat).toEqual(project)
  })
})

describe('projectSummary', () => {
  it('counts paragraphs across all chapters', () => {
    const a = createDefaultChapter('A')
    a.paragraphs = [paragraph('1'), paragraph('2')]
    const b = createDefaultChapter('B')
    b.paragraphs = [paragraph('3')]
    const project: ProjectRecord = {
      id: 'p',
      title: 'T',
      chapters: [a, b],
      activeChapterId: a.id,
      updatedAt: new Date().toISOString(),
    }

    const summary = projectSummary(project)
    expect(summary.paragraphCount).toBe(3)
    expect(summary).not.toHaveProperty('chapterCount')
  })
})
