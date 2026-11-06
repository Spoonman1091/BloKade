import { zipSync } from 'fflate'
import type { PieceMesh } from './types'

const HEADER_BYTES = 80
const TRIANGLE_BYTES = 50

/** A binary STL (mm) for an indexed mesh. Normals come from the triangle corners. */
export function binaryStl(vertices: Float32Array, triangles: Uint32Array): Uint8Array {
  const count = triangles.length / 3
  const out = new Uint8Array(HEADER_BYTES + 4 + count * TRIANGLE_BYTES)
  const view = new DataView(out.buffer)
  view.setUint32(HEADER_BYTES, count, true)
  const at = (index: number, axis: number): number => vertices[index * 3 + axis] ?? 0
  for (let t = 0; t < count; t++) {
    const [a, b, c] = [triangles[t * 3] ?? 0, triangles[t * 3 + 1] ?? 0, triangles[t * 3 + 2] ?? 0]
    const u = [0, 1, 2].map((k) => at(b, k) - at(a, k))
    const w = [0, 1, 2].map((k) => at(c, k) - at(a, k))
    const normal = [
      (u[1] ?? 0) * (w[2] ?? 0) - (u[2] ?? 0) * (w[1] ?? 0),
      (u[2] ?? 0) * (w[0] ?? 0) - (u[0] ?? 0) * (w[2] ?? 0),
      (u[0] ?? 0) * (w[1] ?? 0) - (u[1] ?? 0) * (w[0] ?? 0),
    ]
    const length = Math.hypot(...normal) || 1
    const base = HEADER_BYTES + 4 + t * TRIANGLE_BYTES
    normal.forEach((n, k) => view.setFloat32(base + k * 4, n / length, true))
    ;[a, b, c].forEach((corner, ci) => {
      for (let axis = 0; axis < 3; axis++) view.setFloat32(base + 12 + (ci * 3 + axis) * 4, at(corner, axis), true)
    })
  }
  return out
}

/** The piece moved so it rests on z = 0 and is centred on x and y. */
function laidFlat(piece: PieceMesh): Float32Array {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < piece.vertices.length; i++) {
    const v = piece.vertices[i] ?? 0
    min[i % 3] = Math.min(min[i % 3] ?? v, v)
    max[i % 3] = Math.max(max[i % 3] ?? v, v)
  }
  const shift = [-((min[0] ?? 0) + (max[0] ?? 0)) / 2, -((min[1] ?? 0) + (max[1] ?? 0)) / 2, -(min[2] ?? 0)]
  return Float32Array.from(piece.vertices, (v, i) => v + (shift[i % 3] ?? 0))
}

/** One STL per piece (`name-1.stl`, ...), each flat on z = 0 and centred, zipped. */
export function zipPieces(name: string, pieces: readonly PieceMesh[]): Uint8Array {
  const files = Object.fromEntries(pieces.map((piece) => [`${name}-${piece.number}.stl`, binaryStl(laidFlat(piece), piece.triangles)]))
  return zipSync(files, { level: 0 })
}

/** "Punisher Chest Plate.stl" becomes "punisher-chest-plate". */
export function baseName(fileName: string): string {
  const stem = fileName.trim().replace(/\.stl$/i, '')
  const slug = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'model'
}
