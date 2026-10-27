import type { MeshData } from './types'
import { buildTriangleGrid } from './spatial-grid'

/** Print-check thresholds (millimetres unless noted). */
export const FLOAT_GAP = 0.05
export const OVERHANG_COS = Math.cos(Math.PI / 4)
export const PLATE_TOUCH = 0.05
export const MIN_OVERHANG_AREA = 4 // mm²
export const THIN_WALL = 0.8
export const VERY_THIN_WALL = 0.4
export const THIN_TIME_LIMIT_MS = 5000

/** Room for float error so a mathematically 45° slope isn't flagged. */
const COS_TOLERANCE = 1e-9
const INSIDE_NUDGE = 1e-4
const MIN_HIT_DISTANCE = 1e-3
const TIME_CHECK_EVERY = 500

/** Triangles wound counter-clockwise from outside, as replicad's `mesh()` returns them. */
export interface TriangleSoup {
  readonly vertices: ArrayLike<number>
  readonly triangles: ArrayLike<number>
}

type Vec = readonly [number, number, number]

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
]

function corners(soup: TriangleSoup, t: number): readonly [Vec, Vec, Vec] {
  const at = (corner: number): Vec => {
    const v = (soup.triangles[t * 3 + corner] ?? 0) * 3
    return [soup.vertices[v] ?? 0, soup.vertices[v + 1] ?? 0, soup.vertices[v + 2] ?? 0]
  }
  return [at(0), at(1), at(2)]
}

function triangleCount(soup: TriangleSoup): number {
  return Math.floor(soup.triangles.length / 3)
}

/** Unit outward normal and area; the normal is zero for a degenerate triangle. */
function faceOf(a: Vec, b: Vec, c: Vec): { readonly normal: Vec; readonly area: number } {
  const n = cross(sub(b, a), sub(c, a))
  const length = Math.hypot(n[0], n[1], n[2])
  return length === 0
    ? { normal: [0, 0, 0], area: 0 }
    : { normal: [n[0] / length, n[1] / length, n[2] / length], area: length / 2 }
}

const WELD_SCALE = 1e4

const weldKey = (p: Vec): string => p.map((v) => Math.round(v * WELD_SCALE)).join(',')

/** Groups triangles that share a corner position (welded by rounding, as faces don't share vertices). */
function connectedRegions(tris: readonly (readonly [Vec, Vec, Vec])[]): readonly (readonly number[])[] {
  const parent = tris.map((_, i) => i)
  const find = (i: number): number => {
    let node = i
    while (parent[node] !== node) {
      parent[node] = parent[parent[node]!]!
      node = parent[node]!
    }
    return node
  }
  const owner = new Map<string, number>()
  tris.forEach((tri, i) => tri.forEach((p) => {
    const key = weldKey(p)
    const seen = owner.get(key)
    if (seen === undefined) owner.set(key, i)
    else parent[find(i)] = find(seen)
  }))
  const regions = new Map<number, number[]>()
  tris.forEach((_, i) => {
    const root = find(i)
    const members = regions.get(root)
    if (members) members.push(i)
    else regions.set(root, [i])
  })
  return [...regions.values()]
}

/**
 * Down-facing triangles (steeper than 45°) in regions that don't touch the plate, and their total area.
 * A region that reaches the plate grows up from it (a sphere's or ring's underside), so it prints fine.
 */
export function overhangTriangles(
  soup: TriangleSoup, plateZ: number,
): { readonly picked: readonly number[]; readonly area: number } {
  const down: number[] = []
  const tris: (readonly [Vec, Vec, Vec])[] = []
  const areas: number[] = []
  for (let t = 0; t < triangleCount(soup); t++) {
    const tri = corners(soup, t)
    const face = faceOf(...tri)
    if (face.normal[2] >= -OVERHANG_COS - COS_TOLERANCE) continue
    down.push(t)
    tris.push(tri)
    areas.push(face.area)
  }
  const kept = connectedRegions(tris)
    .filter((region) => region.every((i) => tris[i]!.every((p) => p[2] > plateZ + PLATE_TOUCH)))
    .flat()
    .sort((x, y) => x - y)
  return { picked: kept.map((i) => down[i]!), area: kept.reduce((sum, i) => sum + areas[i]!, 0) }
}

