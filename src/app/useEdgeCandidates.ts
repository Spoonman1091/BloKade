import { useEffect } from 'react'
import { modifiersOf } from '../document/modifiers'
import type { GeometryClient } from '../geometry/client'
import type { BloKadeStore } from '../store/store'

const NO_EDGES = "BloKade couldn't find this part's edges. Try again."

function pickingStillValid(store: BloKadeStore): boolean {
  const { pickingEdges, history } = store.getState()
  if (!pickingEdges) return false
  const nodes = history.present.nodes
  const node = Object.hasOwn(nodes, pickingEdges.nodeId) ? nodes[pickingEdges.nodeId] : undefined
  const modifier = node ? modifiersOf(node).find((m) => m.id === pickingEdges.modifierId) : undefined
  if (!node || node.hidden) return false
  return modifier?.enabled === true && (modifier.type === 'fillet' || modifier.type === 'chamfer')
}

/** While Kade is picking edges, asks the worker for the clickable edges (again after every design change). */
export function useEdgeCandidates(store: BloKadeStore, client: Pick<GeometryClient, 'edgeCandidates'>): void {
  useEffect(() => {
    const refresh = (): void => {
      const { pickingEdges, history } = store.getState()
      if (!pickingEdges) return
      if (!pickingStillValid(store)) {
        store.getState().setPickingEdges(null)
        return
      }
      const stillCurrent = (): boolean => store.getState().pickingEdges === pickingEdges && store.getState().history.present === history.present
      client.edgeCandidates(history.present, pickingEdges.nodeId, pickingEdges.modifierId).then(
        (candidates) => { if (stillCurrent()) store.getState().setEdgeCandidates(candidates) },
        (error: unknown) => {
          if (!stillCurrent()) return
          store.getState().setPickingEdges(null)
          store.getState().notify(error instanceof Error && error.message ? error.message : NO_EDGES)
        },
      )
    }
    refresh()
    return store.subscribe((next, prev) => {
      const designChanged = next.pickingEdges !== null && next.history.present !== prev.history.present
      // Old edges may mark the wrong ones as picked, so hide them until the new ones arrive.
      if (designChanged && next.edgeCandidates !== null) next.setEdgeCandidates(null)
      if (next.pickingEdges !== prev.pickingEdges || designChanged) refresh()
    })
  }, [store, client])
}
