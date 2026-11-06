import type { Manifold, ManifoldToplevel } from 'manifold-3d'
import { fitsBloKade, UNIT_FACTORS, type ImportUnit } from '../app/import-stl'
import { weldMesh } from '../geometry/weld'
import { MAX_STL_BYTES, NO_TRIANGLES, NOT_STL, TOO_BIG_FILE, TOO_LARGE_SIZE } from '../import/limits'
import { parseStl, StlError } from '../import/stl'
import { GAPS_MESSAGE } from './constants'
import type { ModelInfo, SplitResult } from './types'

export interface OpenModel { readonly solid: Manifold; readonly info: ModelInfo }

const fail = (message: string): SplitResult<OpenModel> => ({ ok: false, message })

/** Builds a Manifold from welded, scaled triangles; null when the surface has gaps. */
function solidFrom(wasm: ManifoldToplevel, vertices: Float32Array, triangles: Uint32Array): Manifold | null {
  const mesh = new wasm.Mesh({ numProp: 3, vertProperties: vertices, triVerts: triangles })
  try {
    mesh.merge()
    const solid = wasm.Manifold.ofMesh(mesh)
    if (solid.status() === 'NoError' && !solid.isEmpty()) return solid
    solid.delete()
    return null
  } catch {
    return null
  }
}

/** Reads an STL at full detail, scales it to mm, and rests it on z = 0 centred on x and y. Never throws. */
export function openModel(wasm: ManifoldToplevel, bytes: ArrayBuffer, unit: ImportUnit): SplitResult<OpenModel> {
  if (bytes.byteLength > MAX_STL_BYTES) return fail(TOO_BIG_FILE)
  try {
    const raw = parseStl(bytes)
    const welded = weldMesh(raw.vertices, raw.triangles)
    if (welded.triangles.length === 0) return fail(NO_TRIANGLES)
    const factor = UNIT_FACTORS[unit]
    const scaled = Float32Array.from(welded.vertices, (v) => v * factor)
    const triangles = Uint32Array.from(welded.triangles)
    const loaded = solidFrom(wasm, scaled, triangles)
    if (!loaded) return fail(GAPS_MESSAGE)
    const { min, max } = loaded.boundingBox()
    const placed = loaded.translate([-(min[0] + max[0]) / 2, -(min[1] + max[1]) / 2, -min[2]])
    loaded.delete()
    const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]] as const
    if (!fitsBloKade(size)) {
      placed.delete()
      return fail(TOO_LARGE_SIZE)
    }
    return { ok: true, value: { solid: placed, info: { size, triangleCount: triangles.length / 3 } } }
  } catch (error) {
    if (error instanceof StlError) return fail(error.message)
    console.error('Could not open model for splitting:', error)
    return fail(NOT_STL)
  }
}