/** Distance along `dir` from `origin` to the triangle, or null on a miss (Möller–Trumbore). */
function rayHit(origin: Vec, dir: Vec, a: Vec, b: Vec, c: Vec): number | null {
  const e1 = sub(b, a)
  const e2 = sub(c, a)
  const p = cross(dir, e2)
  const det = dot(e1, p)
  if (Math.abs(det) < 1e-12) return null
  const s = sub(origin, a)
  const u = dot(s, p) / det
  if (u < -1e-9 || u > 1 + 1e-9) return null
  const q = cross(s, e1)
  const v = dot(dir, q) / det
  if (v < -1e-9 || u + v > 1 + 1e-9) return null
  return dot(e2, q) / det
}

/**
 * Triangles with another surface closer than THIN_WALL straight behind them. Gives up
 * (`finished: false`) after THIN_TIME_LIMIT_MS, keeping what it found so far.
 */
export function thinTriangles(
  soup: TriangleSoup, now: () => number = () => performance.now(),
): { readonly picked: readonly number[]; readonly veryThin: boolean; readonly finished: boolean } {
  const count = triangleCount(soup)
  const tris = Array.from({ length: count }, (_, t) => corners(soup, t))
  const faces = tris.map(([a, b, c]) => faceOf(a, b, c))
  const started = now()
  const timedOut = () => now() - started > THIN_TIME_LIMIT_MS
  const grid = buildTriangleGrid(soup.vertices, soup.triangles, { shouldStop: timedOut })
  if (!grid) return { picked: [], veryThin: false, finished: false }
  const picked: number[] = []
  let veryThin = false
  for (let t = 0; t < count; t++) {
    if (t % TIME_CHECK_EVERY === 0 && timedOut()) {
      return { picked, veryThin, finished: false }
    }
    const [a, b, c] = tris[t]!
    const n = faces[t]!.normal
    if (n[0] === 0 && n[1] === 0 && n[2] === 0) continue
    const dir: Vec = [-n[0], -n[1], -n[2]]
    const origin: Vec = [
      (a[0] + b[0] + c[0]) / 3 + dir[0] * INSIDE_NUDGE,
      (a[1] + b[1] + c[1]) / 3 + dir[1] * INSIDE_NUDGE,
      (a[2] + b[2] + c[2]) / 3 + dir[2] * INSIDE_NUDGE,
    ]
    const end: Vec = [origin[0] + dir[0] * THIN_WALL, origin[1] + dir[1] * THIN_WALL, origin[2] + dir[2] * THIN_WALL]
    const lo = [0, 1, 2].map((k) => Math.min(origin[k]!, end[k]!))
    const hi = [0, 1, 2].map((k) => Math.max(origin[k]!, end[k]!))
    let nearest = Infinity
    grid.query(lo, hi, (other) => {
      if (other === t || dot(faces[other]!.normal, dir) <= 0) return
      const [oa, ob, oc] = tris[other]!
      const hit = rayHit(origin, dir, oa, ob, oc)
      if (hit !== null && hit > MIN_HIT_DISTANCE && hit < nearest) nearest = hit
    })
    if (nearest < THIN_WALL) {
      picked.push(t)
      if (nearest < VERY_THIN_WALL) veryThin = true
    }
  }
  return { picked, veryThin, finished: true }
}

/** Un-indexed copy of the picked triangles with flat face normals, ready to draw as a highlight. */
export function pickedMesh(soup: TriangleSoup, picked: readonly number[]): MeshData {
  const positions = new Float32Array(picked.length * 9)
  const normals = new Float32Array(picked.length * 9)
  picked.forEach((t, i) => {
    const tri = corners(soup, t)
    const { normal } = faceOf(...tri)
    tri.forEach((p, corner) => {
      positions.set(p, i * 9 + corner * 3)
      normals.set(normal, i * 9 + corner * 3)
    })
  })
  return {
    positions, normals, indices: Uint32Array.from({ length: picked.length * 3 }, (_, i) => i),
    edges: new Float32Array(0),
  }
}
