import { describe, expect, it } from 'vitest'
import { findSyntaxProblem } from './syntax'

describe('findSyntaxProblem', () => {
  it('is happy with good code', () => {
    expect(findSyntaxProblem("export default { name: 'A', build(s, cad) { return cad.box(1, 2, 3) } }")).toBeNull()
  })
  it('finds a missing bracket and says which line', () => {
    const code = ['export default {', "  name: 'A',", '  build(s, cad) {', '    return cad.box(1, 2, 3', '  },', '}'].join('\n')
    expect(findSyntaxProblem(code)).toMatch(/^Line [45]: something here doesn't look right/)
  })
  it('finds a missing quote', () => {
    expect(findSyntaxProblem("export default { name: 'A }")).toMatch(/^Line 1:/)
  })
  it('is happy with an empty file (the definition check explains what is missing)', () => {
    expect(findSyntaxProblem('')).toBeNull()
  })
})
