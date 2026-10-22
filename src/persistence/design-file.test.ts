import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addImportedPart } from '../document/models'
import { addNode, removeNodes } from '../document/ops'
import { cubeMesh } from '../geometry/testing/meshes'
import { fileNameFor, parseDesignFile, serializeDesign } from './design-file'

function importedGear() {
  const mesh = cubeMesh(10)
  return addImportedPart(createEmptyDocument('Gears'), {
    name: 'Gear', vertices: new Float32Array(mesh.vertices), triangles: new Uint32Array(mesh.triangles), size: [10, 10, 10], color: '#fff',
  })
}

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

  it('keeps carried shapes through save and load', () => {
    const doc = { ...createEmptyDocument('Gears'), plugins: { 'my-0123456789': { name: 'Gear', code: 'export default {}' } } }
    const loaded = parseDesignFile(serializeDesign(doc))
    expect(loaded.ok && loaded.value.plugins).toEqual(doc.plugins)
  })

  it('leaves unused models out of the saved file', () => {
    const { doc, id } = importedGear()
    const removed = removeNodes(doc, [id])
    const loaded = parseDesignFile(serializeDesign(removed))
    expect(loaded.ok && loaded.value.models).toEqual({})
  })

  it('keeps a model its part uses through save and load', () => {
    const { doc } = importedGear()
    expect(parseDesignFile(serializeDesign(doc))).toEqual({ ok: true, value: doc })
  })

  it('still opens a design whose part names a model that is missing', () => {
    const { doc } = importedGear()
    const orphaned = { ...doc, models: {} }
    expect(parseDesignFile(serializeDesign(orphaned)).ok).toBe(true)
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
    expect(result.value.schemaVersion).toBe(5)
    expect(result.value.settings).toEqual({ gridSnap: 0.5, fit: 0.2 })
    expect(result.value.variables).toEqual([])
    expect(result.value.nodes.a).toMatchObject({
      params: { width: 30, depth: 20, height: 10 },
      transform: { position: [1, 2, 0], rotation: [0, 0, 45] },
    })
  })
})
