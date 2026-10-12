import { translateBox, type Axis, type Box } from '../document/box'
import type { Vec3 } from '../document/types'
import type { NamedBox } from './bounds'
import { formatMeasurement, measure } from './measure'
import { snapToObjects } from './object-snap'

export interface DragFeedback {
  /** How far to nudge the dragged part so it lines up with a neighbour (all zero when it doesn't snap). */
  readonly offset: Vec3
  /** The live measurement text shown while dragging. */
  readonly text: string
}

/**
 * Object snap plus the live measurement for a part being dragged.
 * `snapAxes` is null when snapping is off (Shift held, or not moving).
 */
export function dragFeedback(box: Box, others: readonly NamedBox[], snapAxes: readonly Axis[] | null): DragFeedback {
  const snap = snapAxes ? snapToObjects(box, others, snapAxes) : null
  const offset: Vec3 = snap?.offset ?? [0, 0, 0]
  const text = formatMeasurement(measure(translateBox(box, offset), others))
  return { offset, text: snap?.snappedTo ? `${text} · lined up with ${snap.snappedTo}` : text }
}
