import { binaryStl } from '../import/testing/stl-files'

export interface Raised { x: [number, number]; y: [number, number]; height: number }

type Point = readonly [number, number, number]

/** Sorted, de-duplicated grid lines so raised blocks share corners with the plate. */
function lines(ends: readonly [number, number], extra: readonly number[]): number[] {
  return [...new Set([ends[0], ends[1], ...extra.filter((v) => v > ends[0] && v < ends[1])])].sort((a, b) => a - b)
}

/** A flat plate on z = 0, centred on x and y, with raised blocks. Binary STL, watertight. */
export function plateStl(opts: { width: number; depth: number; base: number; raised?: readonly Raised[] }): ArrayBuffer {
  const raised = opts.raised ?? []
  const xs = lines([-opts.width / 2, opts.width / 2], raised.flatMap((r) => r.x))
  const ys = lines([-opts.depth / 2, opts.depth / 2], raised.flatMap((r) => r.y))
  const heightAt = (i: number, j: number): number => {
    if (i < 0 || j < 0 || i >= xs.length - 1 || j >= ys.length - 1) return 0
    const cx = ((xs[i] ?? 0) + (xs[i + 1] ?? 0)) / 2
    const cy = ((ys[j] ?? 0) + (ys[j + 1] ?? 0)) / 2
    const block = raised.find((r) => cx > r.x[0] && cx < r.x[1] && cy > r.y[0] && cy < r.y[1])
    return opts.base + (block?.height ?? 0)
  }
  const vertices: number[] = []
  const triangles: number[] = []
  const quad = (a: Point, b: Point, c: Point, d: Point): void => {
    const first = vertices.length / 3
    for (const p of [a, b, c, d]) vertices.push(...p)
    triangles.push(first, first + 1, first + 2, first, first + 2, first + 3)
  }
  // A wall on the plate's outer edge, from a to b, h tall. Its two ends get a vertex where the
  // neighbouring wall along the edge stops (m0 / m1), so no T-junction is left. `standard` picks the winding.
  const outerWall = (a: readonly [number, number], b: readonly [number, number], h: number, m0: number, m1: number, standard: boolean): void => {
    const at = (p: readonly [number, number], z: number): Point => [p[0], p[1], z]
    const ring: Point[] = [at(a, 0), at(b, 0)]
    if (m1 > 0 && m1 < h) ring.push(at(b, m1))
    ring.push(at(b, h), at(a, h))
    if (m0 > 0 && m0 < h) ring.push(at(a, m0))
    const ordered = standard ? ring : [...ring].reverse()
    if (ring.length === 4) return quad(...(ordered as [Point, Point, Point, Point]))
    const hub: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, h / 2]
    const first = vertices.length / 3
    for (const p of [hub, ...ordered]) vertices.push(...p)
    for (let k = 1; k <= ordered.length; k++) triangles.push(first, first + k, first + 1 + (k % ordered.length))
  }
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const [x0, x1, y0, y1] = [xs[i] ?? 0, xs[i + 1] ?? 0, ys[j] ?? 0, ys[j + 1] ?? 0]
      const h = heightAt(i, j)
      quad([x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h])
      quad([x0, y0, 0], [x0, y1, 0], [x1, y1, 0], [x1, y0, 0])
      // Walls toward +x / +y neighbours, facing out of the taller side. The plate's own outer edge counts as height 0.
      const right = heightAt(i + 1, j)
      if (i + 1 < xs.length - 1) {
        if (h > right) quad([x1, y0, right], [x1, y1, right], [x1, y1, h], [x1, y0, h])
        else if (right > h) quad([x1, y0, h], [x1, y0, right], [x1, y1, right], [x1, y1, h])
      } else {
        outerWall([x1, y0], [x1, y1], h, Math.min(h, heightAt(i, j - 1)), Math.min(h, heightAt(i, j + 1)), true)
      }
      const back = heightAt(i, j + 1)
      if (j + 1 < ys.length - 1) {
        if (h > back) quad([x0, y1, back], [x0, y1, h], [x1, y1, h], [x1, y1, back])
        else if (back > h) quad([x0, y1, h], [x1, y1, h], [x1, y1, back], [x0, y1, back])
      } else {
        outerWall([x0, y1], [x1, y1], h, Math.min(h, heightAt(i - 1, j)), Math.min(h, heightAt(i + 1, j)), false)
      }
      // The -x / -y outer edges (inner walls come from the neighbour).
      if (i === 0) outerWall([x0, y0], [x0, y1], h, Math.min(h, heightAt(i, j - 1)), Math.min(h, heightAt(i, j + 1)), false)
      if (j === 0) outerWall([x0, y0], [x1, y0], h, Math.min(h, heightAt(i - 1, j)), Math.min(h, heightAt(i + 1, j)), true)
    }
  }
  return binaryStl({ vertices, triangles })
}

/** The same file with the triangle at `index` cut out, so the surface has a gap. */
export function withoutTriangle(file: ArrayBuffer, index: number): ArrayBuffer {
  const header = 84
  const size = 50
  const bytes = new Uint8Array(file)
  const count = new DataView(file).getUint32(80, true)
  const out = new Uint8Array(header + (count - 1) * size)
  out.set(bytes.subarray(0, header))
  out.set(bytes.subarray(header, header + index * size), header)
  out.set(bytes.subarray(header + (index + 1) * size), header + index * size)
  new DataView(out.buffer).setUint32(80, count - 1, true)
  return out.buffer
}

export function triangleCountOf(file: ArrayBuffer): number {
  return new DataView(file).getUint32(80, true)
}
