import type { Shape3D } from 'replicad'
import type { Transform } from '../document/types'

type Axis = [number, number, number]

/**
 * Applies a node transform. Matches three.js Euler 'XYZ' (matrix = Rx·Ry·Rz):
 * rotate about world Z, then Y, then X, then translate.
 * Consumes `shape` (replicad deletes the original on transform).
 */
export function placeShape(shape: Shape3D, t: Transform): Shape3D {
  const [rx, ry, rz] = t.rotation
  const steps: ReadonlyArray<[number, Axis]> = [[rz, [0, 0, 1]], [ry, [0, 1, 0]], [rx, [1, 0, 0]]]
  const rotated = steps.reduce<Shape3D>(
    (current, [angle, axis]) => (angle === 0 ? current : current.rotate(angle, [0, 0, 0], axis)),
    shape,
  )
  const [x, y, z] = t.position
  return x === 0 && y === 0 && z === 0 ? rotated : rotated.translate([x, y, z])
}
