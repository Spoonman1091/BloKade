import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createGroupNode, createShapeNode } from './factory'
import { validateDocument } from './schema'
import type { BloKadeDocument, SceneNode } from './types'

const box = (id: string) =>
  createShapeNode({ id, shapeType: 'box', name: 'Box', params: { width: 10 }, color: '#ff0000' })

function docWith(nodes: readonly SceneNode[], root: readonly string[]): BloKadeDocument {
  return { ...createEmptyDocument('Test'), root, nodes: Object.fromEntries(nodes.map((n) => [n.id, n])) }
}

function errorOf(raw: unknown): string {
  const result = validateDocument(raw)
  if (result.ok) throw new Error('expected validation to fail')
  return result.error
}

describe('validateDocument', () => {
  it('accepts a valid nested document', () => {
    const doc = docWith([box('a'), box('b'), createGroupNode({ id: 'g', children: ['b'] })], ['a', 'g'])
    const result = validateDocument(doc)
    expect(result).toEqual({ ok: true, value: doc })
  })

  it('rejects a group that points at a missing part', () => {
    const doc = docWith([createGroupNode({ id: 'g', children: ['ghost'] })], ['g'])
    expect(errorOf(doc)).toContain('Missing part')
  })

  it('rejects a part listed twice', () => {
    const doc = docWith([box('a'), createGroupNode({ id: 'g', children: ['a'] })], ['a', 'g'])
    expect(errorOf(doc)).toContain('more than once')
  })

  it('rejects a cycle of groups', () => {
    const doc = docWith(
      [createGroupNode({ id: 'g1', children: ['g2'] }), createGroupNode({ id: 'g2', children: ['g1'] })],
      ['g1'],
    )
    expect(errorOf(doc)).toContain('more than once')
  })

  it('rejects parts that are not connected to the design', () => {
    expect(errorOf(docWith([box('a'), box('orphan')], ['a']))).toContain('not connected')
  })

  it('rejects a node whose id does not match its key', () => {
    const doc = { ...docWith([box('a')], ['a']), nodes: { a: box('different') } }
    expect(errorOf(doc)).toContain('mismatched id')
  })

  it('rejects an unknown schema version', () => {
    expect(errorOf({ ...createEmptyDocument(), schemaVersion: 2 })).toContain('damaged')
  })

  it('rejects things that are not designs at all', () => {
    expect(errorOf('hello')).toContain('damaged')
    expect(errorOf(null)).toContain('damaged')
  })
})
