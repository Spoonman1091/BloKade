import { describe, expect, it } from 'vitest'
import { registry as base } from '../plugins/index'
import { codeHash } from './hash'
import type { LibraryShape } from './library'
import type { InspectResult } from './meta'
import { buildShapeRegistry } from './shape-registry'

const meta = (name: string): InspectResult => ({ ok: true, meta: { name, icon: '🧩', params: {} } })
const lib = (id: string, code: string): LibraryShape => ({ id, name: id, code, updatedAt: 1 })
const results = { [codeHash('gear v2')]: meta('Gear v2'), [codeHash('gear v1')]: meta('Gear v1'), [codeHash('robot')]: meta('Robot'), [codeHash('broken')]: { ok: false, problem: 'x' } as InspectResult }

describe('buildShapeRegistry', () => {
  const shapes = buildShapeRegistry({
    base,
    library: [lib('my-gear', 'gear v2'), lib('my-broken', 'broken'), lib('my-waiting', 'not checked yet')],
    carried: { 'my-gear': { name: 'Gear', code: 'gear v1' }, 'my-robot': { name: 'Robot', code: 'robot' }, box: { name: 'Box?', code: 'robot' } },
    results,
  })

  it('puts the built-ins first, then the library, then shapes only the design carries', () => {
    expect(shapes.list().slice(0, base.list().length)).toEqual(base.list())
    expect(shapes.mine().map((p) => p.name)).toEqual(['Gear v1', 'Robot'])
    expect(shapes.list()).toHaveLength(base.list().length + 2)
  })
  it("uses the design's own version of a shape for its parts", () => {
    expect(shapes.get('my-gear')).toMatchObject({ name: 'Gear v1', revision: codeHash('gear v1'), toolkit: 'kade' })
    expect(shapes.get('my-robot')?.name).toBe('Robot')
  })
  it('never lets a carried shape replace a built-in', () => {
    expect(shapes.get('box')).toBe(base.get('box'))
  })
  it('leaves out shapes that are broken or not checked yet', () => {
    expect(shapes.get('my-broken')).toBeUndefined()
    expect(shapes.get('my-waiting')).toBeUndefined()
  })
  it('uses the library version when the design does not carry the shape', () => {
    const libraryOnly = buildShapeRegistry({ base, library: [lib('my-gear', 'gear v2')], carried: {}, results })
    expect(libraryOnly.get('my-gear')?.name).toBe('Gear v2')
  })
  it("offers the design's own copy in the palette, and leaves it out when that copy is broken or unchecked", () => {
    for (const code of ['broken', 'not checked yet']) {
      const carriedOnly = buildShapeRegistry({ base, library: [lib('my-gear', 'gear v2')], carried: { 'my-gear': { name: 'Gear', code } }, results })
      expect(carriedOnly.mine()).toEqual([])
    }
  })
  it("never falls back to the library when the design's own version is broken or unchecked", () => {
    for (const code of ['broken', 'not checked yet']) {
      const carriedOnly = buildShapeRegistry({ base, library: [lib('my-gear', 'gear v2')], carried: { 'my-gear': { name: 'Gear', code } }, results })
      expect(carriedOnly.get('my-gear')).toBeUndefined()
    }
  })
})
