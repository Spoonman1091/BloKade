import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createEmptyDocument, createGroupNode, createShapeNode, newId, pickColor, SHAPE_COLORS,
} from './factory'
import { CURRENT_SCHEMA_VERSION, IDENTITY_TRANSFORM } from './types'

afterEach(() => vi.unstubAllGlobals())

describe('newId', () => {
  it('makes 32-character hex ids that differ', () => {
    const a = newId()
    const b = newId()
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(a).not.toBe(b)
  })

  it('works without crypto.randomUUID (plain-HTTP home server)', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) })
    expect(newId()).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('factories', () => {
  it('creates an empty document', () => {
    const doc = createEmptyDocument('Phone Stand')
    expect(doc).toEqual({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      name: 'Phone Stand',
      units: 'mm',
      settings: { gridSnap: 1, fit: 0.2 },
      variables: [],
      root: [],
      nodes: {},
      plugins: {},
      models: {},
    })
  })

  it('creates a solid, visible shape at the origin by default', () => {
    const node = createShapeNode({ shapeType: 'box', name: 'Box', params: { width: 20 }, color: '#ff0000' })
    expect(node).toMatchObject({
      kind: 'shape', shapeType: 'box', name: 'Box', params: { width: 20 }, color: '#ff0000',
      mode: 'solid', hidden: false, transform: IDENTITY_TRANSFORM,
    })
    expect(node.id).toMatch(/^[0-9a-f]{32}$/)
  })

  it('places a shape at a given position', () => {
    const node = createShapeNode({ shapeType: 'box', name: 'Box', params: {}, color: '#fff', position: [1, 2, 3] })
    expect(node.transform.position).toEqual([1, 2, 3])
  })

  it('creates a group', () => {
    const group = createGroupNode({ id: 'g', children: ['a', 'b'] })
    expect(group).toEqual({
      id: 'g', kind: 'group', name: 'Group', children: ['a', 'b'], mode: 'solid',
      hidden: false, color: SHAPE_COLORS[0], transform: IDENTITY_TRANSFORM,
    })
  })

  it('cycles through shape colors', () => {
    expect(pickColor(0)).toBe(SHAPE_COLORS[0])
    expect(pickColor(SHAPE_COLORS.length + 1)).toBe(SHAPE_COLORS[1])
  })

  it('makes hole parts when asked', () => {
    expect(createShapeNode({ shapeType: 'box', name: 'B', params: {}, color: '#fff', mode: 'hole' }).mode).toBe('hole')
    expect(createShapeNode({ shapeType: 'box', name: 'B', params: {}, color: '#fff' }).mode).toBe('solid')
  })

  it('can place a new shape with a rotation', () => {
    const node = createShapeNode({ shapeType: 'box', name: 'Box', params: {}, color: '#f00', position: [1, 2, 3], rotation: [0, 90, 0] })
    expect(node.transform).toEqual({ position: [1, 2, 3], rotation: [0, 90, 0] })
  })
})
