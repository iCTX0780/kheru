import { describe, expect, it } from 'vitest'
import { exportBaseName, slugifyExportName } from './export-filename'

describe('export-filename', () => {
  it('uses project title only for export base names', () => {
    expect(exportBaseName('Weak-spot drill', 'Chapter 1')).toBe('weak-spot-drill')
    expect(exportBaseName('Weak-spot drill')).toBe('weak-spot-drill')
  })

  it('falls back to untitled when empty', () => {
    expect(slugifyExportName('', '')).toBe('untitled')
  })

  it('strips special characters', () => {
    expect(slugifyExportName('My Project!')).toBe('my-project')
  })
})
