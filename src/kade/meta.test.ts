import { describe, expect, it } from 'vitest'
import type { CadToolkit } from '../plugins/cad-types'
import { metaToPlugin } from './meta'

describe('metaToPlugin', () => {
  it('makes a plugin entry for the page from the worker\'s report', () => {
    const plugin = metaToPlugin('my-0123456789', {
      name: 'Gear', icon: '⚙️', params: { size: { type: 'mm', default: 40, label: 'Size' } }, size: { x: 'size' }, mode: 'hole', palette: 'fit',
    }, 'abc-1')
    expect(plugin).toMatchObject({
      id: 'my-0123456789', name: 'Gear', icon: '⚙️', version: 1, revision: 'abc-1', toolkit: 'kade',
      params: { size: { type: 'mm', default: 40, label: 'Size' } }, size: { x: 'size' }, mode: 'hole', palette: 'fit',
    })
  })
  it('never builds on the page', () => {
    const plugin = metaToPlugin('my-a', { name: 'A', icon: 'x', params: {} })
    expect(() => plugin.build({}, {} as CadToolkit)).toThrow('built in the geometry worker')
    expect(plugin.revision).toBeUndefined()
  })
})
