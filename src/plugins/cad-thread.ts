import { makePolygon, makeSolid, type Face, type Shape3D } from 'replicad'

export const THREAD_SEGMENTS = 24
export const THREAD_ROWS_PER_PITCH = 6
export const THREAD_DEPTH_RATIO = 0.6
/** About 2 s to build at the limit (M6 × 40 mm). Longer threads would freeze the geometry engine. */
export const MAX_THREAD_TURNS = 40

type Point3 = [number, number, number]

const fmt = (n: number): string => String(Math.round(n * 100) / 100)

/** Distance from the axis at `u` pitches along the thread: root flat, rising flank, crest flat, falling flank, root flat. */
export function threadRadius(u: number, outer: number, depth: number): number {
  const t = ((u % 1) + 1) % 1
  const inner = outer - depth
  if (t < 0.1 || t >= 0.9) return inner
  if (t < 0.45) return inner + ((t - 0.1) / 0.35) * depth
  if (t < 0.55) return outer
  return outer - ((t - 0.55) / 0.35) * depth
}

function checkThread(diameter: number, pitch: number, length: number): void {
  const depth = pitch * THREAD_DEPTH_RATIO
  if (!(pitch > 0) || diameter / 2 - depth < 0.25) throw new Error('That thread is too fine for its size.')
  if (length / pitch > MAX_THREAD_TURNS) {
    throw new Error(`Threads can be up to ${MAX_THREAD_TURNS} turns long — that's ${fmt(MAX_THREAD_TURNS * pitch)} mm for this size. Make it shorter.`)
  }
}

/** Points of the rod's surface on a grid of angle steps (i) and height rows (j). */
function surfacePoint(diameter: number, pitch: number, length: number, rows: number) {
  const outer = diameter / 2
  const depth = pitch * THREAD_DEPTH_RATIO
  return (i: number, j: number): Point3 => {
    const angle = (2 * Math.PI * i) / THREAD_SEGMENTS
    const z = (length * j) / rows
    const r = threadRadius(z / pitch - i / THREAD_SEGMENTS, outer, depth)
    return [r * Math.cos(angle), r * Math.sin(angle), z]
  }
}

function threadFaces(diameter: number, pitch: number, length: number): Face[] {
  const rows = Math.max(1, Math.round((length / pitch) * THREAD_ROWS_PER_PITCH))
  const at = surfacePoint(diameter, pitch, length, rows)
  const sides = Array.from({ length: rows * THREAD_SEGMENTS }, (_, k) => {
    const i = k % THREAD_SEGMENTS
    const j = Math.floor(k / THREAD_SEGMENTS)
    const [a, b, c, d] = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]
    return [makePolygon([a, b, c]), makePolygon([a, c, d])]
  }).flat()
  const ring = (j: number): Point3[] => Array.from({ length: THREAD_SEGMENTS }, (_, i) => at(i, j))
  return [...sides, makePolygon(ring(0).reverse()), makePolygon(ring(rows))]
}

/** A metric-style threaded rod, centered on X/Y and sitting on z = 0, as one closed solid. */
export function makeThread(diameter: number, pitch: number, length: number): Shape3D {
  checkThread(diameter, pitch, length)
  const faces = threadFaces(diameter, pitch, length)
  try {
    return makeSolid(faces)
  } finally {
    for (const face of faces) face.delete()
  }
}
