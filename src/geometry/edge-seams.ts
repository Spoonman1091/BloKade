import { getOC, type Edge, type Face, type Shape3D } from 'replicad'

/** Faces meeting at less than this angle (radians) count as one smooth surface. */
const SMOOTH_ANGLE = 1e-3

interface Adjacency {
  readonly faces: number[]
  closed: boolean
}

/** Index of each edge by replicad hash code; several edges can share a code, so isSame() confirms. */
function indexEdges(edges: readonly Edge[]): ReadonlyMap<number, readonly number[]> {
  return edges.reduce((map, edge, i) => map.set(edge.hashCode, [...(map.get(edge.hashCode) ?? []), i]), new Map<number, number[]>())
}

/** Which faces each shape edge bounds, and whether it bounds one face on both sides. */
function adjacency(edges: readonly Edge[], faces: readonly Face[]): Adjacency[] {
  const byHash = indexEdges(edges)
  const found: Adjacency[] = edges.map(() => ({ faces: [], closed: false }))
  const oc = getOC()
  faces.forEach((face, f) => {
    for (const faceEdge of face.edges) {
      try {
        const i = (byHash.get(faceEdge.hashCode) ?? []).find((j) => edges[j]?.isSame(faceEdge))
        const entry = i === undefined ? undefined : found[i]
        if (entry && !entry.faces.includes(f)) entry.faces.push(f)
        if (entry && oc.BRep_Tool.IsClosed(faceEdge.wrapped, face.wrapped)) entry.closed = true
      } finally {
        faceEdge.delete()
      }
    }
  })
  return found
}

function isSmooth(edge: Edge, a: Face, b: Face): boolean {
  const oc = getOC()
  return oc.BRepLib.ContinuityOfFaces(edge.wrapped, a.wrapped, b.wrapped, SMOOTH_ANGLE) !== oc.GeomAbs_Shape.GeomAbs_C0
}

/**
 * For each edge (in `edges` order), whether it is a seam rather than a crease: a surface meeting itself
 * (a cylinder's side line) or two faces flowing smoothly into each other (the halves of a ring).
 * Neither can be rounded or bevelled. `edges` must be `shape.edges`; the caller still owns them.
 */
export function seamFlags(shape: Shape3D, edges: readonly Edge[]): boolean[] {
  const faces = shape.faces
  try {
    return adjacency(edges, faces).map((adj, i) => {
      const [a, b] = adj.faces.map((f) => faces[f])
      const edge = edges[i]
      if (adj.closed || adj.faces.length === 1) return true
      return adj.faces.length === 2 && edge !== undefined && a !== undefined && b !== undefined && isSmooth(edge, a, b)
    })
  } finally {
    faces.forEach((f) => f.delete())
  }
}
