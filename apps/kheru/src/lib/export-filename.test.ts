import { describe, expect, it } from 'vitest'
import { exportBaseName, slugifyExportName } from './export-filename'

describe('export-filename', () => {
  it('slugifies project and chapter titles', () => {
    expect(exportBaseName('Weak-spot drill', 'Chapter 1')).toBe('weak-spot-drill-chapter-1')
  })

  it('falls back to untitled when empty', () => {
    expect(slugifyExportName('', '')).toBe('untitled')
  })

  it('strips special characters', () => {
    expect(slugifyExportName('My Project!', 'Chapter #2')).toBe('my-project-chapter-2')
  })
})
