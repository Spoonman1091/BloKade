// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addModifier, removeModifier } from '../document/modifiers'
import { addNode } from '../document/ops'
import type { EdgeCandidate } from '../geometry/types'
import { createBloKadeStore } from '../store/store'
import { useEdgeCandidates } from './useEdgeCandidates'

const candidate: EdgeCandidate = { fingerprint: { kind: 'line', mid: [0.5, 0, 1], dir: [1, 0, 0], length: 0.5 }, points: [0, 0, 0, 1, 0, 0], picked: true }

function setup(edgeCandidates = vi.fn(async () => [candidate])) {
  const base = addNode(createEmptyDocument(), createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: {}, color: '#f00' }))
  const { doc, modifierId } = addModifier(base, 'b', 'fillet')
  const store = createBloKadeStore({ designId: 'd', doc })
  renderHook(() => useEdgeCandidates(store, { edgeCandidates }))
  return { store, modifierId, edgeCandidates }
}

describe('useEdgeCandidates', () => {
  it('fetches candidate edges while picking and again after the design changes', async () => {
    const { store, modifierId, edgeCandidates } = setup()
    store.getState().setPickingEdges({ nodeId: 'b', modifierId })
    await waitFor(() => expect(store.getState().edgeCandidates).toEqual([candidate]))
    store.getState().apply((d) => ({ ...d, name: 'Changed' }))
    await waitFor(() => expect(edgeCandidates).toHaveBeenCalledTimes(2))
  })

  it('stops picking when the modifier is deleted', async () => {
    const { store, modifierId } = setup()
    store.getState().setPickingEdges({ nodeId: 'b', modifierId })
    store.getState().apply((d) => removeModifier(d, 'b', modifierId))
    await waitFor(() => expect(store.getState().pickingEdges).toBeNull())
  })

  it('explains a failure and stops picking', async () => {
    const { store, modifierId } = setup(vi.fn(async () => { throw new Error('This part has a problem.') }))
    store.getState().setPickingEdges({ nodeId: 'b', modifierId })
    await waitFor(() => expect(store.getState().notice).toBe('This part has a problem.'))
    expect(store.getState().pickingEdges).toBeNull()
  })
})
