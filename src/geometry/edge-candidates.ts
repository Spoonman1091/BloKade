import type { Shape3D } from 'replicad'
import type { EdgeSelection } from '../document/types'
import { edgeInfo, edgePolyline, readEdges, shapeBox } from './edge-info'
import { fingerprintOf, selectedEdges } from './edge-select'
import type { EdgeCandidate } from './types'

/** Every real edge of `shape` as a clickable candidate, marking the ones `selection` chooses now. Does not consume `shape`. */
export function findEdgeCandidates(shape: Shape3D, selection: EdgeSelection): EdgeCandidate[] {
  const box = shapeBox(shape)
  const read = readEdges(shape, (edge, seam) => ({ info: edgeInfo(edge, seam), points: edgePolyline(edge) }))
  const { indices } = selectedEdges(selection, read.map((r) => r.info), box)
  // Seams aren't real edges, so they aren't offered for clicking.
  return read.flatMap((r, i) =>
    (r.info.seam ? [] : [{ fingerprint: fingerprintOf(r.info, box), points: r.points, picked: indices.has(i) }]))
}
