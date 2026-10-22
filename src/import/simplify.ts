import { MeshoptSimplifier } from 'meshoptimizer'

export interface IndexedMesh {
  readonly vertices: Float32Array
  readonly triangles: Uint32Array
}

const STRIDE = 3
const TARGET_ERROR = 0.05

/** Keeps only the vertices some triangle uses, renumbering the triangles. */
function dropUnusedVertices(vertices: Float32Array, triangles: Uint32Array): IndexedMesh {
  const newIndex = new Map<number, number>()
  const kept: number[] = []
  const renumbered = triangles.map((old) => {
    let next = newIndex.get(old)
    if (next === undefined) {
      next = newIndex.size
      newIndex.set(old, next)
      kept.push(vertices[old * 3] ?? 0, vertices[old * 3 + 1] ?? 0, vertices[old * 3 + 2] ?? 0)
    }
    return next
  })
  return { vertices: Float32Array.from(kept), triangles: renumbered }
}

/** Reduces a mesh to at most `maxTriangles` triangles, falling back to a rougher method if needed. */
export async function simplifyMesh(vertices: Float32Array, triangles: Uint32Array, maxTriangles: number): Promise<IndexedMesh> {
  await MeshoptSimplifier.ready
  const target = maxTriangles * 3
  let [result] = MeshoptSimplifier.simplify(triangles, vertices, STRIDE, target, TARGET_ERROR)
  if (result.length > target) {
    ;[result] = MeshoptSimplifier.simplifySloppy(triangles, vertices, STRIDE, null, target, TARGET_ERROR)
  }
  return dropUnusedVertices(vertices, result)
}
