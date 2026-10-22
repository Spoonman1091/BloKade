import type { Shape3D } from 'replicad'
import { containsImported } from '../document/models'
import type { BloKadeDocument, NodeId } from '../document/types'
import type { KadeShapes } from '../kade/kade-shapes'
import { NodeBuildError, type Evaluator } from './evaluate'
import { featureEdges } from './feature-edges'
import { exportTargets } from './export-targets'
import { UNEXPECTED } from './messages'
import { findOverlap, OverlapError } from './overlap'
import { write3mf } from './export-3mf'
import { EXPORT_QUALITY, toMeshData } from './tessellate'
import type { BuildChannel, BuildResult, GeometryApi, NodeBuild } from './types'
import { countOpenEdges, weldMesh } from './weld'

export class ExportError extends Error {
  override name = 'ExportError'
}

const HAS_GAPS = "This shape has tiny gaps, so it can't be saved as 3MF. Try ⬇ STL, or change its size a little."

/** Welded mesh for 3MF. Slicers reject meshes with open edges, so refuse them with a friendly message. */
export function closedMeshFor3mf(
  vertices: ArrayLike<number>, triangles: ArrayLike<number>,
): { vertices: number[]; triangles: number[] } {
  const welded = weldMesh(vertices, triangles)
  if (countOpenEdges(welded.triangles) > 0) throw new ExportError(HAS_GAPS)
  return welded
}

function buildNode(evaluator: Evaluator, doc: BloKadeDocument, id: NodeId): NodeBuild {
  try {
    const mesh = toMeshData(evaluator.local(doc, id))
    // An imported model is a mesh of tiny faces, so draw only its sharp edges instead of every triangle.
    const shown = containsImported(doc, id) ? { ...mesh, edges: featureEdges(mesh.positions, mesh.indices) } : mesh
    return { status: 'ok', mesh: shown }
  } catch (error) {
    if (error instanceof NodeBuildError) return { status: 'error', message: error.message }
    console.error('Unexpected geometry failure', error)
    return { status: 'error', message: UNEXPECTED }
  }
}

function rebuild(evaluator: Evaluator, doc: BloKadeDocument, channel: BuildChannel): BuildResult {
  evaluator.beginPass(channel)
  try {
    const nodes = Object.fromEntries(doc.root.map((id) => [id, buildNode(evaluator, doc, id)]))
    return { nodes, warnings: evaluator.warnings() }
  } finally {
    evaluator.endPass()
  }
}

function placedForExport(evaluator: Evaluator, doc: BloKadeDocument, id: NodeId): Shape3D {
  try {
    return evaluator.placed(doc, id)
  } catch (error) {
    const reason = error instanceof NodeBuildError ? error.message : UNEXPECTED
    const name = Object.hasOwn(doc.nodes, id) ? doc.nodes[id]?.name ?? id : id
    throw new ExportError(`Can't export yet: "${name}" has a problem. ${reason}`)
  }
}

/** One fused solid for export. The caller must delete() it. */
function exportShape(evaluator: Evaluator, doc: BloKadeDocument, ids?: readonly NodeId[]): Shape3D {
  const [first, ...rest] = exportTargets(doc, ids).map((id) => placedForExport(evaluator, doc, id))
  if (!first) throw new ExportError("There's nothing to export. Add a solid shape (holes and hidden parts aren't exported).")
  return rest.reduce((acc, shape) => {
    const next = acc.fuse(shape)
    acc.delete()
    return next
  }, first.clone())
}

export function createGeometryApi(evaluator: Evaluator, shapes: KadeShapes): GeometryApi {
  /**
   * Loads the design's carried shapes, then runs `run` with them. setRegistry and `run` happen with no await
   * between them, so calls that overlap can never build with each other's shapes.
   */
  const withShapes = async <T>(doc: BloKadeDocument, run: () => T): Promise<T> => {
    const registry = await shapes.registryFor(doc)
    evaluator.setRegistry(registry)
    return run()
  }
  const exported = async (doc: BloKadeDocument, ids: readonly NodeId[] | undefined, write: (shape: Shape3D) => Promise<ArrayBuffer> | ArrayBuffer) => {
    const shape = await withShapes(doc, () => exportShape(evaluator, doc, ids))
    try {
      return await write(shape)
    } finally {
      shape.delete()
    }
  }
  return {
    rebuild: (doc, channel = 'design') => withShapes(doc, () => rebuild(evaluator, doc, channel)),
    exportStl: (doc, ids) => exported(doc, ids, (shape) => shape.blobSTL({ binary: true, ...EXPORT_QUALITY }).arrayBuffer()),
    export3mf: (doc, ids) => exported(doc, ids, (shape) => {
      const mesh = shape.mesh(EXPORT_QUALITY)
      return new Uint8Array(write3mf(closedMeshFor3mf(mesh.vertices, mesh.triangles), doc.name)).buffer
    }),
    exportStep: (doc, ids) => exported(doc, ids, (shape) => shape.blobSTEP().arrayBuffer()),
    edgeCandidates: (doc, nodeId, modifierId) => withShapes(doc, () => {
      try {
        return evaluator.edgeCandidates(doc, nodeId, modifierId)
      } catch (error) {
        if (error instanceof NodeBuildError) throw new Error(error.message)
        console.error('Unexpected edge-picking failure', error)
        throw new Error(UNEXPECTED)
      }
    }),
    overlap: (doc, a, b) => withShapes(doc, () => {
      try {
        return findOverlap(evaluator, doc, a, b)
      } catch (error) {
        if (error instanceof OverlapError) throw new Error(error.message)
        console.error('Unexpected overlap failure', error)
        throw new Error(UNEXPECTED)
      }
    }),
    inspect: (code) => shapes.inspect(code),
    skipShapes: async (hashes) => shapes.skip(hashes),
  }
}
