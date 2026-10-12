import { describe, expect, it } from 'vitest'
import { registry } from './index'
import { KITS, kitProblems } from './kits'

describe('kits', () => {
  it('only use real plugins, number params and their own variables', () => {
    expect(kitProblems(KITS, registry)).toEqual([])
    expect(KITS.map((k) => k.id)).toEqual(['peg-socket', 'snap-fit'])
  })

  it('reports broken kits', () => {
    const broken = [{
      id: 'bad', name: 'Bad', icon: '❌', variables: [{ name: 'w', expr: '5' }],
      parts: [
        { shapeType: 'nope', name: 'A', offset: [0, 0, 0], formulas: {} },
        { shapeType: 'peg', name: 'B', offset: [0, 0, 0], formulas: { shape: 'w', size: 'other + 1' } },
      ],
    }] as const
    expect(kitProblems(broken, registry)).toEqual([
      'Kit "Bad": there is no "nope" shape.',
      'Kit "Bad": "shape" on Peg is not a number size.',
      'Kit "Bad": the formula for "size" on Peg uses something besides w and fit.',
    ])
  })
})
