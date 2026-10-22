import { weldMesh } from './weld'

const DEFAULT_MIN_ANGLE = 30

type Vec = readonly [number, number, number]

const at = (values: ArrayLike<number>, i: number): Vec => [values[i * 3] ?? 0, values[i * 3 + 1] ?? 0, values[i * 3 + 2] ?? 0]
const minus = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

function unitNormal(a: Vec, b: Vec, c: Vec): Vec {
  const [u, v] = [minus(b, a), minus(c, a)]
  const n: Vec = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  const length = Math.hypot(...n)
  return length === 0 ? [0, 0, 0] : [n[0] / length, n[1] / length, n[2] / length]
}

const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Each edge (smaller index first) with the normals of the triangles that use it. */
function edgeNormals(vertices: ArrayLike<number>, triangles: ArrayLike<number>): Map<string, { ends: [number, number]; normals: Vec[] }> {
  const edges = new Map<string, { ends: [number, number]; normals: Vec[] }>()
  for (let t = 0; t + 2 < triangles.length; t += 3) {
    const corners = [triangles[t] ?? 0, triangles[t + 1] ?? 0, triangles[t + 2] ?? 0]
    const normal = unitNormal(at(vertices, corners[0] ?? 0), at(vertices, corners[1] ?? 0), at(vertices, corners[2] ?? 0))
    for (let k = 0; k < 3; k++) {
      const [a, b] = [corners[k] ?? 0, corners[(k + 1) % 3] ?? 0]
      const ends: [number, number] = a < b ? [a, b] : [b, a]
      const key = `${ends[0]},${ends[1]}`
      const found = edges.get(key)
      if (found) found.normals.push(normal)
      else edges.set(key, { ends, normals: [normal] })
    }
  }
  return edges
}

/**
 * Line segments (6 floats each) for the edges worth drawing: where two faces meet at more than `minAngleDegrees`,
 * and edges with only one face. Positions are welded first, because OpenCascade's display mesh repeats vertices per face.
 */
export function featureEdges(positions: Float32Array, indices: Uint32Array, minAngleDegrees = DEFAULT_MIN_ANGLE): Float32Array {
  const welded = weldMesh(positions, indices)
  const limit = Math.cos((minAngleDegrees * Math.PI) / 180)
  const lines: number[] = []
  for (const { ends, normals } of edgeNormals(welded.vertices, welded.triangles).values()) {
    const [first, second] = normals
    const sharp = normals.length !== 2 || !first || !second || dot(first, second) < limit
    if (sharp) lines.push(...at(welded.vertices, ends[0]), ...at(welded.vertices, ends[1]))
  }
  return new Float32Array(lines)
}
