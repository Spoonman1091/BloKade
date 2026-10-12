import type { Shape3D } from 'replicad'
import type { MeshData } from './types'

export const DISPLAY_QUALITY = { tolerance: 0.1, angularTolerance: 0.3 } as const
export const EXPORT_QUALITY = { tolerance: 0.01, angularTolerance: 0.1 } as const

export function toMeshData(shape: Shape3D): MeshData {
  const mesh = shape.mesh(DISPLAY_QUALITY)
  const edges = shape.meshEdges(DISPLAY_QUALITY)
  return {
    positions: new Float32Array(mesh.vertices),
    normals: new Float32Array(mesh.normals),
    indices: new Uint32Array(mesh.triangles),
    edges: new Float32Array(edges.lines),
  }
}
