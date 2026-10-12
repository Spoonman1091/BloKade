import { alignNodes } from '../document/align'
import type { Axis, BoxEdge } from '../document/box'
import type { BloKadeStore } from '../store/store'
import { topLevelBoxes } from '../viewport/bounds'

/** Lines up the current selection using the boxes of the meshes on screen. Problems become notices. */
export function alignSelection(store: BloKadeStore, axis: Axis, edge: BoxEdge): void {
  const { history, meshes, selection, apply } = store.getState()
  const boxes = Object.fromEntries(topLevelBoxes(history.present, meshes).map((b) => [b.id, b.box] as const))
  apply((doc) => alignNodes(doc, boxes, selection, axis, edge))
}
