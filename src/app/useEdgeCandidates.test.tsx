// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addModifier, removeModifier, setModifierEnabled } from '../document/modifiers'
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

  it('stops picking when the modifier is switched off', async () => {
    const { store, modifierId } = setup()
    store.getState().setPickingEdges({ nodeId: 'b', modifierId })
    store.getState().apply((d) => setModifierEnabled(d, 'b', modifierId, false))
    await waitFor(() => expect(store.getState().pickingEdges).toBeNull())
  })

  it('explains a failure and stops picking', async () => {
    const { store, modifierId } = setup(vi.fn(async () => { throw new Error('This part has a problem.') }))
    store.getState().setPickingEdges({ nodeId: 'b', modifierId })
    await waitFor(() => expect(store.getState().notice).toBe('This part has a problem.'))
    expect(store.getState().pickingEdges).toBeNull()
  })

  describe('stale results', () => {
    interface Deferred { resolve(v: EdgeCandidate[]): void; reject(e: Error): void }
    function deferredSetup() {
      const calls: Deferred[] = []
      const fn = vi.fn(() => new Promise<EdgeCandidate[]>((resolve, reject) => { calls.push({ resolve, reject }) }))
      return { ...setup(fn), calls }
    }
    const other: EdgeCandidate = { ...candidate, picked: false }

    it('ignores a result from before the design changed', async () => {
      const { store, modifierId, calls } = deferredSetup()
      store.getState().setPickingEdges({ nodeId: 'b', modifierId })
      await waitFor(() => expect(calls).toHaveLength(1))
      store.getState().apply((d) => ({ ...d, name: 'Changed' }))
      await waitFor(() => expect(calls).toHaveLength(2))
      await act(async () => { calls[0]?.resolve([candidate]) })
      expect(store.getState().edgeCandidates).toBeNull()
      await act(async () => { calls[1]?.resolve([other]) })
      expect(store.getState().edgeCandidates).toEqual([other])
    })

    it('ignores a result after picking stopped', async () => {
      const { store, modifierId, calls } = deferredSetup()
      store.getState().setPickingEdges({ nodeId: 'b', modifierId })
      await waitFor(() => expect(calls).toHaveLength(1))
      store.getState().setPickingEdges(null)
      await act(async () => { calls[0]?.resolve([candidate]) })
      expect(store.getState().edgeCandidates).toBeNull()
    })

    it('ignores a failure from a stale request', async () => {
      const { store, modifierId, calls } = deferredSetup()
      store.getState().setPickingEdges({ nodeId: 'b', modifierId })
      await waitFor(() => expect(calls).toHaveLength(1))
      store.getState().apply((d) => ({ ...d, name: 'Changed' }))
      await waitFor(() => expect(calls).toHaveLength(2))
      await act(async () => { calls[0]?.reject(new Error('Old problem')) })
      expect(store.getState().notice).toBeNull()
      expect(store.getState().pickingEdges).toEqual({ nodeId: 'b', modifierId })
    })
  })
})
