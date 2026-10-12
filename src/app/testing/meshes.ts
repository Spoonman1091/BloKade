import type { MeshData } from '../../geometry/types'

/** A mesh holding just the 8 corners of a box centered on X/Y and sitting on z = 0. Enough for bounds math. */
export function boxMesh(width: number, depth: number, height: number): MeshData {
  const xs = [-width / 2, width / 2]
  const ys = [-depth / 2, depth / 2]
  const zs = [0, height]
  const corners = xs.flatMap((x) => ys.flatMap((y) => zs.flatMap((z) => [x, y, z])))
  return {
    positions: new Float32Array(corners),
    normals: new Float32Array(corners.length),
    indices: new Uint32Array(0),
    edges: new Float32Array(0),
  }
}
