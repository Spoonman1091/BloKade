import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode, groupNodes, removeNodes, updateNode } from '../document/ops'
import type { MeshData } from '../geometry/types'
import { createBloKadeStore } from './store'

const box = (id: string) => createShapeNode({ id, shapeType: 'box', name: id, params: {}, color: '#fff' })
const mesh: MeshData = { positions: new Float32Array(), normals: new Float32Array(), indices: new Uint32Array(), edges: new Float32Array() }

function setup() {
  return createBloKadeStore({ designId: 'd1', doc: createEmptyDocument() })
}

describe('store', () => {
  it('applies edits with undo and redo', () => {
    const store = setup()
    store.getState().apply((d) => addNode(d, box('a')))
    expect(store.getState().history.present.root).toEqual(['a'])
    store.getState().undo()
    expect(store.getState().history.present.root).toEqual([])
    store.getState().redo()
    expect(store.getState().history.present.root).toEqual(['a'])
  })

  it('turns DocumentOpErrors into a notice instead of crashing', () => {
    const store = setup()
    store.getState().apply((d) => groupNodes(d, ['a']).doc)
    expect(store.getState().notice).toBe('Pick at least two parts to group.')
  })

  it('drops deleted parts from the selection', () => {
    const store = setup()
    store.getState().apply((d) => addNode(d, box('a')))
    store.getState().select(['a', 'ghost'])
    expect(store.getState().selection).toEqual(['a'])
    store.getState().apply((d) => removeNodes(d, ['a']))
    expect(store.getState().selection).toEqual([])
  })

  it('applies builds only for the open design', () => {
    const store = setup()
    store.getState().applyBuild('other', { nodes: { a: { status: 'ok', mesh } } })
    expect(store.getState().meshes).toEqual({})
    expect(store.getState().engineReady).toBe(false)
    store.getState().applyBuild('d1', { nodes: { a: { status: 'ok', mesh } } })
    expect(store.getState().meshes.a?.stale).toBe(false)
    expect(store.getState().engineReady).toBe(true)
  })

  it('opens another design with fresh history', () => {
    const store = setup()
    store.getState().apply((d) => addNode(d, box('a')))
    store.getState().openDesign('d2', createEmptyDocument('Other'))
    expect(store.getState().designId).toBe('d2')
    expect(store.getState().history.past).toEqual([])
    expect(store.getState().history.present.name).toBe('Other')
  })

  it('undo brings back a formula that a drag replaced (Review Focus 5)', () => {
    const formulaBox = { ...createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: { width: 30 }, color: '#f00' }), formulas: { 'position.0': 'wall' } }
    const store = createBloKadeStore({ designId: 'd', doc: addNode(createEmptyDocument(), formulaBox) })
    store.getState().apply((d) => updateNode(d, 'b', (n) => ({ ...n, transform: { ...n.transform, position: [12, 0, 0] } })))
    expect(store.getState().history.present.nodes.b?.formulas).toBeUndefined()
    store.getState().undo()
    expect(store.getState().history.present.nodes.b?.formulas).toEqual({ 'position.0': 'wall' })
  })

  it('remembers a workplane, stops picking when one is chosen, and forgets it for another design', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    store.getState().setPickingWorkplane(true)
    expect(store.getState().pickingWorkplane).toBe(true)
    store.getState().setWorkplane({ origin: [1, 2, 3], rotation: [0, 90, 0] })
    expect(store.getState()).toMatchObject({ workplane: { origin: [1, 2, 3], rotation: [0, 90, 0] }, pickingWorkplane: false })
    store.getState().openDesign('other', createEmptyDocument())
    expect(store.getState().workplane).toBeNull()
  })

  it('keeps modifier warnings from the latest build', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    store.getState().applyBuild('d', { nodes: {}, warnings: { a: { aaaaaaaa: 'Lost track of 1 edge' } } })
    expect(store.getState().modifierWarnings).toEqual({ a: { aaaaaaaa: 'Lost track of 1 edge' } })
    store.getState().applyBuild('d', { nodes: {} })
    expect(store.getState().modifierWarnings).toEqual({})
  })

  it('picks edges or a workplane, never both, and forgets both for another design', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    store.getState().setPickingWorkplane(true)
    store.getState().setPickingEdges({ nodeId: 'a', modifierId: 'aaaaaaaa' })
    expect(store.getState()).toMatchObject({ pickingWorkplane: false, pickingEdges: { nodeId: 'a', modifierId: 'aaaaaaaa' }, edgeCandidates: null })
    store.getState().setEdgeCandidates([])
    store.getState().setPickingWorkplane(true)
    expect(store.getState()).toMatchObject({ pickingWorkplane: true, pickingEdges: null, edgeCandidates: null })
    store.getState().setPickingEdges({ nodeId: 'a', modifierId: 'aaaaaaaa' })
    store.getState().openDesign('other', createEmptyDocument())
    expect(store.getState()).toMatchObject({ pickingEdges: null, edgeCandidates: null, modifierWarnings: {} })
  })
})
