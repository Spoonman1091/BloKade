import type { Shape3D } from 'replicad'
import type { BloKadeDocument } from '../document/types'
import { exportShape, NothingToExportError, ExportError } from './api'
import type { Evaluator } from './evaluate'
import { FLOAT_GAP, MIN_OVERHANG_AREA, overhangTriangles, pickedMesh, thinTriangles, type TriangleSoup } from './print-analysis'
import { EXPORT_QUALITY, toMeshData } from './tessellate'
import type { MeshData, PrintCheckResult, PrintIssue } from './types'

export class PrintCheckError extends Error {
  override name = 'PrintCheckError'
}

const CANT_BUILD = "Fix the part that can't build first, then check again."

/** Joins meshes into one, shifting each one's indices past the vertices before it. */
function mergeMeshes(meshes: readonly MeshData[]): MeshData {
  const offsets = meshes.reduce<number[]>((acc, m) => [...acc, (acc.at(-1) ?? 0) + m.positions.length / 3], [])
  const join = (parts: readonly Float32Array[]) => {
    const all = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
    parts.reduce((at, p) => { all.set(p, at); return at + p.length }, 0)
    return all
  }
  return {
    positions: join(meshes.map((m) => m.positions)),
    normals: join(meshes.map((m) => m.normals)),
    indices: Uint32Array.from(meshes.flatMap((m, i) => Array.from(m.indices, (index) => index + (i === 0 ? 0 : offsets[i - 1] ?? 0)))),
    edges: join(meshes.map((m) => m.edges)),
  }
}

/** Separate solids that sit clear above the plate, so they can't stick to it. */
function floatingPieces(fused: Shape3D, plateZ: number): PrintIssue | null {
  const solids = fused.solids
  try {
    const floating = solids.filter((solid) => solid.boundingBox.bounds[0][2] > plateZ + FLOAT_GAP)
    return floating.length > 0 ? { amount: floating.length, mesh: mergeMeshes(floating.map(toMeshData)) } : null
  } finally {
    solids.forEach((solid) => solid.delete())
  }
}

function overhangIssue(soup: TriangleSoup, plateZ: number): PrintIssue | null {
  const { picked, area } = overhangTriangles(soup, plateZ)
  return area >= MIN_OVERHANG_AREA ? { amount: area, mesh: pickedMesh(soup, picked) } : null
}

function fusedForCheck(evaluator: Evaluator, doc: BloKadeDocument): Shape3D | null {
  try {
    return exportShape(evaluator, doc)
  } catch (error) {
    if (error instanceof NothingToExportError) return null
    if (error instanceof ExportError) throw new PrintCheckError(CANT_BUILD)
    throw error
  }
}

/** Looks for floating pieces, thin walls and overhangs in everything that would be exported. */
export function findPrintProblems(evaluator: Evaluator, doc: BloKadeDocument): PrintCheckResult {
  const fused = fusedForCheck(evaluator, doc)
  if (!fused) return { status: 'nothing' }
  try {
    const plateZ = fused.boundingBox.bounds[0][2]
    const soup = fused.mesh(EXPORT_QUALITY)
    const thin = thinTriangles({ vertices: soup.vertices, triangles: soup.triangles })
    return {
      status: 'checked',
      floating: floatingPieces(fused, plateZ),
      thin: thin.picked.length > 0 ? { veryThin: thin.veryThin, mesh: pickedMesh(soup, thin.picked) } : null,
      overhang: overhangIssue(soup, plateZ),
      thinFinished: thin.finished,
    }
  } finally {
    fused.delete()
  }
}
