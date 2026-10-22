import { describe, expect, it } from 'vitest'
import { cubeMesh } from '../geometry/testing/meshes'
import { createEmptyDocument, createShapeNode } from './factory'
import { addNode, groupNodes, removeNodes } from './ops'
import { addImportedPart, containsImported, decodeModel, encodeModel, modelsInUse, withoutUnusedModels } from './models'
import type { Vec3 } from './types'

const SIZE: Vec3 = [10, 10, 10]

function part(name: string, edge = 10) {
  const mesh = cubeMesh(edge)
  return {
    name, vertices: new Float32Array(mesh.vertices), triangles: new Uint32Array(mesh.triangles), size: SIZE, color: '#4f9dff',
  }
}

describe('imported models in the document', () => {
  it('stores a model once and makes a part that uses it', () => {
    const { doc, id } = addImportedPart(createEmptyDocument(), part('Gear'))
    expect(Object.keys(doc.models)).toHaveLength(1)
    expect(doc.nodes[id]).toMatchObject({ shapeType: 'imported', name: 'Gear', mode: 'solid', params: { width: 10, depth: 10, height: 10 } })
    expect(doc.root).toEqual([id])
  })

  it('importing the same model twice stores it once', () => {
    const once = addImportedPart(createEmptyDocument(), part('Gear')).doc
    const twice = addImportedPart(once, part('Gear again')).doc
    expect(Object.keys(twice.models)).toHaveLength(1)
    expect(modelsInUse(removeNodes(twice, [Object.keys(once.nodes)[0]!]))).toEqual(new Set(Object.keys(twice.models)))
  })

  it('round-trips the triangles exactly', () => {
    const mesh = cubeMesh(7.5)
    const vertices = new Float32Array(mesh.vertices)
    const triangles = new Uint32Array(mesh.triangles)
    const { model } = encodeModel('Cube', vertices, triangles)
    const decoded = decodeModel(model)
    expect(decoded.vertices).toEqual(vertices)
    expect(decoded.triangles).toEqual(triangles)
  })

  it('round-trips a model too big for one call to fromCharCode', () => {
    const vertices = Float32Array.from({ length: 90_000 }, (_, i) => i * 0.5)
    const triangles = Uint32Array.from({ length: 30_000 }, (_, i) => i)
    const decoded = decodeModel(encodeModel('Big', vertices, triangles).model)
    expect(decoded.vertices).toEqual(vertices)
    expect(decoded.triangles).toEqual(triangles)
  })

  it('drops a model only from the saved copy', () => {
    const { doc, id } = addImportedPart(createEmptyDocument(), part('Gear'))
    const removed = removeNodes(doc, [id])
    expect(withoutUnusedModels(removed).models).toEqual({})
    expect(removed.models).not.toEqual({})
  })

  it('keeps models that parts still use', () => {
    const { doc } = addImportedPart(createEmptyDocument(), part('Gear'))
    expect(withoutUnusedModels(doc)).toBe(doc)
  })

  it('knows when a group contains an imported part', () => {
    const imported = addImportedPart(createEmptyDocument(), part('Gear'))
    const withBox = addNode(imported.doc, createShapeNode({ shapeType: 'box', name: 'Box', params: {}, color: '#fff', id: 'box1' }))
    const grouped = groupNodes(withBox, [imported.id, 'box1'], 'g1')
    expect(containsImported(grouped.doc, 'g1')).toBe(true)
    expect(containsImported(grouped.doc, imported.id)).toBe(true)
    expect(containsImported(grouped.doc, 'box1')).toBe(false)
  })

  it('stops at 20 models', () => {
    let doc = createEmptyDocument()
    for (let i = 1; i <= 20; i += 1) doc = addImportedPart(doc, part(`M${i}`, i)).doc
    expect(Object.keys(doc.models)).toHaveLength(20)
    expect(() => addImportedPart(doc, part('One too many', 21))).toThrow("This design already has 20 imported models. Delete a part that uses one, then try again.")
    expect(() => addImportedPart(doc, part('Same as one', 5))).not.toThrow()
  })

  it('does not count models no part uses against the limit, and drops them when adding', () => {
    let doc = createEmptyDocument()
    const ids: string[] = []
    for (let i = 1; i <= 20; i += 1) {
      const added = addImportedPart(doc, part(`M${i}`, i))
      doc = added.doc
      ids.push(added.id)
    }
    const emptied = removeNodes(doc, ids)
    expect(Object.keys(emptied.models)).toHaveLength(20)
    const next = addImportedPart(emptied, part('Twenty-first', 21)).doc
    expect(Object.keys(next.models)).toHaveLength(1)
  })
})
