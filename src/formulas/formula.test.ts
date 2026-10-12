import { describe, expect, it } from 'vitest'
import { computeFormula, MAX_FORMULA_LENGTH, parseFormula, renameVariableIn, variablesUsed } from './formula'

const scope = new Map([['wall', 2], ['fit', 0.2], ['pi', Math.PI]])

function value(text: string): number {
  const result = computeFormula(text, scope)
  if (!result.ok) throw new Error(result.error)
  return result.value
}

function errorOf(text: string): string {
  const result = computeFormula(text, scope)
  if (result.ok) throw new Error(`expected "${text}" to fail`)
  return result.error
}

describe('formulas', () => {
  it('does arithmetic in the usual order', () => {
    expect(value('1 + 2 * 3')).toBe(7)
    expect(value('(1 + 2) * 3')).toBe(9)
    expect(value('10 / 4')).toBe(2.5)
    expect(value('2 ^ 3 ^ 2')).toBe(512)
    expect(value('-2 ^ 2')).toBe(-4)
    expect(value('--3')).toBe(3)
    expect(value('1.5e1')).toBe(15)
    expect(value('.5 + 1')).toBe(1.5)
  })

  it('uses variables, fit and pi', () => {
    expect(value('wall * 2 + fit')).toBeCloseTo(4.2)
    expect(value('2 * pi')).toBeCloseTo(6.283185)
  })

  it('calls the allowed functions, with angles in degrees', () => {
    expect(value('min(3, 1, 2)')).toBe(1)
    expect(value('max(3, wall)')).toBe(3)
    expect(value('round(2.5) + floor(2.9) + ceil(2.1)')).toBe(8)
    expect(value('sqrt(16)')).toBe(4)
    expect(value('sin(90)')).toBeCloseTo(1)
    expect(value('cos(180)')).toBeCloseTo(-1)
    expect(value('tan(45)')).toBeCloseTo(1)
  })

  it('explains mistakes in plain words', () => {
    expect(errorOf('wal * 2')).toContain(`"wal" isn't a variable`)
    expect(errorOf('1 +')).toContain('stops too early')
    expect(errorOf('(1 + 2')).toContain('")" is missing')
    expect(errorOf('2 wall')).toContain(`Something's off near "wall"`)
    expect(errorOf('5 / 0')).toContain('divide by zero')
    expect(errorOf('sqrt(-1)')).toContain("doesn't make a number")
    expect(errorOf('hypot(3, 4)')).toContain(`"hypot" isn't a function`)
    expect(errorOf('round(1, 2)')).toContain('round() needs exactly 1 number')
    expect(errorOf('min()')).toContain('min() needs at least 1 number')
    expect(errorOf('3 # 4')).toContain('"#"')
    expect(errorOf('')).toContain('empty')
  })

  it('refuses formulas that would hang or overflow', () => {
    expect(errorOf('9 ^ 9 ^ 9')).toContain('too big')
    expect(errorOf('1'.repeat(MAX_FORMULA_LENGTH + 1))).toContain(`${MAX_FORMULA_LENGTH} characters`)
    expect(errorOf(`${'('.repeat(41)}1${')'.repeat(41)}`)).toContain('nested too deeply')
    expect(errorOf(`${'-'.repeat(60)}1`)).toContain('nested too deeply')
    expect(value(`${'('.repeat(30)}1${')'.repeat(30)}`)).toBe(1)
  })

  it('never reaches JavaScript', () => {
    expect(errorOf('constructor')).toContain(`isn't a variable`)
    expect(errorOf('__proto__')).toContain(`isn't a variable`)
    expect(errorOf('alert(1)')).toContain(`isn't a function`)
    expect(errorOf('"x"')).toContain("doesn't understand")
  })

  it('lists the variables a formula uses, once each', () => {
    const parsed = parseFormula('max(wall, gap) * wall + 2')
    expect(parsed.ok && variablesUsed(parsed.value)).toEqual(['wall', 'gap'])
  })

  it('renames a variable without touching longer names or broken text', () => {
    expect(renameVariableIn('wall*2 + walls + min(wall, 1)', 'wall', 'side')).toBe('side*2 + walls + min(side, 1)')
    expect(renameVariableIn('3 # wall', 'wall', 'side')).toBe('3 # wall')
  })
})
