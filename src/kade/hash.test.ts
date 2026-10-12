import { describe, expect, it } from 'vitest'
import { codeHash } from './hash'

describe('codeHash', () => {
  it('is the same for the same code and different for different code', () => {
    expect(codeHash('return 1')).toBe(codeHash('return 1'))
    expect(codeHash('return 1')).not.toBe(codeHash('return 2'))
  })
  it('makes a short id-safe string', () => {
    expect(codeHash('x'.repeat(10_000))).toMatch(/^[0-9a-f]{8}-[0-9a-z]+$/)
  })
})
