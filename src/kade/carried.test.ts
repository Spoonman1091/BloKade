import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode, DocumentOpError, removeNodes } from '../document/ops'
import { MAX_CARRIED_SHAPES, type BloKadeDocument } from '../document/types'
import { createBloKadeStore } from '../store/store'
import { carriedInUse, carryShape, outdatedShapes, unaddableNotice, withNewestVersions } from './carried'
import type { LibraryShape } from './library'

const gear = { name: 'Gear', code: 'v1' }
const withParts = (doc: BloKadeDocument, types: readonly string[]): BloKadeDocument =>
  types.reduce((d, shapeType, i) => addNode(d, createShapeNode({ id: `p${i}`, shapeType, name: shapeType, params: {}, color: '#fff' })), doc)
const lib = (id: string, code: string, name = 'Gear'): LibraryShape => ({ id, name, code, updatedAt: 1 })

describe('carried shapes', () => {
  it('copies a shape into a design, and keeps the version its parts use', () => {
    const doc = carryShape(createEmptyDocument(), 'my-gear', gear)
    expect(doc.plugins).toEqual({ 'my-gear': gear })
    const used = addNode(doc, createShapeNode({ id: 'g', shapeType: 'my-gear', name: 'Gear', params: {}, color: '#fff' }))
    expect(carryShape(used, 'my-gear', { name: 'Gear', code: 'v2' })).toBe(used)
  })
  it('copies the newest version when no part uses the old one', () => {
    const doc = carryShape(createEmptyDocument(), 'my-gear', gear)
    expect(carryShape(doc, 'my-gear', { name: 'Big gear', code: 'v2' }).plugins).toEqual({ 'my-gear': { name: 'Big gear', code: 'v2' } })
  })
  it('builds a re-added shape from its newest code after the old part is deleted', () => {
    const part = createShapeNode({ id: 'g', shapeType: 'my-gear', name: 'Gear', params: {}, color: '#fff' })
    const added = addNode(carryShape(createEmptyDocument(), 'my-gear', gear), part)
    const deleted = removeNodes(added, ['g'])
    const again = addNode(carryShape(deleted, 'my-gear', { name: 'Gear', code: 'v2' }), { ...part, id: 'g2' })
    expect(again.plugins['my-gear']?.code).toBe('v2')
  })
  it('replaces an unused copy even when the design is full', () => {
    const plugins = Object.fromEntries(Array.from({ length: MAX_CARRIED_SHAPES }, (_, i) => [`my-${i}`, gear]))
    const full = { ...createEmptyDocument(), plugins }
    expect(carryShape(full, 'my-0', { name: 'Gear', code: 'v2' }).plugins['my-0']?.code).toBe('v2')
  })
  it('refuses more than the limit', () => {
    const full = { ...createEmptyDocument(), plugins: Object.fromEntries(Array.from({ length: MAX_CARRIED_SHAPES }, (_, i) => [`my-${i}`, gear])) }
    expect(() => carryShape(full, 'my-one-more', gear)).toThrow(DocumentOpError)
  })
  it('finds shapes the library has a different version of', () => {
    const doc = { ...createEmptyDocument(), plugins: { 'my-gear': gear, 'my-cup': { name: 'Cup', code: 'same' } } }
    const library = [lib('my-gear', 'v2'), lib('my-cup', 'same', 'Cup'), lib('my-other', 'x')]
    expect(outdatedShapes(withParts(doc, ['my-gear', 'my-cup']), library).map((s) => s.id)).toEqual(['my-gear'])
  })
  it("doesn't call a shape outdated when no part uses it", () => {
    const doc = { ...createEmptyDocument(), plugins: { 'my-gear': gear } }
    expect(outdatedShapes(doc, [lib('my-gear', 'v2')])).toEqual([])
  })
  it('leaves the design alone when nothing is outdated', () => {
    const doc = { ...createEmptyDocument(), plugins: { 'my-gear': gear } }
    expect(withNewestVersions(doc, [lib('my-gear', 'v1')])).toBe(doc)
  })
  it('swaps in the newest versions as one undo step', () => {
    const doc = withParts({ ...createEmptyDocument(), plugins: { 'my-gear': gear } }, ['my-gear'])
    const store = createBloKadeStore({ designId: 'd', doc })
    store.getState().apply((d) => withNewestVersions(d, [lib('my-gear', 'v2', 'Big gear')]))
    expect(store.getState().history.present.plugins).toEqual({ 'my-gear': { name: 'Big gear', code: 'v2' } })
    store.getState().undo()
    expect(store.getState().history.present).toBe(doc)
  })
  it('lists only the carried shapes parts use', () => {
    const doc = withParts({ ...createEmptyDocument(), plugins: { 'my-gear': gear, 'my-cup': { name: 'Cup', code: 'c' } } }, ['my-gear'])
    expect(carriedInUse(doc)).toEqual({ 'my-gear': gear })
  })
  it("names the shape when the design's copy can't be added", () => {
    const doc = withParts({ ...createEmptyDocument(), plugins: { 'my-0a1b2c3d4e': { name: 'Robot head', code: 'bad' } } }, ['my-0a1b2c3d4e'])
    expect(unaddableNotice(doc, 'my-0a1b2c3d4e', { name: 'Robot head', code: 'good' }))
      .toBe("This design's copy of Robot head has a problem. Try the Use my newest version button.")
    expect(unaddableNotice(doc, 'my-0a1b2c3d4e', { name: 'Robot head', code: 'bad' }))
      .toBe("This design's copy of Robot head has a problem. Fix it in 🧩 My shapes.")
    expect(unaddableNotice(doc, 'my-other', { name: 'Cup', code: 'x' })).toBe("Cup isn't ready to add yet. Check it in 🧩 My shapes.")
    expect(unaddableNotice(doc, 'nope', undefined)).toBeNull()
  })
})
