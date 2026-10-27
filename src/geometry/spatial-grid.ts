/** Uniform grid of triangle indices, so a short ray only looks at nearby triangles. */
export interface TriangleGrid {
  /** Calls `visit` once for each triangle whose cells the box touches. */
  query(min: readonly number[], max: readonly number[], visit: (triangle: number) => void): void
}

export function buildTriangleGrid(
  vertices: ArrayLike<number>, triangles: ArrayLike<number>, cell = 1,
): TriangleGrid {
  const cells = new Map<string, number[]>()
  const count = Math.floor(triangles.length / 3)
  for (let t = 0; t < count; t++) {
    const lo = [Infinity, Infinity, Infinity]
    const hi = [-Infinity, -Infinity, -Infinity]
    for (let corner = 0; corner < 3; corner++) {
      const v = (triangles[t * 3 + corner] ?? 0) * 3
      for (let k = 0; k < 3; k++) {
        const value = vertices[v + k] ?? 0
        lo[k] = Math.min(lo[k] ?? value, value)
        hi[k] = Math.max(hi[k] ?? value, value)
      }
    }
    forEachCell(lo, hi, cell, (key) => {
      const list = cells.get(key)
      if (list) list.push(t)
      else cells.set(key, [t])
    })
  }
  const seenAt = new Int32Array(count).fill(-1)
  let queryId = 0
  return {
    query(min, max, visit) {
      queryId++
      forEachCell(min, max, cell, (key) => {
        for (const t of cells.get(key) ?? []) {
          if (seenAt[t] === queryId) continue
          seenAt[t] = queryId
          visit(t)
        }
      })
    },
  }
}

function forEachCell(
  lo: readonly number[], hi: readonly number[], cell: number, fn: (key: string) => void,
): void {
  const at = (values: readonly number[], k: number) => Math.floor((values[k] ?? 0) / cell)
  for (let i = at(lo, 0); i <= at(hi, 0); i++) {
    for (let j = at(lo, 1); j <= at(hi, 1); j++) {
      for (let k = at(lo, 2); k <= at(hi, 2); k++) fn(`${i},${j},${k}`)
    }
  }
}
