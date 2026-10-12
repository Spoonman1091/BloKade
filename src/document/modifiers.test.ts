import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from './factory'
import {
  addModifier, clampModifierField, createModifier, modifiersOf, moveModifier, removeModifier, sameFingerprint,
  setEdgeSelection, setMirror, setModifierEnabled, setPatternAxis, setPickedEdges, togglePicked, updateModifier,
} from './modifiers'
import { addNode, DocumentOpError } from './ops'
import type { BloKadeDocument, EdgeFingerprint } from './types'

const setup = (): BloKadeDocument =>
  addNode(createEmptyDocument(), createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: {}, color: '#f00' }))
const mods = (doc: BloKadeDocument) => {
  const node = doc.nodes.b
  return node ? modifiersOf(node) : []
}
const fp = (x: number): EdgeFingerprint => ({ kind: 'line', mid: [x, 0, 1], dir: [1, 0, 0], length: 0.5 })

describe('modifier operations', () => {
  it('adds modifiers with friendly defaults and unique 8-character ids', () => {
    const first = addModifier(setup(), 'b', 'fillet')
    const second = addModifier(first.doc, 'b', 'fillet')
    expect(first.modifierId).toMatch(/^[a-f0-9]{8}$/)
    expect(second.modifierId).not.toBe(first.modifierId)
    expect(mods(second.doc)[0]).toEqual({ id: first.modifierId, type: 'fillet', enabled: true, radius: 2, edges: { by: 'description', which: 'top' } })
  })

  it('has defaults for every type', () => {
    expect(createModifier('chamfer', 'aaaaaaaa')).toMatchObject({ distance: 1, edges: { by: 'description', which: 'top' } })
    expect(createModifier('linearPattern', 'aaaaaaaa')).toMatchObject({ count: 3, spacing: [25, 0, 0] })
    expect(createModifier('circularPattern', 'aaaaaaaa')).toMatchObject({ count: 6, axis: 'z', angle: 360, center: [0, 0, 0] })
    expect(createModifier('mirror', 'aaaaaaaa')).toMatchObject({ plane: 'YZ', keepOriginal: true })
  })

  it('stops at 10 modifiers per part', () => {
    const full = Array.from({ length: 10 }).reduce<BloKadeDocument>((d) => addModifier(d, 'b', 'mirror').doc, setup())
    expect(() => addModifier(full, 'b', 'mirror')).toThrow('up to 10 modifiers')
  })

  it('reorders, toggles and removes modifiers', () => {
    const a = addModifier(setup(), 'b', 'fillet')
    const b = addModifier(a.doc, 'b', 'mirror')
    const moved = moveModifier(b.doc, 'b', b.modifierId, -1)
    expect(mods(moved).map((m) => m.type)).toEqual(['mirror', 'fillet'])
    expect(moveModifier(moved, 'b', b.modifierId, -1)).toBe(moved)
    expect(mods(setModifierEnabled(moved, 'b', a.modifierId, false))[1]?.enabled).toBe(false)
    const removed = removeModifier(moved, 'b', b.modifierId)
    expect(mods(removed).map((m) => m.type)).toEqual(['fillet'])
    expect(removeModifier(removed, 'b', a.modifierId).nodes.b?.modifiers).toBeUndefined()
  })

  it('explains missing parts and modifiers', () => {
    expect(() => addModifier(setup(), 'nope', 'fillet')).toThrow(DocumentOpError)
    expect(() => removeModifier(setup(), 'b', 'deadbeef')).toThrow('That modifier no longer exists.')
    const a = addModifier(setup(), 'b', 'fillet')
    expect(() => updateModifier(a.doc, 'b', a.modifierId, (m) => ({ ...m, id: 'other123' }))).toThrow(DocumentOpError)
  })

  it('changes edge choices only on Round and Bevel edges', () => {
    const a = addModifier(setup(), 'b', 'fillet')
    const bottom = setEdgeSelection(a.doc, 'b', a.modifierId, { by: 'description', which: 'bottom' })
    expect(mods(bottom)[0]).toMatchObject({ edges: { by: 'description', which: 'bottom' } })
    const picked = setPickedEdges(bottom, 'b', a.modifierId, [fp(0.5)])
    expect(mods(picked)[0]).toMatchObject({ edges: { by: 'picked', fingerprints: [fp(0.5)] } })
    expect(() => setPickedEdges(a.doc, 'b', a.modifierId, Array.from({ length: 101 }, (_, i) => fp(i / 101)))).toThrow('up to 100')
    const m = addModifier(setup(), 'b', 'mirror')
    expect(() => setEdgeSelection(m.doc, 'b', m.modifierId, { by: 'description', which: 'all' })).toThrow(DocumentOpError)
  })

  it('changes pattern axes and mirror settings', () => {
    const c = addModifier(setup(), 'b', 'circularPattern')
    expect(mods(setPatternAxis(c.doc, 'b', c.modifierId, 'x'))[0]).toMatchObject({ axis: 'x' })
    const m = addModifier(setup(), 'b', 'mirror')
    expect(mods(setMirror(m.doc, 'b', m.modifierId, { plane: 'XY', keepOriginal: false }))[0]).toMatchObject({ plane: 'XY', keepOriginal: false })
  })

  it('toggles picked edges by fingerprint', () => {
    expect(togglePicked([fp(0.1)], fp(0.5))).toEqual([fp(0.1), fp(0.5)])
    expect(togglePicked([fp(0.1), fp(0.5)], { ...fp(0.5), mid: [0.5004, 0, 1] })).toEqual([fp(0.1)])
    expect(sameFingerprint(fp(0.1), { ...fp(0.1), kind: 'circle' })).toBe(false)
  })

  it('clamps modifier numbers to safe ranges', () => {
    expect(clampModifierField('radius', 0)).toBe(0.05)
    expect(clampModifierField('distance', 9000)).toBe(500)
    expect(clampModifierField('count', 2.6)).toBe(3)
    expect(clampModifierField('count', 9999)).toBe(50)
    expect(clampModifierField('count', -4)).toBe(1)
    expect(clampModifierField('angle', 720)).toBe(360)
    expect(clampModifierField('spacing', -1e9)).toBe(-2000)
    expect(clampModifierField('center', 12.5)).toBe(12.5)
  })
})
