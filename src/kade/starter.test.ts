import { describe, expect, it } from 'vitest'
import { nameInCode, NEW_SHAPE_CODE, renameInCode, uniqueName } from './starter'

describe('starter code helpers', () => {
  it('reads and changes the name in the code', () => {
    expect(nameInCode(NEW_SHAPE_CODE)).toBe('My shape')
    const renamed = renameInCode(NEW_SHAPE_CODE, "Kade's gear")
    expect(nameInCode(renamed)).toBe("Kade's gear")
    expect(renamed).toContain("name: 'Kade\\'s gear'")
    expect(renameInCode('export default { name: "A" }', 'B')).toBe('export default { name: "B" }')
  })
  it('keeps a name steady across renames', () => {
    const once = renameInCode(NEW_SHAPE_CODE, "Kade's gear")
    const twice = renameInCode(once, nameInCode(once) ?? '')
    expect(twice).toBe(once)
    expect(nameInCode(twice)).toBe("Kade's gear")
  })
  it('keeps names within the limit', () => {
    const name = uniqueName('x'.repeat(60), ['x'.repeat(60)], 60)
    expect(name).toHaveLength(60)
    expect(name.endsWith(' 2')).toBe(true)
  })
  it('leaves code without a name alone', () => {
    expect(nameInCode('export default {}')).toBeNull()
    expect(renameInCode('export default {}', 'B')).toBe('export default {}')
  })
  it('makes names unique', () => {
    expect(uniqueName('Gear', ['Robot'])).toBe('Gear')
    expect(uniqueName('Gear', ['Gear', 'Gear 2'])).toBe('Gear 3')
  })
})
