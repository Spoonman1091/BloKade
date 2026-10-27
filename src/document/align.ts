import { boxEdge, unionBox, type Axis, type Box, type BoxEdge } from './box'
import { DocumentOpError, updateNode } from './ops'
import type { BloKadeDocument, NodeId, Vec3 } from './types'

export const tidy = (v: number): number => {
  const r = Math.round(v * 1e6) / 1e6
  return Object.is(r, -0) ? 0 : r
}

const shift = (v: Vec3, axis: Axis, delta: number): Vec3 =>
  [axis === 0 ? tidy(v[0] + delta) : v[0], axis === 1 ? tidy(v[1] + delta) : v[1], axis === 2 ? tidy(v[2] + delta) : v[2]]

/** Moves top-level parts so their chosen edge (or center) matches the whole selection's. */
export function alignNodes(
  doc: BloKadeDocument, boxes: Readonly<Record<NodeId, Box>>, ids: readonly NodeId[], axis: Axis, edge: BoxEdge,
): BloKadeDocument {
  const targets = [...new Set(ids)].flatMap((id) => {
    const box = doc.root.includes(id) && Object.hasOwn(boxes, id) ? boxes[id] : undefined
    return box ? [{ id, box }] : []
  })
  const all = unionBox(targets.map((t) => t.box))
  if (targets.length < 2 || !all) throw new DocumentOpError('Pick two or more parts (not inside a group) to line them up.')
  const goal = boxEdge(all, axis, edge)
  return targets.reduce((d, { id, box }) => {
    const delta = goal - boxEdge(box, axis, edge)
    return delta === 0 ? d : updateNode(d, id, (n) => ({ ...n, transform: { ...n.transform, position: shift(n.transform.position, axis, delta) } }))
  }, doc)
}
