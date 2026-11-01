import type { CurveStep } from '../cad-types'

/** k for a quarter ellipse drawn as one cubic Bézier. */
export const QUARTER = 0.5522847498

/**
 * Quarter ellipse centred on (cx, cy). Negative rx goes left.
 * With towardTop it runs from (cx + rx, cy) up to (cx, cy + ry); without, back down the same way.
 */
export function quarterEllipse(cx: number, cy: number, rx: number, ry: number, towardTop = true): CurveStep {
  return towardTop
    ? { curve: [[cx + rx, cy + QUARTER * ry], [cx + QUARTER * rx, cy + ry], [cx, cy + ry]] }
    : { curve: [[cx + QUARTER * rx, cy + ry], [cx + rx, cy + QUARTER * ry], [cx + rx, cy]] }
}
