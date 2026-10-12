import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addModifier, setPickedEdges } from '../document/modifiers'
import { addNode } from '../document/ops'
import type { EdgeFingerprint } from '../document/types'
import { createBloKadeStore } from '../store/store'
import { createEdgeActions } from './edge-actions'

const fp = (x: number): EdgeFingerprint => ({ kind: 'line', mid: [x, 0, 1], dir: [1, 0, 0], length: 0.5 })

function setup() {
  const base = addNode(createEmptyDocument(), createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: {}, color: '#f00' }))
  const { doc, modifierId } = addModifier(base, 'b', 'fillet')
  const store = createBloKadeStore({ designId: 'd', doc })
  const edges = () => {
    const m = store.getState().history.present.nodes.b?.modifiers?.[0]
    return m && (m.type === 'fillet' || m.type === 'chamfer') ? m.edges : undefined
  }
  return { store, actions: createEdgeActions(store), modifierId, edges }
}

describe('edge picking actions', () => {
  it('starts and stops picking', () => {
    const { store, actions, modifierId } = setup()
    actions.startPickingEdges('b', modifierId)
    expect(store.getState().pickingEdges).toEqual({ nodeId: 'b', modifierId })
    actions.stopPickingEdges()
    expect(store.getState().pickingEdges).toBeNull()
  })

  it('starts from the edges the description chooses, then toggles one', () => {
    const { store, actions, modifierId, edges } = setup()
    actions.startPickingEdges('b', modifierId)
    store.getState().setEdgeCandidates([
      { fingerprint: fp(0.1), points: [], picked: true },
      { fingerprint: fp(0.5), points: [], picked: true },
      { fingerprint: fp(0.9), points: [], picked: false },
    ])
    actions.togglePickedEdge(fp(0.5))
    expect(edges()).toEqual({ by: 'picked', fingerprints: [fp(0.1)] })
    actions.togglePickedEdge(fp(0.9))
    expect(edges()).toEqual({ by: 'picked', fingerprints: [fp(0.1), fp(0.9)] })
  })

  it('does nothing when not picking', () => {
    const { store, actions } = setup()
    const before = store.getState().history.present
    actions.togglePickedEdge(fp(0.5))
    expect(store.getState().history.present).toBe(before)
  })

  it('keeps the existing picks when already picking by hand', () => {
    const { store, actions, modifierId, edges } = setup()
    store.getState().apply((d) => setPickedEdges(d, 'b', modifierId, [fp(0.3)]))
    actions.startPickingEdges('b', modifierId)
    actions.togglePickedEdge(fp(0.7))
    expect(edges()).toEqual({ by: 'picked', fingerprints: [fp(0.3), fp(0.7)] })
  })
})
