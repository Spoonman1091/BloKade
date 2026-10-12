import { describe, expect, it } from 'vitest'
import { toParamSpecs } from './settings'

const problem = (raw: unknown): string => {
  const result = toParamSpecs(raw)
  return result.ok ? 'no problem' : result.error
}

describe('toParamSpecs', () => {
  it('accepts every setting type, with the label defaulting to the name', () => {
    const result = toParamSpecs({
      size: { type: 'mm', default: 20, label: 'Size' },
      teeth: { type: 'whole', default: 12, min: 6, max: 60 },
      ratio: { type: 'number', default: 1.5 },
      tilt: { type: 'angle', default: 45 },
      words: { type: 'text', default: 'Hi', maxLength: 10 },
      shape: { type: 'choice', default: 'round', options: ['round', { value: 'square', label: 'Square' }] },
      hollow: { type: 'yesno', default: false },
      gap: { type: 'mm', default: 0.2, formula: 'fit' },
    })
    expect(result.ok && result.value).toEqual({
      size: { type: 'mm', default: 20, label: 'Size' },
      teeth: { type: 'whole', default: 12, min: 6, max: 60, label: 'teeth' },
      ratio: { type: 'number', default: 1.5, label: 'ratio' },
      tilt: { type: 'angle', default: 45, label: 'tilt' },
      words: { type: 'text', default: 'Hi', maxLength: 10, label: 'words' },
      shape: { type: 'choice', default: 'round', label: 'shape', options: [{ value: 'round', label: 'round' }, { value: 'square', label: 'Square' }] },
      hollow: { type: 'yesno', default: false, label: 'hollow' },
      gap: { type: 'mm', default: 0.2, formula: 'fit', label: 'gap' },
    })
  })
  it('allows no settings at all', () => {
    expect(toParamSpecs(undefined)).toEqual({ ok: true, value: {} })
  })
  it('explains each kind of mistake', () => {
    expect(problem(5)).toContain('settings needs curly brackets')
    expect(problem({ size: 20 })).toBe("The setting \"size\" needs curly brackets, like size: { type: 'mm', default: 20 }.")
    expect(problem({ size: { type: 'cm', default: 2 } })).toContain('needs a type: \'mm\', \'whole\'')
    expect(problem({ size: { type: 'mm' } })).toBe('The setting "size" needs a number default, like default: 20.')
    expect(problem({ size: { type: 'mm', default: 50, max: 40 } })).toBe('The default of "size" is outside its min and max.')
    expect(problem({ size: { type: 'mm', default: 5, min: 10, max: 2 } })).toBe('The setting "size" has a min bigger than its max.')
    expect(problem({ size: { type: 'mm', default: 5, formula: 'wall * 2' } })).toContain('can only use fit')
    expect(problem({ words: { type: 'text', default: 3 } })).toContain('needs a default in quotes')
    expect(problem({ shape: { type: 'choice', default: 'a', options: ['a'] } })).toContain('needs at least 2 options')
    expect(problem({ shape: { type: 'choice', default: 'c', options: ['a', 'b'] } })).toBe('The default of "shape" must be one of its options.')
    expect(problem({ shape: { type: 'choice', default: 'a', options: ['a', 'a'] } })).toBe('Two options of "shape" are the same.')
    expect(problem({ round: { type: 'yesno', default: 'yes' } })).toBe('The setting "round" needs default: true or default: false.')
    expect(problem({ 'two words': { type: 'mm', default: 1 } })).toContain("can't be a setting name")
  })
  it('allows up to 30 settings', () => {
    const many = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`s${i}`, { type: 'mm', default: 1 }]))
    expect(toParamSpecs(many(30)).ok).toBe(true)
    expect(problem(many(31))).toBe('A shape can have up to 30 settings.')
  })
})
