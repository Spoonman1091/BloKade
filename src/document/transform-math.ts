import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three'
import { UNCHANGED_EPSILON } from './fields'
import { parentOf } from './tree'
import type { BloKadeDocument, NodeId, Transform, Vec3 } from './types'

const round6 = (v: number): number => {
  const r = Math.round(v * 1e6) / 1e6
  return Object.is(r, -0) ? 0 : r
}

/** The new vector, except components that only moved by rounding noise keep their old value exactly. */
export function keepUnchanged(old: Vec3, next: Vec3): Vec3 {
  const pick = (i: 0 | 1 | 2): number => (Math.abs(next[i] - old[i]) < UNCHANGED_EPSILON ? old[i] : next[i])
  return [pick(0), pick(1), pick(2)]
}

export function transformToMatrix(t: Transform): Matrix4 {
  const [rx, ry, rz] = t.rotation.map(MathUtils.degToRad) as [number, number, number]
  const q = new Quaternion().setFromEuler(new Euler(rx, ry, rz, 'XYZ'))
  return new Matrix4().compose(new Vector3(...t.position), q, new Vector3(1, 1, 1))
}

export function transformFromParts(position: Vec3, rotationRadians: Vec3): Transform {
  return {
    position: [round6(position[0]), round6(position[1]), round6(position[2])],
    rotation: [
      round6(MathUtils.radToDeg(rotationRadians[0])),
      round6(MathUtils.radToDeg(rotationRadians[1])),
      round6(MathUtils.radToDeg(rotationRadians[2])),
    ],
  }
}

export function matrixToTransform(m: Matrix4): Transform {
  const position = new Vector3()
  const q = new Quaternion()
  m.decompose(position, q, new Vector3())
  const e = new Euler().setFromQuaternion(q, 'XYZ')
  return transformFromParts([position.x, position.y, position.z], [e.x, e.y, e.z])
}

/** Placement of a node in world space: product of all ancestor transforms and its own. */
export function worldMatrix(doc: BloKadeDocument, id: NodeId): Matrix4 {
  const node = doc.nodes[id]
  if (!node) throw new Error(`Unknown part ${id}`)
  const local = transformToMatrix(node.transform)
  const parent = parentOf(doc, id)
  return parent ? new Matrix4().multiplyMatrices(worldMatrix(doc, parent), local) : local
}
