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
 * Written in units of half the width and half the length. The curves leaving the point and the dip start at 45 degrees
 * in real millimetres, so both are square corners that Round edges can follow (the point and dip tilt by a few degrees
 * with an odd shape, and are kept sensible when the heart is very wide).
 */
export function heartOutline(width: number, length: number): OutlineStep[] {
  const sx = width / 2
  const sy = length / 2
  const p = (x: number, y: number): Point2 => [x * sx, y * sy]
  const tilt = sx / sy
  const pointY = -1 + Math.min(0.35 * tilt, 0.7)
  const dipY = 0.7 + Math.min(0.1 * tilt, 0.25)
  return [
    p(0, -1),
    { curve: [p(0.35, pointY), p(1, -0.1), p(1, 0.35)] },
    { curve: [p(1, 0.75), p(0.78, 1), p(0.5, 1)] },
    { curve: [p(0.22, 1), p(0.1, dipY), p(0, 0.7)] },
    { curve: [p(-0.1, dipY), p(-0.22, 1), p(-0.5, 1)] },
    { curve: [p(-0.78, 1), p(-1, 0.75), p(-1, 0.35)] },
    { curve: [p(-1, -0.1), p(-0.35, pointY), p(0, -1)] },
  ]
}
