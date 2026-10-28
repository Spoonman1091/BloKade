import type { Printer } from '../printers/printers'
import { tidy } from './align'
import type { Box } from './box'
import { updateNode } from './ops'
import { rootAncestorOf } from './tree'
import type { BloKadeDocument, NodeId, Vec3 } from './types'

/** How far to slide a span so it sits inside the plate's edges; a span wider than the plate is centred. */
function pullInside(min: number, max: number, half: number): number {
  if (max - min > 2 * half) return -(min + max) / 2
  if (min < -half) return -half - min
  if (max > half) return half - max
  return 0
}

/** How far to move the part, tidied so float error in a mesh's box (a min z of 1e-7) is no move at all. */
function plateDelta(box: Box, printer: Printer | null): Vec3 {
  const dz = tidy(-box.min[2])
  if (!printer) return [0, 0, dz]
  const [w, d] = printer.size
  return [tidy(pullInside(box.min[0], box.max[0], w / 2)), tidy(pullInside(box.min[1], box.max[1], d / 2)), dz]
}

/** Drops top-level parts onto the floor and, with a printer, back inside its plate edges. */
export function putOnPlate(
  doc: BloKadeDocument, boxes: Readonly<Record<NodeId, Box>>, ids: readonly NodeId[], printer: Printer | null,
): BloKadeDocument {
  const roots = [...new Set(ids.map((id) => rootAncestorOf(doc, id)))]
  return roots.reduce((d, id) => {
    const box = id !== undefined && Object.hasOwn(boxes, id) ? boxes[id] : undefined
    if (id === undefined || !box) return d
    const delta = plateDelta(box, printer)
    if (delta.every((v) => v === 0)) return d
    return updateNode(d, id, (n) => {
      const [x, y, z] = n.transform.position
      return { ...n, transform: { ...n.transform, position: [tidy(x + delta[0]), tidy(y + delta[1]), tidy(z + delta[2])] } }
    })
  }, doc)
}
