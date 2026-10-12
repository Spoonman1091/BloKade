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
    expect(errorOf({ ...createEmptyDocument(), schemaVersion: 3 })).toContain('damaged')
  })

  it('rejects things that are not designs at all', () => {
    expect(errorOf('hello')).toContain('damaged')
    expect(errorOf(null)).toContain('damaged')
  })
})

describe('validateDocument prototype-named ids', () => {
  it('rejects a root id named like an Object.prototype member', () => {
    const doc = docWith([box('a')], ['constructor'])
    expect(errorOf(doc)).toContain('Missing part')
  })

  it('rejects a group child id named like an Object.prototype member', () => {
    const doc = docWith([createGroupNode({ id: 'g', children: ['toString'] })], ['g'])
    expect(errorOf(doc)).toContain('Missing part')
  })

  it('accepts variables, field formulas and text params', () => {
    const shape = { ...box('a'), params: { width: 10, text: 'Kade' }, formulas: { 'param.width': 'wall * 2', 'position.0': 'wall' } }
    const doc = { ...docWith([shape], ['a']), variables: [{ name: 'wall', expr: '5' }] }
    expect(validateDocument(doc).ok).toBe(true)
  })

  it('rejects formulas on unknown fields', () => {
    const shape = { ...box('a'), formulas: { colour: 'red' } }
    expect(errorOf(docWith([shape], ['a']))).toContain('damaged')
  })

  it('rejects duplicate or reserved variable names', () => {
    const base = docWith([], [])
    expect(errorOf({ ...base, variables: [{ name: 'wall', expr: '1' }, { name: 'wall', expr: '2' }] }))
      .toContain('already a variable called "wall"')
    expect(errorOf({ ...base, variables: [{ name: 'fit', expr: '1' }] })).toContain('BloKade already uses "fit"')
  })

  it('rejects an impossible fit gap', () => {
    const doc = docWith([], [])
    expect(errorOf({ ...doc, settings: { ...doc.settings, fit: 5 } })).toContain('damaged')
  })
})
