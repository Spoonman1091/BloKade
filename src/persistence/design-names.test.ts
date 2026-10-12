import { describe, expect, it } from 'vitest'
import { nextUntitledName } from './design-names'

describe('nextUntitledName', () => {
  it('starts with the plain name', () => {
    expect(nextUntitledName([])).toBe('Untitled design')
    expect(nextUntitledName(['Rocket'])).toBe('Untitled design')
  })

  it('numbers the next one from 2', () => {
    expect(nextUntitledName(['Untitled design'])).toBe('Untitled design 2')
    expect(nextUntitledName(['Untitled design', 'Untitled design 2'])).toBe('Untitled design 3')
  })

  it('reuses the lowest free number', () => {
    expect(nextUntitledName(['Untitled design', 'Untitled design 3'])).toBe('Untitled design 2')
    expect(nextUntitledName(['Untitled design 2'])).toBe('Untitled design')
  })
})
