import { BufferAttribute, BufferGeometry } from 'three'
import type { MeshData } from '../geometry/types'

export function toBufferGeometry(mesh: MeshData): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(mesh.positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(mesh.normals, 3))
  geometry.setIndex(new BufferAttribute(mesh.indices, 1))
  geometry.computeBoundingSphere()
  return geometry
}

export function toEdgeGeometry(mesh: MeshData): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(mesh.edges, 3))
  return geometry
}
