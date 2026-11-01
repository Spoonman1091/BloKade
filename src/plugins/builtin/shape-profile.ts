import type { CurveStep, OutlineStep, Point2 } from '../cad-types'

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

const TAU = 2 * Math.PI

/** Regular polygon, corner to corner `diameter` wide, with a flat side at the front (−Y). */
export function polygonOutline(sides: number, diameter: number): Point2[] {
  const r = diameter / 2
  const start = -Math.PI / 2 + Math.PI / sides
  return Array.from({ length: sides }, (_, k): Point2 => {
    const angle = start + (k * TAU) / sides
    return [r * Math.cos(angle), r * Math.sin(angle)]
  })
}

/** Star with one outer point at the back (+Y); inner corners sit halfway between the outer ones. */
export function starOutline(points: number, diameter: number, inner: number): Point2[] {
  return Array.from({ length: points * 2 }, (_, i): Point2 => {
    const r = (i % 2 === 0 ? diameter : inner) / 2
    const angle = Math.PI / 2 + (i * Math.PI) / points
    return [r * Math.cos(angle), r * Math.sin(angle)]
  })
}

/**
 * Heart with its point at the front (−Y) and a dip at the back; the left half mirrors the right.
 * The point and the dip are made of straight sides, and each curve leaves a straight side along the same direction,
 * so no curve ever meets a corner. OpenCascade rounds these edges reliably, which it did not when curves met at the corners.
 */
export function heartOutline(width: number, length: number): OutlineStep[] {
  const sx = width / 2
  const sy = length / 2
  const p = (x: number, y: number): Point2 => [x * sx, y * sy]
  const mirror = (q: Point2): Point2 => [-q[0], q[1]]
  const along = (from: Point2, to: Point2, reach: number): Point2 => {
    const d = Math.hypot(to[0] - from[0], to[1] - from[1])
    return [to[0] + ((to[0] - from[0]) / d) * reach, to[1] + ((to[1] - from[1]) / d) * reach]
  }
  const tip = p(0, -1)
  const flank = p(0.75, -0.25) // where the straight side from the point turns into the curve
  const dip = p(0, 0.7)
  const reach = Math.min(0.14 * sx, 0.15 * sy)
  const lip = [reach, 0.7 * sy + reach] as const // where the curve turns into the straight side down to the dip
  const lobe: CurveStep = { curve: [along(tip, flank, 0.18 * length), p(1, 0.05), p(1, 0.35)] }
  const top: CurveStep = { curve: [p(1, 0.75), p(0.78, 1), p(0.5, 1)] }
  const shoulder: CurveStep = { curve: [p(0.24, 1), along(dip, lip, 0.06 * length), lip] }
  const flip = (step: CurveStep, from: Point2): CurveStep => ({
    curve: [mirror(step.curve[1]), mirror(step.curve[0]), mirror(from)],
  })
  return [
    tip,
    flank,
    lobe,
    top,
    shoulder,
    dip,
    mirror(lip),
    flip(shoulder, p(0.5, 1)),
    flip(top, p(1, 0.35)),
    flip(lobe, flank),
  ]
}
