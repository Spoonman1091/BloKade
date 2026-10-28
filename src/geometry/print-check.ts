import type { Shape3D } from 'replicad'
import type { BloKadeDocument } from '../document/types'
import { exportShape, NothingToExportError, ExportError } from './api'
import { shapeBox } from './edge-info'
import type { Evaluator } from './evaluate'
import {
  FLOAT_GAP, MIN_OVERHANG_AREA, MIN_THIN_AREA, overhangTriangles, pickedMesh, thinTriangles, type TriangleSoup,
} from './print-analysis'
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

/** Joins triangle soups into one, shifting each one's indices past the vertices before it. */
function mergeSoups(soups: readonly TriangleSoup[]): TriangleSoup {
  const offsets = soups.reduce<number[]>((acc, m) => [...acc, (acc.at(-1) ?? 0) + m.vertices.length / 3], [0])
  return {
    vertices: soups.flatMap((m) => Array.from(m.vertices)),
    triangles: soups.flatMap((m, i) => Array.from(m.triangles, (index) => index + (offsets[i] ?? 0))),
  }
}

/** Separate solids that sit clear above the plate, so they can't stick to it. */
function floatingIssue(floating: readonly Shape3D[]): PrintIssue | null {
  return floating.length > 0 ? { amount: floating.length, mesh: mergeMeshes(floating.map(toMeshData)) } : null
}

/**
 * Overhangs on the pieces that sit on the plate. A floating piece is already reported as floating,
 * so its bottom isn't called an overhang too.
 */
function overhangIssue(whole: TriangleSoup, grounded: readonly Shape3D[], anyFloating: boolean, plateZ: number): PrintIssue | null {
  const soup = anyFloating
    ? mergeSoups(grounded.map((solid) => {
      const m = solid.mesh(EXPORT_QUALITY)
      return { vertices: m.vertices, triangles: m.triangles }
    }))
    : whole
  const { picked, area } = overhangTriangles(soup, plateZ)
  return area >= MIN_OVERHANG_AREA ? { amount: area, mesh: pickedMesh(soup, picked) } : null
}

/** Floating pieces and overhangs, from the fused shape's separate solids. */
function pieceProblems(
  fused: Shape3D, whole: TriangleSoup, plateZ: number,
): { readonly floating: PrintIssue | null; readonly overhang: PrintIssue | null } {
  const solids = fused.solids
  try {
    const isFloating = solids.map((solid) => shapeBox(solid).min[2] > plateZ + FLOAT_GAP)
    const floating = solids.filter((_, i) => isFloating[i])
    const grounded = solids.filter((_, i) => !isFloating[i])
    return { floating: floatingIssue(floating), overhang: overhangIssue(whole, grounded, floating.length > 0, plateZ) }
  } finally {
    solids.forEach((solid) => solid.delete())
  }
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
    const plateZ = shapeBox(fused).min[2]
    const mesh = fused.mesh(EXPORT_QUALITY)
    const soup: TriangleSoup = { vertices: mesh.vertices, triangles: mesh.triangles }
    const thin = thinTriangles(soup)
    const { floating, overhang } = pieceProblems(fused, soup, plateZ)
    return {
      status: 'checked',
      floating,
      thin: thin.area >= MIN_THIN_AREA ? { veryThin: thin.veryThin, mesh: pickedMesh(soup, thin.picked) } : null,
      overhang,
      thinFinished: thin.finished,
    }
  } finally {
    fused.delete()
  }
}
