import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { DocumentOpError } from '../document/ops'
import { MAX_CARRIED_SHAPES } from '../document/types'
import { createBloKadeStore } from '../store/store'
import { carryShape, outdatedShapes, withNewestVersions } from './carried'
import type { LibraryShape } from './library'

const gear = { name: 'Gear', code: 'v1' }
const lib = (id: string, code: string, name = 'Gear'): LibraryShape => ({ id, name, code, updatedAt: 1 })

describe('carried shapes', () => {
  it('copies a shape into a design once', () => {
    const doc = carryShape(createEmptyDocument(), 'my-gear', gear)
    expect(doc.plugins).toEqual({ 'my-gear': gear })
    expect(carryShape(doc, 'my-gear', { name: 'Gear', code: 'v2' })).toBe(doc)
  })
  it('refuses more than the limit', () => {
    const full = { ...createEmptyDocument(), plugins: Object.fromEntries(Array.from({ length: MAX_CARRIED_SHAPES }, (_, i) => [`my-${i}`, gear])) }
    expect(() => carryShape(full, 'my-one-more', gear)).toThrow(DocumentOpError)
  })
  it('finds shapes the library has a different version of', () => {
    const doc = { ...createEmptyDocument(), plugins: { 'my-gear': gear, 'my-cup': { name: 'Cup', code: 'same' } } }
    const library = [lib('my-gear', 'v2'), lib('my-cup', 'same', 'Cup'), lib('my-other', 'x')]
    expect(outdatedShapes(doc, library).map((s) => s.id)).toEqual(['my-gear'])
  })
  it('leaves the design alone when nothing is outdated', () => {
    const doc = { ...createEmptyDocument(), plugins: { 'my-gear': gear } }
    expect(withNewestVersions(doc, [lib('my-gear', 'v1')])).toBe(doc)
  })
  it('swaps in the newest versions as one undo step', () => {
    const doc = { ...createEmptyDocument(), plugins: { 'my-gear': gear } }
    const store = createBloKadeStore({ designId: 'd', doc })
    store.getState().apply((d) => withNewestVersions(d, [lib('my-gear', 'v2', 'Big gear')]))
    expect(store.getState().history.present.plugins).toEqual({ 'my-gear': { name: 'Big gear', code: 'v2' } })
    store.getState().undo()
    expect(store.getState().history.present).toBe(doc)
  })
})
