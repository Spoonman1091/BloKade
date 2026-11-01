import type { CurveStep, OutlineStep, Point2, Point3 } from '../cad-types'

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

const PHI = (1 + Math.sqrt(5)) / 2

const ICOSAHEDRON_CORNERS: readonly Point3[] = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI],
  [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
]

const ICOSAHEDRON_TRIANGLES: readonly (readonly [number, number, number])[] = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
]

const cross = (a: Point3, b: Point3): Point3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const dot = (a: Point3, b: Point3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Turns every point about the origin so that `from` (a unit vector) ends up pointing straight down (Rodrigues' formula). */
function turnToDown(points: readonly Point3[], from: Point3): Point3[] {
  const axis = cross(from, [0, 0, -1])
  const sin = Math.hypot(axis[0], axis[1], axis[2])
  const cos = -from[2]
  if (sin < 1e-12) return points.map((p): Point3 => (cos > 0 ? p : [p[0], -p[1], -p[2]]))
  const k: Point3 = [axis[0] / sin, axis[1] / sin, axis[2] / sin]
  return points.map((p): Point3 => {
    const kp = cross(k, p)
    const along = dot(k, p) * (1 - cos)
    return [
      p[0] * cos + kp[0] * sin + k[0] * along,
      p[1] * cos + kp[1] * sin + k[1] * along,
      p[2] * cos + kp[2] * sin + k[2] * along,
    ]
  })
}

/** Icosahedron `diameter` across corner to corner, resting on a flat face with its centre on the Z axis. */
export function icosahedronOnFace(diameter: number): {
  points: Point3[]
  triangles: readonly (readonly [number, number, number])[]
} {
  const scale = diameter / 2 / Math.hypot(1, PHI)
  const scaled = ICOSAHEDRON_CORNERS.map((p): Point3 => [p[0] * scale, p[1] * scale, p[2] * scale])
  const face = [3, 9, 4].map((i) => scaled[i] as Point3)
  const sum = face.reduce((acc, p): Point3 => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0] as Point3)
  const length = Math.hypot(sum[0], sum[1], sum[2])
  const turned = turnToDown(scaled, [sum[0] / length, sum[1] / length, sum[2] / length])
  const lowest = Math.min(...turned.map((p) => p[2]))
  return { points: turned.map((p): Point3 => [p[0], p[1], p[2] - lowest]), triangles: ICOSAHEDRON_TRIANGLES }
}
