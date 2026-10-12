import { measureVolume, type Shape3D } from 'replicad'
import { rootAncestorOf } from '../document/tree'
import type { BloKadeDocument, NodeId } from '../document/types'
import { NodeBuildError, type Evaluator } from './evaluate'
import { UNEXPECTED } from './messages'
import { toMeshData } from './tessellate'
import type { OverlapResult } from './types'

/** Overlaps this small (mm³) are just faces touching. */
export const MIN_OVERLAP = 0.001

export class OverlapError extends Error {
  override name = 'OverlapError'
}

function placedRoot(evaluator: Evaluator, doc: BloKadeDocument, id: NodeId): Shape3D {
  try {
    return evaluator.placed(doc, id)
  } catch (error) {
    const reason = error instanceof NodeBuildError ? error.message : UNEXPECTED
    const name = Object.hasOwn(doc.nodes, id) ? doc.nodes[id]?.name ?? id : id
    throw new OverlapError(`Can't check yet: "${name}" has a problem. ${reason}`)
  }
}

function rootOf(doc: BloKadeDocument, id: NodeId): NodeId | undefined {
  return Object.hasOwn(doc.nodes, id) ? rootAncestorOf(doc, id) : undefined
}

function rootsOf(doc: BloKadeDocument, a: NodeId, b: NodeId): [NodeId, NodeId] {
  const ra = rootOf(doc, a)
  const rb = rootOf(doc, b)
  if (ra === undefined || rb === undefined || ra === rb) throw new OverlapError('Pick two separate parts to check.')
  return [ra, rb]
}

/** Volume of a shape, or 0 when OpenCascade can't measure it (an empty intersection). */
function volumeOrZero(shape: Shape3D): number {
  try {
    return measureVolume(shape)
  } catch {
    return 0
  }
}

/** Where two top-level parts collide. Selected children count as their top-level part. Cached shapes are never freed. */
export function findOverlap(evaluator: Evaluator, doc: BloKadeDocument, a: NodeId, b: NodeId): OverlapResult {
  const [ra, rb] = rootsOf(doc, a, b)
  const common = placedRoot(evaluator, doc, ra).intersect(placedRoot(evaluator, doc, rb))
  try {
    const volume = volumeOrZero(common)
    return volume > MIN_OVERLAP ? { status: 'overlap', volume, mesh: toMeshData(common) } : { status: 'none' }
  } finally {
    common.delete()
  }
}
