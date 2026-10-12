import { boxEdge, type Axis, type Box, type BoxEdge } from '../document/box'
import type { Vec3 } from '../document/types'
import type { NamedBox } from './bounds'

/** How close (mm) an edge or center must come to another part's before it snaps. */
export const SNAP_DISTANCE = 2

export interface SnapResult {
  readonly offset: Vec3
  readonly snappedTo: string | null
}

interface Candidate {
  readonly delta: number
  readonly name: string
}

const PAIRS: readonly (readonly [BoxEdge, BoxEdge])[] = [
  ['min', 'min'], ['min', 'max'], ['max', 'min'], ['max', 'max'], ['center', 'center'],
]

const closer = (a: Candidate | null, b: Candidate | null): Candidate | null =>
  a === null || (b !== null && Math.abs(b.delta) < Math.abs(a.delta)) ? b : a

function bestOnAxis(target: Box, others: readonly NamedBox[], axis: Axis, threshold: number): Candidate | null {
  const candidates = others.flatMap((other) => PAIRS.map(([mine, theirs]) => ({
    delta: boxEdge(other.box, axis, theirs) - boxEdge(target, axis, mine),
    name: other.name,
  })))
  return candidates.filter((c) => Math.abs(c.delta) <= threshold).reduce<Candidate | null>(closer, null)
}

/** Nudges a dragged part so a face or its center lines up with a nearby part's, on the axes being dragged. */
export function snapToObjects(
  target: Box, others: readonly NamedBox[], axes: readonly Axis[], threshold: number = SNAP_DISTANCE,
): SnapResult {
  const picks = new Map(axes.map((axis) => [axis, bestOnAxis(target, others, axis, threshold)] as const))
  const deltaOn = (axis: Axis): number => picks.get(axis)?.delta ?? 0
  const nearest = [...picks.values()].reduce<Candidate | null>(closer, null)
  return { offset: [deltaOn(0), deltaOn(1), deltaOn(2)], snappedTo: nearest?.name ?? null }
}

/** Which world axes a move handle drags ("X", "XY", "XYZ"…). Rotation handles ("E", "XYZE") move none. */
export function axesOf(handle: string | null | undefined): Axis[] {
  if (!handle || handle.includes('E')) return []
  return ([0, 1, 2] as const).filter((axis) => handle.includes('XYZ'.charAt(axis)))
}
