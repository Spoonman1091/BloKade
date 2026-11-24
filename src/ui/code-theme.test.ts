import { describe, expect, it } from 'vitest'
import { CODE_COLORS } from './code-theme'

describe('code colours', () => {
  it('takes every colour from a CSS variable, so the editor follows dark and light mode', () => {
    expect(CODE_COLORS.length).toBeGreaterThan(5)
    for (const spec of CODE_COLORS) expect(spec.color).toMatch(/^var\(--code-[a-z]+\)$/)
  })
})
