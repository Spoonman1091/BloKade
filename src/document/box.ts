import type { Vec3 } from './types'

/** An axis-aligned box in world millimetres. */
export interface Box {
  readonly min: Vec3
  readonly max: Vec3
}

export type Axis = 0 | 1 | 2
export type BoxEdge = 'min' | 'center' | 'max'

const AXES = [0, 1, 2] as const
const each = (fn: (axis: Axis) => number): Vec3 => [fn(0), fn(1), fn(2)]

export const boxSize = (b: Box): Vec3 => each((i) => b.max[i] - b.min[i])
export const boxCenter = (b: Box): Vec3 => each((i) => (b.min[i] + b.max[i]) / 2)

export function boxEdge(b: Box, axis: Axis, edge: BoxEdge): number {
  if (edge === 'min') return b.min[axis]
  if (edge === 'max') return b.max[axis]
  return (b.min[axis] + b.max[axis]) / 2
}

export function unionBox(boxes: readonly Box[]): Box | null {
  const [first, ...rest] = boxes
  if (!first) return null
  return rest.reduce<Box>((acc, b) => ({
    min: each((i) => Math.min(acc.min[i], b.min[i])),
    max: each((i) => Math.max(acc.max[i], b.max[i])),
  }), first)
}

export const translateBox = (b: Box, offset: Vec3): Box =>
  ({ min: each((i) => b.min[i] + offset[i]), max: each((i) => b.max[i] + offset[i]) })

/** Shortest distance between two boxes; 0 when they touch or overlap. */
export function boxGap(a: Box, b: Box): number {
  return Math.hypot(...AXES.map((i) => Math.max(0, a.min[i] - b.max[i], b.min[i] - a.max[i])))
}
