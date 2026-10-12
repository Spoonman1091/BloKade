import { modifiersOf, setPickedEdges, togglePicked } from '../document/modifiers'
import type { EdgeFingerprint, NodeId } from '../document/types'
import type { BloKadeStore } from '../store/store'

export interface EdgeActions {
  startPickingEdges(nodeId: NodeId, modifierId: string): void
  stopPickingEdges(): void
  /** Adds or removes one edge from the Round/Bevel modifier being picked. */
  togglePickedEdge(fingerprint: EdgeFingerprint): void
}

export function createEdgeActions(store: BloKadeStore): EdgeActions {
  const state = () => store.getState()
  return {
    startPickingEdges: (nodeId, modifierId) => state().setPickingEdges({ nodeId, modifierId }),
    stopPickingEdges: () => state().setPickingEdges(null),
    togglePickedEdge: (fingerprint) => {
      const { pickingEdges, edgeCandidates, history } = state()
      if (!pickingEdges) return
      const nodes = history.present.nodes
      const node = Object.hasOwn(nodes, pickingEdges.nodeId) ? nodes[pickingEdges.nodeId] : undefined
      const modifier = node ? modifiersOf(node).find((m) => m.id === pickingEdges.modifierId) : undefined
      if (!modifier || (modifier.type !== 'fillet' && modifier.type !== 'chamfer')) return
      // The first click by hand starts from the edges the description ("Top edges"…) was choosing.
      const current = modifier.edges.by === 'picked'
        ? modifier.edges.fingerprints
        : (edgeCandidates ?? []).filter((c) => c.picked).map((c) => c.fingerprint)
      state().apply((doc) => setPickedEdges(doc, pickingEdges.nodeId, pickingEdges.modifierId, togglePicked(current, fingerprint)))
    },
  }
}
