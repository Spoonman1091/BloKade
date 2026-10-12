import { describe, expect, it } from 'vitest'
import { formatNumber, parseNumberInput } from './number-input'

describe('number input helpers', () => {
  it('formats with up to 3 decimals', () => {
    expect(formatNumber(20)).toBe('20')
    expect(formatNumber(1 / 3)).toBe('0.333')
    expect(formatNumber(-0)).toBe('0')
  })

  it('parses numbers and rejects junk', () => {
    expect(parseNumberInput(' 12.5 ')).toBe(12.5)
    expect(parseNumberInput('-3')).toBe(-3)
    expect(parseNumberInput('')).toBeNull()
    expect(parseNumberInput('abc')).toBeNull()
    expect(parseNumberInput('Infinity')).toBeNull()
  })
})
