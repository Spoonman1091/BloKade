import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createGroupNode, createShapeNode } from './factory'
import { descendantsOf, isDescendant, parentOf, rootAncestorOf, siblingsOf } from './tree'
import type { BloKadeDocument, SceneNode } from './types'

const box = (id: string) => createShapeNode({ id, shapeType: 'box', name: id, params: {}, color: '#fff' })

// root: [a, g1]; g1: [b, g2]; g2: [c]
const nodes: SceneNode[] = [
  box('a'), box('b'), box('c'),
  createGroupNode({ id: 'g1', children: ['b', 'g2'] }),
  createGroupNode({ id: 'g2', children: ['c'] }),
]
const doc: BloKadeDocument = {
  ...createEmptyDocument(), root: ['a', 'g1'], nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
}

describe('tree helpers', () => {
  it('finds parents', () => {
    expect(parentOf(doc, 'a')).toBeNull()
    expect(parentOf(doc, 'c')).toBe('g2')
    expect(parentOf(doc, 'nope')).toBeUndefined()
  })

  it('lists siblings', () => {
    expect(siblingsOf(doc, null)).toEqual(['a', 'g1'])
    expect(siblingsOf(doc, 'g1')).toEqual(['b', 'g2'])
    expect(siblingsOf(doc, 'a')).toEqual([])
  })

  it('lists descendants depth-first', () => {
    expect(descendantsOf(doc, 'g1')).toEqual(['b', 'g2', 'c'])
    expect(descendantsOf(doc, 'a')).toEqual([])
  })

  it('checks ancestry', () => {
    expect(isDescendant(doc, 'g1', 'c')).toBe(true)
    expect(isDescendant(doc, 'g2', 'b')).toBe(false)
  })

  it('finds the top-level ancestor', () => {
    expect(rootAncestorOf(doc, 'c')).toBe('g1')
    expect(rootAncestorOf(doc, 'a')).toBe('a')
    expect(rootAncestorOf(doc, 'nope')).toBeUndefined()
  })
})
