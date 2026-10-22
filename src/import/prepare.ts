import { countOpenEdges, weldMesh } from '../geometry/weld'
import type { Vec3 } from '../document/types'
import { MAX_IMPORT_TRIANGLES, MAX_STL_BYTES, NOT_STL, TOO_BIG_FILE } from './limits'
import { simplifyMesh } from './simplify'
import { parseStl, StlError } from './stl'

export interface PreparedModel {
  /** Welded, in the file's units, centred on x/y, min z = 0. */
  readonly vertices: Float32Array
  readonly triangles: Uint32Array
  /** Width, depth, height in the file's units. */
  readonly size: Vec3
  readonly triangleCount: number
  readonly simplified: boolean
  readonly hasGaps: boolean
}

export type PrepareResult =
  | { readonly ok: true; readonly model: PreparedModel }
  | { readonly ok: false; readonly message: string }

interface Bounds { readonly min: Vec3; readonly max: Vec3 }

function boundsOf(vertices: Float32Array): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < vertices.length; i++) {
    const axis = i % 3
    const v = vertices[i] ?? 0
    if (v < (min[axis] ?? 0)) min[axis] = v
    if (v > (max[axis] ?? 0)) max[axis] = v
  }
  return { min, max }
}

/** Moves the model so it is centred on x and y and rests on z = 0. */
function centred(vertices: Float32Array, { min, max }: Bounds): Float32Array {
  const offset = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, min[2]]
  return vertices.map((v, i) => v - (offset[i % 3] ?? 0))
}

async function prepare(buffer: ArrayBuffer, maxTriangles: number): Promise<PreparedModel> {
  const raw = parseStl(buffer)
  const welded = weldMesh(raw.vertices, raw.triangles)
  const weldedMesh = { vertices: Float32Array.from(welded.vertices), triangles: Uint32Array.from(welded.triangles) }
  const simplified = weldedMesh.triangles.length / 3 > maxTriangles
  const { vertices, triangles } = simplified
    ? await simplifyMesh(weldedMesh.vertices, weldedMesh.triangles, maxTriangles)
    : weldedMesh
  const bounds = boundsOf(vertices)
  const size: Vec3 = [bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]]
  return {
    vertices: centred(vertices, bounds),
    triangles,
    size,
    triangleCount: triangles.length / 3,
    simplified,
    hasGaps: countOpenEdges(triangles) > 0,
  }
}

/** Reads an STL, welds it, simplifies it if needed, centres and measures it. Never throws. */
export async function prepareStl(buffer: ArrayBuffer, maxTriangles = MAX_IMPORT_TRIANGLES): Promise<PrepareResult> {
  if (buffer.byteLength > MAX_STL_BYTES) return { ok: false, message: TOO_BIG_FILE }
  try {
    return { ok: true, model: await prepare(buffer, maxTriangles) }
  } catch (error) {
    if (error instanceof StlError) return { ok: false, message: error.message }
    console.error('Could not prepare STL:', error)
    return { ok: false, message: NOT_STL }
  }
}
