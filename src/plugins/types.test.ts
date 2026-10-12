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

  it('hands text params to build as strings', () => {
    const plugin = definePlugin({
      id: 'label',
      name: 'Label',
      icon: 'x',
      version: 1,
      params: {
        text: { type: 'text', default: 'Kade', label: 'Text' },
        size: { type: 'mm', default: 4, label: 'Size' },
      },
      size: {
        // @ts-expect-error size handles can only change number params
        x: 'text',
        y: 'size',
      },
      build: ({ text, size }, cad) => {
        const letters: string = text
        return cad.box(size * letters.length, size, size)
      },
    })
    expect(defaultParams(plugin)).toEqual({ text: 'Kade', size: 4 })
  })
})
