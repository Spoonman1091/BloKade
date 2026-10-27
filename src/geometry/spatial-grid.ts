/** Uniform grid of triangle indices, so a short ray only looks at nearby triangles. */
export interface TriangleGrid {
  /** Calls `visit` once for each triangle whose cells the box touches. */
  query(min: readonly number[], max: readonly number[], visit: (triangle: number) => void): void
}

export interface GridOptions {
  readonly cell?: number
  /** Asked every STOP_CHECK_EVERY triangles; true abandons the build. */
  readonly shouldStop?: () => boolean
  /** Abandon the build past this many (triangle, cell) entries. */
  readonly maxEntries?: number
}

const STOP_CHECK_EVERY = 500
const PLANE_MARGIN = 1e-9
export const DEFAULT_MAX_GRID_ENTRIES = 5_000_000

/**
 * Each triangle goes only into the cells its plane passes through, so the cell count grows
 * with surface area rather than bounding-box volume. Returns null if the build was abandoned.
 */
export function buildTriangleGrid(
  vertices: ArrayLike<number>, triangles: ArrayLike<number>, options: GridOptions = {},
): TriangleGrid | null {
  const { cell = 1, shouldStop, maxEntries = DEFAULT_MAX_GRID_ENTRIES } = options
  const cells = new Map<string, number[]>()
  const count = Math.floor(triangles.length / 3)
  let entries = 0
  const add = (key: string, t: number) => {
    const list = cells.get(key)
    if (list) list.push(t)
    else cells.set(key, [t])
    entries++
  }
  for (let t = 0; t < count; t++) {
    if (t % STOP_CHECK_EVERY === 0 && shouldStop?.()) return null
    registerTriangle(vertices, triangles, t, cell, (key) => add(key, t), () => entries > maxEntries)
    if (entries > maxEntries) return null
  }
  const seenAt = new Int32Array(count).fill(-1)
  let queryId = 0
  return {
    query(min, max, visit) {
      queryId++
      for (let i = at(min, 0, cell); i <= at(max, 0, cell); i++) {
        for (let j = at(min, 1, cell); j <= at(max, 1, cell); j++) {
          for (let k = at(min, 2, cell); k <= at(max, 2, cell); k++) {
            for (const t of cells.get(`${i},${j},${k}`) ?? []) {
              if (seenAt[t] === queryId) continue
              seenAt[t] = queryId
              visit(t)
            }
          }
        }
      }
    },
  }
}

const at = (values: readonly number[], k: number, cell: number) => Math.floor((values[k] ?? 0) / cell)

function registerTriangle(
  vertices: ArrayLike<number>, triangles: ArrayLike<number>, t: number, cell: number,
  add: (key: string) => void, overBudget: () => boolean,
): void {
  const p = [0, 1, 2].map((corner) => {
    const v = (triangles[t * 3 + corner] ?? 0) * 3
    return [vertices[v] ?? 0, vertices[v + 1] ?? 0, vertices[v + 2] ?? 0]
  })
  const [a, b, c] = p as [number[], number[], number[]]
  const e1 = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!]
  const e2 = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!]
  const n = [
    e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!,
  ]
  const abs = n.map(Math.abs)
  const m = abs[0]! >= abs[1]! && abs[0]! >= abs[2]! ? 0 : abs[1]! >= abs[2]! ? 1 : 2
  if (abs[m] === 0) return // no area: nothing to hit
  const [u, w] = [0, 1, 2].filter((k) => k !== m) as [number, number]
  const lo = [0, 1, 2].map((k) => Math.min(a[k]!, b[k]!, c[k]!))
  const hi = [0, 1, 2].map((k) => Math.max(a[k]!, b[k]!, c[k]!))
  const d = n[0]! * a[0]! + n[1]! * a[1]! + n[2]! * a[2]!
  const along = (x: number, y: number) => (d - n[u]! * x - n[w]! * y) / n[m]!
  const key = (i: number, j: number, k: number) => {
    const idx = [0, 0, 0]
    idx[m] = k; idx[u] = i; idx[w] = j
    return `${idx[0]},${idx[1]},${idx[2]}`
  }
  for (let i = Math.floor(lo[u]! / cell); i <= Math.floor(hi[u]! / cell); i++) {
    for (let j = Math.floor(lo[w]! / cell); j <= Math.floor(hi[w]! / cell); j++) {
      const xs = [Math.max(i * cell, lo[u]!), Math.min((i + 1) * cell, hi[u]!)]
      const ys = [Math.max(j * cell, lo[w]!), Math.min((j + 1) * cell, hi[w]!)]
      const zs = [along(xs[0]!, ys[0]!), along(xs[0]!, ys[1]!), along(xs[1]!, ys[0]!), along(xs[1]!, ys[1]!)]
      const zLo = Math.max(Math.min(...zs) - PLANE_MARGIN, lo[m]!)
      const zHi = Math.min(Math.max(...zs) + PLANE_MARGIN, hi[m]!)
      for (let k = Math.floor(zLo / cell); k <= Math.floor(zHi / cell); k++) add(key(i, j, k))
      if (overBudget()) return
    }
  }
}
