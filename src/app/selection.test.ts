import { describe, expect, it } from 'vitest'
import { nextSelection, toggleInSelection } from './selection'

describe('selection helpers', () => {
  it('toggles ids', () => {
    expect(toggleInSelection(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleInSelection(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('replaces or adds depending on the modifier key', () => {
    expect(nextSelection(['a'], 'b', false)).toEqual(['b'])
    expect(nextSelection(['a'], 'b', true)).toEqual(['a', 'b'])
  })
})
