import { describe, expect, it } from 'vitest'
import { printerById } from '../printers/printers'
import type { Box } from './box'
import { createEmptyDocument, createShapeNode } from './factory'
import { addNode, groupNodes } from './ops'
import { putOnPlate } from './plate'
import type { BloKadeDocument, NodeId, Vec3 } from './types'

const a1 = printerById('bambu-a1-mini')

const part = (id: string, mode: 'solid' | 'hole' = 'solid') =>
  createShapeNode({ id, shapeType: 'box', name: id, params: { width: 20, depth: 20, height: 20 }, color: '#fff', position: [0, 0, 0], mode })
const docOf = (...ids: string[]): BloKadeDocument => ids.reduce((d, id) => addNode(d, part(id)), createEmptyDocument())
const box = (min: Vec3, max: Vec3): Box => ({ min, max })
const posOf = (doc: BloKadeDocument, id: NodeId): Vec3 => {
  const node = doc.nodes[id]
  if (!node) throw new Error(`no node ${id}`)
  return node.transform.position
}
const onPlate = box([-10, -10, 0], [10, 10, 20])

describe('putOnPlate', () => {
  it('drops a raised part to the floor', () => {
    const out = putOnPlate(docOf('a'), { a: box([-10, -10, 10], [10, 10, 30]) }, ['a'], a1)
    expect(posOf(out, 'a')).toEqual([0, 0, -10])
  })

  it('lifts a sunken part to the floor', () => {
    const out = putOnPlate(docOf('a'), { a: box([-10, -10, -5], [10, 10, 15]) }, ['a'], a1)
    expect(posOf(out, 'a')).toEqual([0, 0, 5])
  })

  it('pulls a part back inside each edge of the A1 mini', () => {
    const run = (b: Box) => posOf(putOnPlate(docOf('a'), { a: b }, ['a'], a1), 'a')
    expect(run(box([85, -10, 0], [105, 10, 20]))).toEqual([-15, 0, 0])
    expect(run(box([-105, -10, 0], [-85, 10, 20]))).toEqual([15, 0, 0])
    expect(run(box([-10, -100, 0], [10, -80, 20]))).toEqual([0, 10, 0])
    expect(run(box([-10, 80, 0], [10, 100, 20]))).toEqual([0, -10, 0])
  })

  it('centres a part wider than the plate on that axis', () => {
    const out = putOnPlate(docOf('a'), { a: box([0, -10, 0], [200, 10, 20]) }, ['a'], a1)
    expect(posOf(out, 'a')).toEqual([-100, 0, 0])
  })

  it('only drops without a printer', () => {
    const out = putOnPlate(docOf('a'), { a: box([500, -10, 3], [520, 10, 23]) }, ['a'], null)
    expect(posOf(out, 'a')).toEqual([0, 0, -3])
  })

  it('moves a whole group when a child is selected, and duplicates move once', () => {
    const grouped = groupNodes(docOf('a', 'b'), ['a', 'b'], 'g').doc
    const out = putOnPlate(grouped, { g: box([-10, -10, 4], [10, 10, 24]) }, ['a', 'g'], a1)
    expect(posOf(out, 'g')).toEqual([0, 0, -4])
    expect(posOf(out, 'a')).toEqual([0, 0, 0])
  })

  it('moves selected holes too', () => {
    const doc = addNode(createEmptyDocument(), part('h', 'hole'))
    const out = putOnPlate(doc, { h: box([-10, -10, 7], [10, 10, 27]) }, ['h'], a1)
    expect(posOf(out, 'h')).toEqual([0, 0, -7])
  })

  it('skips parts with no box', () => {
    const doc = docOf('a', 'b')
    const out = putOnPlate(doc, { a: box([-10, -10, 2], [10, 10, 22]) }, ['a', 'b'], a1)
    expect(posOf(out, 'a')).toEqual([0, 0, -2])
    expect(out.nodes['b']).toBe(doc.nodes['b'])
  })

  it('returns the same document when nothing moves', () => {
    const doc = docOf('a')
    expect(putOnPlate(doc, { a: onPlate }, ['a'], a1)).toBe(doc)
  })

  it('writes tidy numbers', () => {
    const doc = docOf('a')
    const out = putOnPlate(doc, { a: box([-10, -10, 0.1 + 0.2], [10, 10, 20]) }, ['a'], a1)
    expect(posOf(out, 'a')[2]).toBe(-0.3)
    const zeroed = putOnPlate(addNode(createEmptyDocument(), { ...part('z'), transform: { ...part('z').transform, position: [0, 0, 0.3] } }),
      { z: box([-10, -10, 0.3], [10, 10, 20]) }, ['z'], a1)
    expect(Object.is(posOf(zeroed, 'z')[2], 0)).toBe(true)
  })
})
