/** Reads a binary STL into a (non-indexed) vertex/triangle list. */
export function parseBinaryStl(buffer: ArrayBuffer): { vertices: number[]; triangles: number[] } {
  const view = new DataView(buffer)
  const count = view.getUint32(80, true)
  const vertices: number[] = []
  for (let i = 0; i < count; i++) {
    const offset = 84 + i * 50 + 12
    for (let k = 0; k < 9; k++) vertices.push(view.getFloat32(offset + k * 4, true))
  }
  return { vertices, triangles: Array.from({ length: count * 3 }, (_, i) => i) }
}

/** Signed volume of a closed triangle mesh. */
export function meshVolume(vertices: readonly number[], triangles: readonly number[]): number {
  let sum = 0
  for (let i = 0; i + 2 < triangles.length; i += 3) {
    const [a, b, c] = [triangles[i] ?? 0, triangles[i + 1] ?? 0, triangles[i + 2] ?? 0].map((t) => [
      vertices[t * 3] ?? 0, vertices[t * 3 + 1] ?? 0, vertices[t * 3 + 2] ?? 0,
    ]) as [number[], number[], number[]]
    sum += ((a[0] ?? 0) * ((b[1] ?? 0) * (c[2] ?? 0) - (b[2] ?? 0) * (c[1] ?? 0))
      - (a[1] ?? 0) * ((b[0] ?? 0) * (c[2] ?? 0) - (b[2] ?? 0) * (c[0] ?? 0))
      + (a[2] ?? 0) * ((b[0] ?? 0) * (c[1] ?? 0) - (b[1] ?? 0) * (c[0] ?? 0))) / 6
  }
  return Math.abs(sum)
}
