import type { Shape3D } from 'replicad'
import type { BloKadeDocument, NodeId } from '../document/types'
import { NodeBuildError, type Evaluator } from './evaluate'
import { exportTargets } from './export-targets'
import { write3mf } from './export-3mf'
import { EXPORT_QUALITY, toMeshData } from './tessellate'
import type { BuildResult, GeometryApi, NodeBuild } from './types'
import { weldMesh } from './weld'

export class ExportError extends Error {
  override name = 'ExportError'
}

const UNEXPECTED = 'Something went wrong building this part. Try changing its size a little, or undo.'

function buildNode(evaluator: Evaluator, doc: BloKadeDocument, id: NodeId): NodeBuild {
  try {
    return { status: 'ok', mesh: toMeshData(evaluator.local(doc, id)) }
  } catch (error) {
    if (error instanceof NodeBuildError) return { status: 'error', message: error.message }
    console.error('Unexpected geometry failure', error)
    return { status: 'error', message: UNEXPECTED }
  }
}

function rebuild(evaluator: Evaluator, doc: BloKadeDocument): BuildResult {
  evaluator.beginPass()
  try {
    return { nodes: Object.fromEntries(doc.root.map((id) => [id, buildNode(evaluator, doc, id)])) }
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

export function createGeometryApi(evaluator: Evaluator): GeometryApi {
  return {
    rebuild: async (doc) => rebuild(evaluator, doc),
    exportStl: async (doc, ids) => {
      const shape = exportShape(evaluator, doc, ids)
      try {
        return await shape.blobSTL({ binary: true, ...EXPORT_QUALITY }).arrayBuffer()
      } finally {
        shape.delete()
      }
    },
    export3mf: async (doc, ids) => {
      const shape = exportShape(evaluator, doc, ids)
      try {
        const mesh = shape.mesh(EXPORT_QUALITY)
        return new Uint8Array(write3mf(weldMesh(mesh.vertices, mesh.triangles), doc.name)).buffer
      } finally {
        shape.delete()
      }
    },
  }
}
