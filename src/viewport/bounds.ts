import { Box3, Vector3, type Matrix4 } from 'three'
import type { Box } from '../document/box'
import { transformToMatrix } from '../document/transform-math'
import type { BloKadeDocument, NodeId } from '../document/types'
import type { DisplayedMesh } from '../store/merge-build'

/** The world box of a mesh's points after a placement matrix, or null for an empty mesh. */
export function meshBox(positions: ArrayLike<number>, matrix: Matrix4): Box | null {
  if (positions.length < 3) return null
  const box = new Box3()
  const point = new Vector3()
  for (let i = 0; i + 2 < positions.length; i += 3) {
    box.expandByPoint(point.set(positions[i] ?? 0, positions[i + 1] ?? 0, positions[i + 2] ?? 0).applyMatrix4(matrix))
  }
  return { min: [box.min.x, box.min.y, box.min.z], max: [box.max.x, box.max.y, box.max.z] }
}

export interface NamedBox {
  readonly id: NodeId
  readonly name: string
  readonly box: Box
}

/** World boxes of the visible top-level parts that already have a mesh. */
export function topLevelBoxes(doc: BloKadeDocument, meshes: Readonly<Record<NodeId, DisplayedMesh>>): readonly NamedBox[] {
  return doc.root.flatMap((id) => {
    const node = Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined
    const displayed = Object.hasOwn(meshes, id) ? meshes[id] : undefined
    if (!node || !displayed || node.hidden) return []
    const box = meshBox(displayed.mesh.positions, transformToMatrix(node.transform))
    return box ? [{ id, name: node.name, box }] : []
  })
}
