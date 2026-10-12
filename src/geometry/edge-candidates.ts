import type { Shape3D } from 'replicad'
import type { EdgeSelection } from '../document/types'
import { edgeInfo, edgePolyline, shapeBox } from './edge-info'
import { fingerprintOf, selectedEdges } from './edge-select'
import type { EdgeCandidate } from './types'

/** Every edge of `shape` as a clickable candidate, marking the ones `selection` chooses now. Does not consume `shape`. */
export function findEdgeCandidates(shape: Shape3D, selection: EdgeSelection): EdgeCandidate[] {
  const box = shapeBox(shape)
  const read = shape.edges.map((edge) => {
    try {
      return { info: edgeInfo(edge), points: edgePolyline(edge) }
    } finally {
      edge.delete()
    }
  })
  const { indices } = selectedEdges(selection, read.map((r) => r.info), box)
  return read.map((r, i) => ({ fingerprint: fingerprintOf(r.info, box), points: r.points, picked: indices.has(i) }))
}
