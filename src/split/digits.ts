import type { CrossSection, ManifoldToplevel } from 'manifold-3d'

/** Digit shape, as fractions of its height. */
const WIDTH_RATIO = 0.55
const STROKE_RATIO = 0.15
const GAP_RATIO = 0.2

type Segment = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g'
type Rect = readonly [number, number, number, number] // x0, y0, x1, y1

/** Seven-segment strokes lit for each digit (a top, b top right, c bottom right, d bottom, e bottom left, f top left, g middle). */
const LIT: readonly (readonly Segment[])[] = [
  ['a', 'b', 'c', 'd', 'e', 'f'],
  ['b', 'c'],
  ['a', 'b', 'g', 'e', 'd'],
  ['a', 'b', 'g', 'c', 'd'],
  ['f', 'g', 'b', 'c'],
  ['a', 'f', 'g', 'c', 'd'],
  ['a', 'f', 'g', 'e', 'd', 'c'],
  ['a', 'b', 'c'],
  ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  ['a', 'b', 'c', 'd', 'f', 'g'],
]

function segmentRect(segment: Segment, w: number, h: number, t: number): Rect {
  const mid = h / 2
  switch (segment) {
    case 'a': return [0, h - t, w, h]
    case 'b': return [w - t, mid, w, h]
    case 'c': return [w - t, 0, w, mid]
    case 'd': return [0, 0, w, t]
    case 'e': return [0, 0, t, mid]
    case 'f': return [0, mid, t, h]
    case 'g': return [0, mid - t / 2, w, mid + t / 2]
  }
}

function rectPolygon([x0, y0, x1, y1]: Rect): [number, number][] {
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
}

/** The strokes of a whole number, digits left to right, lower-left corner at the origin. */
function strokes(n: number, height: number): Rect[] {
  const w = height * WIDTH_RATIO
  const t = height * STROKE_RATIO
  const step = w + height * GAP_RATIO
  return [...String(n)].flatMap((char, i) =>
    (LIT[Number(char)] ?? []).map((s): Rect => {
      const [x0, y0, x1, y1] = segmentRect(s, w, height, t)
      return [x0 + i * step, y0, x1 + i * step, y1]
    }),
  )
}

/**
 * Block (seven-segment) digits for a piece number, `height` tall, centred on the origin and
 * mirrored in x so they read right from underneath once the piece is turned over. Caller frees it.
 */
export function digitOutline(wasm: ManifoldToplevel, n: number, height: number): CrossSection {
  const joined = wasm.CrossSection.union(strokes(Math.max(0, Math.round(n)), height).map((r) => [rectPolygon(r)]))
  try {
    const { min, max } = joined.bounds()
    const centred = joined.translate([-(min[0] + max[0]) / 2, -(min[1] + max[1]) / 2])
    try {
      return centred.mirror([1, 0])
    } finally {
      centred.delete()
    }
  } finally {
    joined.delete()
  }
}
