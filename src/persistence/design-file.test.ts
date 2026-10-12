import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { fileNameFor, parseDesignFile, serializeDesign } from './design-file'

describe('design files', () => {
  it('round-trips a design', () => {
    const doc = addNode(createEmptyDocument('Phone Stand'), createShapeNode({ shapeType: 'box', name: 'Box', params: { width: 5 }, color: '#fff' }))
    expect(parseDesignFile(serializeDesign(doc))).toEqual({ ok: true, value: doc })
  })

  it('explains files that are not JSON', () => {
    expect(parseDesignFile('not json at all')).toEqual({ ok: false, error: "This file isn't a BloKade design." })
  })

  it('explains damaged designs', () => {
    const result = parseDesignFile(JSON.stringify({ ...createEmptyDocument(), root: ['ghost'] }))
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toContain('damaged')
  })

  it('makes friendly file names', () => {
    expect(fileNameFor(createEmptyDocument("Kade's Phone Stand!"), 'stl')).toBe('kade-s-phone-stand.stl')
    expect(fileNameFor(createEmptyDocument('***'), '3mf')).toBe('design.3mf')
  })

  it('opens a design saved by Milestone 1 and keeps every part', () => {
    const v1 = JSON.stringify({
      schemaVersion: 1, name: 'Old robot', units: 'mm', settings: { gridSnap: 0.5 }, root: ['a'],
      nodes: {
        a: {
          id: 'a', kind: 'shape', name: 'Box', shapeType: 'box', params: { width: 30, depth: 20, height: 10 },
          mode: 'solid', transform: { position: [1, 2, 0], rotation: [0, 0, 45] }, hidden: false, color: '#ff6b6b',
        },
      },
    })
    const result = parseDesignFile(v1)
    if (!result.ok) throw new Error(result.error)
    expect(result.value.schemaVersion).toBe(2)
    expect(result.value.settings).toEqual({ gridSnap: 0.5, fit: 0.2 })
    expect(result.value.variables).toEqual([])
    expect(result.value.nodes.a).toMatchObject({
      params: { width: 30, depth: 20, height: 10 },
      transform: { position: [1, 2, 0], rotation: [0, 0, 45] },
    })
  })
})
