import { describe, expect, it } from 'vitest'
import { prepareTextForTts } from './tts-prepare-text'

describe('prepareTextForTts', () => {
  it('spells DI and CI/CD', () => {
    const { spoken } = prepareTextForTts('Use DI in CI/CD pipelines.')
    expect(spoken).toBe('Use D I in C I C D pipelines.')
  })

  it('expands numeronyms', () => {
    const { spoken } = prepareTextForTts('Ship a11y and i18n together.')
    expect(spoken).toBe('Ship accessibility and internationalization together.')
  })

  it('speaks DOM as dome', () => {
    const { spoken } = prepareTextForTts('Update the DOM after render.')
    expect(spoken).toBe('Update the dome after render.')
  })

  it('strips author overrides from display but uses them for speech', () => {
    const { display, spoken } = prepareTextForTts('The DOM [as: document object model] is ready.')
    expect(display).toBe('The DOM is ready.')
    expect(spoken).toBe('The document object model is ready.')
  })

  it('author override wins over glossary', () => {
    const { spoken } = prepareTextForTts('DOM [as: D O M] everywhere.')
    expect(spoken).toBe('D O M everywhere.')
  })
})
