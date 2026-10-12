import type { NodeId } from '../document/types'
import type { BuildResult, MeshData } from '../geometry/types'

export interface DisplayedMesh {
  readonly mesh: MeshData
  readonly stale: boolean
}

export function mergeBuild(
  prev: Readonly<Record<NodeId, DisplayedMesh>>, result: BuildResult,
): { meshes: Record<NodeId, DisplayedMesh>; errors: Record<NodeId, string> } {
  const entries = Object.entries(result.nodes)
  const meshes = Object.fromEntries(
    entries.flatMap(([id, build]): [NodeId, DisplayedMesh][] => {
      if (build.status === 'ok') return [[id, { mesh: build.mesh, stale: false }]]
      const old = prev[id]
      return old ? [[id, { mesh: old.mesh, stale: true }]] : []
    }),
  )
  const errors = Object.fromEntries(
    entries.flatMap(([id, build]) => (build.status === 'error' ? [[id, build.message]] : [])),
  )
  return { meshes, errors }
}
