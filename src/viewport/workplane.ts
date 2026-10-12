import { Euler, Quaternion, Vector3, type Object3D } from 'three'
import type { Vec3 } from '../document/types'
import type { Workplane } from '../store/store'

const tidy = (value: number, step: number): number => {
  const rounded = Number((Math.round(value / step) * step).toFixed(6))
  return Object.is(rounded, -0) ? 0 : rounded
}

/** A workplane from a clicked point and that face's outward normal (both in world space). */
export function workplaneFromHit(point: Vec3, normal: Vec3): Workplane {
  const origin: Vec3 = [tidy(point[0], 0.01), tidy(point[1], 0.01), tidy(point[2], 0.01)]
  const n = new Vector3(...normal)
  if (n.lengthSq() === 0) return { origin, rotation: [0, 0, 0] }
  const turn = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), n.normalize())
  const e = new Euler().setFromQuaternion(turn, 'XYZ')
  const deg = (radians: number): number => tidy((radians * 180) / Math.PI, 0.001)
  return { origin, rotation: [deg(e.x), deg(e.y), deg(e.z)] }
}

export interface PickableHit {
  readonly point: Vector3
  readonly face?: { readonly normal: Vector3 } | null
  readonly object: Object3D
}

function isInside(object: Object3D, within: Object3D): boolean {
  for (let o: Object3D | null = object; o; o = o.parent) if (o === within) return true
  return false
}

/**
 * The first hit that landed on a face, with its point and outward normal in world space.
 * With `within`, only hits on that object or its descendants count (not grids or other parts in front).
 */
export function pickFromIntersections(
  intersections: readonly PickableHit[], within?: Object3D,
): { point: Vec3; normal: Vec3 } | null {
  const hit = intersections.find((h) => h.face && (!within || isInside(h.object, within)))
  if (!hit?.face) return null
  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
  return { point: [hit.point.x, hit.point.y, hit.point.z], normal: [normal.x, normal.y, normal.z] }
}
