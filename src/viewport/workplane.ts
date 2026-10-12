import { Euler, Quaternion, Vector3 } from 'three'
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
