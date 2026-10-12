/** Merges vertices closer than `precision` and drops collapsed triangles. */
export function weldMesh(
  vertices: ArrayLike<number>, triangles: ArrayLike<number>, precision = 1e-4,
): { vertices: number[]; triangles: number[] } {
  const lookup = new Map<string, number>()
  const outVertices: number[] = []
  const remap: number[] = []
  for (let i = 0; i < vertices.length / 3; i++) {
    const xyz = [vertices[i * 3] ?? 0, vertices[i * 3 + 1] ?? 0, vertices[i * 3 + 2] ?? 0]
    const key = xyz.map((v) => Math.round(v / precision)).join(',')
    const existing = lookup.get(key)
    const index = existing ?? outVertices.length / 3
    if (existing === undefined) {
      lookup.set(key, index)
      outVertices.push(...xyz)
    }
    remap.push(index)
  }
  const outTriangles: number[] = []
  for (let i = 0; i + 2 < triangles.length; i += 3) {
    const [a, b, c] = [remap[triangles[i] ?? 0] ?? 0, remap[triangles[i + 1] ?? 0] ?? 0, remap[triangles[i + 2] ?? 0] ?? 0]
    if (a !== b && b !== c && a !== c) outTriangles.push(a, b, c)
  }
  return { vertices: outVertices, triangles: outTriangles }
}

/** Number of edges not shared by exactly two triangles (0 = watertight). */
export function countOpenEdges(triangles: ArrayLike<number>): number {
  const uses = new Map<string, number>()
  for (let i = 0; i + 2 < triangles.length; i += 3) {
    const t = [triangles[i] ?? 0, triangles[i + 1] ?? 0, triangles[i + 2] ?? 0]
    for (let k = 0; k < 3; k++) {
      const a = t[k] ?? 0
      const b = t[(k + 1) % 3] ?? 0
      const key = a < b ? `${a},${b}` : `${b},${a}`
      uses.set(key, (uses.get(key) ?? 0) + 1)
    }
  }
  return [...uses.values()].filter((count) => count !== 2).length
}
