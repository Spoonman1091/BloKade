import { rootAncestorOf } from '../document/tree'
import type { BloKadeDocument, Mode, NodeId } from '../document/types'

/** Visible top-level parts (of the given mode) covered by `ids`; selected children count as their top-level group. */
function visibleRoots(doc: BloKadeDocument, mode: Mode, ids?: readonly NodeId[]): NodeId[] {
  const roots = (ids ?? doc.root).map((id) => rootAncestorOf(doc, id))
  return [...new Set(roots)].filter((id): id is NodeId => {
    if (id === undefined || !Object.hasOwn(doc.nodes, id)) return false
    const node = doc.nodes[id]
    return node !== undefined && !node.hidden && node.mode === mode
  })
}

/** Visible, solid, top-level parts to export. Selected children export their whole top-level group. */
export const exportTargets = (doc: BloKadeDocument, ids?: readonly NodeId[]): NodeId[] => visibleRoots(doc, 'solid', ids)

/** Visible top-level holes an export leaves out, because a hole only cuts inside its group. */
export const looseHoles = (doc: BloKadeDocument, ids?: readonly NodeId[]): NodeId[] => visibleRoots(doc, 'hole', ids)
