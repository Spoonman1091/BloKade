import { describe, expect, it } from 'vitest'
import { defaultParams } from './params'
import { definePlugin } from './types'

// Type-level regression guard: parameter names must be inferred from `params`, not from `size`.
describe('definePlugin inference', () => {
  it('allows params that no size handle references', () => {
    const plugin = definePlugin({
      id: 'extra',
      name: 'Extra',
      icon: 'x',
      version: 1,
      params: {
        width: { type: 'mm', default: 5, label: 'Width' },
        extra: { type: 'mm', default: 7, label: 'Extra' },
      },
      size: { x: 'width' },
      build: ({ width, extra }, cad) => cad.box(width, extra, 1),
    })
    expect(defaultParams(plugin)).toEqual({ width: 5, extra: 7 })
  })

  it('allows a plugin with no size handles', () => {
    const plugin = definePlugin({
      id: 'nosize',
      name: 'No size',
      icon: 'x',
      version: 1,
      params: { a: { type: 'mm', default: 3, label: 'A' } },
      build: ({ a }, cad) => cad.box(a, a, a),
    })
    expect(defaultParams(plugin)).toEqual({ a: 3 })
  })
})
