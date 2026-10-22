import { MeshoptSimplifier } from 'meshoptimizer'
import { TOO_DETAILED } from './limits'
import { StlError } from './stl'

export interface IndexedMesh {
  readonly vertices: Float32Array
  readonly triangles: Uint32Array
}

const STRIDE = 3
const TARGET_ERROR = 0.05
/** How many times the rough method may retry, each time allowing twice the error. */
const SLOPPY_RETRIES = 5

/** Keeps only the vertices some triangle uses, renumbering the triangles. */
export function dropUnusedVertices(vertices: Float32Array, triangles: Uint32Array): IndexedMesh {
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

/** The rough method, allowing more error each time until the result fits. Null if it never does. */
function simplifySloppy(vertices: Float32Array, triangles: Uint32Array, target: number): Uint32Array | null {
  for (let attempt = 0; attempt < SLOPPY_RETRIES; attempt += 1) {
    const [result] = MeshoptSimplifier.simplifySloppy(triangles, vertices, STRIDE, null, target, TARGET_ERROR * 2 ** attempt)
    if (result.length <= target) return result.length > 0 ? result : null
  }
  return null
}

/** Reduces a mesh to at most `maxTriangles` triangles, falling back to a rougher method if needed. */
export async function simplifyMesh(vertices: Float32Array, triangles: Uint32Array, maxTriangles: number): Promise<IndexedMesh> {
  await MeshoptSimplifier.ready
  const target = maxTriangles * 3
  const [plain] = MeshoptSimplifier.simplify(triangles, vertices, STRIDE, target, TARGET_ERROR)
  const result = plain.length > target ? simplifySloppy(vertices, triangles, target) : plain
  if (!result) throw new StlError(TOO_DETAILED)
  return dropUnusedVertices(vertices, result)
}
